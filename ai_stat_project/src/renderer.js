/* global Csv */
let sourceData = [];
let columns = [];
let cleanedData = [];

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const isMissing = (value) => value === null || value === undefined || String(value).trim() === '';

function numericValue(value) {
  if (isMissing(value)) return null;
  const text = String(value).trim().replaceAll(',', '');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function isNumericColumn(column, rows = sourceData) {
  const values = rows.map((row) => row[column]).filter((value) => !isMissing(value));
  return values.length > 0 && values.every((value) => numericValue(value) !== null);
}

function isDateColumn(column) {
  const values = sourceData.map((row) => row[column]).filter((value) => !isMissing(value));
  if (!values.length) return false;
  const dateLike = /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})(?:\s.*)?$/;
  return values.filter((value) => dateLike.test(String(value).trim()) && !Number.isNaN(Date.parse(value))).length / values.length >= 0.8;
}

function classifyColumn(column) {
  if (isNumericColumn(column)) {
    const unique = new Set(sourceData.map((row) => row[column]).filter((value) => !isMissing(value))).size;
    if (unique <= 10 && unique / Math.max(sourceData.length, 1) < 0.05) return '범주형(숫자 코드 가능)';
    return '수치형';
  }
  return isDateColumn(column) ? '날짜형' : '범주형';
}

function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function outlierInfo(column, rows = sourceData) {
  const values = rows.map((row) => numericValue(row[column])).filter((value) => value !== null).sort((a, b) => a - b);
  if (!values.length) return { count: 0, lower: NaN, upper: NaN };
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const count = rows.filter((row) => { const n = numericValue(row[column]); return n !== null && (n < lower || n > upper); }).length;
  return { count, lower, upper };
}

function table(headers, rows, cellRenderer = (value) => escapeHtml(value)) {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const body = rows.map((row) => `<tr>${headers.map((header) => `<td>${cellRenderer(row[header], header)}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}">표시할 데이터가 없습니다.</td></tr>`}</tbody></table>`;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

async function openCsv() {
  const file = await window.desktopAPI.openCsv();
  if (!file) return;
  const parsed = Csv.parse(file.content);
  if (!parsed.columns.length || !parsed.rows.length) {
    showToast('읽을 수 있는 데이터가 없습니다.');
    return;
  }
  columns = parsed.columns;
  sourceData = parsed.rows;
  cleanedData = [];
  window.dispatchEvent(new Event('dataset:loaded'));
  $('#fileName').textContent = file.name;
  $('#fileMeta').textContent = `${sourceData.length.toLocaleString()}행 × ${columns.length.toLocaleString()}열`;
  $('#emptyState').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
  $('#resultPanel').classList.add('hidden');
  renderDashboard();
  showToast('CSV 파일을 불러왔습니다.');
}

function renderDashboard() {
  const missingTotal = sourceData.reduce((sum, row) => sum + columns.filter((column) => isMissing(row[column])).length, 0);
  const numericColumns = columns.filter((column) => isNumericColumn(column));
  const outlierTotal = numericColumns.reduce((sum, column) => sum + outlierInfo(column).count, 0);
  $('#metricCards').innerHTML = [['전체 행', sourceData.length.toLocaleString()], ['변수', columns.length.toLocaleString()], ['결측치', missingTotal.toLocaleString()], ['이상치 후보', outlierTotal.toLocaleString()]].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
  $('#previewCount').textContent = `상위 ${Math.min(20, sourceData.length)}행`;
  $('#previewTable').innerHTML = table(columns, sourceData.slice(0, 20));
  const types = columns.map((column) => ({ 변수: column, '판별 유형': classifyColumn(column) }));
  $('#typeTable').innerHTML = table(['변수', '판별 유형'], types, (value, key) => key === '판별 유형' ? `<span class="type-pill ${value.includes('범주') ? 'category' : value.includes('날짜') ? 'date' : ''}">${escapeHtml(value)}</span>` : escapeHtml(value));
  const missing = columns.map((column) => { const count = sourceData.filter((row) => isMissing(row[column])).length; return { 변수: column, '결측치 개수': count, '결측치 비율(%)': ((count / sourceData.length) * 100).toFixed(2) }; });
  $('#missingTable').innerHTML = table(['변수', '결측치 개수', '결측치 비율(%)'], missing);
  const outliers = numericColumns.map((column) => { const info = outlierInfo(column); return { 변수: column, '이상치 개수': info.count, 하한: info.lower.toFixed(4), 상한: info.upper.toFixed(4) }; });
  $('#outlierTable').innerHTML = table(['변수', '이상치 개수', '하한', '상한'], outliers);
}

function mode(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function preprocess() {
  const originalRows = sourceData.length;
  const actions = [];
  const seen = new Set();
  let rows = sourceData.map((row) => ({ ...row })).filter((row) => {
    const key = JSON.stringify(columns.map((column) => row[column]));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const duplicates = originalRows - rows.length;
  if (duplicates) actions.push(`중복 행 ${duplicates}개 제거`);

  const missingMethod = $('#missingMethod').value;
  if (missingMethod === 'drop') {
    const before = rows.length;
    rows = rows.filter((row) => columns.every((column) => !isMissing(row[column])));
    actions.push(`결측치가 있는 행 ${before - rows.length}개 제거`);
  } else if (missingMethod === 'median_mode') {
    columns.forEach((column) => {
      const count = rows.filter((row) => isMissing(row[column])).length;
      if (!count) return;
      const nonMissing = rows.map((row) => row[column]).filter((value) => !isMissing(value));
      const numeric = nonMissing.length > 0 && nonMissing.every((value) => numericValue(value) !== null);
      const replacement = numeric ? quantile(nonMissing.map(numericValue).sort((a, b) => a - b), 0.5) : mode(nonMissing);
      if (replacement !== undefined) {
        rows.forEach((row) => { if (isMissing(row[column])) row[column] = replacement; });
        actions.push(numeric ? `${column}: 결측치 ${count}개를 중앙값 ${replacement}로 대체` : `${column}: 결측치 ${count}개를 최빈값 '${replacement}'로 대체`);
      }
    });
  } else actions.push('결측치를 별도로 처리하지 않음');

  const numericColumns = columns.filter((column) => isNumericColumn(column, rows));
  const outlierMethod = $('#outlierMethod').value;
  if (outlierMethod === 'clip') {
    numericColumns.forEach((column) => {
      const info = outlierInfo(column, rows);
      if (!info.count) return;
      rows.forEach((row) => { const n = numericValue(row[column]); if (n !== null) row[column] = Math.min(info.upper, Math.max(info.lower, n)); });
      actions.push(`${column}: 이상치 ${info.count}개를 IQR 경계값으로 조정`);
    });
  } else if (outlierMethod === 'remove') {
    const infos = Object.fromEntries(numericColumns.map((column) => [column, outlierInfo(column, rows)]));
    numericColumns.forEach((column) => { if (infos[column].count) actions.push(`${column}: IQR 기준 이상치 후보 ${infos[column].count}개 발견`); });
    const before = rows.length;
    rows = rows.filter((row) => numericColumns.every((column) => { const n = numericValue(row[column]); return n === null || (n >= infos[column].lower && n <= infos[column].upper); }));
    actions.push(`이상치가 포함된 행 총 ${before - rows.length}개 제거`);
  } else actions.push('이상치를 별도로 처리하지 않음');

  cleanedData = rows;
  window.dispatchEvent(new Event('dataset:cleaned'));
  $('#resultMetrics').innerHTML = [['원본 행 수', originalRows], ['전처리 후 행 수', rows.length], ['제거된 행 수', originalRows - rows.length]].map(([label, value]) => `<div><span>${label}</span><strong>${value.toLocaleString()}</strong></div>`).join('');
  $('#actionLog').innerHTML = actions.map((action) => `<span>✓ ${escapeHtml(action)}</span>`).join('');
  $('#resultTable').innerHTML = table(columns, rows.slice(0, 50));
  $('#resultPanel').classList.remove('hidden');
  $('#resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveResult() {
  const content = Csv.unparse(columns, cleanedData);
  const savedPath = await window.desktopAPI.saveCsv({ content, defaultName: 'cleaned_data.csv' });
  if (savedPath) showToast('전처리 결과를 저장했습니다.');
}

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-item,.page-section').forEach((element) => element.classList.remove('active'));
  button.classList.add('active');
  $(`#${button.dataset.section}`).classList.add('active');
}));
$('#openButton').addEventListener('click', openCsv);
$('#changeFileButton').addEventListener('click', openCsv);
$('#runButton').addEventListener('click', preprocess);
$('#saveButton').addEventListener('click', saveResult);
