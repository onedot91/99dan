# Result-screen visual/UX gate — simple_result_visual_gate

**Recommendation: REQUEST_CHANGES**

## Evidence inspected

- [ResultScreen.tsx](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/ResultScreen.tsx:12)
- [results.css](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/results.css:1)
- [App.tsx](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/App.tsx:37)
- Parent manual-QA result capture: early-ended 100-point result, showing score,
  `정답`, `다시 볼 문제`, and one `명예의 전당` action at desktop width.
- Current diff and `DESIGN.md` result contract.

## Findings

### CRITICAL

None. The result surface is live React DOM. `ResultScreen` composes reusable
`PixelArt`, `Stat`, and `Icon` primitives; no image or screenshot is used as a
UI substitute. Styling consumes shared color, spacing, type, and geometry
tokens from `styles.css`.

### HIGH

1. Completed runs still render an additional `1분 도전 완료` / `2분 도전 완료`
   / `3분 도전 완료` badge. This conflicts with the requested reduced result
   contract of only score, correct count, and revisit count. The early-ended QA
   capture did not show it because the conditional suppresses it only when
   `r.endedEarly` is true; ordinary completed runs take the other path.
   [ResultScreen.tsx](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/ResultScreen.tsx:13)

### MEDIUM

None.

### LOW

None. In the captured early-result desktop state, the two stat cards form one
clear row, the single mint Hall-of-Fame button is visually distinct, and there
is no body-level `처음으로` or retry/practice action. `App.tsx` keeps
`처음으로` in the header for non-home screens, as requested.

## Blocker

Remove the conditional completion badge before approving the simplified result
screen. Then verify one normally completed challenge at desktop width as well
as the early-ended state.
