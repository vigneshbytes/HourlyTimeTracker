import { describe, it, expect } from 'vitest';
import { checkTask, checkManualSession } from '../src/logic/forms.js';

const NOW = new Date(2026, 10, 26, 12).getTime();

describe('shared form rules', () => {
  it('needs a task name', () => {
    expect(checkTask({ name: '  ' }, NOW).ok).toBe(false);
    expect(checkTask({ name: ' Write ' }, NOW).value).toEqual({ name: 'Write', notes: '', maxHours: null, expiresAt: null });
  });
  it('validates max hours and expiry', () => {
    expect(checkTask({ name: 'a', limit: 'abc' }, NOW).errors.limit).toBeTruthy();
    expect(checkTask({ name: 'a', limit: '7:30' }, NOW).value.maxHours).toBe(7.5);
    const r = checkTask({ name: 'a', expiry: '14' }, NOW);
    expect(r.ok).toBe(true);
    expect(r.value.expiresAt).toBeGreaterThan(NOW);
  });
  it('checks manual session hours', () => {
    expect(checkManualSession({ hours: '' }).ok).toBe(false);
    expect(checkManualSession({ hours: 'x' }).error).toBeTruthy();
    expect(checkManualSession({ hours: '1:30', date: '2026-11-20' }).value).toEqual({ hours: 1.5, date: '2026-11-20', time: '' });
  });
});
