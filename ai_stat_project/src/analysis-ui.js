/* global StatAnalysis, AIRecommender, sourceData, cleanedData, columns, $, escapeHtml, table, showToast */
(() => {
  'use strict';
  const titles = { describe: '기술통계', welch: '독립 두 집단 · Welch t검정', anova: '일원분산분석 (ANOVA)', pearson: 'Pearson 상관분석', spearman: 'Spearman 순위 상관분석', regression: '단순 선형회귀분석', chi: '카이제곱 독립성 검정' };
  const methodHelp = {
    describe: '숫자 한 열의 가운데 값과 퍼진 정도를 봅니다. 예: 시험 점수는 대체로 몇 점인가?',
    welch: '서로 다른 두 그룹의 평균을 비교합니다. 예: A반과 B반 평균 점수가 다른가? 같은 사람의 전후 비교에는 맞지 않습니다.',
    anova: '세 그룹 이상의 평균을 비교합니다. 차이가 보여도 어느 두 그룹이 다른지는 추가 분석이 필요합니다.',
    pearson: '두 숫자가 직선에 가까운 형태로 함께 움직이는지 봅니다. 함께 움직여도 원인이라는 뜻은 아닙니다.',
    spearman: '두 숫자의 정확한 값보다 높고 낮은 순서가 함께 움직이는지 봅니다.',
    regression: '한 숫자가 바뀔 때 다른 숫자가 평균적으로 얼마나 달라지는지 직선으로 설명합니다. 예측은 관측 범위 안에서만 조심해서 사용하세요.',
    chi: '두 분류 항목의 비율이 관련 있는지 봅니다. 예: 학년과 선호 과목. 인원 수를 적은 열을 분류 항목으로 고르면 안 됩니다.'
  };
  const metricDescriptions = {
    '평균': '값을 모두 더해 개수로 나눈 값', '중앙값': '값을 순서대로 놓았을 때 가운데 값', '표준편차': '값들이 평균에서 얼마나 흩어져 있는지',
    '평균 차이 (첫 집단 − 둘째)': '첫 그룹 평균에서 둘째 그룹 평균을 뺀 값',
    '상관계수 r': '+1에 가까우면 함께 증가, -1에 가까우면 반대로 움직이며, 0에 가까우면 직선 관계가 약함',
    '순위 상관계수 ρ': '높고 낮은 순서가 얼마나 함께 움직이는지',
    '기울기': 'X가 1 늘 때 예측되는 Y의 변화량', '절편': 'X가 0일 때 직선이 예측하는 Y값',
    '설명력 R²': '이 직선이 이 데이터의 Y 변화 중 설명하는 비율',
    'p-value': '차이나 관계가 없다는 가정 아래 지금 같은 결과를 판단하는 수치. 효과의 크기나 원인 증명은 아님',
    'Cohen\'s d (합동 표준편차)': '두 그룹 평균 차이를 값의 퍼짐에 비추어 나타낸 크기',
    '효과 크기 η²': '그룹 구분과 관련된 값의 변동 비율', "Cramér's V": '두 분류 항목의 관계 정도',
    't': '두 평균 차이를 값의 변동과 비교한 검정 수치', 'F': '그룹 간 차이를 그룹 내부 변동과 비교한 검정 수치',
    'χ²': '관측된 분류별 인원과 관계가 없을 때 예상되는 인원의 차이', '자유도': '검정 계산에 쓰이는 값의 수에 관한 수치',
    '집단 간 자유도': '그룹 수에 따른 계산값', '집단 내 자유도': '그룹 내부 자료 수에 따른 계산값'
  };
  const fmt = v => v === null || v === undefined ? '—' : Math.abs(v) >= 1e7 || (v !== 0 && Math.abs(v) < .0001) ? v.toExponential(3) : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
  const pFmt = p => p < .0001 ? '< 0.0001' : fmt(p);
  let lastResult = null;
  const rows = () => $('#analysisSource').value === 'cleaned' ? cleanedData : sourceData;
  const normalized = value => String(value).toLowerCase().replace(/[\s_()[\]℃°·-]/g, '');
  const unsuitableName = name => /(^|[_\s])(id|code)([_\s]|$)|번호|코드|지점|우편|날짜|일자|date|time/i.test(name);
  function choices() {
    const profiles = StatAnalysis.profile(rows(), columns);
    const numeric = profiles.filter(p => p.numeric && p.unique > 1 && !unsuitableName(p.name)).sort((a, b) => Number(a.unique <= 10) - Number(b.unique <= 10));
    const categories = profiles.filter(p => !unsuitableName(p.name) && p.unique >= 2 && p.unique <= 20 && rows().length > p.unique && (!p.numeric || p.unique <= 10));
    return { profiles, numeric, categories };
  }
  function invalidate() { lastResult = null; $('#analysisResult').classList.add('hidden'); $('#analysisError').textContent = ''; }
  function setOptions(selector, items, preferred) {
    const el = $(selector); el.innerHTML = items.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}${p.numeric ? ' · 숫자' : ''}</option>`).join('');
    if (items.some(p => p.name === preferred)) el.value = preferred;
  }
  function updateVariables() {
    invalidate(); const method = $('#analysisMethod').value, { numeric, categories } = choices();
    const grouped = ['welch', 'anova', 'chi'].includes(method);
    const previousX = $('#analysisX').value, previousY = $('#analysisY').value;
    const groups = method === 'welch' ? categories.filter(p => p.unique === 2) : method === 'anova' ? categories.filter(p => p.unique >= 3) : categories;
    setOptions('#analysisX', grouped ? groups : numeric, previousX);
    setOptions('#analysisY', method === 'chi' ? categories : numeric, previousY);
    if ($('#analysisX').value === $('#analysisY').value) { const alternative = [...$('#analysisY').options].find(o => o.value !== $('#analysisX').value); if (alternative) $('#analysisY').value = alternative.value; }
    $('#analysisXLabel').textContent = grouped ? (method === 'chi' ? '범주형 변수 X' : '집단 변수') : method === 'regression' ? '설명 변수 X' : '수치형 변수 X';
    $('#analysisYLabel').textContent = method === 'chi' ? '범주형 변수 Y' : '결과 변수 Y (숫자)';
    $('#analysisYWrap').classList.toggle('hidden', method === 'describe');
    $('#methodHelp').textContent = methodHelp[method];
    $('#analysisHint').textContent = `${rows().length.toLocaleString()}행 기준 · 분석에 필요한 값이 빈 행은 그 분석에서 제외합니다.${$('#analysisSource').value === 'cleaned' ? ' 데이터를 정리하면 결과가 바뀔 수 있으니 원본 결과와 비교하세요.' : ''}`;
    $('#analyzeButton').disabled = !rows().length || !$('#analysisX').value || (method !== 'describe' && !$('#analysisY').value);
  }
  function recommendations() {
    const { numeric, categories } = choices(), proposals = [];
    if (numeric.length) proposals.push({ method: 'describe', x: numeric[0].name, text: `${numeric[0].name} 요약` });
    const group = categories.find(p => numeric.some(n => n.name !== p.name));
    if (group) { const outcome = numeric.find(n => n.name !== group.name); proposals.push({ method: group.unique === 2 ? 'welch' : 'anova', x: group.name, y: outcome.name, text: `${group.name}별 ${outcome.name} 평균 비교` }); }
    if (numeric.length >= 2) proposals.push({ method: 'pearson', x: numeric[0].name, y: numeric[1].name, text: `${numeric[0].name}와 ${numeric[1].name} 관계` });
    if (categories.length >= 2) proposals.push({ method: 'chi', x: categories[0].name, y: categories[1].name, text: `${categories[0].name}와 ${categories[1].name} 분류 관계` });
    $('#recommendations').replaceChildren();
    proposals.forEach(proposal => { const button = document.createElement('button'); button.className = 'secondary-button'; button.textContent = `열 기준 빠른 선택 · ${proposal.text}`; button.addEventListener('click', () => { $('#analysisMethod').value = proposal.method; updateVariables(); $('#analysisX').value = proposal.x; if (proposal.y) $('#analysisY').value = proposal.y; }); $('#recommendations').append(button); });
    if (proposals.length) { const note = document.createElement('small'); note.className = 'analysis-help'; note.textContent = '빠른 선택은 열의 종류만 보고 제안합니다. 위의 AI 질문 기능과 별개이며, 열의 실제 의미를 확인해야 합니다.'; $('#recommendations').append(note); }
  }
  function matching(items, question) {
    const q = normalized(question);
    return [...items].sort((a, b) => Number(q.includes(normalized(b.name))) - Number(q.includes(normalized(a.name))));
  }
  function planFor(method, question) {
    const { numeric, categories } = choices();
    const nums = matching(numeric, question), cats = matching(categories, question);
    if (method === 'describe') return nums.length ? { x: nums[0].name } : null;
    if (['pearson', 'spearman', 'regression'].includes(method)) return nums.length >= 2 ? { x: nums[0].name, y: nums[1].name } : null;
    if (method === 'chi') return cats.length >= 2 ? { x: cats[0].name, y: cats[1].name } : null;
    const groups = cats.filter(p => method === 'welch' ? p.unique === 2 : p.unique >= 3);
    const group = groups[0], outcome = nums.find(p => p.name !== group?.name);
    return group && outcome ? { x: group.name, y: outcome.name } : null;
  }
  function aiRecommend() {
    const question = $('#aiQuestion').value.trim(), prediction = AIRecommender.classify(question), box = $('#aiAdvice');
    if (!prediction) { box.className = 'ai-advice warning'; box.textContent = '질문을 조금 더 구체적으로 써 주세요. 예: “두 반의 평균 점수가 다른가?”'; return; }
    const method = prediction.method, plan = planFor(method, question);
    $('#analysisMethod').value = method; updateVariables();
    if (!plan) {
      box.className = 'ai-advice warning';
      box.innerHTML = `<strong>AI 후보: ${escapeHtml(titles[method])}</strong>이 파일에서는 필요한 열을 찾지 못했습니다. ${escapeHtml(methodHelp[method])} 그룹·분류 열 또는 서로 다른 숫자 열이 필요한지 확인하세요. 다른 방법은 직접 선택할 수 있습니다.`;
      return;
    }
    $('#analysisX').value = plan.x;
    if (plan.y) $('#analysisY').value = plan.y;
    box.className = 'ai-advice';
    box.innerHTML = `<strong>AI 후보: ${escapeHtml(titles[method])}</strong>${escapeHtml(methodHelp[method])}<br>선택한 열: ${escapeHtml(plan.x)}${plan.y ? ' / ' + escapeHtml(plan.y) : ''}. 질문과 열의 뜻이 맞는지 확인한 뒤 분석을 실행하세요.`;
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
      $('#analysisMeta').textContent = `${result.source} · 전체 ${result.total}행 중 ${result.n}행을 계산에 사용 (${result.excluded}행 제외) · ${result.created}`;
      $('#analysisMetrics').innerHTML = result.metrics.map(([name, value]) => `<div class="metric"><span>${escapeHtml(name)}</span><strong>${name === 'p-value' ? pFmt(value) : fmt(value)}</strong></div>`).join('');
      $('#metricHelp').innerHTML = `<strong>화면의 숫자 뜻</strong><br>${result.metrics.map(([name]) => `${escapeHtml(name)}: ${escapeHtml(metricDescriptions[name] || '분석 방법에서 계산한 결과 수치')}`).join('<br>')}`;
      $('#analysisInterpretation').innerHTML = interpretation(result).map(line => `<p>${escapeHtml(line)}</p>`).join('');
      $('#analysisTable').innerHTML = resultTable(result);
      $('#analysisWarnings').innerHTML = ['확인 사항 · 분석 가정은 자동 검증되지 않았습니다.', ...result.warnings].map(line => `<p>${escapeHtml(line)}</p>`).join('');
      $('#analysisResult').classList.remove('hidden'); drawChart(result); lastResult = result;
    } catch (error) { $('#analysisError').textContent = error.message; }
  }
  function reportHtml() {
    if (!lastResult) return null;
    const r = lastResult, e = escapeHtml;
    return `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${e(titles[r.method])} 보고서</title><style>body{font:15px/1.7 sans-serif;max-width:1000px;margin:40px auto;padding:20px;color:#172c40}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #cbd5df;padding:8px;text-align:left}img{width:100%}.metric{display:inline-block;margin:12px;padding:12px;border:1px solid #ccd5df}.metric strong{display:block}.interpretation{background:#edf7f2;padding:18px}h1{font-size:26px}@media print{body{margin:0}table,img{break-inside:avoid}}</style></head><body><h1>${e(titles[r.method])} 보고서</h1><p>파일: ${e(r.fileName)}<br>변수: ${e(r.x)}${r.method !== 'describe' ? ' / ' + e(r.y) : ''}<br>${e($('#analysisMeta').textContent)}</p><p>StatPilot 1.2 · ${e(methodHelp[r.method])}<br>결과 해석은 계산값에 따른 규칙 기반 문장입니다. ${r.p !== undefined ? '유의수준 0.05 · ' : ''}데이터는 PC 내부에서 계산했습니다.</p>${$('#analysisMetrics').innerHTML}<div class="interpretation">${$('#metricHelp').innerHTML}</div><div class="interpretation">${$('#analysisInterpretation').innerHTML}</div><img alt="${e($('#chartCaption').textContent)}" src="${$('#analysisChart').toDataURL('image/png')}"><p>${e($('#chartCaption').textContent)}</p>${resultTable(r)}<h2>확인 사항</h2>${$('#analysisWarnings').innerHTML}</body></html>`;
  }
  $('#aiRecommend').addEventListener('click', aiRecommend);
  $('#exportAnalysis').addEventListener('click', async () => { try { const content = reportHtml(); if (content && await window.desktopAPI.saveReport({ content })) showToast('분석 보고서를 저장했습니다.'); } catch (error) { $('#analysisError').textContent = `보고서 저장 실패: ${error.message}`; } });
  $('#analysisMethod').addEventListener('change', updateVariables);
  $('#analysisSource').addEventListener('change', () => { updateVariables(); recommendations(); });
  ['#analysisX', '#analysisY'].forEach(id => $(id).addEventListener('change', invalidate));
  $('#analyzeButton').addEventListener('click', analyze);
  window.addEventListener('dataset:loaded', () => { $('#analysisSource').value = 'original'; $('#analysisSource').options[1].disabled = true; $('#aiAdvice').textContent = ''; $('#aiQuestion').value = ''; updateVariables(); recommendations(); });
  window.addEventListener('dataset:cleaned', () => { $('#analysisSource').options[1].disabled = false; invalidate(); updateVariables(); recommendations(); });
  window.StatAnalysisUI = { analyze, reportHtml, updateVariables };
})();
