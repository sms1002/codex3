import streamlit as st
import pandas as pd

from modules.preprocessing import (
    classify_columns,
    missing_summary,
    detect_outliers_iqr,
    preprocess_dataframe,
)

st.set_page_config(page_title="AI 통계 분석 도우미", layout="wide")

st.title("AI 기반 통계 분석 방법 자동 선택 및 결과 해석 시스템")
st.caption("3회차 구현: CSV 업로드 → 변수 유형 판별 → 결측치 검사 → 이상치 탐지 → 전처리")

uploaded_file = st.file_uploader("CSV 파일을 업로드하세요.", type=["csv"])

if uploaded_file is not None:
    try:
        df = pd.read_csv(uploaded_file)
    except UnicodeDecodeError:
        uploaded_file.seek(0)
        df = pd.read_csv(uploaded_file, encoding="cp949")

    st.subheader("1. 원본 데이터")
    st.write(f"데이터 크기: {df.shape[0]}행 × {df.shape[1]}열")
    st.dataframe(df.head(20), use_container_width=True)

    st.subheader("2. 변수 유형 자동 판별")
    types = classify_columns(df)
    type_df = pd.DataFrame({
        "변수": list(types.keys()),
        "판별 유형": list(types.values())
    })
    st.dataframe(type_df, use_container_width=True)

    st.subheader("3. 결측치 검사")
    missing = missing_summary(df)
    st.dataframe(missing, use_container_width=True)

    st.subheader("4. 이상치 탐지 (IQR)")
    outlier_rows = []
    for col in df.select_dtypes(include="number").columns:
        info = detect_outliers_iqr(df[col])
        outlier_rows.append({
            "변수": col,
            "이상치 개수": info["count"],
            "하한": info["lower_bound"],
            "상한": info["upper_bound"]
        })
    if outlier_rows:
        st.dataframe(pd.DataFrame(outlier_rows), use_container_width=True)
    else:
        st.info("수치형 변수가 없습니다.")

    st.subheader("5. 전처리 설정")
    missing_method = st.selectbox(
        "결측치 처리 방법",
        ["median_mode", "drop", "none"],
        format_func=lambda x: {
            "median_mode": "수치형=중앙값 / 범주형=최빈값",
            "drop": "결측치가 있는 행 삭제",
            "none": "처리하지 않음"
        }[x]
    )

    outlier_method = st.selectbox(
        "이상치 처리 방법",
        ["none", "clip", "remove"],
        format_func=lambda x: {
            "none": "처리하지 않음",
            "clip": "IQR 경계값으로 조정",
            "remove": "이상치가 있는 행 제거"
        }[x]
    )

    if st.button("전처리 실행"):
        cleaned, report = preprocess_dataframe(
            df,
            missing_method=missing_method,
            outlier_method=outlier_method
        )

        st.success("전처리가 완료되었습니다.")
        c1, c2, c3 = st.columns(3)
        c1.metric("원본 행 수", report["original_rows"])
        c2.metric("전처리 후 행 수", report["final_rows"])
        c3.metric("제거된 행 수", report["removed_rows"])

        st.write("처리 내역")
        st.json(report["actions"])

        st.subheader("전처리 결과")
        st.dataframe(cleaned.head(50), use_container_width=True)

        csv = cleaned.to_csv(index=False).encode("utf-8-sig")
        st.download_button(
            "전처리된 CSV 저장",
            data=csv,
            file_name="cleaned_data.csv",
            mime="text/csv"
        )

else:
    st.info("왼쪽이 아니라 위의 업로드 버튼에서 CSV 파일을 선택하세요.")
