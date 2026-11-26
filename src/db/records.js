// Record shapes and defaults. Reading always goes through normalize*(), which
// fills in defaults for fields that older app versions never wrote, and keeps
// any unknown fields untouched (written by newer/older versions).

export const RECORD_VERSION = 1; // version of the code that last wrote a record

export const TASK_DEFAULTS = Object.freeze({
  name: '',
  notes: '',
  maxHours: null,   // number | null
  expiresAt: null,  // epoch ms (end of the expiry day) | null
  status: 'active', // 'active' | 'archived'
  createdAt: 0,
  updatedAt: 0,
  lastUsedAt: null, // epoch ms of last start/stop
  archivedAt: null,
});

export const SESSION_DEFAULTS = Object.freeze({
  taskId: null,
  start: null,         // epoch ms | null (manual log without a date)
  end: null,           // epoch ms | null (running, or manual without a date)
  manual: false,
  durationMs: null,    // manual logs only
  dateProvided: true,  // manual logs: user typed a date
  timeProvided: true,  // manual logs: user typed a time
  createdAt: 0,
  updatedAt: 0,
});

export const SETTINGS_DEFAULTS = Object.freeze({
  expiryWarnDays: 2,
  yellowThreshold: 0.7,
  createOnlyUntil: 0, // epoch ms; until then new tasks are created without starting a timer
});

export const normalizeTask = (raw) => ({ ...TASK_DEFAULTS, ...raw });
export const normalizeSession = (raw) => ({ ...SESSION_DEFAULTS, ...raw });
export const normalizeSettings = (raw) => ({ ...SETTINGS_DEFAULTS, ...(raw || {}) });

// Fields a user may change on a task through the UI.
export const EDITABLE_TASK_FIELDS = ['name', 'notes', 'maxHours', 'expiresAt'];

export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}
