const DAY = 86400000;

export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function fmtDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h === 0) return ms > 0 && totalMin === 0 ? '<1m' : `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtHours(h) {
  return fmtDuration(h * 3600000);
}

// "2.5" → 2.5, "1:30" → 1.5, "1h 30m" → 1.5, "90m" → 1.5. Returns NaN when invalid.
export function parseHours(input) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return NaN;
  let m;
  if ((m = s.match(/^(\d+):([0-5]?\d)$/))) return +m[1] + +m[2] / 60;
  if ((m = s.match(/^(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?)?$/))) return parseFloat(m[1].replace(',', '.'));
  if ((m = s.match(/^(\d+)\s*m(in(ute)?s?)?$/))) return +m[1] / 60;
  if ((m = s.match(/^(\d+)\s*h(?:rs?|ours?)?\s*(\d+)\s*m(?:in(?:ute)?s?)?$/))) return +m[1] + +m[2] / 60;
  return NaN;
}

export const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const endOfDay = (t) => { const d = new Date(t); d.setHours(23, 59, 59, 999); return d.getTime(); };
export const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Order of day/month/year in the user's locale, e.g. ['day','month','year'].
export function localeDateOrder(locale) {
  return new Intl.DateTimeFormat(locale).formatToParts(new Date(2001, 11, 31))
    .map((p) => p.type).filter((t) => ['day', 'month', 'year'].includes(t));
}

// Expiry input: "" → null, "7" / "7d" / "7 days" → end of day 7 days from now,
// "2026-12-31" or a locale-ordered date like "31/12/2026" → end of that day.
// Returns { value: epochMs|null, error?: string }.
export function parseExpiry(input, now = Date.now(), locale) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return { value: null };
  let m;
  if ((m = s.match(/^(\d{1,4})\s*(d|days?)?$/))) return { value: endOfDay(now + Number(m[1]) * DAY) };
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return dateOrError(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/))) {
    const nums = [m[1], m[2], m[3]];
    if (nums[0].length === 4) return dateOrError(+nums[0], +nums[1], +nums[2]);
    const order = localeDateOrder(locale);
    const parts = {};
    order.forEach((k, i) => { parts[k] = +nums[i]; });
    if (parts.year < 100) parts.year += 2000;
    return dateOrError(parts.year, parts.month, parts.day);
  }
  return { value: null, error: 'Enter a number of days or a date' };
}

function dateOrError(y, mo, d) {
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return { value: null, error: 'That date does not exist' };
  return { value: endOfDay(dt.getTime()) };
}

export function fmtDate(t, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return t == null ? '–' : new Date(t).toLocaleDateString(undefined, opts);
}
export function fmtDateTime(t) {
  return t == null ? '–' : new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function fmtTime(t) {
  return new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
export function toInputDate(t) { return t == null ? '' : dayKey(t); }
export function toInputTime(t) { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

export function daysUntil(t, now = Date.now()) {
  return Math.round((startOfDay(t) - startOfDay(now)) / DAY);
}

export function relativeExpiry(t, now = Date.now()) {
  if (t == null) return '';
  if (t < now) return 'Expired';
  const d = daysUntil(t, now);
  if (d === 0) return 'Expires today';
  if (d === 1) return 'Expires tomorrow';
  return `Expires in ${d} days`;
}
