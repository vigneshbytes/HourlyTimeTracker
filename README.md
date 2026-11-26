# ⏱ TimeTracker

A fast, offline-first time tracker for hourly tasks. It's a Progressive Web App
(PWA) with **no backend**: everything runs in your browser and all data stays on
your device.

**Live app:** https://vigneshbytes.github.io/HourlyTimeTracker/

## Features

- **One tap to start.** Tap a task to start timing it. Only one task runs at a
  time; tapping another asks before switching. An Undo bar appears for 5 s and
  sessions under 5 s are discarded.
- **Running task on top.** The running task's card grows and moves to the top
  with a big Stop button. The whole card is the stop button.
- **Smart order.** Running task → tasks about to expire (soonest first) → most
  recently used.
- **Colours.** Red when a task is about to expire or has expired (it moves up).
  Yellow at 70% of the task's max hours (it doesn't move). "Over limit" badge
  at 100%; timing continues.
- **Options menu.** Hover a card (mouse) or press and hold (touch): Edit, Log
  session manually, View history, Archive.
- **Manual logs.** Enter hours, optionally a date and time. Logs without a
  date are placed on the day you added them and shown in a different colour.
- **History.** All tasks, filter Active/Archived, sort by created or completed
  date, search names and notes. Each task shows a big total and a graph with
  one line per log (hover or tap a line for exact time). Edit or delete logs,
  unarchive tasks, permanently delete archived tasks (type the name to confirm).
- **Settings.** Expiry warning days, bulk archive (oldest first, Shift+click to
  select a range), backup export/import (merge), database export/import
  (replace), storage status, erase all data (3-step confirmation).
- **Three layouts.** Phone/tablet (touch), desktop, and a compact **widget**
  layout when the desktop app window is shrunk small. Layout is chosen by input
  type first, so a small desktop window never behaves like a phone.
- **Multiple windows.** If the app is open twice, it offers to close the
  others; otherwise all windows stay in sync live.
- **Light theme only.** Browser auto-dark and dark-mode extensions are blocked.

## Install it

- **Desktop (Chrome, Edge):** click the install icon in the address bar.
- **Android:** browser menu ⋮ → **Install app** / **Add to Home screen**.
- **iPhone / iPad (Safari):** Share → **Add to Home Screen**.

## How it's built

| Part | Choice |
| --- | --- |
| UI | Plain JavaScript modules, no framework |
| Build | [Vite](https://vite.dev), run for free by GitHub Actions |
| Database | IndexedDB via [Dexie.js](https://dexie.org). See [docs/DATABASE.md](docs/DATABASE.md) |
| Offline | Service worker precaches every file; new versions show an "Update" prompt |
| Tests | [Vitest](https://vitest.dev). Run on every push; a failing test blocks the deploy |
| Hosting | GitHub Pages |

```
index.html            page shell
public/               icons + manifest (copied as-is)
src/main.js           start-up, routing, live clock, updates
src/db/               database: schema, records, repo (all writes), backups, safety copies
src/logic/            pure functions: time parsing/formatting, sorting, colours
src/ui/               views (task list, history, settings), dialogs, menus, layouts
src/sw.js             service worker template
tests/                automated tests
.github/workflows/    test + deploy pipeline
```

## Working on it (all in the cloud)

- **Quick edit:** open a file on GitHub and click ✏️. Commit to `main`; the
  workflow tests, builds and deploys in about a minute. Watch it in the
  **Actions** tab.
- **Full editor:** Code → Codespaces → Create codespace. It installs everything
  and opens a live preview (`npm run dev`). Run tests with `npm test`.

## Roadmap

- Grand total across all tasks for a date range
- Always-on-top mini timer (Document Picture-in-Picture, Chrome/Edge)
- Expiry reminder notifications

## License

[GPL-3.0](LICENSE). Anyone may use, modify and sell this software, including
commercially, as long as distributed versions stay open source under the same
license.
