import pandas as pd
import numpy as np


def classify_columns(df: pd.DataFrame) -> dict:
    """
    각 열을 수치형/범주형/날짜형으로 간단히 판별한다.
    고등학교 프로젝트용 규칙 기반 구현.
    """
    result = {}

    for col in df.columns:
        s = df[col]

        if pd.api.types.is_numeric_dtype(s):
            # 숫자라도 고유값이 매우 적으면 범주형일 가능성이 큼
            nunique = s.nunique(dropna=True)
            if nunique <= 10 and nunique / max(len(s), 1) < 0.05:
                result[col] = "범주형(숫자 코드 가능)"
            else:
                result[col] = "수치형"
            continue

        # 날짜형 변환 가능성 검사
        non_null = s.dropna()
        if len(non_null) > 0:
            parsed = pd.to_datetime(non_null, errors="coerce")
            success_ratio = parsed.notna().mean()
            if success_ratio >= 0.8:
                result[col] = "날짜형"
                continue

        result[col] = "범주형"

    return result


def missing_summary(df: pd.DataFrame) -> pd.DataFrame:
    count = df.isna().sum()
    ratio = (count / len(df) * 100).round(2) if len(df) else count.astype(float)

    return pd.DataFrame({
        "변수": df.columns,
        "결측치 개수": count.values,
        "결측치 비율(%)": ratio.values
    })


def detect_outliers_iqr(series: pd.Series) -> dict:
    s = pd.to_numeric(series, errors="coerce").dropna()

    if len(s) == 0:
        return {
            "count": 0,
            "lower_bound": np.nan,
            "upper_bound": np.nan,
            "mask": pd.Series(False, index=series.index)
        }

    q1 = s.quantile(0.25)
    q3 = s.quantile(0.75)
    iqr = q3 - q1

    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    numeric = pd.to_numeric(series, errors="coerce")
    mask = (numeric < lower) | (numeric > upper)

    return {
        "count": int(mask.sum()),
        "lower_bound": round(float(lower), 4),
        "upper_bound": round(float(upper), 4),
        "mask": mask.fillna(False)
    }


def fill_missing_values(df: pd.DataFrame) -> tuple[pd.DataFrame, list]:
    out = df.copy()
    actions = []

    for col in out.columns:
        missing_count = int(out[col].isna().sum())
        if missing_count == 0:
            continue

        if pd.api.types.is_numeric_dtype(out[col]):
            value = out[col].median()
            out[col] = out[col].fillna(value)
            actions.append(
                f"{col}: 결측치 {missing_count}개를 중앙값 {value}로 대체"
            )
        else:
            mode = out[col].mode(dropna=True)
            if len(mode) > 0:
                value = mode.iloc[0]
                out[col] = out[col].fillna(value)
                actions.append(
                    f"{col}: 결측치 {missing_count}개를 최빈값 '{value}'로 대체"
                )

    return out, actions


def clip_outliers(df: pd.DataFrame) -> tuple[pd.DataFrame, list]:
    out = df.copy()
    actions = []

    for col in out.select_dtypes(include="number").columns:
        info = detect_outliers_iqr(out[col])

        if info["count"] > 0:
            out[col] = out[col].clip(
                lower=info["lower_bound"],
                upper=info["upper_bound"]
            )
            actions.append(
                f"{col}: 이상치 {info['count']}개를 IQR 경계값으로 조정"
            )

    return out, actions


def remove_outliers(df: pd.DataFrame) -> tuple[pd.DataFrame, list]:
    out = df.copy()
    total_mask = pd.Series(False, index=out.index)
    actions = []

    for col in out.select_dtypes(include="number").columns:
        info = detect_outliers_iqr(out[col])
        if info["count"] > 0:
            total_mask |= info["mask"]
            actions.append(
                f"{col}: IQR 기준 이상치 후보 {info['count']}개 발견"
            )

    removed = int(total_mask.sum())
    out = out.loc[~total_mask].copy()
    actions.append(f"이상치가 포함된 행 총 {removed}개 제거")

    return out, actions


def preprocess_dataframe(
    df: pd.DataFrame,
    missing_method: str = "median_mode",
    outlier_method: str = "none"
) -> tuple[pd.DataFrame, dict]:

    out = df.copy()
    original_rows = len(out)
    actions = []

    # 중복 행 제거
    duplicated = int(out.duplicated().sum())
    if duplicated > 0:
        out = out.drop_duplicates().copy()
        actions.append(f"중복 행 {duplicated}개 제거")

    # 결측치 처리
    if missing_method == "median_mode":
        out, logs = fill_missing_values(out)
        actions.extend(logs)

    elif missing_method == "drop":
        before = len(out)
        out = out.dropna().copy()
        actions.append(f"결측치가 있는 행 {before - len(out)}개 제거")

    elif missing_method == "none":
        actions.append("결측치를 별도로 처리하지 않음")

    # 이상치 처리
    if outlier_method == "clip":
        out, logs = clip_outliers(out)
        actions.extend(logs)

    elif outlier_method == "remove":
        out, logs = remove_outliers(out)
        actions.extend(logs)

    elif outlier_method == "none":
        actions.append("이상치를 별도로 처리하지 않음")

    report = {
        "original_rows": original_rows,
        "final_rows": len(out),
        "removed_rows": original_rows - len(out),
        "actions": actions
    }

    return out, report
