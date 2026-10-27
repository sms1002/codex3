/* Small supervised text classifier. Training happens locally from reviewed examples. */
(function (root) {
  'use strict';

  const examples = {
    describe: [
      '점수의 평균과 중앙값을 알고 싶다', '값이 얼마나 퍼져 있는지 요약',
      '한 변수의 분포와 범위 확인', '기온의 최솟값과 최댓값 보기',
      '자료의 대표값과 표준편차', '나이 데이터의 사분위수',
      '매출의 전반적인 분포를 보고 싶다', '숫자 한 열의 기초 통계'
    ],
    welch: [
      '남학생과 여학생의 평균 점수 비교', '두 집단의 평균이 다른가',
      '서로 다른 두 반의 평균 비교', '실험군과 대조군의 평균 비교',
      '두 그룹의 수입 평균 차이를 검정', '처리 집단과 비처리 집단 평균',
      '두 반 학생 평균 성적 비교', '독립적인 두 집단의 차이'
    ],
    anova: [
      '세 학년의 평균 점수 비교', '세 집단 이상 평균 차이',
      '봄 여름 가을 겨울 평균 기온 비교', '여러 그룹 사이 평균이 다른가',
      'A B C반 성적을 비교', '다섯 지역의 평균 수입 비교',
      '범주가 세 개 이상인 집단별 평균', '여러 치료 방법의 평균 효과 차이'
    ],
    pearson: [
      '공부 시간과 점수의 직선 관계', '두 숫자가 함께 증가하는가',
      '키와 몸무게의 선형 상관', '평균기온과 최고기온의 상관관계',
      '두 수치 변수 사이의 상관계수', '소득과 소비의 직선형 관계',
      '온도가 오르면 판매량도 오르는가', '숫자 두 열의 선형 연관성'
    ],
    spearman: [
      '순위가 함께 움직이는가', '등수와 순위의 관계',
      '공부 시간 순위와 점수 순위 비교', '두 변수의 순위 상관',
      '값보다 높고 낮은 순서가 중요한 관계', '서열 자료끼리 관련이 있는가',
      '만족도 순위와 성적 순위', '단조 관계를 순위로 확인'
    ],
    regression: [
      '공부 시간으로 점수를 예측', '한 변수가 1 증가하면 결과가 얼마나 바뀌나',
      '기온으로 전력 사용량을 설명', '매출 예측을 위한 회귀식',
      'X로 Y의 값을 추정하고 싶다', '기울기와 절편을 구하고 싶다',
      '나이가 늘 때 수입 변화량', '숫자로 결과를 예측하는 직선 모델'
    ],
    chi: [
      '성별과 합격 여부가 관련 있는가', '두 범주형 변수의 관계',
      '지역과 찬반 비율의 관련성', '학년별 선호 유형이 다른가',
      '두 종류의 교차표를 검정', '집단과 성공 실패의 연관성',
      '흡연 여부와 질병 여부의 관계', '분류 항목 두 개의 독립성'
    ]
  };

  function features(text) {
    const words = String(text).toLowerCase().match(/[가-힣a-z0-9]+/g) || [];
    const result = new Set();
    words.forEach(word => {
      if (word.length > 1) result.add(`w:${word}`);
      for (let size = 2; size <= 3; size++) {
        for (let i = 0; i + size <= word.length; i++) result.add(`c:${word.slice(i, i + size)}`);
      }
    });
    return [...result];
  }

  const counts = {}, totals = {}, vocabulary = new Set();
  const labels = Object.keys(examples);
  labels.forEach(label => {
    counts[label] = new Map(); totals[label] = 0;
    examples[label].forEach(sentence => features(sentence).forEach(feature => {
      counts[label].set(feature, (counts[label].get(feature) || 0) + 1);
      totals[label]++; vocabulary.add(feature);
    }));
  });

  function classify(question) {
    const text = String(question).trim();
    if (text.length < 5) return null;
    const observed = features(text).filter(feature => vocabulary.has(feature));
    if (observed.length < 2) return null;
    const alpha = 1;
    const ranked = labels.map(method => {
      const denominator = totals[method] + alpha * vocabulary.size;
      const score = observed.reduce((sum, feature) => sum + Math.log(((counts[method].get(feature) || 0) + alpha) / denominator), Math.log(examples[method].length));
      return { method, score };
    }).sort((a, b) => b.score - a.score);
    return { method: ranked[0].method, alternatives: ranked.slice(1, 3).map(item => item.method), matchedFeatures: observed.length };
  }

  const api = Object.freeze({ classify, trainingCount: labels.reduce((sum, label) => sum + examples[label].length, 0) });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AIRecommender = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
