# 구구단 게임 · Pixel arcade

## Brief
초등 3학년 곱셈 회상 게임. 1280×650 크롬북과 모바일에서 스크롤 없이 조작한다. 64개 식, 1·2·3분 도전, 단별 연습, 약점 연습을 제공한다.

## Visual contract
짙은 남색 도트 배경, 크림 패널, 민트·노랑 키캡과 각진 픽셀 프레임. PixelArt는 독자적 SVG 마스코트/트로피이며 UI는 실제 React DOM이다. 한글은 읽기 쉬운 시스템 글꼴, 숫자는 고정폭. 외부 폰트/추가 의존성 없음. School_Timer 동물 프로필 이미지를 공유한다.

## Tokens
CSS :root가 단일 출처. Background #172334, panel #24354a, border #41546b, paper #fff5dc, ink #243047, muted #a9bbce, mint #91e3b4, yellow #ffd168, coral #ffb19c. Text minimum 13pt; scale 18/20/24/28/32/40/48/64/80/104px. Spacing 4/8/12/16/20/24/32/40/48/64px. Borders 2px, ledges 4px, radius 0/4/8px. Semantic size custom properties control layout; media thresholds and SVG coordinates are geometry.

## Layout and content
100dvh shell, fixed header, minmax(0,1fr) body. Targets: 1280×650, 768×650, 375×667, 390×844, 360×640, 320×568, 844×390 landscape. No document/panel scroll at target sizes; never hide actionable overflow. Extreme zoom/smaller heights may scroll to preserve accessibility.
Wide home pairs the illustrated `구구단 게임` title with one challenge card, a horizontal two-button practice row and Hall of Fame. The challenge card contains the 1·2·3 minute selector and its start action. The signed-in header shows only the animal profile and student number. Wide play puts equation left, keypad right; portrait stacks HUD/equation/feedback/keypad/score. Results use compact 2×2 stats. Records use summary/history tabs; weak facts and history use paging for unbounded data.
Home buttons have names only, no subtitles/footer disclaimers. The previously selected early-result badge and zero-answer subtitle remain removed. All unnecessary supporting copy is removed. Combo scoring and milestone effects remain, but no combo text appears. No percentages in student UI: results show only the score, correct count and revisit count, with one Hall of Fame action; records use attempted counts, history says “6문제 중 5개 정답”.

## Primitives
PixelArt, Icon, NumberPad, Stat, Pager, arcade-panel, primary-button, quiet-button. Focus/hover/press/disabled states. Touch target minimum 44px, keypad minimum 48px (44px in short landscape). Minimum text 13pt at every breakpoint.

## Audio and motion
Web Audio created/unlocked only on sound-toggle gesture. Default OFF, resets OFF on refresh. Explicit 소리 켜기/끄기 labels and aria-pressed. Crisp short input tick, rising correct chord plus a105ms low impact and a short attack layer, gentle descending wrong cue, five-combo arpeggio, finish flourish. Soft gain/envelopes, low-pass, compressor, bounded voices, immediate mute including scheduled voices. Hidden document silences sound; return never replays stale cues. No music/network audio.
100ms press, 180ms entrance, 340ms correct recoil, local pixel sparks for combo, 220ms wrong nudge, 500ms result arrival. Only opacity/transform animate. Correct feedback lasts450ms; wrong feedback350ms before retrying the same fact without exposing the answer. No full-screen shake/flashing/continuous decorative motion. Reduced motion disables movement without removing feedback or changing sound preference.

## Learning/privacy
64 ordered 2×2 through 9×9 facts; rush/practice cover eligible facts before repeats; practice length selected tables × 8. Rush ends after the selected60/120/180 seconds. Weak practice retains spacing/mastery. Completed learning records and personal bests persist in separate Supabase game tables. School_Timer profiles are read-only. Leaderboards are duration-specific top3 personal bests. A first-visit selection of1–23 is confirmed in a native modal dialog, then only that number persists in localStorage under gugudan-rush.student-number. Twenty presses of the header profile/number button reopen the same selector outside active play, and a changed number creates a fresh cloud session before loading that student's record. Subsequent visits skip selection; the number selects the shared server record; it is self-selection, not a verified identity. Cancel/Escape do not save. Invalid stored values reopen selection. Storage failure is shown without falsely claiming persistence.

## Verification
Every page plus populated lists at Chromebook/mobile dimensions; overflow, clipping, readable text, keyboard/touch input, default mute/toggle lifecycle, feedback/combo/finish, reduced motion, build and console. Real school hardware and speaker loudness remain unverified. Existing React/Vite dependencies only; no unrelated tooling installs.
