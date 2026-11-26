# Database design

TimeTracker stores everything in the browser's **IndexedDB**, through the
[Dexie.js](https://dexie.org) library. The data belongs to the site's address
(`vigneshbytes.github.io`) and never leaves the device.

## Tables

| Table | Key | Indexed fields | What it holds |
| --- | --- | --- | --- |
| `tasks` | `id` | `status`, `createdAt`, `lastUsedAt` | name, notes, maxHours, expiresAt, status (`active`/`archived`), archivedAt … |
| `sessions` | `id` | `taskId`, `start`, `createdAt`, `running` | one row per log: start/end for timed logs; durationMs, dateProvided, timeProvided for manual logs |
| `meta` | `key` | – | settings and bookkeeping |

A second database, `hourlytimetracker-snapshots`, keeps the last 5 **safety copies**
of all data. One is written automatically before every schema upgrade and before
every database import.

## Rules that keep data safe across app updates

1. **Records are flexible.** Only indexed fields are declared in the schema. Any
   record can carry extra fields, so adding a field needs no migration.
2. **New fields get defaults on read.** `src/db/records.js` merges each stored
   record over a defaults object, so data written by older versions works.
3. **Removed fields are ignored, never deleted.** All writes are partial
   updates (`table.update(id, changes)`), so fields the current code does not
   know about stay in storage untouched.
4. **Schema versions only add.** Never edit or remove an existing
   `db.version(n)` block in `src/db/schema.js`; add `db.version(n + 1)`. Never
   delete a table. Upgrade functions may only back-fill new fields.
5. **Safety copy first.** Before an upgrade runs, `src/db/snapshot.js` copies
   every table. If it can't, the upgrade is not attempted.
6. **Newer data, older app.** If the stored data is from a newer app version,
   the app shows a message instead of touching it.
7. **Tested.** `tests/db.test.js` opens data written by an "old" version with a
   "new" schema and checks nothing is lost.

## Adding a field (example)

```js
// records.js
export const TASK_DEFAULTS = { ..., clientName: '' };
```
That's all, unless you need to search or sort by it, in which case add an index:

```js
// schema.js — new block, old ones untouched
db.version(2).stores({ tasks: 'id, status, createdAt, lastUsedAt, clientName' });
export const SCHEMA_VERSION = 2;
```
