import { describe, expect, it } from 'vitest';
import { emptySide, type Position } from '../game/rules';
import { DEFAULT_THRESHOLDS, explain, features, severityOf, shotsAgainst } from './analysis';

const pos = (w: Record<number, number>, b: Record<number, number>): Position => {
  const mk = (o: Record<number, number>) => { const a = emptySide(); for (const k in o) a[+k] = o[k]; return a; };
  const p = { w: mk(w), b: mk(b) };
  for (const a of [p.w, p.b]) a[0] += 15 - a.reduce((x, y) => x + y, 0);
  return p;
};

describe('shot counting', () => {
  it('direct 6 with no blocks = 17 rolls', () => {
    // White blot on its 7 = black's 18; black's two checkers on its 24 are 6 pips away.
    const p = pos({ 7: 1 }, { 24: 2, 1: 13 });
    expect(shotsAgainst(p, 'w').rolls).toBe(17);
  });
  it('blot 1 away = 11 + ... direct ones', () => {
    const p = pos({ 12: 1 }, { 14: 1, 1: 14 }); // white 12 = black 13, black on 14 is 1 away
    expect(shotsAgainst(p, 'w').rolls).toBe(11);
  });
  it('no blots, no shots', () => {
    const p = pos({ 6: 2 }, { 24: 2, 1: 13 });
    expect(shotsAgainst(p, 'w').rolls).toBe(0);
  });
});

describe('features and explanations', () => {
  it('detects home points and prime', () => {
    const f = features(pos({ 4: 2, 5: 2, 6: 2, 8: 3, 13: 6 }, { 24: 15 }), 'w');
    expect(f.homePoints).toEqual([4, 5, 6]);
    expect(f.prime).toBe(3);
  });
  it('explains an exposed blot', () => {
    const before = pos({ 6: 4, 8: 3, 13: 4, 24: 2, 4: 2 }, { 24: 2, 13: 4, 8: 3, 6: 4, 5: 2 });
    const played = pos({ 6: 4, 8: 3, 13: 2, 10: 1, 7: 1, 24: 2, 4: 2 }, { 24: 2, 13: 4, 8: 3, 6: 4, 5: 2 });
    const best = pos({ 6: 4, 8: 3, 13: 3, 24: 2, 4: 3 }, { 24: 2, 13: 4, 8: 3, 6: 4, 5: 2 });
    const probs = [0.5, 0.1, 0.01, 0.1, 0.01] as [number, number, number, number, number];
    const r = explain(before, 'w', played, best, { probs }, { probs });
    expect(r[0]).toContain('בודדים');
    expect(r.join(' ')).toMatch(/מתוך 36/);
  });
  it('severity thresholds', () => {
    expect(severityOf(0.01, DEFAULT_THRESHOLDS)).toBe('none');
    expect(severityOf(0.04, DEFAULT_THRESHOLDS)).toBe('inaccuracy');
    expect(severityOf(0.07, DEFAULT_THRESHOLDS)).toBe('mistake');
    expect(severityOf(0.2, DEFAULT_THRESHOLDS)).toBe('blunder');
  });
});
