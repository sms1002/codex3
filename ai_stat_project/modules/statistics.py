"""
4~5회차에서 확장할 통계 분석 모듈의 기본 골격.
"""
from scipy import stats
import pandas as pd


def independent_t_test(df, group_col, value_col):
    groups = df[group_col].dropna().unique()

    if len(groups) != 2:
        raise ValueError("독립표본 t검정은 정확히 2개 집단이 필요합니다.")

    a = df.loc[df[group_col] == groups[0], value_col].dropna()
    b = df.loc[df[group_col] == groups[1], value_col].dropna()

    stat, p = stats.ttest_ind(a, b, equal_var=False)

    return {
        "method": "독립표본 t검정",
        "group1": str(groups[0]),
        "group2": str(groups[1]),
        "mean1": float(a.mean()),
        "mean2": float(b.mean()),
        "statistic": float(stat),
        "p_value": float(p)
    }


def correlation(df, x_col, y_col, method="pearson"):
    x = df[x_col]
    y = df[y_col]
    valid = pd.concat([x, y], axis=1).dropna()

    if method == "pearson":
        r, p = stats.pearsonr(valid[x_col], valid[y_col])
        name = "Pearson 상관분석"
    else:
        r, p = stats.spearmanr(valid[x_col], valid[y_col])
        name = "Spearman 상관분석"

    return {
        "method": name,
        "correlation": float(r),
        "p_value": float(p)
    }
