"""Development-only cross-check. Requires SciPy; the desktop app does not."""
import json
import subprocess
import sys
from pathlib import Path
import numpy as np
from scipy import stats

rng = np.random.default_rng(20260908)
cases = []
for n in [3, 6, 20, 100, 1000]:
    for strength in [0, 0.4, -0.8]:
        a = rng.normal(size=n)
        b = strength * a + rng.normal(size=n)
        for method in ['pearson', 'spearman', 'regression']:
            x = np.round(a, 1) if method == 'spearman' else a
            rows = [{'x': float(v), 'y': float(w)} for v, w in zip(x, b)]
            if method == 'regression':
                s = stats.linregress(x, b)
                margin = stats.t.ppf(.975, n - 2) * s.stderr
                expected = {'slope': s.slope, 'intercept': s.intercept, 'p': s.pvalue, 'ci:0': s.slope - margin, 'ci:1': s.slope + margin}
            else:
                s = stats.spearmanr(x, b) if method == 'spearman' else stats.pearsonr(x, b)
                expected = {'r': s.statistic, 'p': s.pvalue}
            cases.append(dict(name=f'{method}-{n}-{strength}', method=method, rows=rows, expected=expected))
for n in [2, 5, 30, 200]:
    groups = [rng.normal(i, 1 + i * 2, n + i * 3) for i in range(4)]
    a, b = groups[:2]
    test = stats.ttest_ind(a, b, equal_var=False)
    ci = test.confidence_interval()
    rows = [{'x': str(i), 'y': float(v)} for i, group in enumerate(groups[:2]) for v in group]
    cases.append(dict(name=f'welch-{n}', method='welch', rows=rows, expected={'metric:1': test.statistic, 'metric:2': test.df, 'p': test.pvalue, 'ci:0': ci.low, 'ci:1': ci.high}))
    f = stats.f_oneway(*groups)
    rows = [{'x': str(i), 'y': float(v)} for i, group in enumerate(groups) for v in group]
    cases.append(dict(name=f'anova-{n}', method='anova', rows=rows, expected={'metric:0': f.statistic, 'p': f.pvalue}))
for shape in [(2,2), (2,3), (4,6), (10,10)]:
    for diagonal in [0, 15]:
        cells = rng.integers(1, 30, size=shape)
        for i in range(min(shape)): cells[i,i] += diagonal
        chi, p, df, _ = stats.chi2_contingency(cells, correction=False)
        rows = [{'x': str(i), 'y': str(j)} for i in range(shape[0]) for j in range(shape[1]) for _ in range(int(cells[i,j]))]
        cases.append(dict(name=f'chi-{shape}-{diagonal}', method='chi', rows=rows, expected={'metric:0': chi, 'metric:1': df, 'p': p}))
result = subprocess.run([sys.argv[1], str(Path(__file__).with_name('analysis.test.js')), '--reference'], input=json.dumps(cases), text=True, capture_output=True)
print(result.stdout)
print(result.stderr, file=sys.stderr)
sys.exit(result.returncode)
