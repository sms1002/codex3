const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const assert = require('node:assert/strict');

app.whenReady().then(async () => {
  try {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const errors = [];
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(message);
  });

  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  const csv = await fs.readFile(path.join(__dirname, '..', 'data', 'sample_student_data.csv'), 'utf8');
  const state = await win.webContents.executeJavaScript(`(() => {
    const parsed = Csv.parse(${JSON.stringify(csv)});
    columns = parsed.columns;
    sourceData = parsed.rows;
    window.dispatchEvent(new Event('dataset:loaded'));
    document.querySelector('#emptyState').classList.add('hidden');
    document.querySelector('#dashboard').classList.remove('hidden');
    document.querySelector('#fileName').textContent = 'sample_student_data.csv';
    renderDashboard();
    preprocess();
    window.scrollTo(0, 0);
    const analysisChecks = [];
    for (const [method, x, y] of [['describe','시험점수',''],['welch','성별','시험점수'],['anova','학년','시험점수'],['pearson','공부시간','시험점수'],['spearman','공부시간','시험점수'],['regression','공부시간','시험점수'],['chi','성별','학년']]) {
      document.querySelector('#analysisMethod').value = method;
      StatAnalysisUI.updateVariables();
      document.querySelector('#analysisX').value = x;
      if (y) document.querySelector('#analysisY').value = y;
      document.querySelector('#analyzeButton').click();
      analysisChecks.push({ method, error: document.querySelector('#analysisError').textContent, visible: !document.querySelector('#analysisResult').classList.contains('hidden'), report: StatAnalysisUI.reportHtml()?.includes('data:image/png') });
    }
    document.querySelector('#analysisMethod').value = 'regression';
    StatAnalysisUI.updateVariables();
    document.querySelector('#analysisX').value = '공부시간';
    document.querySelector('#analysisY').value = '시험점수';
    document.querySelector('#analyzeButton').click();
    return {
      analysisChecks,
      title: document.title,
      heading: document.querySelector('h1')?.textContent,
      sourceRows: sourceData.length,
      cleanedRows: cleanedData.length,
      resultVisible: !document.querySelector('#resultPanel').classList.contains('hidden'),
      desktopApiReady: typeof window.desktopAPI?.openCsv === 'function'
    };
  })()`);
  state.analysisChecks.forEach(check => { assert.equal(check.error, '', check.method); assert.ok(check.visible && check.report, check.method); });
  assert.equal(state.desktopApiReady, true);
  await win.webContents.executeJavaScript('window.scrollTo(0,0)');
  const image = await win.capturePage();
  await fs.writeFile(path.join(__dirname, 'desktop-smoke.png'), image.toPNG());
  await win.webContents.executeJavaScript("document.querySelector('#analysisResult').scrollIntoView({block:'start'})");
  await fs.writeFile(path.join(__dirname, 'analysis-result.png'), (await win.capturePage()).toPNG());
  const report = await win.webContents.executeJavaScript('StatAnalysisUI.reportHtml()');
  await fs.writeFile(path.join(__dirname, 'sample-analysis-report.html'), report, 'utf8');
  const reset = await win.webContents.executeJavaScript(`(() => { sourceData = [{newColumn:1},{newColumn:2}]; columns = ['newColumn']; cleanedData = []; window.dispatchEvent(new Event('dataset:loaded')); return { hidden: document.querySelector('#analysisResult').classList.contains('hidden'), disabled: document.querySelector('#analysisSource').options[1].disabled, emptyReport: StatAnalysisUI.reportHtml() === null }; })()`);
  assert.ok(reset.hidden && reset.disabled && reset.emptyReport);
  assert.equal(errors.length, 0);
  await fs.writeFile(path.join(__dirname, 'smoke-result.json'), JSON.stringify({ ...state, errors }, null, 2));
    app.quit();
  } catch (error) {
    await fs.writeFile(path.join(__dirname, 'smoke-result.json'), JSON.stringify({ error: error.stack || String(error) }, null, 2));
    app.exit(1);
  }
});
