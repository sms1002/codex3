# AI 통계 분석 도우미 — Windows Desktop

기존 Streamlit 웹 화면을 Electron(Chromium) 기반 Windows 데스크톱 앱으로 전환한 버전입니다. 분석은 외부 서버 없이 사용자 PC 안에서 처리됩니다.

## 바로 실행하기

`release/AI-Stat-Desktop/AI-Stat-Desktop.exe`를 실행합니다. 다른 Windows PC로 옮길 때는 `release/AI-Stat-Desktop-Windows-x64.zip` 전체를 복사한 뒤 압축을 풀어 사용합니다. Python과 Node.js는 필요하지 않습니다.

- CSV 업로드
- 데이터 크기 확인
- 변수 유형 자동 판별
- 결측치 개수/비율 확인
- IQR 기반 이상치 탐지
- 중복 행 제거
- 결측치 대체 또는 행 삭제
- 이상치 경계값 조정 또는 행 삭제
- 전처리된 CSV 다운로드

## 개발 모드 실행

Node.js 20 이상을 설치한 뒤 프로젝트 폴더에서 실행합니다.

```powershell
npm install
npm start
```

## Windows 설치 파일 만들기

```powershell
npm run dist
```

완성된 설치 파일은 `dist` 폴더에 생성됩니다. 설치 없이 실행하는 단일 파일이 필요하면 `npm run dist:portable`을 사용하세요.

## 기존 파이썬 버전

기존 `app.py`와 `modules`는 비교 및 참고를 위해 남겨 두었습니다. 새 데스크톱 앱은 Python이나 Streamlit 서버를 실행하지 않습니다.
