const assert = require('node:assert/strict');
const fs = require('node:fs');
const A = require('../src/analysis.js');
let checked = 0;
function near(actual, expected, label) { assert.ok(Number.isFinite(actual), `${label}: nonfinite`); assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`); checked++; }
function run(method, rows) { return A.run(rows, { method, x: 'x', y: 'y' }); }
near(A.tP(1, 1), .5, 'Cauchy t tail');
near(A.tP(0, 5), 1, 'zero t');
const d = run('describe', [1,2,3,4,5].map(x => ({ x })));
near(d.summaries[0].mean, 3, 'mean'); near(d.summaries[0].sd, Math.sqrt(2.5), 'sample SD'); near(d.summaries[0].q1, 2, 'Q1');
near(run('pearson', [1,2,3,4].map(x => ({ x, y: -x }))).r, -1, 'perfect negative correlation');
assert.throws(() => run('pearson', [{ x: 1, y: 2 },{ x: 1, y: 3 },{ x: 1, y: 4 }]));
assert.throws(() => run('welch', [{ x: 'a', y: 1 },{ x: 'b', y: 2 }]));
assert.throws(() => run('chi', [{ x: 'a', y: 'b' }]));
assert.throws(() => run('describe', []));
const sparse = run('chi', [{ x: '__proto__', y: 'a' }, { x: 'constructor', y: 'b' }]); assert.equal(sparse.sparse, true);
const missing = run('describe', [{ x: '' }, { x: '  ' }, { x: 'bad' }, { x: '1,000' }, { x: 0 }]); assert.equal(missing.n, 2); assert.equal(missing.excluded, 3);
assert.equal(A.number('Infinity'), null); assert.equal(A.number('0x10'), null);
const raw = [{ x: 'a', y: 1 }, { x: 'a', y: 3 }, { x: 'b', y: 2 }, { x: 'b', y: 4 }], copy = JSON.stringify(raw); run('welch', raw); assert.equal(JSON.stringify(raw), copy);
if (process.argv.includes('--reference')) {
  const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
  for (const c of cases) {
    const r = run(c.method, c.rows);
    for (const [key, expected] of Object.entries(c.expected)) {
      const actual = key.startsWith('metric:') ? r.metrics[Number(key.slice(7))][1] : key.startsWith('ci:') ? r.ci[Number(key.slice(3))] : r[key];
      near(actual, expected, `${c.name} ${key}`);
    }
  }
  console.log(`${cases.length} SciPy reference cases passed.`);
}
console.log(`PASS: ${checked} numerical comparisons plus validation, missing-value and immutability checks.`);
