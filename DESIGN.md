# 구구단 게임 · 16-bit pixel arcade

## Brief
초등 3학년 곱셈 회상 게임. 1280×650 크롬북과 모바일에서 스크롤 없이 조작한다. 64개 식의 곱, 빈칸 인수, 두 곱의 비교 문제를 1·2·3분 도전, 단별 연습, 약점 연습에서 제공한다.

## Visual contract
16비트 콘솔 스타일. 계단식 밤하늘 띠, 픽셀 별(`src/assets/stars.svg`), 3겹 픽셀 산(`src/assets/mountains.svg`)을 고정 배경으로 깐다. 헤더의 '배경' 버튼을 누르면 배경 메뉴가 열린다. 배경은 레벨에 따라 열린다: 밤 Lv1, 노을 Lv2, 벚꽃 Lv3, 숲 Lv4, 사막 Lv6, 바다 Lv8, 눈 Lv10, 화산 Lv15, 오로라 Lv20, 우주 Lv30, 반딧불 Lv35, 보석 Lv42, 황금 Lv50, 사탕 Lv60, 무지개 Lv72, 폭풍 Lv85, 천상 Lv100(뒤로 갈수록 간격이 벌어짐). 새 배경은 기존 배경과 색 계열이 겹치지 않게 고르고(올리브·자수정·호박·체리·무지개·회색·하늘금빛), 글자가 바로 얹히는 하늘 위·가운데 띠는 어둡게 유지한다. 잠긴 배경도 메뉴에 필요한 레벨과 함께 보여 목표가 되게 하고, 저장된 배경이 현재 레벨보다 높으면(교사 초기화 등) 밤으로 돌아간다. 테마마다 하늘 띠 색, 입자 타일(`src/assets/backgrounds/*-sky.svg`), 지면 띠(`*-ground.svg`)가 바뀌고 선택은 기기에 번호별로 저장된다(`src/game/background.ts`). 패널·버튼은 모서리 픽셀이 빠진 4방향 box-shadow 외곽선(`--ring`), 위 하이라이트/아래 그림자 베벨, 4px 낙차(`--drop`)로 만든다. 누르면 4px 내려가고 베벨이 반전된다. radius 0. 스프라이트는 `Sprite.tsx`의 ASCII 맵(한 글자=한 픽셀)을 `<rect>`로 그리며 색은 CSS 토큰 클래스(`px-*`)에서 온다. UI는 실제 React DOM. 글꼴은 Galmuri11 Bold(OFL, `src/assets/fonts`, 로컬 번들·외부 요청 없음), 숫자도 같은 글꼴. School_Timer 동물 프로필 이미지는 `image-rendering:pixelated`.

색은 고정이다: 기기가 다크 모드여도 같은 화면이 나와야 한다. 삼성 인터넷·안드로이드 크롬 계열은 페이지가 다크 모드 대응을 선언하지 않으면 색을 자동으로 어둡게 바꾸고, `color-scheme: only light`를 쓰면 오히려 그 처리가 걸린다. 그래서 `color-scheme: light dark`(index.html 메타와 :root)로 대응을 선언하고, `@media(prefers-color-scheme:dark)`에 라이트와 같은 값을 넣어 화면은 그대로 둔다(그 값은 :root와 항상 같게 유지). 대화상자·입력창은 `color-scheme: light`로 고정. 주소창 색(theme-color)은 배경색 #14132b.

## Tokens
CSS :root가 단일 출처. 모든 색은 기본/하이라이트/그림자 3단: panel #2a2856 (hi #5552a0, lo #1d1b40), paper #fff4d6 (hi #fffdf3, shade #d9c49a), mint #5ee08a (#b4f5c8/#2a9d5c), yellow #ffd23f (#fff3a3/#c77d0a), coral #ff7a8a (#b8324a), blue #4cc9ff (#2766c7), orange #ff9f1c, red #ff4d5e, silver/bronze(순위). outline #0b0a1f, ink #1c1638. Pixel unit `--px` 4px. Text 18/21/24/33/48/72px, equation `clamp(36px,16cqi,96px)`로 문제 패널 너비에 맞춤, 최소 13pt. Spacing 4~64px.

## Layout and content
100dvh shell, fixed header, minmax(0,1fr) body. Targets: 1280×650, 768×650, 375×667, 390×844, 360×640, 320×568, 844×390 landscape. No document/panel scroll at target sizes; never hide actionable overflow. Extreme zoom/smaller heights may scroll to preserve accessibility.
Wide home pairs the illustrated `구구단 게임` title with one challenge card, a horizontal two-button practice row and Hall of Fame. The challenge card contains the 1·2·3 minute selector and its start action. The signed-in header shows the animal profile and student number; during timed play it also holds the countdown beside the sound and exit actions. The challenge label and progress track stay in the play HUD. Pressing the profile reopens number selection. Wide play puts equation left, keypad right; portrait stacks HUD/equation/feedback/keypad/score. Compare questions replace the keypad with three large symbol choices. Results use compact 2×2 stats. Student records separate 1-, 2- and 3-minute challenges, each showing its highest score and correct answers. The teacher view keeps the header fixed and scrolls its student list and detail panel on wide screens; on mobile the document scrolls.
Home buttons have names only, no subtitles/footer disclaimers. The previously selected early-result badge and zero-answer subtitle remain removed. All unnecessary supporting copy is removed. Correct answers earn 100 points, consecutive answers earn 10 more per step from the second answer up to 50 bonus points, and wrong answers lose 100 points and reset the combo. Speed has no score bonus. Wrong answers show an explicit score loss, while the countdown keeps the same appearance at low time. No percentages in student UI: results show only the score, correct count and revisit count, with one Hall of Fame action; personal records show only each challenge's best score and correct count.

## 모바일 원칙 (폭 700px 이하)
화면이 작으니 문구는 최소로, 배치는 촘촘하게. 새 화면이나 문구를 만들 때마다 이 기준으로 휴대폰 폭(375px, 가장 좁은 320px)에서 확인한다.
- 문구: 뜻이 아이콘·숫자·배치로 전해지면 글자는 뺀다. 긴 문구는 `.wide-only`(데스크톱만)로 감싸고 짧은 말은 `.narrow-only`(휴대폰만)로 준다. 예: "1분 도전"→"1분", "다시 볼 문제"→"복습", 결과 "오늘의 기록"·기록 화면 제목은 숨김.
- 헤더 버튼은 아이콘만 쓰고 `aria-label`로 이름을 준다. 판을 끝내는 "끝내기"만 글자를 남긴다.
- 한 줄로 읽어야 하는 것은 한 줄로: 비교 문제는 "식 [기호] 식"을 한 줄에 두고 기호 버튼은 아래 줄.
- 겹침 금지: 테두리(4px)와 버튼 그림자(8px)를 합쳐 요소 사이를 최소 24px 띄우고, 글자는 줄바꿈되지 않게 한다.
- 터치 기기에선 :hover 강조를 쓰지 않는다(`@media(hover:hover)`).
- 가장 넓어지는 경우로 확인한다: 예) 결과 화면은 최고 기록·레벨 업·새 배경·펫 고르기가 한꺼번에 나올 때. 한 칸 레이아웃은 `minmax(0,1fr)`로 두어 긴 줄이 화면을 밀어내지 않게 한다.
- 휴대폰 전용 규칙은 `src/mobile.css`에 모은다. 다른 화면 CSS보다 늦게 로드되지만 `styles.css`(main.tsx)보다는 먼저 로드되므로, `styles.css` 규칙을 덮을 땐 부모 선택자를 붙여 우선순위를 높인다(예: `.background-menu .background-option`).

## Primitives
PixelArt, Icon, NumberPad, compare-pad, Stat, Pager, arcade-panel, primary-button, quiet-button. Focus/hover/press/disabled states. Touch target minimum 44px, keypad minimum 48px (44px in short landscape). Minimum text 13pt at every breakpoint.

## Audio and motion
Web Audio created/unlocked only on sound-toggle gesture. Default OFF, resets OFF on refresh. Explicit 소리 켜기/끄기 labels and aria-pressed. 칩튠 합성: 25% 펄스파 리드, 삼각파 베이스, 짧은 노이즈 타격. 정답음은 연속 정답마다 도-레-미-파-솔로 올라가고 5콤보마다 아르페지오 팡파르(10·15·20콤보는 한 단계씩 높게). 오답은 부드러운 삼각파 두 음(겁주지 않음). 결과는 신기록 팡파르 > 레벨 업 음계 > 기본 완료 팡파르 중 하나만. Low-pass 4.2kHz, compressor, 최대 24 voice, 새 효과음이 이전 효과음을 끊음, immediate mute including scheduled voices. Hidden document silences sound. No music/network audio.
모션은 steps() 타이밍으로 스프라이트 프레임처럼 끊어 보이게 한다. 입력: 숫자가 답 칸에 쾅 박히고(130ms) 키패드가 눌려 찌그러진다. 정답: 답 칸 1프레임 흰 섬광, 답 칸에서 퍼지는 2겹 충격파, 포물선으로 떨어지는 12개 파편, 헤더 점수 튕김과 “+N” 칩, 방금 찬 보너스 칸 팝, +점수 팝업(모두 450ms 안에 끝남). 다음 문제는 110ms 안에 흐리지 않게 튀어 들어와 반응시간을 해치지 않는다. 5콤보마다 문제 패널만 흔들리고 금빛으로 한 번 맥동하며 “N 콤보!” 배너(440ms). 10콤보 이상은 문제 패널에 금빛 테두리(정지 상태)와 더 큰 주황 점수 팝업. 오답: 답 칸만 흔들린다. 결과: 통계 카드 순차 등장, 카운트업이 끝나면 점수 도장. 오답: 220ms 흔들림과 감점 표시. 결과: 점수 카운트업 900ms, 신기록 도장, EXP 바 채우기, 레벨 업 도장, 새로 익힌 식 칩. Only opacity/transform animate. 문제 패널 밖 전체 화면 흔들림·번쩍임 없음. 플레이 중 배경은 움직이지 않는다(홈 캐릭터 걷기·시간 바 펫 까딱임·커서 깜빡임만 연속). Correct feedback lasts 450ms; wrong feedback 350ms before retrying the same fact without exposing the answer. 보상 모션(문제 영역 밖에서만): 시간 바 펫은 정답에 폴짝, 5콤보마다 빙글+반짝이, 오답에 살짝 휘청. 도전 중 이전 최고 점수를 넘는 순간 시간 바에 깃발이 꽂히고 “최고 기록 돌파!” 알림이 잠깐 뜬다. 결과 화면은 경험치 조각(최대 10개)이 바로 날아든 뒤 바가 차고, 레벨 업 도장, 새로 열린 배경 카드(미리보기+바로 쓰기), 펫 고르기 버튼 통통 순서로 이어지며, 버튼이 아닌 곳을 누르면 모두 끝 상태로 건너뛴다. 홈 펫은 그날 이 기기에서 처음 볼 때 졸다가(Zz) 깨어나 “반가워!”, 고를 펫이 있으면 가운데서 폴짝이며 머리 위 말풍선 “새 펫!”(말풍선이나 펫을 누르면 펫 고르기). 슬픔·꾸중 표현은 쓰지 않는다. Reduced motion disables movement, particles and banners without removing feedback text or changing sound preference. 예외: 홈 펫의 느린 걷기와 까딱임은 유지한다(윈도우 "애니메이션 표시" 끔 설정이 흔해 펫이 멈추면 고장처럼 보임).

## Motivation (learning-safe)
보상은 속도보다 꾸준함과 숙달에 준다. 점수 규칙·출제·재출제·피드백 시간은 바꾸지 않는다.
- 레벨: 누적 정답 15개마다 1레벨(고정 간격, 상한 없음). 칭호는 레벨 구간 이름(1 초보 모험가 … 50 곱셈 제왕, 60 곱셈 황제, 70 은하 정복자, 80 우주의 수호신, 90 불멸의 전설, 100 곱셈의 신. “구구단”이라는 말은 쓰지 않음). 홈과 기록 화면에 EXP 바, 결과에 +EXP와 레벨 업.
- 펫 나무: 레벨마다 1번 선택(레벨 1 = 첫 펫). 12종 × (아기 1 + 속성 4 + 변신 12 + 전설 24 + 신화 48) = 1068. 나중 4종(곰·문어·유니콘·펭귄)은 둥근 귀·다리 촉수·뿔과 무지개 갈기·지느러미로 실루엣을, 초콜릿·자홍·레몬·남색으로 색을 기존 8종과 구별한다. 진화는 부모를 가진 경우에만 가능. 선택지 3개는 학생 번호·선택 횟수 시드로 고정(새로고침으로 다시 뽑기 불가). 스프라이트는 몸통 반쪽 ASCII를 좌우 반전하고, 속성 팔레트와 꼬리, 날개·왕관·마법 모자, 전설 테두리 빛(별빛 금색·달빛 보라)을 겹쳐 만든다. 단계마다 모습과 크기가 확실히 다르다: 1단계는 깨진 알껍데기 속 아기(틀의 약 52%), 2단계 63%, 3단계 75%, 4단계 86%, 5단계 100%이며 발 기준선은 같다. 4단계 최종 진화형은 실루엣부터 다르다: 별빛은 뒤에 금빛 햇살, 빨간 망토, 금빛 눈; 달빛은 뒤에 초승달, 보라 망토, 청록빛 눈. 두 형태 모두 금/보라 테두리 빛을 두른다. 5단계 신화는 전설 위에 한 겹을 더한다: 천사는 머리 위 금빛 고리와 흰 깃털 날개, 우주는 몸을 가로지르는 행성 고리(뒤쪽 호는 몸 뒤, 앞쪽 호는 몸 앞)와 작은 행성 둘. 둘 다 전설 빛 바깥에 두 번째 테두리 빛(흰색/청록)을 두른다. 도감과 펫 나무는 1→5단계 열로 보여 주고(5단계 열은 마지막으로 누른 전설 하나의 신화 둘만, 그 전설 칸 아래 파란 줄로 표시) 그림 아래에는 그 단계에서 더해진 것만 적는다. 기본 캐릭터는 없다: 첫 펫을 고르기 전 홈에는 어떤 펫도 나오지 않는다. 고른 펫이 홈에서 걷는다. 결과에서 레벨 업하면 “새 펫 고르기”.
- 콤보 미터: 실제 점수 규칙(두 번째 연속 정답부터 +10, 최대 +50)을 5칸 보너스 칸으로 보여 줌. 5콤보부터 불꽃. 플레이 중 헤더에서 점수·타이머 옆에 둔다.
- 시간 바 펫: 대표 펫이 시간 바의 초록 끝에 서서 도전에서는 시간이 줄수록 왼쪽으로, 연습에서는 맞힌 만큼 오른쪽으로 걷는다. 펫이 없으면 바만 보인다.
- 구구단 도감: 8×8 칸에 익힌 식(연속 3회 정답, 금색)·연습 중(파랑)·다시 볼 식(빨강)·아직 안 푼 식. 좁은 화면은 “내 기록/구구단 도감” 전환.
- 결과: 끝까지 한 도전이 이전 최고보다 높으면 “최고 기록 갱신!”(첫 기록은 “첫 기록!”), 아니면 “최고 기록까지 N점!”. 이번에 새로 익힌 식을 칩으로 보여 줌.
- 명예의 전당: 1등 왕관, 2·3등 은·동색, 내 순위는 “나” 표시.
- 오답은 비난하지 않는다: 부드러운 소리, 정답 비공개, 콤보는 조용히 0으로.

## Learning/privacy
64 ordered 2×2 through 9×9 facts; rush/practice cover eligible facts before repeats; practice length selected tables × 8. Questions rotate through product, missing first factor, missing second factor, and product comparison. Comparison uses <, =, >; the server checks all three forms. Rush ends after the selected60/120/180 seconds. Weak practice retains spacing/mastery. Completed learning records and personal bests persist in separate Supabase game tables. School_Timer profiles are read-only. Leaderboards are duration-specific top3 personal bests. A first-visit selection of1–23 is confirmed in a native modal dialog, then only that number persists in localStorage under gugudan-rush.student-number. Pressing the header profile/number button reopens the selector outside active play. Subsequent visits skip selection; the number selects the shared server record; it is self-selection, not a verified identity. Cancel/Escape do not save. Invalid stored values reopen selection. Storage failure is shown without falsely claiming persistence. Teacher entry uses a four-digit server-checked code and a 30-minute in-memory session. The teacher view lists all 23 students, individual fact aggregates, latest 20 sessions, and per-student reset with confirmation.

## Verification
Every page plus populated lists at Chromebook/mobile dimensions; overflow, clipping, readable text, keyboard/touch input, default mute/toggle lifecycle, feedback/combo/finish, reduced motion, build and console. Real school hardware and speaker loudness remain unverified. Existing React/Vite dependencies only; no unrelated tooling installs.
