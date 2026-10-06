# 세로셈 시각·디자인 시스템 검토

- recommendation: REQUEST_CHANGES
- visual verdict: REVISE
- confidence: HIGH (제공된 캡처의 결함 판단), desktop 제품 화면은 확인 불가
- 검토 범위: 시간 제한 없는 두 자리 곱셈 5문제의 home/setup/play/result/replacement dialog. 정확한 픽셀 복제 대상은 없으며 `DESIGN.md`를 계약으로 사용했다.
- 구현 파일은 수정하지 않았다. 이 보고서만 작성했다.

## Findings

### CRITICAL

없음. 화면 대용 이미지나 가짜 입력 UI는 발견하지 못했다.

### HIGH

1. **[evidence] 데스크톱 캡처가 불완전하다.** `/private/tmp/99dan-vertical-iab-evidence/clean-input-1280.png`에서 x≈320 이후와 y≈568 이후 영역이 검정이다. 계산 숫자와 키패드 대부분이 보이지 않아 1280×650 자리 정렬·가용 공간·클리핑을 승인할 수 없다. 제품 결함이라고 단정하지 않는다. 완전히 합성된 현재 화면 증거가 필요하다.

### MEDIUM

1. **[product] 320px 단계 선택에서 한글 어미 한 글자가 고립된다.** `clean-setup-320.png`의 세 번째 카드 설명(대략 x80–266, y375–416)이 `마지막 덧셈도 올림하 / 기`로 줄바꿈된다. 렌더링 위치는 `src/components/VerticalScreen.tsx:61`, 설명 스타일은 `src/vertical.css:9`. 검토 중 `src/game/vertical.ts:9`의 문구가 `덧셈 올림까지 연습`으로 변경된 것을 확인했지만 새 렌더링은 이 검토 대상에 없으므로 해결 여부를 승인하지 않았다.

### LOW

없음.

## 확인된 정상 구현

- `DigitCell`과 `VerticalBoard`는 실제 button/span/grid 구조이다 (`src/components/VerticalScreen.tsx:8`, `:14`). 현재 칸만 활성화하고 미래 칸은 빈 span으로 렌더링한다 (`:26`, `:30`, `:33`).
- 기존 `NumberPad`, `Icon`, `arcade-panel`, `primary-button`, `quiet-button`을 재사용한다 (`src/components/VerticalScreen.tsx:5`, `:105`, `:110`). UI를 래스터 이미지로 대체한 흔적은 없다.
- 색상·글꼴·간격·베벨은 기존 `src/styles.css:2`의 토큰을 사용한다. 행 최소 높이와 반응형 상한 등 숫자값은 `DESIGN.md` 세로셈 계약에 명시된 크기와 대응하며, 일회성 색상 체계로 분기하지 않는다.
- `clean-start-320.png`와 `clean-input-320.png`에서 숫자 밑줄, 입력 칸 내부 점, 입력 칸 외부 점이 보이지 않는다. 노란 현재 칸과 세로 점선은 명확하다.
- `clean-input-320.png`의 58×61에서 작은 올림 4가 백의 자리 열 위에 놓여 있다. 구현 역시 십의 자리 곱셈의 올림을 `shift+1` 열로 계산한다 (`src/game/vertical.ts:28`).
- 모바일 계산 영역은 대략 y90–378을 사용하며 키패드와 겹치지 않는다. 키패드 오른쪽 열은 지우기·0·확인 순서이다.
- home/result/dialog의 제공된 모바일 화면에서 텍스트 잘림·겹침은 발견하지 못했다. dialog 본문은 의미 단위로 읽히고 두 버튼이 영역 안에 들어간다.

## 직접 검사한 증거

모든 아래 PNG를 `view_image`로 각각 직접 열었다. 이전 이미지들은 판단에 사용하지 않았다.

1. `/private/tmp/99dan-vertical-iab-evidence/clean-home-320.png`
2. `/private/tmp/99dan-vertical-iab-evidence/clean-setup-320.png`
3. `/private/tmp/99dan-vertical-iab-evidence/clean-start-320.png`
4. `/private/tmp/99dan-vertical-iab-evidence/clean-input-320.png`
5. `/private/tmp/99dan-vertical-iab-evidence/clean-input-1280.png`
6. `/private/tmp/99dan-vertical-iab-evidence/clean-result-320.png`
7. `/private/tmp/99dan-vertical-iab-evidence/clean-dialog-320.png`

읽은 소스: `DESIGN.md`, `src/components/VerticalScreen.tsx`, `src/vertical.css`, `src/mobile.css`, `src/components/NumberPad.tsx`, `src/styles.css` 토큰 및 공통 규칙, `src/game/vertical.ts` 단계 생성부. 통합 변경은 `src/App.tsx`, `src/components/HomeScreen.tsx`, `src/types/game.ts`, `src/mobile.css`의 diff로 확인했다. 새 VerticalScreen/vertical.css는 untracked여서 전체 파일을 읽었다. 브랜치: `feature/pixel-arcade-pets`.

`stat`으로 제공된 캡처가 최초 검토 대상 VerticalScreen/vertical.css/mobile.css보다 나중에 생성되었음을 확인했다. 다만 검토 중 문구 수정이 발생했으므로 전체 현재 빌드에 대한 최종 승인은 아니다. notepad 경로는 제공되지 않았다.

## 검증 한계와 blockers

- 깨진 desktop 캡처를 완전한 캡처로 교체하고 독립적으로 다시 확인해야 한다.
- 변경된 3단계 설명의 320px 렌더링을 다시 확인해야 한다.
- 부모 실행자가 보고한 DOM overflow=0, touch ≥44px, 7개 테스트/8,100개 곱셈/빌드 성공은 이 시각 검토에서 재실행하지 않았다. 이 보고서는 해당 기능 검증을 별도로 승인하지 않는다.
- 이후 부모 실행자는 fullPage 캡처로 desktop 증거를 고쳤다고 알렸으나, 새 캡처는 후속 독립 검토 대상이다.
