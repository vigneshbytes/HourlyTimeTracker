# Notes for Claude

- Read `docs/MINI_TIMER.md` before touching `src/ui/miniTimer.js`: it records the
  owner's size and layout rules (minimum 240 × 136, fixed heights: card H1 = 60, ⌂ + + = H1, 🔍 and task rows = H1/2, equal 4px gaps; no top bar, no streak or date) and the
  shared-logic architecture (`createActions(app, ui)`).
- Standing rules: no dark mode ever; never track or show pay/rates; archive is
  manual only; every commit is `Major:` or `Minor:` with the version and a
  CHANGELOG entry; no git tags.
