// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { miniLayout, X, Y, GAP, TOL } from '../src/ui/miniTimer.js';

describe('miniLayout: heights fitted to the browser’s smallest mini window', () => {
  it('Chromium 240 × 52: card 32, ⌂ / + 14, 🔍 / rows 16', () => {
    expect(miniLayout(52)).toEqual({ y: 52, icon: 14, h1: 32, row: 16 });
    expect(X).toBe(240);
  });
  it('the three rail icons + two gaps always fill the height exactly', () => {
    for (let h = 30; h <= 80; h++) {
      const L = miniLayout(h);
      expect(L.icon * 2 + L.row + GAP * 2).toBe(L.y);
      expect(L.h1).toBe(L.icon * 2 + GAP);
      expect(Math.abs(L.row - L.h1 / 2)).toBeLessThanOrEqual(2);
    }
  });
  it('adapts within ±20% and clamps beyond it', () => {
    expect(miniLayout(46).y).toBe(46);
    expect(miniLayout(60).y).toBe(60);
    expect(miniLayout(20).y).toBe(Math.round(Y * (1 - TOL)));
    expect(miniLayout(1000).y).toBe(Math.round(Y * (1 + TOL)));
    expect(miniLayout(undefined).y).toBe(52);
  });
});
