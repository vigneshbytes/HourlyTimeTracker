# Notes for Claude

- Read `docs/MINI_TIMER.md` before touching `src/ui/miniTimer.js`: it records the
  owner's size and layout rules (window opens at Chromium's minimum X × Y =
  240 × 52; card H1 = 32, ⌂ + + = H1, 🔍 and task rows = 16, rail 18, equal 4px
  gaps; interactive state when selected OR hovered or when nothing is running,
  widget state otherwise with the card filling the space; opens on task start;
  launch size = last user resize, else the browser's own minimum (request
  20% under 240 × 52, measure, fit heights within ±20%; if opened big anyway,
  the first click/key inside snaps it to the minimum); no undo pop-ups; no scrollbars; no animations; no top bar, no streak or
  date) and the shared-logic architecture (`createActions(app, ui)`).
- Standing rules: no dark mode ever; never track or show pay/rates; archive is
  manual only; every commit is `Major:` or `Minor:` with the version and a
  CHANGELOG entry; no git tags.
