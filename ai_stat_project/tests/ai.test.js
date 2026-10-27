const assert = require('node:assert/strict');
const AI = require('../src/ai-recommender.js');

const heldOut = [
  ['한 열의 평균과 퍼진 정도를 요약해 줘', 'describe'],
  ['기온 분포와 중앙값이 궁금해', 'describe'],
  ['두 반 학생들의 평균 성적 차이가 있나', 'welch'],
  ['남녀 두 그룹의 소득을 비교하고 싶어', 'welch'],
  ['학년 세 개의 점수 평균이 다른가', 'anova'],
  ['네 계절의 평균기온을 비교하고 싶어', 'anova'],
  ['키가 클수록 몸무게도 커지는 직선 관계인가', 'pearson'],
  ['평균기온과 최고기온이 함께 올라가는지 궁금해', 'pearson'],
  ['등수 순서가 비슷한지 알고 싶어', 'spearman'],
  ['두 점수의 순위가 함께 변하나', 'spearman'],
  ['공부시간으로 시험점수를 예측하고 싶어', 'regression'],
  ['온도가 1도 증가할 때 사용량은 얼마나 바뀌나', 'regression'],
  ['성별에 따라 합격 여부가 다른가', 'chi'],
  ['지역과 선호 유형 사이의 관련성이 있나', 'chi']
];

let correct = 0;
for (const [question, expected] of heldOut) {
  const actual = AI.classify(question)?.method;
  if (actual === expected) correct++;
  else console.error(`Miss: ${expected} <- ${actual}: ${question}`);
}
assert.equal(AI.trainingCount, 56);
assert.equal(AI.classify(''), null);
assert.equal(AI.classify('???'), null);
assert.equal(correct, heldOut.length, `Only ${correct}/${heldOut.length} unseen questions were classified correctly`);
console.log(`AI classifier holdout: ${correct}/${heldOut.length}`);
