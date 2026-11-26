# ⏱ TimeTracker

An offline-first time tracker for hourly-paid projects. It is a static Progressive Web App (PWA): there is no backend, no account and no server-side storage. Every feature runs in your browser and all data stays on your device.

**Live app:** https://vigneshbytes.github.io/HourlyTimeTracker/

## Install it

- **Desktop (Chrome, Edge):** open the live app and click **Install app** in the header, or the install icon in the address bar.
- **Android (Chrome):** menu ⋮ → **Install app** / **Add to Home screen**.
- **iPhone / iPad (Safari):** Share → **Add to Home Screen**.

Once installed it opens in its own window and works with no internet connection.

## Architecture

| Concern | Choice |
| --- | --- |
| Hosting | GitHub Pages (free static hosting), deployed by GitHub Actions on every push to `main` |
| Runtime | Plain HTML, CSS and ES modules. No build step, no framework, no dependencies |
| Offline | Service worker (`sw.js`) caches the app shell; cache name is stamped with the commit SHA on deploy |
| Installability | `manifest.webmanifest` + 192/512 px and maskable icons. All paths are relative so it works under the `/HourlyTimeTracker/` subpath |
| Storage | IndexedDB (`timetracker` database), scoped to the site's origin |
| Durability | `navigator.storage.persist()` is requested on first load so the browser won't evict data under storage pressure |
| Data safety | Every erase goes through a 3-step confirmation: explain + count → tick "I understand" → type `DELETE ALL MY DATA` (paste disabled) |

### Data model (v1)

- `projects`: `{ id, name, hourlyRate, currency, archived, createdAt }`
- `entries`: `{ id, projectId, start, end, note }` (indexed by `projectId` and `start`)
- `meta`: `{ key, value }` for settings and bookkeeping

Schema changes are handled by bumping `DB_VERSION` in `js/storage.js` and adding a migration step in `upgrade()`. Existing data is never dropped by an upgrade.

### Important notes about browser storage

- Data lives in **this browser on this device** only. A different browser, device or a private window starts empty.
- Clearing site data from the browser's own settings will delete it; the app can't prevent that. A backup/export feature is planned for this reason.
- On iOS, the installed home-screen app and Safari have separate storage.

## Project layout

```
index.html              App shell
manifest.webmanifest    PWA manifest
sw.js                   Service worker (offline cache)
css/style.css           Styles (light/dark)
js/app.js               Entry point, install prompt, status UI
js/storage.js           IndexedDB layer + persistence request
js/erase.js             Multi-step erase confirmation flow
js/version.js           App version
icons/                  App icons
.github/workflows/      Pages deployment
.devcontainer/          GitHub Codespaces setup
```

## Developing in the cloud

Everything can be done from a browser:

1. On GitHub, click **Code → Codespaces → Create codespace on main**.
2. The dev container starts a static server on port 8000 and opens a preview.
3. Commit and push to `main`; the **Deploy to GitHub Pages** workflow publishes the site in about a minute.

For quick edits, press `.` on the repo page to open github.dev.

## Roadmap

- [x] Scaffold: PWA shell, offline cache, install support, IndexedDB storage, persistent storage request, guarded erase flow, Pages deploy
- [ ] Feature list (to be defined)

## License

[GPL-3.0](LICENSE). You may use, modify and sell this software, including commercially, as long as any distributed version stays open source under the same license.
