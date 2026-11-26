import { describe, it, expect } from 'vitest';
import { parseHours, parseExpiry, fmtDuration, fmtClock } from '../src/logic/time.js';
import { buildStats, sortMainList, rangeIds, filterHistory, sortOldestActivity } from '../src/logic/tasks.js';
import { normalizeTask, SETTINGS_DEFAULTS } from '../src/db/records.js';

const NOW = new Date(2026, 10, 26, 12).getTime();
const H = 3600000;

describe('parsing', () => {
  it('parses hours in several forms', () => {
    expect(parseHours('2.5')).toBe(2.5);
    expect(parseHours('1:30')).toBe(1.5);
    expect(parseHours('90m')).toBe(1.5);
    expect(parseHours('1h 30m')).toBe(1.5);
    expect(parseHours('abc')).toBeNaN();
  });
  it('parses expiry as days or a date', () => {
    expect(new Date(parseExpiry('2', NOW).value).getDate()).toBe(28);
    expect(new Date(parseExpiry('2026-12-31', NOW).value).getMonth()).toBe(11);
    expect(new Date(parseExpiry('31/12/2026', NOW, 'en-GB').value).getDate()).toBe(31);
    expect(new Date(parseExpiry('12/31/2026', NOW, 'en-US').value).getDate()).toBe(31);
    expect(parseExpiry('31/02/2026', NOW, 'en-GB').error).toBeTruthy();
    expect(parseExpiry('', NOW).value).toBeNull();
  });
  it('formats durations', () => {
    expect(fmtDuration(90 * 60000)).toBe('1h 30m');
    expect(fmtClock(3723000)).toBe('1:02:03');
  });
});

describe('sorting and colours', () => {
  const mk = (o) => normalizeTask({ createdAt: NOW - 10 * H, ...o });
  const tasks = [
    mk({ id: 'old', name: 'old', lastUsedAt: NOW - 5 * H }),
    mk({ id: 'recent', name: 'recent', lastUsedAt: NOW - H }),
    mk({ id: 'expiring', name: 'exp', lastUsedAt: NOW - 9 * H, expiresAt: NOW + 24 * H }),
    mk({ id: 'yellow', name: 'y', lastUsedAt: NOW - 3 * H, maxHours: 10 }),
    mk({ id: 'running', name: 'r', lastUsedAt: NOW - 8 * H }),
  ];
  const sessions = [
    { id: 's1', taskId: 'yellow', start: NOW - 20 * H, end: NOW - 12 * H },
    { id: 's2', taskId: 'running', start: NOW - 60000, end: null, running: 1 },
  ];
  const stats = buildStats(tasks, sessions, SETTINGS_DEFAULTS, NOW);

  it('orders running, then expiring, then most recently used; yellow does not jump', () => {
    expect(sortMainList(tasks, stats).map((t) => t.id)).toEqual(['running', 'expiring', 'recent', 'yellow', 'old']);
  });
  it('colours red for expiring and yellow at 70% of the limit', () => {
    expect(stats.get('expiring').color).toBe('red');
    expect(stats.get('yellow').color).toBe('yellow');
    expect(stats.get('yellow').overLimit).toBe(false);
    expect(stats.get('old').color).toBeNull();
  });
  it('bulk archive order is oldest activity first', () => {
    expect(sortOldestActivity(tasks)[0].id).toBe('expiring');
  });
  it('history search matches names and notes', () => {
    const t = [mk({ id: 'a', name: 'Logo design', notes: 'for ACME' }), mk({ id: 'b', name: 'Website' })];
    const st = buildStats(t, [], SETTINGS_DEFAULTS, NOW);
    expect(filterHistory(t, st, { query: 'acme' }).map((x) => x.id)).toEqual(['a']);
  });
  it('shift-click range selection', () => {
    expect(rangeIds(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['b', 'c', 'd']);
  });
});
