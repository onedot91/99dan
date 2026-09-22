# Clone / design-system fidelity review — ultimate_fresh_visual_gate

**Recommendation: APPROVE**

## Scope and evidence

This report intentionally ignores pre-existing `.qa` and `.omo` material. It
uses only the current working tree and the current HMR render at
`http://localhost:5173/` inspected on 2026-09-22.

Fresh IAB capture evidence was produced and visually inspected in the current
run for all 18 required states:

| Viewport | Captured states |
| --- | --- |
| 375 × 812 | `home`, `tables`, `weak` empty state, `play`, early-exit `result`, empty `records` |
| 768 × 1024 | `home`, `tables`, `weak` empty state, `play`, early-exit `result`, empty `records` |
| 1280 × 900 | `home`, `tables`, `weak` empty state, `play`, early-exit `result`, empty `records` |

The IAB capture API supplied in-session image artifacts rather than filesystem
paths. Each was captured after the current source inspection; no previous QA
image or report was used. Runtime DOM measurements reported no horizontal
overflow in every captured screen (`scrollWidth === clientWidth`). The small
vertical document overage in 375px play/result is bottom spacing, not clipped
or hidden interactive content.

Additional inspected artifacts:

- [src/styles.css](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/styles.css:1), [src/screens.css](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/screens.css:1), [src/results.css](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/results.css:1)
- [src/App.tsx](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/App.tsx:11), [src/components/HomeScreen.tsx](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/HomeScreen.tsx:4), [src/components/PlayScreen.tsx](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/PlayScreen.tsx:5), [src/components/NumberPad.tsx](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/NumberPad.tsx:2), [src/components/Icon.tsx](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/Icon.tsx:7)
- [src/components/ResultScreen.tsx](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/ResultScreen.tsx:7), [src/components/RecordsScreen.tsx](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/components/RecordsScreen.tsx:6), [src/game/useRushGame.ts](/Users/ibyeonghyeon/Documents/GitHub/99dan/src/game/useRushGame.ts:23)
- `npm run build`: passed on the reviewed source.

## Findings

### CRITICAL

None. The rendered screens are live React DOM: `App` selects screen components,
the keypad is twelve real `<button>` elements, and `Icon` emits inline SVG.
Current IAB DOM inspection found `images: 0`, `canvas: 0`, and no source
`<img>`, `<canvas>`, `url(...)`, or `background-image` substitute. The one
background is a CSS radial gradient, not a raster stand-in.

### HIGH

None. The component structure is reusable and live: `Icon`, `NumberPad`, and
`Stat` are shared primitives; state transitions are driven by `useRushGame`.
The home mode controls contain their three intended labels only, with no
subtitle/helper copy inside the controls. All 18 current renders retained the
same layer order: header, centered screen content, then screen-specific live
controls.

### MEDIUM

None. Raw token values are declared in `:root` and the reviewed color,
spacing, geometry, radius, font-size, and letter-spacing consumption uses
`var(...)`; raw pixel values outside `:root` are limited to media-query
breakpoints. A fresh cross-file reference check found 158 declarations, 145
referenced tokens, zero unresolved references, and zero self-references.

All visible Korean copy remained whole and legible at 375, 768, and 1280px:
no isolated particles, clipped glyphs, unnatural phrase split, or horizontal
overflow was seen. The body base computes to 13pt (17.333px); all sampled
visible text is at or above that value. The mobile keypad measures 64px and
the remaining interactive controls are at least 48px.

### LOW

None. The empty-state card uses its own tokenized radius
(`--radius-24`), while empty weak-state icon geometry remains tokenized. The
answer `?` uses `#647b6e` on `#edf3e8`, measuring 4.04:1 at 38px bold text.
For an Escape/"여기까지 하기" end, the result view shows ordinary progress
copy only; it does not show a "중도" or "종료" notice.

## Verdict rationale

The current build is an extensible component/token implementation rather than
a screenshot composition. The fresh IAB inspection found the requested
responsive states visually coherent across all three requested dimensions,
with no blocking CJK, clipping, touch-size, contrast, token, or image-substitute
issue.

## Blockers

None.
