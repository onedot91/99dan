# Student-number session safety — fresh gate review

## recommendation

APPROVE

## blockers

None.

## originalIntent

활성 플레이 밖에서는 헤더의 학생 번호 버튼으로 기존 1–23번 선택 화면을 다시 열고 기존 확인/저장 흐름으로 번호를 변경한다. 활성 플레이 중에는 같은 버튼이 기존 종료 동작을 유지한다. 번호 변경과 이전 학생의 비동기 cloud 작업이 겹쳐도 이전 학생의 token/session이 새 학생의 profile, begin, finish, leaders 요청에 사용되지 않아야 한다.

## desiredOutcome

- SC-1: non-play 화면에서 헤더 버튼이 기존 학생 번호 선택기를 연다.
- SC-2: 번호 선택 후 기존 확인 dialog와 `saveStudentNumber()` 흐름으로 새 번호를 적용한다.
- SC-3: 이전 학생의 지연된 async continuation이 새 학생의 profile/begin/finish/leaders 요청에 쓰이는 token을 변경할 수 없다.
- SC-4: play 화면에서 헤더 버튼은 selector를 열지 않고 `g.end(true)`를 호출한다.
- SC-5: 모든 cloud 호출부가 대상 `studentNumber`를 명시적으로 전달한다.

## userOutcomeReview

SC-1, SC-2, SC-4는 충족된다. `App.tsx:19-31`에서 non-play 클릭은 최상위 `studentNumber`를 `null`로 바꾸어 기존 `StudentNumberScreen`을 렌더링하고, play 클릭은 `g.end(true)`를 유지한다. `StudentNumberScreen.tsx:12-26`은 1–23 선택, 확인 dialog, `saveStudentNumber()`를 그대로 사용한다. 세 screenshot도 1번 홈, 1–23 selector, 20번 확인 dialog를 실제 화면으로 보여 준다.

SC-3와 SC-5도 충족된다. `src/cloud/client.ts:8-9`의 token과 registration promise는 모두 `Map<number, ...>`이며, `connect(studentNumber)`의 모든 읽기/쓰기/정리는 전달된 동일 학생 번호 키에만 작용한다 (`:16-29`). 따라서 이전 학생의 늦은 registration 완료는 `tokens.set(oldStudent, token)`만 수행하고 새 학생 key를 덮어쓰지 않는다. 401 경로도 해당 학생 key만 삭제하고 같은 학생 번호로 재시도한다 (`:31-39`). `loadProfile`, `beginRun`, `finishRun`, `loadLeaders`는 모두 학생 번호를 필수 인자로 받아 `authenticated(studentNumber, ...)`에 전달한다 (`:42-49`). 전체 호출부 검색 결과 `useSharedGame.ts`의 profile/begin/finish와 `HallScreen.tsx`의 leaders 모두 현재 closure/prop의 `studentNumber`를 명시적으로 전달한다. 이전 학생의 unmount 후 save continuation이 남아 있어도 그 continuation이 접근하는 key는 이전 학생 번호뿐이다.

## programming / remove-ai-slops direct pass

- 현재 수정은 이전 단일 global identity/token 문제를 학생별 Map 두 개로 고친 최소 범위 변경이다. 새 dependency, pass-through wrapper, 단일 사용 helper, 별도 parser/normalizer, debug 코드가 추가되지 않았다.
- `registrations`는 동일 학생의 동시 register만 합치고 학생 간 promise를 공유하지 않는다. `finally`의 identity check는 같은 key에 더 최신 promise가 생겼을 때 이를 지우지 않는 유효한 concurrency guard다.
- 삭제만 검증하는 test, 요청된 제거를 문자열로 확인하는 test, tautological test, 구현 미러링 test는 없다. 프로젝트 자체에 test suite가 없으므로 과도한 test도 없다.
- `client.ts`는 50 pure LOC로 oversized-module 기준에 해당하지 않는다.
- NOTE: 동시성 회귀 자동 test가 없어 향후 회귀 방지는 약하다. 하지만 SC-3은 현재 구현의 key-scoped 상태와 모든 호출부의 명시적 번호 전달로 직접 확인되며, 성공 기준이 test artifact 자체를 요구하지 않으므로 blocker가 아니다.
- NOTE: `client.ts`의 bare `fetch`와 일부 bare `Error`는 `omo:programming`의 이상적 기준과 다르지만 이번 성공 기준의 학생별 session 격리를 위반하지 않으므로 blocker가 아니다.

## verification

- `npx tsc --noEmit`: PASS (2026-09-22, fresh gate run)
- `npx vite build --outDir /private/tmp/99dan-gate-build --emptyOutDir`: PASS, 54 modules transformed (2026-09-22, fresh gate run)
- exported cloud API call-site search: PASS; every profile/begin/finish/leaders call supplies `studentNumber`
- local screenshot inspection: PASS for home header, selector, and 20 confirmation dialog

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/cloud/client.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/cloud/useSharedGame.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/HallScreen.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/App.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/StudentNumberScreen.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/studentNumber.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/number-reselect/home.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/number-reselect/number-select.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/number-reselect/number-20-confirm.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.omo/evidence/number-reselect-functional-gate-review.md`

## exactEvidenceGaps

- `omo ulw-loop status --json`은 환경에 `omo` executable이 없어 실행되지 않았다. 지침에 따라 fallback 경로 `.omo/evidence/number-session-fresh-gate-review.md`를 사용했다.
- 별도 executor report, code review report, manual QA matrix, notepad path는 입력에 제공되지 않았다. 이전 gate report와 현재 source/build/screenshot artifacts를 직접 재검증했다.
- 저장 중 재선택과 지연된 이전 학생 응답을 실제 network timing으로 교차시키는 자동 test artifact는 없다. 현재 코드의 학생별 key isolation을 정적 추적해 충족을 확인했다.
- screenshot은 20번 확인 버튼 클릭 뒤 최종 home을 직접 보여 주지 않는다. 입력에는 브라우저에서 1번을 재선택하고 cloud-loaded home까지 성공했다는 실행 증거가 제공되었고, 현재 gate는 사용자 지시에 따라 브라우저를 다시 사용하지 않았다.
- 저장소 전체가 Git 기준 untracked 상태라 기준 commit 대비 변경 diff를 복원할 수 없다. 검토는 현재 파일 전체와 이전 gate artifact를 대상으로 했다.
