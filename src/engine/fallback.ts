// Lightweight heuristic evaluator, used only when the gnubg WebAssembly
// engine can't be loaded. It plays reasonably but is far from world class.
import { other, pipCount, type Position, type Side } from '../game/rules';
import type { Evaluation, Probs } from './types';

/** Number of the 36 rolls that hit a blot `dist` pips away (direct + simple indirect). */
export function shotCount(dist: number): number {
  let n = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
    if (a === dist || b === dist || (a !== b && a + b === dist) || (a === b && dist % a === 0 && dist / a <= 4)) n++;
  }
  return n;
}

/** Evaluate `pos` from the point of view of `side`, which has just moved (opponent to roll). */
export function heuristicEval(pos: Position, side: Side): Evaluation {
  const me = pos[side], op = pos[other(side)];
  const pipLead = pipCount(op) - pipCount(me);
  let score = pipLead * 0.012;

  let contact = false;
  let myBack = 0;
  for (let p = 1; p <= 25; p++) if (me[p]) myBack = Math.max(myBack, p);
  let opBack = 0;
  for (let p = 1; p <= 25; p++) if (op[p]) opBack = Math.max(opBack, p);
  if (myBack + opBack > 25) contact = true;

  if (contact) {
    for (let p = 1; p <= 24; p++) {
      if (me[p] >= 2) score += p <= 6 ? 0.07 : p <= 9 ? 0.05 : 0.02;
      if (me[p] > 3) score -= 0.015 * (me[p] - 3);
      if (me[p] === 1) {
        let risk = 0;
        for (let q = 1; q <= 25; q++) if (op[q]) {
          const opPoint = 25 - p, dist = q - opPoint;
          if (dist > 0 && dist <= 12) risk = Math.max(risk, shotCount(dist));
        }
        score -= (risk / 36) * (0.12 + (25 - p) * 0.006);
      }
    }
    let run = 0, prime = 0;
    for (let p = 1; p <= 12; p++) { run = me[p] >= 2 ? run + 1 : 0; prime = Math.max(prime, run); }
    score += prime * prime * 0.012;
    score += op[25] * 0.12 - me[25] * 0.12;
  }
  score += (me[0] - op[0]) * 0.02;

  const win = 1 / (1 + Math.exp(-score * 3));
  const probs: Probs = [win, 0, 0, 0, 0];
  return { eq: 2 * win - 1, probs };
}
