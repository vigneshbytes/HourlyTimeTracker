import { sessionDuration, sessionTime } from './tasks.js';
import { startOfDay } from './time.js';

const DAY = 86400000;

export function startOfWeek(t) {
  const d = new Date(startOfDay(t));
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export function startOfMonth(t) {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

// Summary numbers for the idle panel, the History header and the streak badge.
// dailyAvgMs = all tracked time ÷ the number of days that have any tracked time
// (days off don't drag the average down).
export function overviewStats(sessions, now = Date.now()) {
  const today = startOfDay(now);
  const week = startOfWeek(now);
  const month = startOfMonth(now);
  let todayMs = 0, weekMs = 0, monthMs = 0, totalMs = 0, todaySessions = 0, lastEnd = null;
  const days = new Set();
  for (const s of sessions) {
    const t = sessionTime(s);
    const dur = sessionDuration(s, now);
    totalMs += dur;
    if (t >= today) { todayMs += dur; todaySessions++; }
    if (t >= week) weekMs += dur;
    if (t >= month) monthMs += dur;
    days.add(startOfDay(t));
    if (!s.manual && s.end != null && (lastEnd == null || s.end > lastEnd)) lastEnd = s.end;
  }
  // Streak: consecutive days with tracked time, ending today (or yesterday).
  let streak = 0;
  let d = days.has(today) ? today : today - DAY;
  while (days.has(startOfDay(d))) { streak++; d = startOfDay(d - DAY / 2); }
  const dailyAvgMs = days.size ? totalMs / days.size : 0;
  return { todayMs, weekMs, monthMs, todaySessions, dailyAvgMs, trackedDays: days.size, streak, lastEnd };
}

export const QUOTES = [
  ['Lost time is never found again.', 'Benjamin Franklin'],
  ['Well begun is half done.', 'Aristotle'],
  ['One today is worth two tomorrows.', 'Benjamin Franklin'],
  ['Nothing is particularly hard if you divide it into small jobs.', 'Henry Ford'],
  ['The best way out is always through.', 'Robert Frost'],
  ['It is not enough to be busy; so are the ants. The question is: what are we busy about?', 'Henry David Thoreau'],
  ['Begin, be bold, and venture to be wise.', 'Horace'],
  ['Well done is better than well said.', 'Benjamin Franklin'],
  ['Drop by drop the pot is filled.', 'Proverb'],
  ['Little by little, one travels far.', 'Proverb'],
  ['Do not squander time, for that is the stuff life is made of.', 'Benjamin Franklin'],
];

// Same quote all day, changes daily.
export function quoteOfTheDay(now = Date.now()) {
  const n = Math.floor(startOfDay(now) / DAY);
  return QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
