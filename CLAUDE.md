# Notes for Claude

- Read `docs/MINI_TIMER.md` before touching `src/ui/miniTimer.js`: it records the
  owner's size and layout rules (window opens at Chromium's minimum X × Y =
  240 × 52; card H1 = 32, ⌂ + + = H1, 🔍 and task rows = 16, rail 18, equal 4px
  gaps; interactive state on hover (or keyboard use), widget state otherwise with the card
  filling the space; no undo pop-ups; no scrollbars; no top bar, no streak or
  date) and the shared-logic architecture (`createActions(app, ui)`).
- Standing rules: no dark mode ever; never track or show pay/rates; archive is
  manual only; every commit is `Major:` or `Minor:` with the version and a
  CHANGELOG entry; no git tags.
