import { describe, it, expect } from 'vitest';
import { fetchQuote } from '../src/logic/quotes.js';

const ok = (body) => async () => ({ ok: true, json: async () => body });
describe('quotes', () => {
  it('uses the first API that answers', async () => {
    const q = await fetchQuote({ fetchImpl: ok({ quote: 'Hi', author: 'Me' }) });
    expect(q).toMatchObject({ text: 'Hi', author: 'Me', source: 'api' });
  });
  it('falls back to a built-in quote when offline or failing', async () => {
    const q = await fetchQuote({ fetchImpl: async () => { throw new Error('offline'); } });
    expect(q.source).toBe('local');
    expect(q.text.length).toBeGreaterThan(5);
  });
});
