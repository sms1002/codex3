"""
5회차: 분석 목적과 변수 구조를 바탕으로 통계 방법을 추천하는 규칙 기반 엔진.
"""


def recommend_method(goal, independent_type=None, dependent_type=None, group_count=None):
    if goal == "두 집단 평균 비교":
        if independent_type == "categorical" and dependent_type == "numeric":
            if group_count == 2:
                return "독립표본 t검정"

    if goal == "세 집단 이상 평균 비교":
        if independent_type == "categorical" and dependent_type == "numeric":
            if group_count is not None and group_count >= 3:
                return "일원분산분석(One-way ANOVA)"

    if goal == "두 수치형 변수의 관계":
        if independent_type == "numeric" and dependent_type == "numeric":
            return "Pearson 상관분석 또는 Spearman 상관분석"

    if goal == "한 변수가 다른 변수에 미치는 영향":
        if independent_type == "numeric" and dependent_type == "numeric":
            return "단순 선형회귀분석"

    return "조건에 맞는 분석 방법을 자동 결정하지 못했습니다."
