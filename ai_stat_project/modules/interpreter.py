"""
6회차 AI 해석 모듈의 기본 골격.

현재는 규칙 기반 문장 생성으로 동작하게 만들고,
나중에 LLM API를 연결해 설명을 자연스럽게 확장한다.
"""


def interpret_p_value(p_value, alpha=0.05):
    if p_value < alpha:
        return (
            f"p-value는 {p_value:.4f}로 유의수준 {alpha}보다 작습니다. "
            "따라서 통계적으로 유의한 차이 또는 관계가 있다고 판단할 수 있습니다. "
            "다만 이 결과만으로 인과관계를 단정할 수는 없습니다."
        )

    return (
        f"p-value는 {p_value:.4f}로 유의수준 {alpha} 이상입니다. "
        "따라서 현재 데이터만으로 통계적으로 유의한 차이 또는 관계가 있다고 "
        "판단하기는 어렵습니다."
    )
