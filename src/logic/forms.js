// Form rules shared by every UI (the full app's dialogs and the mini timer's
// inline forms). Pure functions: raw text in, { ok, value, errors, hints } out.
import { parseHours, parseExpiry, fmtDate, relativeExpiry, fmtDuration } from './time.js';

export const LIMIT_HINT = 'Turns yellow at 70%, shows "Over limit" at 100%.';
export const EXPIRY_HINT = 'Optional. Turns red when it is close.';

// New / edited task. Resolves to { name, notes, maxHours, expiresAt }.
export function checkTask({ name = '', notes = '', limit = '', expiry = '' } = {}, now = Date.now()) {
  const errors = {};
  const hints = {};
  const nm = String(name).trim();
  if (!nm) errors.name = 'Enter a name';
  const limitRaw = String(limit ?? '').trim();
  const hrs = limitRaw ? parseHours(limitRaw) : null;
  if (limitRaw && !(hrs > 0)) errors.limit = 'Enter hours like 20, 2.5 or 7:30';
  else hints.limit = hrs ? `= ${fmtDuration(hrs * 3600000)}. Turns yellow at 70%.` : LIMIT_HINT;
  const ex = parseExpiry(expiry, now);
  if (ex.error) errors.expiry = ex.error;
  else hints.expiry = ex.value ? `${fmtDate(ex.value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${relativeExpiry(ex.value, now)}` : EXPIRY_HINT;
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, hints, value: ok ? { name: nm, notes: String(notes ?? '').trim(), maxHours: hrs, expiresAt: ex.value } : null };
}

// Manually added session. Resolves to { hours, date, time } (date/time optional).
export function checkManualSession({ hours = '', date = '', time = '' } = {}) {
  const raw = String(hours ?? '').trim();
  const v = parseHours(raw);
  const ok = v > 0;
  return {
    ok,
    error: raw && !ok ? 'Enter hours like 2, 1.5 or 1:30' : '',
    hint: ok ? `= ${fmtDuration(v * 3600000)}` : '',
    value: ok ? { hours: v, date: date || '', time: time || '' } : null,
  };
}
