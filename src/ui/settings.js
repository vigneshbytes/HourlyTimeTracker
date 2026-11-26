import { h, svgIcon } from './dom.js';
import { confirmDialog, multiStepErase, toast, errorToast, modal } from './dialogs.js';
import { exportBackup, importBackup, exportDatabase, importDatabase, downloadJson, pickJsonFile } from '../db/backup.js';
import { listSnapshots } from '../db/snapshot.js';
import { requestPersistence } from '../db/index.js';
import { sortOldestActivity, rangeIds } from '../logic/tasks.js';
import { fmtDate, fmtDuration, fmtDateTime } from '../logic/time.js';

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

export function createSettingsView(app) {
  const root = h('section', { class: 'view view-settings' });
  const storageEl = h('dl', { class: 'kv' });
  const snapshotsEl = h('p', { class: 'muted small' });
  const warnDays = h('input', { type: 'number', min: 0, max: 365, inputmode: 'numeric', class: 'num',
    onchange: async () => {
      const v = Math.max(0, Math.min(365, Math.round(Number(warnDays.value) || 0)));
      warnDays.value = v;
      await app.repo.updateSettings({ expiryWarnDays: v });
      toast('Saved');
    } });

  const persistBtn = h('button', { type: 'button', class: 'btn', onclick: async () => {
    const r = await requestPersistence();
    await refreshStorage();
    await modal({
      title: r ? 'Persistent storage is on' : 'Not granted yet',
      build: (close) => h('div', null,
        r ? h('p', null, 'Done. The browser will no longer clear your TimeTracker data on its own. Nothing else to do.')
          : h('div', { class: 'small' },
            h('p', null, 'The browser decided not to grant it right now. Nothing is broken and your data is still saved. What happens next depends on the browser:'),
            h('ul', null,
              h('li', null, h('strong', null, 'Firefox: '), 'a permission prompt appears near the address bar. Choose ', h('em', null, 'Allow'), '.'),
              h('li', null, h('strong', null, 'Chrome / Edge: '), 'there is no prompt. It is usually granted once the app is installed, or after you have used it for a while. Try again later.'),
              h('li', null, h('strong', null, 'Safari (iPhone/iPad): '), 'add the app to your Home Screen and open it from there.')),
            h('p', null, 'Meanwhile, export a backup now and then (Backup section above).')),
        h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', autofocus: true, onclick: () => close(true) }, 'OK'))),
    });
  } }, 'Request persistent storage');

  const card = (title, ...body) => h('div', { class: 'card' }, h('h3', null, title), ...body);
  const btn = (label, onclick, cls = '') => h('button', { type: 'button', class: `btn ${cls}`, onclick }, label);

  root.append(
    h('h2', { class: 'view-title' }, 'Settings'),
    card('Task list',
      h('label', { class: 'field inline' }, h('span', { class: 'field-label' }, 'Warn about expiry this many days ahead'), warnDays),
      h('a', { href: '#/settings/archive', class: 'btn' }, svgIcon('archive', 16), ' Bulk archive…')),
    card('Backup',
      h('p', { class: 'muted small' }, 'A readable file with all tasks and logs. Importing a backup adds anything missing and never deletes or overwrites existing data.'),
      h('div', { class: 'row' },
        btn('Export backup', async () => { try { downloadJson(await exportBackup(app.db), `timetracker-backup-${stamp()}.json`); } catch (e) { errorToast(e); } }),
        btn('Import backup…', async () => {
          try {
            const data = await pickJsonFile();
            if (!data) return;
            const r = await importBackup(app.db, data);
            toast(`Imported ${r.tasks} tasks and ${r.sessions} logs${r.skipped ? ` (${r.skipped} already present)` : ''}`);
          } catch (e) { errorToast(e); }
        }))),
    card('Database',
      h('p', { class: 'muted small' }, 'An exact copy of the whole local database. Importing one REPLACES everything currently stored (an automatic safety copy is kept first).'),
      h('div', { class: 'row' },
        btn('Export database', async () => { try { downloadJson(await exportDatabase(app.db), `timetracker-database-${stamp()}.json`); } catch (e) { errorToast(e); } }),
        btn('Import database…', async () => {
          try {
            const data = await pickJsonFile();
            if (!data) return;
            const n = (data.tables?.tasks?.length ?? '?');
            const ok = await multiStepErase({ what: `Importing this file replaces ALL current tasks and logs with the ${n} task(s) in the file.`, phrase: 'REPLACE MY DATA', confirmText: 'Replace everything' });
            if (!ok) return;
            await importDatabase(app.db, data);
            toast('Database imported');
          } catch (e) { errorToast(e); }
        }, 'btn-danger-outline')),
      snapshotsEl),
    card('Storage',
      storageEl,
      h('p', { class: 'muted small' }, 'Your tasks are saved in this browser. Normally the browser may clear a site’s saved data on its own if the device runs very low on space (this is rare). ',
        h('strong', null, 'Persistent storage'), ' asks the browser never to clear it automatically. It is recommended and costs nothing. Your data is only removed if you erase it here or clear site data in the browser settings.'),
      persistBtn),
    card('Danger zone',
      h('p', { class: 'muted small' }, 'Erase every task, log and setting stored in this browser.'),
      btn('Erase all data…', async () => {
        const ok = await multiStepErase({ what: `This permanently deletes ${app.data.tasks.length} task(s) and ${app.data.sessions.length} log(s).` });
        if (!ok) return;
        await app.repo.eraseAll();
        toast('All data erased');
      }, 'btn-danger')),
    card('About',
      h('p', { class: 'small' }, `Version ${app.version}. All data stays on this device. `,
        h('a', { href: 'https://github.com/vigneshbytes/HourlyTimeTracker', target: '_blank', rel: 'noopener' }, 'Source code'),
        ' · ', h('a', { href: 'https://www.gnu.org/licenses/gpl-3.0.html', target: '_blank', rel: 'noopener' }, 'GPL-3.0'))),
  );
  root.classList.add('card-stack');

  async function refreshStorage() {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    persistBtn.hidden = persisted !== false;
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const mb = (b) => (b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : `${(b / 1048576).toFixed(b < 1048576 ? 2 : 1)} MB`);
    storageEl.replaceChildren(
      h('dt', null, 'Persistent'), h('dd', null, persisted == null ? 'Not supported by this browser' : persisted ? 'On ✓ (data won’t be cleared automatically)' : 'Off'),
      h('dt', null, 'Used'), h('dd', null, est ? `${mb(est.usage)} of ${mb(est.quota)}` : 'Unknown'));
    try {
      const snaps = await listSnapshots();
      snapshotsEl.replaceChildren(snaps.length
        ? h('span', null, `Safety copies: ${snaps.length} (latest ${fmtDateTime(snaps.at(-1).createdAt)}, ${snaps.at(-1).reason}). `,
          h('button', { type: 'button', class: 'link', onclick: () => downloadJson(snaps.at(-1), `timetracker-safety-copy-${stamp()}.json`) }, 'Download latest'))
        : 'No safety copies yet. One is made automatically before every database upgrade or import.');
    } catch { /* ignore */ }
  }

  return {
    root,
    render() { if (document.activeElement !== warnDays) warnDays.value = app.data.settings.expiryWarnDays; refreshStorage(); },
    tick() {},
  };
}

export function createBulkArchiveView(app) {
  const root = h('section', { class: 'view view-bulk' });
  const selected = new Set();
  let lastClicked = null;
  const list = h('ul', { class: 'bulk-list' });
  const countEl = h('span');
  const archiveBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: doArchive }, svgIcon('archive', 16), ' Archive ', countEl);
  const allBox = h('input', { type: 'checkbox', 'aria-label': 'Select all', onchange: () => {
    const ids = ordered().map((t) => t.id);
    if (allBox.checked) ids.forEach((id) => selected.add(id)); else selected.clear();
    render();
  } });

  root.append(
    h('div', { class: 'detail-head' },
      h('a', { href: '#/settings', class: 'icon-btn', 'aria-label': 'Back to settings' }, svgIcon('back')),
      h('h2', { class: 'detail-name' }, 'Bulk archive')),
    h('p', { class: 'muted small' }, 'Active tasks, least recently used first. Shift+click selects a range.'),
    h('div', { class: 'bulk-bar' }, h('label', { class: 'check' }, allBox, ' Select all'), archiveBtn),
    list);

  const ordered = () => sortOldestActivity(app.data.tasks.filter((t) => t.status === 'active'));

  async function doArchive() {
    const ids = [...selected];
    if (!ids.length) return;
    const ok = await confirmDialog({ title: `Archive ${ids.length} task${ids.length > 1 ? 's' : ''}?`, message: 'They move to History, where you can unarchive them at any time.', confirmText: 'Archive' });
    if (!ok) return;
    await app.actions.archive(ids);
    selected.clear();
  }

  function render() {
    const tasks = ordered();
    const ids = tasks.map((t) => t.id);
    for (const id of [...selected]) if (!ids.includes(id)) selected.delete(id);
    countEl.textContent = selected.size ? `(${selected.size})` : '';
    archiveBtn.disabled = selected.size === 0;
    allBox.checked = tasks.length > 0 && selected.size === tasks.length;
    allBox.indeterminate = selected.size > 0 && selected.size < tasks.length;
    list.replaceChildren(...(tasks.length ? tasks.map((t) => {
      const st = app.stats.get(t.id);
      const box = h('input', { type: 'checkbox', checked: selected.has(t.id), 'aria-label': `Select ${t.name}` });
      const rowEl = h('li', { class: `bulk-row${selected.has(t.id) ? ' sel' : ''}` },
        h('label', { class: 'bulk-label' }, box,
          h('span', { class: 'bulk-name' }, t.name),
          h('span', { class: 'muted small' }, `last used ${fmtDate(t.lastUsedAt ?? t.createdAt)} · ${fmtDuration(st.totalMs)}`)));
      box.addEventListener('click', (e) => {
        const check = box.checked;
        const range = e.shiftKey && lastClicked ? rangeIds(ids, lastClicked, t.id) : [t.id];
        for (const id of range) check ? selected.add(id) : selected.delete(id);
        lastClicked = t.id;
        // prevent text selection from shift-click
        window.getSelection()?.removeAllRanges();
        render();
      });
      return rowEl;
    }) : [h('li', { class: 'empty small' }, 'No active tasks.')]));
  }

  return { root, render, tick() {} };
}
