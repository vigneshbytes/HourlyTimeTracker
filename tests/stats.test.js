import { describe, it, expect } from 'vitest';
import { overviewStats, startOfWeek, quoteOfTheDay } from '../src/logic/stats.js';

const NOW = new Date(2026, 10, 26, 15).getTime(); // Thu 26 Nov 2026
const at = (d, h) => new Date(2026, 10, d, h).getTime();
const H = 3600000;

describe('overview stats', () => {
  const sessions = [
    { start: at(26, 9), end: at(26, 10) },           // today 1h
    { start: at(26, 11), end: at(26, 11) + H / 2 },  // today 30m
    { start: at(25, 9), end: at(25, 11) },           // yesterday 2h
    { start: at(24, 9), end: at(24, 10) },           // Tue 1h
    { start: at(22, 9), end: at(22, 10) },           // last Sunday (previous week), gap on 23
    { manual: true, durationMs: H, start: null, createdAt: at(26, 12) }, // manual no date, today
  ];
  const s = overviewStats(sessions, NOW);
  it('totals today and this week', () => {
    expect(s.todayMs).toBe(2.5 * H);
    expect(s.weekMs).toBe(5.5 * H);
    expect(s.todayLogs).toBe(3);
  });
  it('counts the streak of consecutive days', () => { expect(s.streak).toBe(3); });
  it('remembers when the last timed session ended', () => { expect(s.lastEnd).toBe(at(26, 11) + H / 2); });
  it('weeks start on Monday', () => { expect(new Date(startOfWeek(NOW)).getDate()).toBe(23); });
  it('quote changes daily but is stable within a day', () => {
    expect(quoteOfTheDay(at(26, 1))).toEqual(quoteOfTheDay(at(26, 23)));
  });
});
