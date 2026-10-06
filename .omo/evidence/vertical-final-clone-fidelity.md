# 세로셈 최종 시각·디자인 시스템 검토

- recommendation: APPROVE
- visual verdict: PASS
- blockers: 없음
- 범위: 시간 제한 없는 두 자리 곱셈 5문제의 home/setup/play/result/replacement dialog 및 최신 점·밑줄 제거 요구.
- 기준: 제공된 사용자 요구와 현재 `DESIGN.md`. 정확한 외부 복제 디자인은 제공되지 않았다.
- 구현 변경 없음. 역할 지침에 따른 이 보고서만 작성했다.

## Findings by severity

### CRITICAL

없음. UI를 이미지로 대체한 증거가 없다.

### HIGH

없음. 기존 데스크톱 증거의 검정 잘림은 새로운 `clean-start-1280.png`에서 해소되었다.

### MEDIUM

없음. 현재 `clean-setup-320.png`에서 3단계 설명은 `덧셈 올림까지 연습` 한 줄로 표시되어 이전 한 글자 고립 현상이 해소되었다.

### LOW

현재 검토 범위에서 없음.

## 직접 확인한 결과

- `DigitCell`의 실제 button/span과 `VerticalBoard`의 반복 행·열이 숫자와 입력을 렌더링한다 (`src/components/VerticalScreen.tsx:8`, `:14`, `:24`). 미래 칸은 빈 span이고 활성 입력의 내용은 session.entry다 (`:30`, `:33`). 화면 캡처를 붙인 UI가 아니다.
- `NumberPad`, `Icon`, `arcade-panel`, `primary-button`, `quiet-button`을 재사용한다. `NumberPad.tsx`의 버튼은 키 값을 실제 onInput으로 전달한다.
- 색, 글꼴, 일반 간격, 베벨은 `src/styles.css:2`의 공통 토큰과 연결되어 있다 (`src/vertical.css:6`, `:29`, `:45`). 남아 있는 수치값은 최소 터치 크기·행 높이·반응형 상한 등의 기하 제약이다. 독립적인 일회성 색상/타이포그래피 체계가 아니다. 기존 별·산 장식은 배경이며 학습 UI를 대신하지 않는다.
- 320px 시작·진행 캡처에서 빈 노란 입력칸 안팎의 점과 피연산자 밑줄이 없다. 세로 점선은 자리 구분선으로 유지된다. `DigitCell`은 value만 출력하며 source-digit은 색상만 바꾼다 (`src/components/VerticalScreen.tsx:9`, `src/vertical.css:49`).
- 58×61 진행 캡처의 올림 4는 백의 자리 열 위에 놓인다. 단계 생성도 십의 자리 곱셈의 올림을 shift+1 위치에 배치한다 (`src/game/vertical.ts:28`). 활성 입력칸 역시 같은 열 격자를 사용한다.
- 모바일에서는 계산판 아래 4열×3행 키패드가 완전히 보이며 지우기·0·확인은 오른쪽 열이다. 데스크톱은 계산판 왼쪽, 3열×4행 키패드 오른쪽으로 배치되고 새 1280×650 캡처 전체가 정상 표시된다.
- 7개 캡처에서 한글 glyph 누락, 한 글자 고립, 텍스트 겹침 또는 조작 버튼 잘림을 발견하지 못했다. 확인창 본문과 취소/새로 시작 버튼도 경계 안에 있다.
- CSS의 활성 칸 최소 크기는 44×44px, 모바일 키 높이도 최소 44px이다 (`src/vertical.css:41`, `src/mobile.css:63`). 제공 캡처에서는 키와 계산판의 시각적 영역이 분리된다.

## Inspected evidence

다음 7개 PNG 모두 view_image로 직접 열어 검사했다.

1. `/private/tmp/99dan-vertical-iab-evidence/clean-home-320.png`
2. `/private/tmp/99dan-vertical-iab-evidence/clean-setup-320.png`
3. `/private/tmp/99dan-vertical-iab-evidence/clean-start-320.png`
4. `/private/tmp/99dan-vertical-iab-evidence/clean-input-320.png`
5. `/private/tmp/99dan-vertical-iab-evidence/clean-start-1280.png`
6. `/private/tmp/99dan-vertical-iab-evidence/clean-result-320.png`
7. `/private/tmp/99dan-vertical-iab-evidence/clean-dialog-320.png`

검토한 코드/계약: `src/components/VerticalScreen.tsx`, `src/components/NumberPad.tsx`, `src/vertical.css`, `src/mobile.css`, `src/game/vertical.ts`, `src/game/useVerticalGame.ts`, `src/styles.css`의 토큰·기본 스타일, `DESIGN.md`. 현재 tracked diff의 `App.tsx`, `HomeScreen.tsx`, `types/game.ts`, 문서 및 모바일 스타일 변경도 확인했다. 신규 파일은 실제 본문을 읽었다.

검증 기록: `/private/tmp/99dan-vertical-iab-evidence/final-qa.md`. 이전 보고서 `.omo/evidence/vertical-multiplication-clone-fidelity.md`는 이전 blocker의 비교에만 사용했다. 구 캡처 `clean-input-1280.png`는 최종 판단에서 제외했다. 별도 notepad 경로는 제공되지 않았다.

## 검증 한계

이 검토는 현재 소스와 제공된 7개 렌더링의 시각 검토다. 브라우저를 실행하지 않았고 테스트·빌드를 재실행하지 않았다. final-qa.md의 7/7 테스트, 8,100개 곱셈, DOM overflow 및 실제 입력 검증은 작성자의 기록이며 독립 실행 결과로 주장하지 않는다. 최신 데스크톱 진행/올림 화면은 이번 7개 증거에 없으므로, 데스크톱의 모든 단계까지 시각 검증했다고 주장하지 않는다. 학교 실기기와 보조기술은 미검증이다.
