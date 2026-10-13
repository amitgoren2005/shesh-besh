import { describe, expect, it } from 'vitest';
import { hasWon, initialPosition, other, turnOptions, winResult, type Position, type Side } from './rules';

// Deterministic PRNG so failures are reproducible.
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}

const total = (a: number[]) => a.reduce((s, x) => s + x, 0);

function checkInvariants(p: Position) {
  expect(total(p.w)).toBe(15);
  expect(total(p.b)).toBe(15);
  for (let i = 1; i <= 24; i++) expect(p.w[i] > 0 && p.b[25 - i] > 0).toBe(false);
  for (const a of [p.w, p.b]) for (const x of a) expect(x).toBeGreaterThanOrEqual(0);
}

describe('random full games', () => {
  it('200 games always terminate with a valid result', { timeout: 60000 }, () => {
    const r = rng(42);
    const kinds = { single: 0, mars: 0, turkish: 0 };
    for (let g = 0; g < 200; g++) {
      let pos = initialPosition(), side: Side = r() < .5 ? 'w' : 'b', turns = 0;
      while (!hasWon(pos, 'w') && !hasWon(pos, 'b')) {
        const d1 = 1 + Math.floor(r() * 6), d2 = 1 + Math.floor(r() * 6);
        const o = turnOptions(pos, side, d1, d2);
        const m = o.moves[Math.floor(r() * o.moves.length)];
        expect(m.steps.length).toBe(o.maxSteps);
        pos = m.result;
        checkInvariants(pos);
        side = other(side);
        expect(++turns).toBeLessThan(2000);
      }
      const winner: Side = hasWon(pos, 'w') ? 'w' : 'b';
      kinds[winResult(pos, winner).kind]++;
    }
    // Random play produces plenty of gammons; all three kinds should show up.
    expect(kinds.single).toBeGreaterThan(0);
    expect(kinds.mars).toBeGreaterThan(0);
  });
});
