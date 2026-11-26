# Notes for Claude

- Read `docs/MINI_TIMER.md` before touching `src/ui/miniTimer.js`: it records the
  owner's size and layout rules (minimum 240 × 128, two task rows, legible text, no top bar: ⌂ / + / 🔍 rail on the right, no streak or date) and the
  shared-logic architecture (`createActions(app, ui)`).
- Standing rules: no dark mode ever; never track or show pay/rates; archive is
  manual only; every commit is `Major:` or `Minor:` with the version and a
  CHANGELOG entry; no git tags.
