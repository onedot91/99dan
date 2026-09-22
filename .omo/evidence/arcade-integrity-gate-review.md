# Final Gate Review — arcade-integrity

## recommendation

APPROVE

## blockers

[]

## originalIntent

구구단 게임을 1280×650 Chromebook과 지정된 모바일/가로 화면에서 문서 스크롤 없이 조작 가능한 독자적 pixel arcade UI로 전면 개편한다. 기존 64개 식, 60초 도전, 단별 연습, 약한 문제 학습을 유지하고, 실제 React DOM과 독자적 SVG를 사용한다. 효과음은 새로고침마다 기본 OFF이며 사용자 제스처로만 켜지고 즉시 끌 수 있어야 한다. 정답·오답·콤보·결과에 의미 있는 모션과 피드백을 제공한다.

## desiredOutcome

- `DESIGN.md`의 색상·타입·간격·프레임 토큰을 공유하는 일관된 pixel arcade 화면.
- home/tables/weak/play/result/records/history가 1280×650, 768×650, 375×667, 390×844, 360×640, 320×568, 844×390에서 잘림·문서 스크롤·13pt 미만 텍스트 없이 동작.
- 실제 버튼, 탭, pager, keypad, focus/disabled 상태와 live status가 동작.
- audio context는 소리 토글 제스처 전에는 생성되지 않고, OFF→ON→OFF, visibility mute, voice 제한/정리가 안전하게 동작.
- 정답, 오답, 5-combo, 결과 진입 모션이 상태를 전달하며 reduced-motion에서 움직임만 제거.

## userOutcomeReview

요청한 사용자 결과를 충족한다. `src/App.tsx`와 화면 컴포넌트는 실제 DOM 버튼·탭·목록·SVG로 구성되어 있고 raster/background screenshot 대체가 없다. CSS는 `:root` 토큰과 공용 primitive를 사용하며 지정 색상, 13pt 기본 글자, 44/48px 조작 크기, desktop/portrait/short-landscape 레이아웃을 일관되게 구현한다.

`.qa/arcade/metrics.json`의 111개 측정 레코드(62개 고유 상태명)는 전부 `scrollWidth === width`, `scrollHeight === height`, `clipped: []`, `small: []`다. 64개 JPEG 모두 실제 JPEG signature와 명시 크기가 맞고 현재 CSS보다 새롭다. 1280×650의 7개 화면, 320×568의 핵심/채움 상태, 844×390 가로 화면, combo/wrong feedback를 직접 열어 확인했으며 텍스트 겹침, 잘린 조작부, 비정상 합성, 정보 위계 붕괴를 찾지 못했다.

오디오는 `useGameAudio.ts:6`에서 매 mount OFF로 시작하고, `toggle()` 사용자 클릭 경로에서만 `GameAudio`를 생성/activate한다. `audio.ts`는 low-pass/compressor/gain envelope, 최대 10 voice, cue 전환 시 기존 voice 정지, 즉시 mute와 dispose를 구현한다. hidden 전환은 mute와 UI OFF를 함께 적용해 stale cue가 복귀 시 재생되지 않는다. 정답/오답/콤보/finish cue는 run phase와 screen 전환에서만 발생한다.

모션은 `motion.css`에서 page 180ms, correct 280ms, wrong 220ms, combo, sparks, result 500ms로 실제 상태 class에 연결되고 transform/opacity만 애니메이션한다. `prefers-reduced-motion`은 애니메이션/transition을 끄고 상태 문구와 색 피드백은 유지한다. 장식성 무한 모션은 없다.

`npm run build`를 직접 재실행해 TypeScript 검사와 Vite production build가 통과했다(46 modules transformed). 명시된 성공 기준 위반은 없다.

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Documents/GitHub/99dan/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/App.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/*.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/audio.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/useGameAudio.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/useRushGame.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/learning.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/styles.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/screens.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/results.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/src/motion.css`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/.qa/arcade/metrics.json`
- Representative direct image inspection: `.qa/arcade/{home,tables,weak,play,result,records,history}-1280x650.jpg`, core/populated 320×568 captures, `{home,play,result}-844x390.jpg`, `combo-feedback.jpg`, `wrong-feedback.jpg`
- Existing reports under `/Users/ibyeonghyeon/Documents/GitHub/99dan/.omo/evidence/`
- `/Users/ibyeonghyeon/Documents/GitHub/99dan/QA.md`

## programmingAndRemoveAiSlopsPass

직접 `programming` 및 `remove-ai-slops` 관점으로 소스와 테스트 범위를 재검토했다. 자동 테스트 파일이 없어 deletion-only, 제거 문구 고정, tautological, implementation-mirroring, 과도한 테스트는 없다. production 코드에도 요청을 위해 불필요한 parser/normalizer, speculative abstraction, pass-through wrapper, 네트워크/저장 계층, debug logging은 없다. `useRushGame.ts`는 100줄이고 각 컴포넌트도 250 pure LOC 제한 아래다. 압축된 one-line JSX와 긴 표현식은 유지보수 NOTE지만 명시 성공 기준 위반은 아니다.

기존 `rush-final-integrity-gate-review.md`와 `ultimate-fresh-functional-gate-review.md`는 programming/slop 및 overfit 항목을 명시적으로 다룬다. 이전 viewport/기획 증거가 섞여 있어 현재 승인 근거로 단독 신뢰하지 않았으며, 이번 소스·fresh arcade 캡처·metrics 직접 검토로 현재 범위를 보강했다.

## exactEvidenceGaps

- `.qa/arcade`에는 rest/mid/settled 3-frame motion sequence가 없다. 실제 motion class 연결, keyframes, reduced-motion 규칙과 settled feedback 캡처는 확인했지만 프레임 단위 timing/jank는 독립 재생산하지 않았다. 명시 기능의 구현 부재를 증명하지 않으므로 NOTE다.
- 효과음의 실제 speaker 음량/음색은 실물 학교 기기에서 재검증하지 않았다. Web Audio graph와 브라우저 상호작용 보고만 확인했다. `DESIGN.md`도 이를 미검증 범위로 명시한다.
- repository 전체가 untracked여서 기준 commit 대비 diff를 재구성할 수 없다. 현재 계약과 현재 산출물 간 일치성은 직접 검토했으나 변경 전후 범위 감사는 불가능하다.
- 별도 lint/test script가 `package.json`에 없다. production build/typecheck와 제공된 수동 QA가 현재 검증 근거다.
- `metrics.json`은 append된 중복 측정이 있어 111 records / 62 unique names다. 모든 레코드가 green이며 필수 49 화면 캡처는 존재하므로 승인에는 영향이 없다.

