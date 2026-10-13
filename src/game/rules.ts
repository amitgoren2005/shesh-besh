// Backgammon rules. Each side's checkers are stored from that side's own
// perspective: index 1..24 = points (1 = ace point, 24 = farthest),
// 25 = bar, 0 = borne off. My point p is the opponent's point 25 - p.

export type Side = 'w' | 'b';
export const BAR = 25;
export const OFF = 0;
export const CHECKERS = 15;

export interface Position { w: number[]; b: number[] }
export interface Step { from: number; to: number; die: number; hit?: boolean }
export interface Move { steps: Step[]; result: Position; key: string }
export interface TurnOptions { paths: Step[][]; moves: Move[]; maxSteps: number }

export const other = (s: Side): Side => (s === 'w' ? 'b' : 'w');

export function emptySide(): number[] { return new Array(26).fill(0); }

export function initialPosition(): Position {
  const side = () => { const a = emptySide(); a[24] = 2; a[13] = 5; a[8] = 3; a[6] = 5; return a; };
  return { w: side(), b: side() };
}

export function clonePos(p: Position): Position { return { w: p.w.slice(), b: p.b.slice() }; }
export function posKey(p: Position): string { return p.w.join(',') + '|' + p.b.join(','); }

export function pipCount(arr: number[]): number {
  let s = 0;
  for (let i = 1; i <= 25; i++) s += i * arr[i];
  return s;
}

const allHome = (me: number[]) => { for (let i = 7; i <= 25; i++) if (me[i]) return false; return true; };

/** Can `side` land on its own point `to` (1..24)? */
function open(pos: Position, side: Side, to: number): boolean {
  return pos[other(side)][25 - to] < 2;
}

/** Legal single-checker steps for one die. */
export function singleSteps(pos: Position, side: Side, die: number): Step[] {
  const me = pos[side];
  if (me[BAR] > 0) {
    const t = 25 - die;
    return open(pos, side, t) ? [{ from: BAR, to: t, die }] : [];
  }
  const out: Step[] = [];
  const home = allHome(me);
  for (let p = 24; p >= 1; p--) {
    if (!me[p]) continue;
    const t = p - die;
    if (t >= 1) { if (open(pos, side, t)) out.push({ from: p, to: t, die }); }
    else if (home) {
      if (t === 0) out.push({ from: p, to: OFF, die });
      else {
        let higher = false;
        for (let q = p + 1; q <= 6; q++) if (me[q]) { higher = true; break; }
        if (!higher) out.push({ from: p, to: OFF, die });
      }
    }
  }
  return out;
}

export function applyStep(pos: Position, side: Side, step: Step): { pos: Position; hit: boolean } {
  const n = clonePos(pos), me = n[side], op = n[other(side)];
  me[step.from]--;
  let hit = false;
  if (step.to !== OFF) {
    const oi = 25 - step.to;
    if (op[oi] === 1) { op[oi] = 0; op[BAR]++; hit = true; }
  }
  me[step.to]++;
  return { pos: n, hit };
}

export function applySteps(pos: Position, side: Side, steps: Step[]): Position {
  let p = pos;
  for (const s of steps) p = applyStep(p, side, s).pos;
  return p;
}

/** All legal ways to play a roll, honouring the max-dice and larger-die rules. */
export function turnOptions(pos: Position, side: Side, d1: number, d2: number): TurnOptions {
  const orders = d1 === d2 ? [[d1, d1, d1, d1]] : [[d1, d2], [d2, d1]];
  const leaves: { steps: Step[]; pos: Position }[] = [];
  const rec = (p: Position, seq: number[], i: number, steps: Step[]) => {
    if (i === seq.length) { leaves.push({ steps, pos: p }); return; }
    const opts = singleSteps(p, side, seq[i]);
    if (!opts.length) { leaves.push({ steps, pos: p }); return; }
    for (const s of opts) {
      const r = applyStep(p, side, s);
      rec(r.pos, seq, i + 1, steps.concat({ ...s, hit: r.hit }));
    }
  };
  orders.forEach(o => rec(pos, o, 0, []));

  let maxSteps = 0;
  for (const l of leaves) maxSteps = Math.max(maxSteps, l.steps.length);
  let keep = leaves.filter(l => l.steps.length === maxSteps);
  if (maxSteps === 1 && d1 !== d2) {
    const big = Math.max(d1, d2);
    const withBig = keep.filter(l => l.steps[0].die === big);
    if (withBig.length) keep = withBig;
  }
  const seen = new Set<string>(), paths: Step[][] = [], moves: Move[] = [];
  for (const l of keep) {
    const pk = l.steps.map(s => `${s.from}-${s.to}-${s.die}`).join(' ');
    if (!seen.has('p' + pk)) { seen.add('p' + pk); paths.push(l.steps); }
    const key = posKey(l.pos);
    if (!seen.has(key)) { seen.add(key); moves.push({ steps: l.steps, result: l.pos, key }); }
  }
  return { paths, moves, maxSteps };
}

const sameStep = (a: Step, b: Step) => a.from === b.from && a.to === b.to && a.die === b.die;

/** Remaining step sequences of the paths that start with `played`. */
export function remainingPaths(opts: TurnOptions, played: Step[]): Step[][] {
  const out: Step[][] = [];
  for (const p of opts.paths) {
    let ok = true;
    for (let i = 0; i < played.length; i++) if (!p[i] || !sameStep(p[i], played[i])) { ok = false; break; }
    if (ok) out.push(p.slice(played.length));
  }
  return out;
}

export interface Dest { to: number; steps: Step[] }

/** Where the checker on `from` can go next (single die or combined dice). */
export function destinations(opts: TurnOptions, played: Step[], from: number): Dest[] {
  const best = new Map<number, Step[]>();
  for (const rest of remainingPaths(opts, played)) {
    if (!rest.length || rest[0].from !== from) continue;
    const chain: Step[] = [];
    for (let i = 0; i < rest.length; i++) {
      if (i > 0 && rest[i].from !== chain[chain.length - 1].to) break;
      chain.push(rest[i]);
      const to = rest[i].to, cur = best.get(to);
      if (!cur || cur.length > chain.length) best.set(to, chain.slice());
      if (to === OFF) break;
    }
  }
  return [...best].map(([to, steps]) => ({ to, steps }));
}

/** Points (own perspective, 25 = bar) holding checkers that can move now. */
export function movableFroms(opts: TurnOptions, played: Step[]): number[] {
  const s = new Set<number>();
  for (const r of remainingPaths(opts, played)) if (r.length) s.add(r[0].from);
  return [...s];
}

export const turnComplete = (opts: TurnOptions, played: Step[]) =>
  remainingPaths(opts, played).every(r => r.length === 0) && played.length === opts.maxSteps;

export const hasWon = (pos: Position, side: Side) => pos[side][OFF] === CHECKERS;

export type WinKind = 'single' | 'mars' | 'turkish';
export function winResult(pos: Position, winner: Side): { kind: WinKind; points: 1 | 2 | 3 } {
  const lo = pos[other(winner)];
  if (lo[OFF] > 0) return { kind: 'single', points: 1 };
  for (let i = 19; i <= 25; i++) if (lo[i]) return { kind: 'turkish', points: 3 };
  return { kind: 'mars', points: 2 };
}

/** gnubg-style notation, e.g. "13/7 8/7", "bar/22*", "6/off(2)". */
export function notation(steps: Step[]): string {
  const name = (n: number) => (n === BAR ? 'bar' : n === OFF ? 'off' : String(n));
  const segs: { from: number; to: number; hit: boolean }[] = [];
  const used = new Array(steps.length).fill(false);
  for (let i = 0; i < steps.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let from = steps[i].from, to = steps[i].to, hit = !!steps[i].hit;
    let extended = true;
    while (extended && !hit && to !== OFF) {
      extended = false;
      for (let j = i + 1; j < steps.length; j++) {
        if (!used[j] && steps[j].from === to) { used[j] = true; to = steps[j].to; hit = !!steps[j].hit; extended = true; break; }
      }
    }
    segs.push({ from, to, hit });
  }
  segs.sort((a, b) => b.from - a.from || b.to - a.to);
  const parts: string[] = [];
  for (let i = 0; i < segs.length;) {
    let n = 1;
    while (i + n < segs.length && segs[i + n].from === segs[i].from && segs[i + n].to === segs[i].to && segs[i + n].hit === segs[i].hit) n++;
    parts.push(`${name(segs[i].from)}/${name(segs[i].to)}${segs[i].hit ? '*' : ''}${n > 1 ? `(${n})` : ''}`);
    i += n;
  }
  return parts.join(' ');
}

/** Absolute board index (white's numbering) of a side-relative point. */
export const absPoint = (side: Side, p: number) => (side === 'w' ? p : 25 - p);
