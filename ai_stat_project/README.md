# AI 통계 분석 도우미 1.1.0

Windows에서 인터넷 연결 없이 사용하는 무료 통계 분석 앱입니다. CSV를 불러와 전처리, 분석, 그래프, 한국어 해석과 HTML 보고서 저장까지 PC에서 처리합니다. 분석 안내는 계산 결과에 따른 규칙 기반 설명이며 생성형 AI 모델이나 유료 API를 사용하지 않습니다.

## 실행

`release/AI-Stat-Desktop/AI-Stat-Desktop.exe`를 실행하세요. 다른 Windows PC에는 `release/AI-Stat-Desktop-Windows-x64.zip`을 **전체 압축 해제**한 뒤 안의 실행 파일을 여세요. Python이나 Node.js 설치는 필요하지 않습니다. ZIP 안의 `resources` 폴더와 DLL은 실행 파일과 함께 있어야 합니다.

## 사용 순서

1. **CSV 파일 불러오기**에서 UTF-8 또는 CP949 CSV를 선택합니다.
2. 분석 목적과 변수를 선택하고 **통계 분석 실행**을 누릅니다. 추천 항목은 변수의 유형과 범주 수로 만든 후보이므로 연구 목적에 맞는지 확인하세요.
3. 필요한 경우 결측치와 이상치 처리 방법을 선택해 **전처리 실행**을 누릅니다. **분석 데이터**를 전처리된 데이터로 바꾼 뒤 다시 분석하면 전후 결과를 비교할 수 있습니다.
4. **분석 보고서 저장**으로 그래프가 포함된 HTML을 저장하거나 **CSV로 저장**으로 전처리 결과를 저장합니다. HTML은 인터넷 없이 브라우저에서 열거나 인쇄할 수 있습니다.

지원 분석: 기술통계, Welch 독립 두 집단 t검정, 일원분산분석, Pearson·Spearman 상관, 단순 선형회귀, 카이제곱 독립성 검정. 결측 행은 선택한 변수에 한해 분석에서 제외됩니다. 통계 가정은 자동 검증되지 않으므로 보고서의 확인 사항을 읽고, 중요한 판단에는 전문가 검토를 받으세요.

## 개발 및 검증

Node.js 20 이상이 있는 개발 PC에서 이 폴더로 이동해 실행합니다.

```powershell
npm install
npm test
python tests/compare_scipy.py node
./node_modules/electron/dist/electron.exe tests/smoke.js
```

SciPy 대조는 개발 검증용이며 앱 실행에는 필요하지 않습니다. 화면 테스트는 실제 Electron 창에서 CSV 열기, 7가지 분석, 보고서·전처리 CSV 저장, 저장 실패와 데이터 전환을 확인합니다. 결과와 화면 이미지는 `tests/artifacts/`에 생성됩니다.

## Windows 배포본 만들기

```powershell
./node_modules/.bin/electron-builder.CMD --win dir --x64
```

생성된 `dist/win-unpacked`의 전체 내용을 `release/AI-Stat-Desktop`에 담고 ZIP으로 묶습니다. `release`는 Git에서 제외되므로 실행 파일과 ZIP을 배포할 때는 GitHub Release에 별도 첨부합니다.

기존 `app.py`와 `modules/`는 이전 Python 버전 비교용입니다. 1.1.0 데스크톱 앱은 해당 파일을 실행하지 않습니다.
