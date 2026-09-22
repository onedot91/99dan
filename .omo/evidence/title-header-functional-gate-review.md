# Title/header functional gate review

## recommendation

APPROVE

## originalIntent

로그인된 앱 헤더에서 게임 제목을 제거하여 동물 프로필과 학생 번호만 보이게 하고, 게임 제목이 필요한 화면 및 문서 메타데이터에서는 제목을 `구구단 게임`으로 통일한다.

## desiredOutcome

- SC-1: 로그인 후 모든 화면의 헤더 브랜드 영역에는 프로필 이미지(없으면 기존 대체 아이콘)와 학생 번호만 표시된다.
- SC-2: 헤더 브랜드 버튼은 현재 화면 맥락에 맞는 접근 가능한 이름과 기존 이동/종료 동작을 유지한다.
- SC-3: 게임 제목을 표시해야 하는 홈, 최초 학생 번호 선택 화면, 브라우저 문서 제목 및 프로젝트 문서에는 `구구단 게임`이 사용된다.
- SC-4: 375×667, 768×650, 1280×650 화면에서 레이아웃·가독성·조작을 막는 회귀가 없다.

## userOutcomeReview

요청한 결과가 실제 산출물에 반영되었다. `App.tsx`의 로그인 후 `.brand-button`은 avatar/fallback icon과 `${studentNumber}번`만 렌더한다. 버튼의 접근 가능한 이름은 홈 등 일반 화면에서 `처음으로`, 플레이 중에는 `연습을 마치고 기록 보기`이며 기존 클릭 동작과 일치한다. `HomeScreen.tsx`, `StudentNumberScreen.tsx`, `index.html`, `DESIGN.md`, `README.md`, `QA.md`에서 사용자-facing 게임 이름은 `구구단 게임`으로 확인되었고, 범위 내에서 이전 게임 제목 문자열은 발견되지 않았다.

6개 현재 캡처 모두 헤더에 프로필과 `1번`만 보이고 게임 제목이 재등장하지 않는다. 홈의 큰 제목은 세 크기 모두 `구구단 게임!`으로 읽히며, 기록 화면도 헤더/콘텐츠가 겹치거나 잘리지 않는다. 제공된 DOM 측정 결과는 세 크기에서 문서 높이와 viewport가 같고, 화면 밖 요소 및 13pt 미만 텍스트가 0이며, 문서 제목은 `구구단 게임`, `.brand-button` 텍스트는 정확히 `1번`이다. 직접 재현한 `npm run build -- --outDir /private/tmp/99dan-title-gate-build`도 TypeScript 검사 후 Vite 54 modules 빌드에 성공했다.

## direct remove-ai-slops / programming pass

- 변경 의도는 기존 JSX에서 제목 span을 제거하고 필요한 제목 문자열을 교체하는 최소 범위다. 새로운 helper, parsing, normalization, dependency, dead branch, debug output은 없다.
- 요청된 제거 자체를 확인하는 테스트, 자연어 문자열 고정 테스트, 삭제 전용/tautological/implementation-mirroring 테스트가 추가되지 않았다.
- `App.tsx`의 타입 계약과 React 상태/이벤트 흐름은 유지된다. 이번 변경으로 새 `any`, assertion, non-null assertion, catch, mutation escape hatch가 생기지 않았다.
- 별도 code review report는 이번 좁은 변경용으로 제공되지 않았다. 직접 diff/source/slop pass와 빌드 및 UI artifact 검증이 SC-1~SC-4를 모두 뒷받침하므로 승인 차단 근거가 아니다.

## checkedArtifacts

- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/App.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/HomeScreen.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/StudentNumberScreen.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/styles.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/index.html`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/README.md`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/QA.md`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/title-update/home-375.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/title-update/home-768.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/title-update/home-1280.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/title-update/records-375.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/title-update/records-768.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/title-update/records-1280.jpg`
- `/private/tmp/99dan-title-gate-build` (독립 재현 빌드 출력)

## blockers

없음.

## evidenceGaps

- 이 변경 전용 자동 브라우저 실행 로그/metrics JSON은 artifact 목록에 없고 관측값만 제공되었다. 다만 6개 현재 캡처, 직접 소스 검사, 기존 QA 계약, 독립 빌드가 SC-1~SC-4의 승인 판단을 충분히 지지한다.
- 스크린리더 직접 실행은 이번 검토에서 수행하지 않았다. 버튼의 명시적 `aria-label`, 장식 이미지의 빈 `alt`, DOM 구조를 소스에서 확인했다.

