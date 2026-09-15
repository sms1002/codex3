const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: '#07111f',
    title: 'AI 통계 분석 도우미',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

ipcMain.handle('csv:open', async () => {
  const result = await dialog.showOpenDialog({
    title: '분석할 CSV 파일 선택',
    properties: ['openFile'],
    filters: [{ name: 'CSV 파일', extensions: ['csv'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const buffer = await fs.readFile(filePath);
  let content;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    content = new TextDecoder('euc-kr').decode(buffer);
  }
  return { content, name: path.basename(filePath), filePath };
});

ipcMain.handle('csv:save', async (_event, { content, defaultName }) => {
  const result = await dialog.showSaveDialog({
    title: '전처리 결과 저장',
    defaultPath: defaultName || 'cleaned_data.csv',
    filters: [{ name: 'CSV 파일', extensions: ['csv'] }]
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, `\uFEFF${content}`, 'utf8');
  return result.filePath;
});

ipcMain.handle('report:save', async (_event, { content }) => {
  if (typeof content !== 'string' || content.length > 20000000) throw new Error('보고서 크기를 확인하세요.');
  const result = await dialog.showSaveDialog({ title: '분석 보고서 저장', defaultPath: 'statistical_report.html', filters: [{ name: 'HTML 보고서', extensions: ['html'] }] });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, content, 'utf8');
  return result.filePath;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
