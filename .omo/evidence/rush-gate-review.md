# Final Visual Gate Review — 구구단 러시

- recommendation: REJECT
- requestedVerdict: REVISE
- blockers:
  - violatedCriterion: `DESIGN.md — Layout and primitives: Header contains brand and navigation action; Accessibility and responsive behavior: layout fits 375, 768, 1280px widths`
    type: evidence
    observation: `weak`의 375/768/1280 캡처에는 헤더 전체가 없고, `records`의 375/768/1280 캡처에는 브랜드 마크 왼쪽이 이미지 경계에서 잘려 있다. 그러나 같은 캡처를 설명하는 `capture-metrics.json`은 모든 해당 화면의 header.top=0과 정상적인 header.left/right를 기록한다. 이미지와 측정값이 서로 모순되므로 최종 시각 증거로 헤더 및 무잘림 기준을 재현할 수 없다.
    evidencePointer: `.qa/weak-375.jpg`, `.qa/weak-768.jpg`, `.qa/weak-1280.jpg`, `.qa/records-375.jpg`, `.qa/records-768.jpg`, `.qa/records-1280.jpg`, `.qa/capture-metrics.json`

## originalIntent

기존 블록·개수 세기 시제품을 밝고 미니멀한 구구단 회상 훈련 앱으로 교체한다. 사용자는 홈의 세 모드에서 연습을 시작하고, 식을 가장 먼저 보며 큰 3×4 키패드 또는 물리 키보드로 답한다. 375px, 768px, 1280px에서 헤더·콘텐츠·상태·조작 요소가 겹치거나 잘리지 않아야 한다.

## desiredOutcome

모든 화면에서 브랜드와 이동 액션이 있는 헤더가 안정적으로 보이고, 홈·설정·플레이·결과·기록 화면이 세 기준 폭에 맞게 표시된다. 플레이 화면은 큰 식과 44px 이상의 조작 영역을 제공하고, 긴 결과 및 기록 화면은 세로 스크롤로 전체 내용을 확인할 수 있어야 한다.

## userOutcomeReview

기능 구현과 대부분의 화면은 의도에 부합한다. 홈은 정확히 세 개의 큰 모드 액션을 제공하며, 플레이 화면은 식을 가장 크게 배치하고 3×4 키패드와 명확한 진행·점수·콤보 상태를 보여 준다. 설정, 결과, 기록 화면의 카드와 CTA도 일관된 색상·간격·타이포그래피를 사용한다. 375px 플레이 화면에 겹침이 없고, 측정된 키패드 버튼은 105×64px로 목표를 충족한다. 결과 및 기록 하단 캡처도 CTA와 안내 문구까지 확인 가능하다.

다만 최종 캡처 세트와 측정 JSON이 약한 구구단 및 기록 화면의 헤더 표시 여부를 서로 다르게 증명한다. 이 불일치는 사용자에게 전달될 실제 화면의 상태인지 캡처 도구의 산출물 문제인지 현재 아티팩트만으로 구분할 수 없다. 따라서 헤더와 세 기준 폭 무잘림이라는 명시 기준에 대해 최종 승인할 수 없다.

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Documents/GitHub/99dan/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/README.md`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/App.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/*.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/*.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/types/game.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/styles.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/screens.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/results.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/{home,play,tables,weak,result,records}-{375,768,1280}.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/result-bottom-375.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/records-bottom-375.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/capture-metrics.json`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/layout-metrics.json`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/algorithm-check.txt`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.omo/evidence/rush-final-integrity-gate-review.md`

## verification

- `npm run build`: PASS. `tsc --noEmit`와 Vite production build가 성공했다.
- 직접 이미지 판독: 18개 기본 JPEG, 결과/기록 하단 2개를 확인했다.
- 캡처 측정값: 요청 viewport, clientWidth, scrollY=0, header bounds를 확인했다.
- 조작 영역: `.qa/layout-metrics.json`은 768/1280에서 44px 미만 버튼 0개를 기록한다. 전달된 375px 측정값 105×64px도 기준을 충족한다.

## directRemoveAiSlopsAndProgrammingPass

변경 소스와 테스트 범위를 직접 확인했다. 자동화 테스트 파일이 없어 삭제 확인만 하는 테스트, 제거 문구 고정 테스트, tautological test, 구현 미러링 테스트는 없다. 프로덕션 코드에는 불필요한 parser/normalizer, 네트워크·영속성 계층, 디버그 로그, broad catch, 타입 회피가 없다. 각 TypeScript/TSX 파일은 250 pure LOC 이하이며, 가장 큰 `useRushGame.ts`는 99 pure LOC이다. compact one-line JSX/CSS는 유지보수성이 낮지만 명시 성공 기준 위반이 아니므로 NOTE다.

기존 기능 게이트 보고서는 동일한 remove-ai-slops/programming 관점과 overfit 항목을 명시적으로 다룬다. 해당 보고서의 오래된 PNG 경로 및 이전 375px 측정 공백은 이번 직접 JPEG·JSON 판독으로 대체 확인했다.

## notes

- 긴 화면의 JPEG 폭이 viewport보다 15px 작은 현상은 `clientWidth` 및 native scrollbar 제외 설명과 일치한다. 그 자체는 제품 CSS overflow 증거가 아니다.
- `weak` 화면의 헤더 누락과 `records` 화면의 브랜드 잘림은 위 scrollbar 폭 차이만으로 설명되지 않으며, 같은 JSON의 header bounds와도 모순된다.
- 별도 테스트 스위트 부재는 회귀 보호를 줄이지만 명시된 시각 성공 기준의 독립 blocker는 아니다.

## exactEvidenceGaps

- `weak` 375/768/1280에서 `App.tsx`가 항상 렌더링하는 헤더가 캡처에 나타나지 않는 이유를 설명하거나 정상 렌더를 증명하는 일치된 이미지가 없다.
- `records` 375/768/1280에서 브랜드 마크가 왼쪽 경계에 잘린 이미지와 정상 header.left를 기록한 측정값 중 어느 것이 실제 viewport 렌더를 대표하는지 확인할 독립 증거가 없다.
- executor report, 별도 code-review report, manual-QA markdown matrix, notepad path는 제공되지 않았다. 기능 보고서와 직접 검토가 주요 기능을 지지하므로 이 문서 부재 자체는 blocker가 아니다.
