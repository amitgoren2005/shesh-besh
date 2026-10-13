import { describe, expect, it } from 'vitest';
import {
  applySteps, destinations, emptySide, initialPosition, movableFroms, notation, pipCount,
  turnComplete, turnOptions, winResult, type Position, type Step,
} from './rules';

const pos = (w: Record<number, number>, b: Record<number, number>): Position => {
  const mk = (o: Record<number, number>) => { const a = emptySide(); for (const k in o) a[+k] = o[k]; return a; };
  const p = { w: mk(w), b: mk(b) };
  const fill = (a: number[]) => { const s = a.reduce((x, y) => x + y, 0); a[0] += 15 - s; };
  fill(p.w); fill(p.b);
  return p;
};

describe('opening position', () => {
  it('has 167 pips each', () => {
    const p = initialPosition();
    expect(pipCount(p.w)).toBe(167);
    expect(pipCount(p.b)).toBe(167);
  });
  it('3-1 includes 8/5 6/5 and every move uses both dice', () => {
    const o = turnOptions(initialPosition(), 'w', 3, 1);
    expect(o.maxSteps).toBe(2);
    expect(o.moves.map(m => notation(m.steps))).toContain('8/5 6/5');
    expect(o.moves.length).toBe(16);
  });
  it('6-6 plays four steps', () => {
    const o = turnOptions(initialPosition(), 'w', 6, 6);
    expect(o.maxSteps).toBe(4);
    expect(o.moves.map(m => notation(m.steps))).toContain('24/18(2) 13/7(2)');
  });
});

describe('bar and blocking', () => {
  it('must enter from the bar first', () => {
    const p = pos({ 25: 1, 13: 5 }, { 6: 2 });
    const o = turnOptions(p, 'w', 4, 2);
    for (const path of o.paths) expect(path[0].from).toBe(25);
  });
  it('closed board means no move', () => {
    const p = pos({ 25: 1, 13: 2 }, { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 });
    const o = turnOptions(p, 'w', 6, 5);
    expect(o.maxSteps).toBe(0);
    expect(o.moves.length).toBe(1);
  });
  it('a hit sends the opponent checker to the bar', () => {
    const p = pos({ 13: 1 }, { 15: 1 });
    const o = turnOptions(p, 'w', 3, 4);
    const m = o.moves.find(x => notation(x.steps) === '13/10*/6' || notation(x.steps).startsWith('13/10*'))!;
    expect(m.result.b[25]).toBe(1);
  });
});

describe('dice usage rules', () => {
  it('larger die must be played when only one can be used', () => {
    // White's lone checker on 9 can play 9/3 or 9/8, but white's 2-point is blocked so not both.
    const p = pos({ 9: 1 }, { 23: 2 });
    const o = turnOptions(p, 'w', 6, 1);
    expect(o.maxSteps).toBe(1);
    expect(o.paths.every(path => path[0].die === 6)).toBe(true);
  });
  it('must use both dice when possible', () => {
    const p = pos({ 24: 1 }, {});
    const o = turnOptions(p, 'w', 5, 2);
    expect(o.maxSteps).toBe(2);
  });
});

describe('bearing off', () => {
  it('exact and higher dice bear off', () => {
    const p = pos({ 3: 1, 1: 1 }, { 24: 15 });
    const o = turnOptions(p, 'w', 6, 3);
    const names = o.moves.map(m => notation(m.steps));
    expect(names).toContain('3/off 1/off');
  });
  it('cannot bear off with checkers outside home', () => {
    const p = pos({ 8: 1, 2: 1 }, { 24: 15 });
    const o = turnOptions(p, 'w', 6, 5);
    for (const path of o.paths) expect(path[0].to).not.toBe(0);
  });
  it('higher die bears off only the highest checker', () => {
    const p = pos({ 4: 1, 2: 1 }, { 24: 15 });
    const o = turnOptions(p, 'w', 6, 6);
    expect(o.moves.length).toBe(1);
    expect(o.moves[0].result.w[0]).toBe(15);
  });
});

describe('tap-to-move helpers', () => {
  it('offers single and combined destinations', () => {
    const o = turnOptions(initialPosition(), 'w', 6, 3);
    const d = destinations(o, [], 13).map(x => x.to).sort((a, b) => a - b);
    expect(d).toEqual([4, 7, 10]);
    expect(movableFroms(o, []).sort((a, b) => a - b)).toEqual([6, 8, 13, 24]);
  });
  it('tracks a partially played turn', () => {
    const o = turnOptions(initialPosition(), 'w', 6, 1);
    const first: Step = destinations(o, [], 13).find(x => x.to === 7)!.steps[0];
    expect(turnComplete(o, [first])).toBe(false);
    const second = destinations(o, [first], 8).find(x => x.to === 7)!.steps[0];
    expect(turnComplete(o, [first, second])).toBe(true);
    const r = applySteps(initialPosition(), 'w', [first, second]);
    expect(r.w[7]).toBe(2);
  });
});

describe('scoring', () => {
  it('single, mars and turkish mars', () => {
    expect(winResult(pos({}, { 1: 14 }), 'w').kind).toBe('single');
    const mars = pos({}, { 3: 15 }); mars.b[0] = 0;
    expect(winResult(mars, 'w')).toEqual({ kind: 'mars', points: 2 });
    const turk = pos({}, { 3: 14, 20: 1 }); turk.b[0] = 0;
    expect(winResult(turk, 'w')).toEqual({ kind: 'turkish', points: 3 });
  });
});
