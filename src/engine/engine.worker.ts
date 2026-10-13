/// <reference lib="webworker" />
import {
  applyStep, notation, other, posKey, turnOptions, type Move, type Position, type Side, type Step,
} from '../game/rules';
import { heuristicEval } from './fallback';
import type { EngineInfo, EngineRequest, Evaluation, Level, Probs, RankedMove } from './types';

interface GnubgModule {
  _malloc(n: number): number;
  _free(p: number): void;
  HEAP32: Int32Array;
  ccall(name: string, ret: string, types: string[], args: number[]): string | number;
}

let mod: GnubgModule | null = null;
let info: EngineInfo = { kind: 'fallback' };
let ptrMe = 0, ptrOpp = 0;

async function init(): Promise<EngineInfo> {
  if (mod) return info;
  try {
    const base = import.meta.env.BASE_URL + 'engine/';
    // Load via a blob URL: Vite's dev server refuses direct imports of files in /public.
    const src = await (await fetch(base + 'sb-engine.js')).text();
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const factory = (await import(/* @vite-ignore */ url)).default as (o: object) => Promise<GnubgModule>;
    URL.revokeObjectURL(url);
    mod = await factory({ locateFile: (f: string) => base + f, print: () => undefined, printErr: () => undefined });
    const rc = mod.ccall('sb_init', 'number', [], []) as number;
    if (rc !== 0) throw new Error('sb_init returned ' + rc);
    ptrMe = mod._malloc(25 * 4);
    ptrOpp = mod._malloc(25 * 4);
    info = { kind: 'gnubg' };
  } catch (e) {
    mod = null;
    info = { kind: 'fallback', detail: String(e) };
  }
  return info;
}

/** gnubg layout: index 0..23 = points 1..24 of that side, 24 = bar. */
function setBoard(pos: Position, side: Side) {
  const me = pos[side], op = pos[other(side)];
  const base1 = ptrMe >> 2, base2 = ptrOpp >> 2;
  for (let i = 0; i < 25; i++) {
    mod!.HEAP32[base1 + i] = me[i + 1];
    mod!.HEAP32[base2 + i] = op[i + 1];
  }
}

const fromEngine = (pairs: number[][]): Step[] =>
  pairs.map(([f, t]) => ({ from: f === 24 ? 25 : f + 1, to: t < 0 ? 0 : t + 1, die: 0 }));

/** Map engine step pairs to our generated move (matching by resulting position). */
function matchMove(pos: Position, side: Side, moves: Move[], pairs: number[][]): Move | null {
  let p = pos;
  for (const s of fromEngine(pairs)) p = applyStep(p, side, s).pos;
  const key = posKey(p);
  return moves.find(m => m.key === key) ?? null;
}

function rankFallback(side: Side, moves: Move[]): RankedMove[] {
  return moves
    .map(m => { const e = heuristicEval(m.result, side); return { steps: m.steps, key: m.key, notation: notation(m.steps), eq: e.eq, probs: e.probs, ply: 0 }; })
    .sort((a, b) => b.eq - a.eq);
}

const toEnginePairs = (steps: Step[]) => steps.flatMap(s => [s.from === 25 ? 24 : s.from - 1, s.to === 0 ? -1 : s.to - 1]);

function analyze(pos: Position, side: Side, dice: [number, number], ply: number, played?: Step[]): RankedMove[] {
  const opts = turnOptions(pos, side, dice[0], dice[1]);
  if (opts.maxSteps === 0) return [];
  if (!mod) return rankFallback(side, opts.moves);
  setBoard(pos, side);
  let json: string;
  if (played && played.length) {
    const pairs = toEnginePairs(played);
    const ptr = mod._malloc(pairs.length * 4);
    pairs.forEach((v, i) => (mod!.HEAP32[(ptr >> 2) + i] = v));
    json = mod.ccall('sb_analyze_move', 'string', ['number', 'number', 'number', 'number', 'number', 'number', 'number'],
      [ptrMe, ptrOpp, dice[0], dice[1], ply, ptr, played.length]) as string;
    mod._free(ptr);
  } else {
    json = mod.ccall('sb_analyze', 'string', ['number', 'number', 'number', 'number', 'number'], [ptrMe, ptrOpp, dice[0], dice[1], ply]) as string;
  }
  const r = JSON.parse(json) as { moves?: { move: number[][]; eq: number; p: number[]; ply: number }[]; error?: string };
  if (!r.moves) return rankFallback(side, opts.moves);
  const out: RankedMove[] = [];
  const seen = new Set<string>();
  for (const em of r.moves) {
    const m = matchMove(pos, side, opts.moves, em.move);
    if (!m || seen.has(m.key)) continue;
    seen.add(m.key);
    out.push({ steps: m.steps, key: m.key, notation: notation(m.steps), eq: em.eq, probs: em.p as Probs, ply: em.ply });
  }
  // Any move the engine didn't list (shouldn't happen) goes last.
  for (const m of opts.moves) if (!seen.has(m.key)) out.push({ steps: m.steps, key: m.key, notation: notation(m.steps), eq: -3, probs: [0, 0, 0, 0, 0], ply: -1 });
  return out;
}

function best(pos: Position, side: Side, dice: [number, number], level: Level): RankedMove | null {
  const opts = turnOptions(pos, side, dice[0], dice[1]);
  if (opts.maxSteps === 0) return null;
  if (!mod) {
    const ranked = rankFallback(side, opts.moves);
    const noise = [0.25, 0.15, 0.07, 0.02, 0][level];
    if (noise) ranked.forEach(r => (r.eq += (Math.random() - 0.5) * noise * 2));
    return ranked.sort((a, b) => b.eq - a.eq)[0];
  }
  setBoard(pos, side);
  const json = mod.ccall('sb_best_move', 'string', ['number', 'number', 'number', 'number', 'number'], [ptrMe, ptrOpp, dice[0], dice[1], level]) as string;
  const r = JSON.parse(json) as { move: number[][] };
  const m = matchMove(pos, side, opts.moves, r.move) ?? opts.moves[0];
  return { steps: m.steps, key: m.key, notation: notation(m.steps), eq: 0, probs: [0, 0, 0, 0, 0], ply: level };
}

function evaluate(pos: Position, side: Side, ply: number): Evaluation {
  if (!mod) {
    const e = heuristicEval(pos, other(side));
    return { eq: -e.eq, probs: [1 - e.probs[0], 0, 0, 0, 0] };
  }
  setBoard(pos, side);
  const json = mod.ccall('sb_evaluate', 'string', ['number', 'number', 'number'], [ptrMe, ptrOpp, ply]) as string;
  const r = JSON.parse(json) as { eq: number; p: number[] };
  return { eq: r.eq, probs: r.p as Probs };
}

self.onmessage = async (ev: MessageEvent<EngineRequest>) => {
  const q = ev.data;
  try {
    let result: unknown;
    if (q.type === 'init') result = await init();
    else {
      await init();
      if (q.type === 'best') result = best(q.pos, q.side, q.dice, q.level);
      else if (q.type === 'analyze') result = analyze(q.pos, q.side, q.dice, q.ply);
      else if (q.type === 'grade') result = analyze(q.pos, q.side, q.dice, q.ply, q.played);
      else result = evaluate(q.pos, q.side, q.ply);
    }
    self.postMessage({ id: q.id, ok: true, result });
  } catch (e) {
    self.postMessage({ id: q.id, ok: false, error: String(e) });
  }
};
