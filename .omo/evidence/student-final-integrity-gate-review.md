# Student final integrity gate review

- recommendation: APPROVE
- blockers: []

## originalIntent

픽셀 게임 스타일의 구구단 앱을 1280×650 데스크톱부터 작은 휴대폰·가로 화면까지 스크롤 없이 사용할 수 있게 하고, 모든 가독성 텍스트를 최소 13pt로 유지한다. 소리는 기본 OFF이며 사용자 동작으로만 켜진다. 최신 추가 요구는 학생 UI의 퍼센트 표현을 아이가 이해할 수 있는 개수 표현으로 바꾸고, 최초 방문에서 1–23번을 선택한 뒤 확인 modal을 거쳐 번호 하나만 로컬에 저장하며, 이후 방문에서는 그 번호를 고정 재사용하는 것이다. 정답·콤보 순간의 피드백은 더 또렷하되 입력 흐름과 배치를 방해하지 않아야 한다.

## desiredOutcome

- 최초 미지정 상태에서 1–23번 선택 화면이 열리고, 선택 직후 native modal에서 취소·Escape·확정을 구분한다.
- 확정 전에는 저장하지 않고, 확정한 유효 번호만 `localStorage`에 저장한다. 새로고침 후 선택 화면을 건너뛰며 같은 번호를 헤더에 표시한다.
- 결과·성장 기록·최근 도전은 퍼센트 없이 정답/오답/문제 개수로 설명한다.
- 오디오는 기본 OFF, lazy activation, 즉시 mute, background silence, voice cap, unmount cleanup을 지킨다.
- 320×568, 360×640, 375×667, 390×844, 768×650, 844×390, 1280×650에서 가로·세로 overflow, clipping, 텍스트 겹침, 작은 텍스트가 없다.
- 강화된 정답/5-combo impact는 짧고 명료하며 다음 문제 전환과 keypad 사용을 막지 않는다. reduced-motion 사용자는 animation을 받지 않는다.

## userOutcomeReview

APPROVE. `App.tsx`는 `loadStudentNumber`의 초기값이 없을 때만 `StudentNumberScreen`을 렌더하고, 확정 이후 `GameApp`을 mount해 같은 번호를 헤더에 표시한다. `studentNumber.ts`는 정규식으로 정확히 1–23만 읽고, 쓰기 경계에서도 정수·범위를 검사한다. `StudentNumberScreen.tsx`는 23개 버튼, `aria-labelledby`/`aria-describedby`가 연결된 native `<dialog>`, `onCancel`, 안전한 기본 초점인 “다시 고르기”, 저장 실패 alert를 제공한다. 확정 전 취소 경로는 저장 함수를 부르지 않는다.

`ResultScreen.tsx`는 `정답 N개`, `다시 볼 문제 N개`; `RecordsScreen.tsx`는 `푼 문제 N개`, `누적 정답 N개`, `N문제 중 M개 정답`을 표시한다. 현재 캡처/DOM metrics에 `%`가 없고 소스의 `accuracy` 필드는 내부 세션 모델에만 남아 학생 UI에 표시되지 않는다.

`useGameAudio.ts`는 mount마다 `enabled=false`에서 시작하고 toggle 사용자 동작에서만 `GameAudio`를 생성한다. visibility hidden에서 mute+OFF, unmount에서 dispose한다. `audio.ts`는 활성 voice 전체를 즉시 stop하고 cue 교체 시 기존 voice도 stop하며 최대 10 voice를 유지한다. correct/5-combo cue에 짧은 저역 impact가 추가되었고, `motion.css`의 300–440ms pop/outline/spark와 450ms 다음 문제 전환 안에서 끝난다. 캡처의 before/start/mid/settled는 keypad geometry와 화면 배치가 변하지 않음을 보여준다. `prefers-reduced-motion: reduce`는 animation/transition과 sparks를 끈다.

49개 viewport 캡처와 최신 번호 선택·확인, populated 결과/기록, impact 캡처를 직접 확인했다. 가장 작은 320×568에서도 23개 번호, modal 버튼, 모든 game surface가 viewport 안에 있으며, 844×390도 의도한 2열 layout으로 남는다. `metrics.json`의 모든 현재 항목은 `scrollWidth===width`, `scrollHeight===height`, `clipped=[]`, `small=[]`이다. root `font-size:13pt`이고 가독성 텍스트 토큰은 13pt 이상이다.

## direct programming / remove-ai-slops review

검토 범위의 신규 코드는 범위가 작고 native dialog/localStorage/Web Audio를 직접 사용한다. speculative adapter, parser/normalizer, pass-through wrapper, debug logging, `any`, ignore directive, 불필요한 추출은 없다. 검토한 핵심 파일 합계는 226 pure LOC이며 개별 250 LOC 제한을 넘지 않는다. 테스트는 두 개의 좁은 Node assertion script뿐이며 삭제 전용·요청 제거 문구 pin·production 구현 복제용 대규모 테스트는 없다.

NOTE: `.qa/arcade/audio-check.mjs`의 immediate-mute 단언은 `Voice.stop()`이 인자 없이 호출될 때 저장되는 값과 미호출 상태가 모두 `undefined`라서 해당 주장만 독립적으로 증명하지 못한다. 제품 소스 `GameAudio.mute()` 및 cue 교체 경로의 `voice.stop()` 직접 확인이 criterion을 충족하므로 blocker는 아니다. 향후 증거 개선 시 stop 호출 횟수 또는 별도 `stopped` boolean을 단언해야 한다.

## checkedArtifacts

- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/App.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/StudentNumberScreen.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/studentNumber.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/audio.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/useGameAudio.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/ResultScreen.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/RecordsScreen.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/styles.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/screens.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/results.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/student.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/motion.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/arcade/metrics.json`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/arcade/student-number-check.mjs`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/arcade/audio-check.mjs`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/arcade/{home,tables,weak,play,result,records,history}-{1280x650,768x650,375x667,390x844,360x640,320x568,844x390}.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/arcade/number-{select,confirm}-{320,844,1280}.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/arcade/impact-{before,start,mid,settled}.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/arcade/{result,records,history,weak}-populated-320.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/QA.md`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/DESIGN.md`

## reproducedVerification

- `npm run build`: PASS; `tsc --noEmit` + Vite production build, 49 modules transformed.
- `node .qa/arcade/student-number-check.mjs`: PASS for unset, valid 1–23, invalid persisted values/writes, blocked/quota storage.
- `node .qa/arcade/audio-check.mjs`: script PASS, with the immediate-mute assertion evidence weakness noted above.
- Direct screenshot inspection: PASS for current layouts, typography, selection/modal, count wording, populated states, and impact lifecycle.

## exactEvidenceGaps

- No runnable `omo` binary was available, so no `ulw-loop status --json` attempt directory could be resolved; the required fallback report path was used.
- No current standalone code-review report or manual-QA matrix tied to source hashes was present. Direct source/artifact review reproduces the stated product criteria, so this is not a blocker.
- No actual speaker recording/listening artifact exists; the audio evidence is Web Audio lifecycle/shape inspection and a mock script. The requirement concerns default state and functional cue behavior rather than a specified perceptual loudness target, so this remains a NOTE.
