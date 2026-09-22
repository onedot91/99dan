# Student number reselection — functional gate review

## recommendation

REJECT

## originalIntent

활성 플레이가 아닐 때 헤더의 프로필/학생 번호 버튼으로 기존 1–23번 선택 화면을 다시 열고, 기존 확인 및 localStorage 저장 흐름으로 번호를 변경한다. 번호 변경 후에는 이전 학생의 cloud token/session을 절대 사용하지 않으며, 활성 플레이 중 같은 버튼은 기존처럼 안전하게 연습을 종료한다.

## desiredOutcome

- SC-1: 활성 플레이 밖에서 헤더 번호 버튼을 누르면 기존 1–23번 선택 화면이 열린다.
- SC-2: 번호를 누르면 기존 확인 dialog가 열리고, 확인 시 기존 저장 함수를 통해 선택 번호가 적용된다.
- SC-3: 번호를 바꾼 뒤 새 학생의 cloud 요청이 이전 학생의 token/session으로 전송되지 않는다.
- SC-4: 활성 플레이 중 헤더 번호 버튼은 재선택 화면을 열지 않고 기존 `g.end(true)` 동작을 유지한다.

## userOutcomeReview

SC-1, SC-2, SC-4는 현재 코드와 제공된 화면 증거에서 충족된다. `App.tsx`는 비-play 화면에서 `onReselect()`로 최상위 학생 번호 상태를 `null`로 바꾸어 기존 `StudentNumberScreen`을 다시 사용한다. 이 화면은 1–23 버튼, 기존 확인 dialog, `saveStudentNumber()`를 그대로 사용한다. play 화면에서는 같은 헤더 버튼이 계속 `g.end(true)`를 호출한다. `.qa/number-reselect`의 `home.jpg`, `number-select.jpg`, `number-20-confirm.jpg`도 홈의 1번 헤더, 1–23 선택기, `20번 / 내 번호가 맞아?` 확인 dialog를 각각 보여 준다.

SC-3는 결과 저장과 번호 재선택이 겹칠 때 보장되지 않는다. `useSharedGame.save()`는 component unmount 후에도 취소되지 않으며, 저장 후 `loadProfile(studentNumber)`를 실행한다. 사용자가 result 화면에서 재선택하고 새 번호를 확정한 뒤 이 이전 save가 그 줄에 도달하면 `connect(oldStudent)`가 module-global `registeredStudent`와 `token`을 이전 학생으로 되돌린다. 새 `GameApp`의 `beginRun()`/`finishRun()`은 학생 번호를 받거나 `connect(newStudent)`를 재확인하지 않고 현재 전역 token을 바로 사용하므로, 새 학생의 run이 이전 학생 session으로 전송될 수 있다.

## blockers

1. `violatedCriterion`: SC-3
   - Observation: 이전 결과 저장의 비동기 continuation이 번호 변경 후 cloud singleton을 이전 학생 session으로 되돌릴 수 있으며, 이후 새 학생의 run API는 그 token을 그대로 사용한다.
   - `evidencePointer`: `src/cloud/useSharedGame.ts:27-43` (`save()`가 unmount 취소 없이 마지막에 이전 closure의 `loadProfile(studentNumber)` 호출), `src/cloud/client.ts:23-33` (`connect()`가 module-global identity/token 교체), `src/cloud/client.ts:39-40` (`beginRun`/`finishRun`이 student identity 확인 없이 `request()` 호출), `src/App.tsx:21,31` (result 등 모든 non-play 화면에서 즉시 unmount/reselection 허용).

## direct programming / remove-ai-slops review

- 재선택 UI 변경 자체는 기존 `StudentNumberScreen`, `saveStudentNumber`, `g.end(true)`를 재사용하는 최소 변경이며 새 dependency, 불필요한 helper, parsing/normalization, debug code가 없다.
- 추가 test 파일은 없어 deletion-only, 요청 제거만 검증하는 test, tautological test, 구현 미러링 test는 발견되지 않았다.
- 반면 번호/session 격리의 경쟁 조건을 고정하는 회귀 test가 없다. 현재 수동 QA는 홈에서 1→20 확인 dialog까지의 순차 흐름만 다루며, result 저장 중 재선택과 지연된 old request가 교차하는 adversarial case를 검증하지 않는다.
- 검토 대상 네 파일의 합산 pure LOC는 131줄이며 이 변경으로 불필요한 대형 모듈이나 추상화가 추가되지 않았다.

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/App.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/StudentNumberScreen.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/cloud/client.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/cloud/useSharedGame.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/studentNumber.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/useRushGame.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/number-reselect/home.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/number-reselect/number-select.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/number-reselect/number-20-confirm.jpg`

## exactEvidenceGaps

- `omo ulw-loop status --json`은 현재 환경에 `omo` 실행 파일이 없어 실패했으며, 지침에 따라 fallback report path를 사용했다.
- 저장 중 재선택, 지연된 이전학생 request 완료, 이후 새학생 `beginRun`/`finishRun` header의 session token을 검증하는 동시성 QA/test artifact가 없다.
- 제공된 screenshots는 확인 dialog까지 증명하지만 `맞아, 시작!` 클릭 후 localStorage 값이 20으로 바뀐 상태나 최종 1번 복구를 직접 보여 주지는 않는다. 소스상 기존 저장 흐름 재사용은 확인했다.
- `npm run build` 통과는 입력으로 제공되었으나 read-only gate 범위 때문에 다시 실행하지 않았다.
