// Compares our move generator with gnubg's (the WebAssembly engine) on random positions.
import { describe, expect, it } from 'vitest';
import { applyStep, initialPosition, other, posKey, turnOptions, type Position, type Side } from './rules';

interface Mod {
  _malloc(n: number): number; HEAP32: Int32Array;
  ccall(n: string, r: string, t: string[], a: number[]): string | number;
}

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}

describe('move generation matches gnubg', () => {
  it('same set of resulting positions on 400 random positions', { timeout: 120000 }, async () => {
    const factory = (await import('../../public/engine/sb-engine.js' as string)).default as (o: object) => Promise<Mod>;
    const m = await factory({ print: () => undefined, printErr: () => undefined });
    expect(m.ccall('sb_init', 'number', [], [])).toBe(0);
    const pMe = m._malloc(100), pOp = m._malloc(100);
    const r = rng(7);
    let checked = 0;
    let pos: Position = initialPosition(), side: Side = 'w';
    while (checked < 400) {
      const d1 = 1 + Math.floor(r() * 6), d2 = 1 + Math.floor(r() * 6);
      const ours = turnOptions(pos, side, d1, d2);
      const me = pos[side], op = pos[other(side)];
      for (let i = 0; i < 25; i++) { m.HEAP32[(pMe >> 2) + i] = me[i + 1]; m.HEAP32[(pOp >> 2) + i] = op[i + 1]; }
      const res = JSON.parse(m.ccall('sb_analyze', 'string', ['number', 'number', 'number', 'number', 'number'], [pMe, pOp, d1, d2, 0]) as string) as { moves: { move: number[][] }[] };
      const theirs = new Set(res.moves.map(mv => {
        let p = pos;
        for (const [f, t] of mv.move) p = applyStep(p, side, { from: f === 24 ? 25 : f + 1, to: t < 0 ? 0 : t + 1, die: 0 }).pos;
        return posKey(p);
      }));
      const mine = new Set(ours.maxSteps ? ours.moves.map(x => x.key) : []);
      expect([...mine].sort()).toEqual([...theirs].sort());
      checked++;
      if (!ours.moves.length) break;
      pos = ours.moves[Math.floor(r() * ours.moves.length)].result;
      side = other(side);
      if (pos.w[0] === 15 || pos.b[0] === 15) { pos = initialPosition(); side = 'w'; }
    }
    expect(checked).toBe(400);
  });
});
