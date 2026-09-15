/* Offline statistical engine. No network or generated code execution. */
(function (root) {
  'use strict';
  const missing = v => v == null || String(v).trim() === '';
  function number(v) {
    if (missing(v)) return null;
    const s = String(v).trim().replaceAll(',', '');
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return null;
    return Number.isFinite(Number(s)) ? Number(s) : null;
  }
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const ss = a => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0); };
  const variance = a => ss(a) / (a.length - 1);
  function quantile(a, p) { const i = (a.length - 1) * p, k = Math.floor(i); return a[k] + (a[Math.min(k + 1, a.length - 1)] - a[k]) * (i - k); }
  function describe(a) {
    const sorted = [...a].sort((x, y) => x - y);
    return { n: a.length, mean: mean(a), sd: a.length > 1 ? Math.sqrt(variance(a)) : null, min: sorted[0], q1: quantile(sorted, .25), median: quantile(sorted, .5), q3: quantile(sorted, .75), max: sorted[sorted.length - 1] };
  }
  // Lanczos log-gamma, continued-fraction incomplete beta, series/CF gamma tail.
  function logGamma(z) {
    const c = [676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
    if (z < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
    z -= 1; let x = .99999999999980993;
    c.forEach((v, i) => { x += v / (z + i + 1); });
    const t = z + 7.5;
    return .5 * Math.log(2 * Math.PI) + (z + .5) * Math.log(t) - t + Math.log(x);
  }
  const clamp = x => Math.min(1, Math.max(0, x));
  function betaCF(a, b, x) {
    const tiny = 1e-300; let c = 1, d = 1 - (a + b) * x / (a + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d; let h = d;
    for (let m = 1; m <= 10000; m++) {
      for (const aa of [m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m)), -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1))]) {
        d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
        c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d; const delta = d * c; h *= delta;
        if (aa < 0 && Math.abs(delta - 1) < 1e-14) return h;
      }
    }
    throw new Error('확률 계산이 수렴하지 않았습니다. 데이터 범위를 확인하세요.');
  }
  function beta(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
    return clamp(x < (a + 1) / (a + b + 2) ? front * betaCF(a, b, x) / a : 1 - front * betaCF(b, a, 1 - x) / b);
  }
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    const front = Math.exp(-x + a * Math.log(x) - logGamma(a));
    if (x < a + 1) {
      let term = 1 / a, sum = term;
      for (let n = 1; n < 10000; n++) { term *= x / (a + n); sum += term; if (Math.abs(term) < Math.abs(sum) * 1e-14) return clamp(1 - sum * front); }
    } else {
      let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
      for (let i = 1; i < 10000; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const delta = d * c; h *= delta; if (Math.abs(delta - 1) < 1e-14) return clamp(front * h); }
    }
    throw new Error('확률 계산이 수렴하지 않았습니다.');
  }
  const tP = (t, df) => beta(df / (df + t * t), df / 2, .5);
  function criticalT(df) { let lo = 0, hi = 1; while (tP(hi, df) > .05) hi *= 2; for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (tP(mid, df) > .05) lo = mid; else hi = mid; } return (lo + hi) / 2; }
  function ranks(a) {
    const sorted = a.map((v, i) => ({ v, i })).sort((x, y) => x.v - y.v), result = [];
    for (let i = 0; i < sorted.length;) { let j = i + 1; while (j < sorted.length && sorted[j].v === sorted[i].v) j++; for (let k = i; k < j; k++) result[sorted[k].i] = (i + j + 1) / 2; i = j; }
    return result;
  }
  function pearson(x, y) { const mx = mean(x), my = mean(y), sx = ss(x), sy = ss(y); if (!(sx > 0 && sy > 0)) throw new Error('값이 모두 같은 변수는 상관·회귀 분석을 할 수 없습니다.'); return Math.max(-1, Math.min(1, x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / Math.sqrt(sx * sy))); }
  function profile(rows, columns) { return columns.map(name => { const a = rows.map(r => r[name]).filter(v => !missing(v)); return { name, numeric: a.length > 0 && a.every(v => number(v) !== null), unique: new Set(a.map(v => String(v).trim())).size }; }); }
  function run(rows, options) {
    const { method, x, y } = options;
    if (!rows.length) throw new Error('분석할 행이 없습니다.');
    if (!x || (method !== 'describe' && !y)) throw new Error('분석할 변수를 선택하세요.');
    if (method !== 'describe' && x === y) throw new Error('서로 다른 두 변수를 선택하세요.');
    const warnings = [], result = { method, x, y, total: rows.length, warnings, metrics: [], summaries: [] };
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    let valid;
    if (method === 'describe') {
      valid = rows.map(r => number(r[x])).filter(v => v !== null); assert(valid.length, '선택한 변수에 분석 가능한 숫자가 없습니다.');
      const d = describe(valid); result.summaries = [{ name: x, ...d }]; result.values = valid;
      result.metrics = [['평균', d.mean], ['중앙값', d.median], ['표준편차', d.sd]];
    } else if (['pearson', 'spearman', 'regression'].includes(method)) {
      valid = rows.map(r => [number(r[x]), number(r[y])]).filter(a => a.every(v => v !== null));
      assert(valid.length >= 3, '두 변수의 유효한 값이 함께 있는 행이 3개 이상 필요합니다.');
      const a = valid.map(v => v[0]), b = valid.map(v => v[1]);
      const r = method === 'spearman' ? pearson(ranks(a), ranks(b)) : pearson(a, b), df = a.length - 2;
      result.r = r; result.p = Math.abs(r) === 1 ? 0 : tP(r * Math.sqrt(df / (1 - r * r)), df); result.points = valid;
      result.summaries = [{ name: x, ...describe(a) }, { name: y, ...describe(b) }];
      if (method === 'regression') {
        const slope = r * Math.sqrt(ss(b) / ss(a)), intercept = mean(b) - slope * mean(a);
        const residualSS = a.reduce((s, v, i) => s + (b[i] - intercept - slope * v) ** 2, 0);
        const se = Math.sqrt(residualSS / df / ss(a)), margin = criticalT(df) * se;
        result.slope = slope; result.intercept = intercept; result.ci = [slope - margin, slope + margin];
        result.metrics = [['기울기', slope], ['절편', intercept], ['설명력 R²', r * r], ['p-value', result.p]];
        warnings.push('선형성, 잔차의 정규성·등분산성, 관측값의 독립성을 확인해야 합니다. 회귀 결과만으로 인과관계를 판단할 수 없습니다.');
      } else {
        result.metrics = [[method === 'spearman' ? '순위 상관계수 ρ' : '상관계수 r', r], ['p-value', result.p]];
        warnings.push(method === 'spearman' ? '동점은 평균 순위로 처리합니다. p-value는 t분포 근사값이며 소표본에서는 순열검정 등 추가 확인이 필요합니다.' : '선형 관계와 이상치를 확인하세요. p-value는 독립 관측과 이변량 정규성 가정을 따릅니다.');
        warnings.push('상관관계는 인과관계를 의미하지 않습니다.');
      }
    } else if (['welch', 'anova'].includes(method)) {
      valid = rows.filter(r => !missing(r[x]) && number(r[y]) !== null);
      const groups = new Map(); valid.forEach(r => { const key = String(r[x]).trim(); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(number(r[y])); });
      assert(method === 'welch' ? groups.size === 2 : groups.size >= 3, method === 'welch' ? 'Welch t검정은 정확히 두 집단이 필요합니다.' : 'ANOVA는 세 집단 이상이 필요합니다.');
      assert(groups.size <= 50, '집단이 너무 많습니다. ID가 아닌 집단 변수를 선택하세요(최대 50개).');
      const arrays = [...groups.values()]; assert(arrays.every(a => a.length >= 2), '각 집단에 유효한 값이 2개 이상 필요합니다.');
      result.summaries = [...groups].map(([name, a]) => ({ name, ...describe(a) }));
      if (method === 'welch') {
        const [a, b] = arrays, va = variance(a) / a.length, vb = variance(b) / b.length, se = Math.sqrt(va + vb);
        assert(se > 0, '두 집단 모두 값의 변동이 없어 t검정을 계산할 수 없습니다.');
        const difference = mean(a) - mean(b), t = difference / se, df = (va + vb) ** 2 / (va * va / (a.length - 1) + vb * vb / (b.length - 1));
        const pooled = Math.sqrt((ss(a) + ss(b)) / (a.length + b.length - 2));
        result.p = tP(t, df); result.ci = [difference - criticalT(df) * se, difference + criticalT(df) * se];
        result.metrics = [['평균 차이 (첫 집단 − 둘째)', difference], ['t', t], ['자유도', df], ['p-value', result.p], ["Cohen's d (합동 표준편차)", difference / pooled]];
        warnings.push('서로 독립인 두 집단의 평균을 비교합니다. 같은 사람의 전후 측정에는 사용할 수 없습니다. 소표본에서는 집단별 정규성·이상치를 확인하세요.');
      } else {
        const grand = mean(valid.map(r => number(r[y]))), within = arrays.reduce((s, a) => s + ss(a), 0), between = arrays.reduce((s, a) => s + a.length * (mean(a) - grand) ** 2, 0);
        assert(within > 0, '집단 내 변동이 없어 ANOVA를 계산할 수 없습니다.');
        const df1 = groups.size - 1, df2 = valid.length - groups.size, f = (between / df1) / (within / df2);
        result.p = beta(df2 / (df2 + df1 * f), df2 / 2, df1 / 2);
        result.metrics = [['F', f], ['집단 간 자유도', df1], ['집단 내 자유도', df2], ['p-value', result.p], ['효과 크기 η²', between / (between + within)]];
        warnings.push('일원분산분석은 독립 관측, 집단별 정규성 및 등분산성을 가정합니다. 유의한 경우 어느 집단끼리 다른지는 사후검정이 필요합니다.');
      }
    } else if (method === 'chi') {
      valid = rows.filter(r => !missing(r[x]) && !missing(r[y]));
      const labelsX = [...new Set(valid.map(r => String(r[x]).trim()))], labelsY = [...new Set(valid.map(r => String(r[y]).trim()))];
      assert(labelsX.length >= 2 && labelsY.length >= 2, '각 범주형 변수에 두 범주 이상이 필요합니다.');
      assert(labelsX.length * labelsY.length <= 400, '범주 조합이 너무 많습니다(최대 400칸). ID나 연속형 숫자가 아닌 범주형 변수를 선택하세요.');
      const cells = labelsX.map(() => labelsY.map(() => 0)); valid.forEach(r => { cells[labelsX.indexOf(String(r[x]).trim())][labelsY.indexOf(String(r[y]).trim())]++; });
      const rt = cells.map(a => a.reduce((s, n) => s + n, 0)), ct = labelsY.map((_, j) => cells.reduce((s, a) => s + a[j], 0));
      let chi = 0, low = 0; cells.forEach((a, i) => a.forEach((n, j) => { const expected = rt[i] * ct[j] / valid.length; chi += (n - expected) ** 2 / expected; if (expected < 5) low++; }));
      const df = (labelsX.length - 1) * (labelsY.length - 1); result.p = gammaQ(df / 2, chi / 2); result.sparse = low > 0;
      result.contingency = { labelsX, labelsY, cells };
      result.metrics = [['χ²', chi], ['자유도', df], ['p-value', result.p], ["Cramér's V", Math.sqrt(chi / (valid.length * Math.min(labelsX.length - 1, labelsY.length - 1)))]];
      warnings.push('Pearson 카이제곱 독립성 검정이며 연속성 보정은 적용하지 않습니다. 관측값은 서로 독립이어야 합니다.');
      if (low) warnings.push(`기대도수 5 미만인 칸이 ${low}개입니다. 근사 p-value의 신뢰도가 낮을 수 있으므로 Fisher 정확검정이나 범주 재검토가 필요합니다.`);
    } else throw new Error('지원하지 않는 분석 방법입니다.');
    result.n = valid.length; result.excluded = rows.length - valid.length;
    if (result.excluded) warnings.unshift(`선택한 변수의 결측치 또는 숫자로 읽을 수 없는 값 때문에 ${result.excluded}행을 제외했습니다.`);
    assert(result.metrics.every(([, v]) => v === null || Number.isFinite(v)) && (result.p === undefined || Number.isFinite(result.p)), '값의 범위가 너무 커 계산할 수 없습니다. 단위를 조정하세요.');
    return result;
  }
  const api = { run, profile, number, describe, tP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StatAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
