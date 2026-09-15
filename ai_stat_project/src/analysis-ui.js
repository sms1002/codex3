/* global StatAnalysis, sourceData, cleanedData, columns, $, escapeHtml, table, showToast */
(() => {
  'use strict';
  const titles = { describe: '기술통계', welch: '독립 두 집단 · Welch t검정', anova: '일원분산분석 (ANOVA)', pearson: 'Pearson 상관분석', spearman: 'Spearman 순위 상관분석', regression: '단순 선형회귀분석', chi: '카이제곱 독립성 검정' };
  const fmt = v => v === null || v === undefined ? '—' : Math.abs(v) >= 1e7 || (v !== 0 && Math.abs(v) < .0001) ? v.toExponential(3) : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
  const pFmt = p => p < .0001 ? '< 0.0001' : fmt(p);
  let lastResult = null;
  const rows = () => $('#analysisSource').value === 'cleaned' ? cleanedData : sourceData;
  function invalidate() { lastResult = null; $('#analysisResult').classList.add('hidden'); $('#analysisError').textContent = ''; }
  function setOptions(selector, items, preferred) {
    const el = $(selector); el.innerHTML = items.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}${p.numeric ? ' · 숫자' : ''}</option>`).join('');
    if (items.some(p => p.name === preferred)) el.value = preferred;
  }
  function updateVariables() {
    invalidate(); const method = $('#analysisMethod').value, profiles = StatAnalysis.profile(rows(), columns), numeric = profiles.filter(p => p.numeric);
    const grouped = ['welch', 'anova', 'chi'].includes(method);
    const previousX = $('#analysisX').value, previousY = $('#analysisY').value;
    setOptions('#analysisX', grouped ? profiles : numeric, previousX);
    setOptions('#analysisY', method === 'chi' ? profiles : numeric, previousY);
    if ($('#analysisX').value === $('#analysisY').value) { const alternative = [...$('#analysisY').options].find(o => o.value !== $('#analysisX').value); if (alternative) $('#analysisY').value = alternative.value; }
    $('#analysisXLabel').textContent = grouped ? (method === 'chi' ? '범주형 변수 X' : '집단 변수') : method === 'regression' ? '설명 변수 X' : '수치형 변수 X';
    $('#analysisYLabel').textContent = method === 'chi' ? '범주형 변수 Y' : '결과 변수 Y (숫자)';
    $('#analysisYWrap').classList.toggle('hidden', method === 'describe');
    $('#analysisHint').textContent = `${rows().length.toLocaleString()}행 기준 · ${method === 'describe' ? '평균, 중앙값, 표준편차, 사분위수와 분포를 확인합니다.' : '선택한 변수의 결측 행만 제외합니다. 검정은 유의수준 0.05를 사용하며 t검정·상관·회귀는 양측 검정입니다.'}${$('#analysisSource').value === 'cleaned' ? ' 결측치 대체·이상치 처리로 검정 결과가 바뀔 수 있으므로 원본 결과와 비교하세요.' : ''}`;
    $('#analyzeButton').disabled = !rows().length || !$('#analysisX').value || (method !== 'describe' && !$('#analysisY').value);
  }
  function recommendations() {
    const p = StatAnalysis.profile(rows(), columns), nums = p.filter(v => v.numeric), proposals = [];
    if (nums.length) proposals.push({ method: 'describe', x: nums[0].name, text: `${nums[0].name} 분포 요약` });
    // Prefer text categories, then low-cardinality numeric codes; users confirm roles.
    const candidates = p.filter(v => v.unique >= 2 && v.unique <= 10).sort((a, b) => Number(a.numeric) - Number(b.numeric));
    for (const g of candidates) {
      const outcome = nums.find(v => v.name !== g.name && v.unique > g.unique);
      if (outcome) { proposals.push({ method: g.unique === 2 ? 'welch' : 'anova', x: g.name, y: outcome.name, text: `${g.name}별 ${outcome.name} 평균 비교` }); break; }
    }
    const continuous = nums.filter(v => v.unique > 10), pair = continuous.length >= 2 ? continuous : nums;
    if (pair.length >= 2) proposals.push({ method: 'pearson', x: pair[0].name, y: pair[1].name, text: `${pair[0].name} ↔ ${pair[1].name} 관계` });
    if (candidates.length >= 2) proposals.push({ method: 'chi', x: candidates[0].name, y: candidates[1].name, text: `${candidates[0].name} × ${candidates[1].name} 범주 관계` });
    $('#recommendations').replaceChildren();
    proposals.forEach(proposal => { const button = document.createElement('button'); button.className = 'secondary-button'; button.textContent = `추천 · ${proposal.text}`; button.addEventListener('click', () => { $('#analysisMethod').value = proposal.method; updateVariables(); $('#analysisX').value = proposal.x; if (proposal.y) $('#analysisY').value = proposal.y; }); $('#recommendations').append(button); });
    if (proposals.length) { const note = document.createElement('small'); note.className = 'analysis-help'; note.textContent = '추천은 값의 유형·범주 수에 따른 후보입니다. 변수의 의미와 연구 설계를 확인하세요.'; $('#recommendations').append(note); }
  }
  function interpretation(r) {
    const lines = [];
    if (r.method === 'describe') { const d = r.summaries[0]; lines.push(`${r.x}의 평균은 ${fmt(d.mean)}, 중앙값은 ${fmt(d.median)}입니다. 최솟값 ${fmt(d.min)}부터 최댓값 ${fmt(d.max)} 사이에 분포합니다.`); lines.push(`가운데 50%의 값은 ${fmt(d.q1)}~${fmt(d.q3)} 구간에 있습니다. 기술통계는 데이터를 요약하며 가설검정을 수행하지 않습니다.`); }
    else {
      const significant = r.p < .05;
      lines.push(`p-value ${pFmt(r.p)}: 유의수준 0.05에서 ${significant ? '통계적으로 유의한 결과입니다.' : '통계적으로 유의하다고 판단할 근거가 부족합니다. 차이·관계가 없다는 증명은 아닙니다.'}`);
      if (r.method === 'welch') { const [a, b] = r.summaries; lines.push(`${a.name} 평균 ${fmt(a.mean)}, ${b.name} 평균 ${fmt(b.mean)}입니다. 평균 차이(${a.name} − ${b.name})의 95% 신뢰구간은 ${fmt(r.ci[0])}~${fmt(r.ci[1])}입니다.`); }
      if (r.method === 'anova') lines.push(significant ? '적어도 한 집단의 모집단 평균이 다르다는 근거가 있습니다. 모든 집단이 서로 다르다는 뜻은 아닙니다.' : '현재 데이터로 집단 평균의 차이를 확인하지 못했습니다. 표본 수와 집단별 분포도 확인하세요.');
      if (['pearson', 'spearman'].includes(r.method)) lines.push(`상관계수는 ${fmt(r.r)}로 ${r.r > 0 ? '양의' : r.r < 0 ? '음의' : '0인'} 관계가 관찰됩니다. 관계의 실질적인 중요성은 분야와 데이터에 따라 판단하세요.`);
      if (r.method === 'regression') { lines.push(`회귀식: ${r.y} = ${fmt(r.intercept)} + (${fmt(r.slope)}) × ${r.x}. X가 1 증가할 때 모델의 Y 예측값은 ${fmt(r.slope)}만큼 변합니다.`); lines.push(`표본 내 Y 변동의 약 ${fmt(r.r ** 2 * 100)}%를 설명합니다. 기울기의 95% 신뢰구간은 ${fmt(r.ci[0])}~${fmt(r.ci[1])}입니다. 관측 범위 밖 예측에는 주의가 필요합니다.`); }
      if (r.method === 'chi') lines.push(r.sparse ? '기대도수가 작은 칸이 있어 이 유의성 판단은 잠정적입니다. 아래 확인 사항을 읽어주세요.' : significant ? '두 범주형 변수의 독립성 가설에 반하는 근거가 있습니다.' : '두 범주형 변수의 관련성을 확인할 근거가 부족합니다.');
      lines.push('p-value는 효과의 크기나 가설이 참일 확률이 아닙니다. 표본 수와 효과 크기를 함께 확인하세요.');
    }
    return lines;
  }
  function resultTable(r) {
    if (r.contingency) { const { labelsX, labelsY, cells } = r.contingency; return `<table><thead><tr><th>${escapeHtml(r.x)} / ${escapeHtml(r.y)}</th>${labelsY.map(v => `<th>${escapeHtml(v)}</th>`).join('')}</tr></thead><tbody>${labelsX.map((v, i) => `<tr><td>${escapeHtml(v)}</td>${cells[i].map(n => `<td>${n}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
    return table(['변수 / 집단', 'N', '평균', '표준편차', '최솟값', 'Q1', '중앙값', 'Q3', '최댓값'], r.summaries.map(d => ({ '변수 / 집단': d.name, N: d.n, 평균: fmt(d.mean), 표준편차: fmt(d.sd), 최솟값: fmt(d.min), Q1: fmt(d.q1), 중앙값: fmt(d.median), Q3: fmt(d.q3), 최댓값: fmt(d.max) })));
  }
  function drawChart(r) {
    const canvas = $('#analysisChart'), ctx = canvas.getContext('2d'), W = 1000, H = 380, left = 95, right = 955, top = 28, bottom = 300;
    ctx.fillStyle = '#0a1523'; ctx.fillRect(0, 0, W, H); ctx.font = '13px Segoe UI, sans-serif';
    const shorten = s => String(s).length > 18 ? `${String(s).slice(0, 17)}…` : String(s);
    function axes(min, max) { if (max === min) { min -= 1; max += 1; } const scale = v => bottom - (v - min) / (max - min) * (bottom - top); for (let i = 0; i <= 4; i++) { const v = min + (max - min) * i / 4, y = scale(v); ctx.strokeStyle = '#23374a'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); ctx.fillStyle = '#aabbd0'; ctx.textAlign = 'right'; ctx.fillText(fmt(v), left - 10, y + 4); } return scale; }
    let caption;
    if (r.points) {
      const a = r.summaries[0], b = r.summaries[1], sx = v => left + (v - a.min) / (a.max - a.min) * (right - left), sy = axes(b.min, b.max);
      const step = Math.max(1, Math.ceil(r.points.length / 3000)); ctx.fillStyle = '#4ce3a199';
      for (let i = 0; i < r.points.length; i += step) { ctx.beginPath(); ctx.arc(sx(r.points[i][0]), sy(r.points[i][1]), 3.5, 0, Math.PI * 2); ctx.fill(); }
      if (r.method === 'regression') { ctx.save(); ctx.beginPath(); ctx.rect(left, top, right - left, bottom - top); ctx.clip(); ctx.strokeStyle = '#ffc66b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(a.min), sy(r.intercept + r.slope * a.min)); ctx.lineTo(sx(a.max), sy(r.intercept + r.slope * a.max)); ctx.stroke(); ctx.restore(); }
      ctx.fillStyle = '#aabbd0'; ctx.textAlign = 'center'; for (let i = 0; i <= 4; i++) { const v = a.min + (a.max - a.min) * i / 4; ctx.fillText(fmt(v), sx(v), bottom + 24); }
      ctx.fillText(shorten(r.x), (left + right) / 2, H - 16); ctx.textAlign = 'left'; ctx.fillText(shorten(r.y), 10, 17);
      caption = `${r.x} (가로) · ${r.y} (세로) 산점도.${step > 1 ? ` 화면에는 ${step}행 간격으로 최대 3,000개 점을 표시하며 계산에는 모든 유효 행을 사용합니다.` : ''}${r.method === 'spearman' ? ' 그래프는 원래 값, 상관계수는 순위 기준입니다.' : ''}`;
    } else {
      let bars, labels;
      if (r.method === 'describe') {
        const d = r.summaries[0], bins = d.min === d.max ? 1 : Math.min(16, Math.ceil(Math.sqrt(r.n))), width = (d.max - d.min) / bins || 1;
        bars = Array(bins).fill(0); r.values.forEach(v => bars[Math.min(bins - 1, Math.floor((v - d.min) / width))]++);
        labels = bars.map((_, i) => fmt(d.min + i * width)); caption = `${r.x} 히스토그램 · 가로: 구간 시작값 (마지막 구간은 최댓값 포함), 세로: 행 수`;
      } else if (r.contingency) {
        const { labelsX, labelsY, cells } = r.contingency; bars = cells.flat(); labels = labelsX.flatMap(x => labelsY.map(y => `${x} / ${y}`)); caption = '범주 조합별 관측 빈도 · 전체 교차표는 아래 표에서 확인하세요.';
      } else { bars = r.summaries.map(d => d.mean); labels = r.summaries.map(d => d.name); caption = `${r.x}별 ${r.y} 평균 · 오차막대는 표시하지 않습니다. 표본 수와 표준편차는 아래 표에서 확인하세요.`; }
      if (bars.length > 20) { bars = bars.slice(0, 20); labels = labels.slice(0, 20); caption += ' 그래프는 앞 20개만 표시합니다.'; }
      const sy = axes(Math.min(0, ...bars), Math.max(0, ...bars)), slot = (right - left) / bars.length;
      bars.forEach((v, i) => { const px = left + slot * i + slot * .16, py = sy(v), zero = sy(0); ctx.fillStyle = '#4ce3a1'; ctx.fillRect(px, Math.min(py, zero), slot * .68, Math.max(1, Math.abs(py - zero))); ctx.fillStyle = '#cbd6e5'; ctx.textAlign = 'center'; ctx.fillText(fmt(v), px + slot * .34, v >= 0 ? py - 7 : py + 15); ctx.save(); ctx.translate(px + slot * .34, bottom + 20); if (bars.length > 8) ctx.rotate(-.35); ctx.fillText(shorten(labels[i]), 0, 0, Math.max(40, slot)); ctx.restore(); });
    }
    $('#chartCaption').textContent = caption; canvas.setAttribute('aria-label', caption);
  }
  function analyze() {
    invalidate();
    try {
      const result = StatAnalysis.run(rows(), { method: $('#analysisMethod').value, x: $('#analysisX').value, y: $('#analysisY').value });
      result.source = $('#analysisSource').value === 'cleaned' ? '전처리된 데이터' : '원본 데이터'; result.fileName = $('#fileName').textContent; result.created = new Date().toLocaleString('ko-KR');
      if ($('#analysisSource').value === 'cleaned') result.warnings.unshift('전처리된 데이터로 분석했습니다. 결측치 대체, 중복 제거 및 이상치 처리가 추정치와 p-value에 영향을 줄 수 있습니다.');
      $('#analysisTitle').textContent = titles[result.method];
      $('#analysisMeta').textContent = `${result.source} · 전체 ${result.total}행 / 분석 ${result.n}행 / 제외 ${result.excluded}행 · ${result.created}`;
      $('#analysisMetrics').innerHTML = result.metrics.map(([name, value]) => `<div class="metric"><span>${escapeHtml(name)}</span><strong>${name === 'p-value' ? pFmt(value) : fmt(value)}</strong></div>`).join('');
      $('#analysisInterpretation').innerHTML = interpretation(result).map(line => `<p>${escapeHtml(line)}</p>`).join('');
      $('#analysisTable').innerHTML = resultTable(result);
      $('#analysisWarnings').innerHTML = ['확인 사항 · 분석 가정은 자동 검증되지 않았습니다.', ...result.warnings].map(line => `<p>${escapeHtml(line)}</p>`).join('');
      $('#analysisResult').classList.remove('hidden'); drawChart(result); lastResult = result;
    } catch (error) { $('#analysisError').textContent = error.message; }
  }
  function reportHtml() {
    if (!lastResult) return null;
    const r = lastResult, e = escapeHtml;
    return `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${e(titles[r.method])} 보고서</title><style>body{font:15px/1.7 sans-serif;max-width:1000px;margin:40px auto;padding:20px;color:#172c40}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #cbd5df;padding:8px;text-align:left}img{width:100%}.metric{display:inline-block;margin:12px;padding:12px;border:1px solid #ccd5df}.metric strong{display:block}.interpretation{background:#edf7f2;padding:18px}h1{font-size:26px}@media print{body{margin:0}table,img{break-inside:avoid}}</style></head><body><h1>${e(titles[r.method])} 분석 보고서</h1><p>파일: ${e(r.fileName)}<br>변수: ${e(r.x)}${r.method !== 'describe' ? ' / ' + e(r.y) : ''}<br>${e($('#analysisMeta').textContent)}</p><p>StatPilot 1.1 · 규칙 기반 자동 해석 · ${r.p !== undefined ? '유의수준 0.05 · ' : ''}데이터는 PC 내부에서 계산했습니다.</p>${$('#analysisMetrics').innerHTML}<div class="interpretation">${$('#analysisInterpretation').innerHTML}</div><img alt="${e($('#chartCaption').textContent)}" src="${$('#analysisChart').toDataURL('image/png')}"><p>${e($('#chartCaption').textContent)}</p>${resultTable(r)}<h2>확인 사항</h2>${$('#analysisWarnings').innerHTML}</body></html>`;
  }
  $('#exportAnalysis').addEventListener('click', async () => { try { const content = reportHtml(); if (content && await window.desktopAPI.saveReport({ content })) showToast('분석 보고서를 저장했습니다.'); } catch (error) { $('#analysisError').textContent = `보고서 저장 실패: ${error.message}`; } });
  $('#analysisMethod').addEventListener('change', updateVariables);
  $('#analysisSource').addEventListener('change', () => { updateVariables(); recommendations(); });
  ['#analysisX', '#analysisY'].forEach(id => $(id).addEventListener('change', invalidate));
  $('#analyzeButton').addEventListener('click', analyze);
  window.addEventListener('dataset:loaded', () => { $('#analysisSource').value = 'original'; $('#analysisSource').options[1].disabled = true; updateVariables(); recommendations(); });
  window.addEventListener('dataset:cleaned', () => { $('#analysisSource').options[1].disabled = false; invalidate(); updateVariables(); recommendations(); });
  window.StatAnalysisUI = { analyze, reportHtml, updateVariables };
})();
