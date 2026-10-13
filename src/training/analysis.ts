import { BAR, other, pipCount, turnOptions, type Position, type Side, type Step } from '../game/rules';
import type { Probs, RankedMove } from '../engine/types';

export type Severity = 'none' | 'inaccuracy' | 'mistake' | 'blunder';
export interface Thresholds { inaccuracy: number; mistake: number; blunder: number }
export const DEFAULT_THRESHOLDS: Thresholds = { inaccuracy: 0.03, mistake: 0.06, blunder: 0.12 };

export const SEVERITY_LABEL: Record<Severity, string> = {
  none: 'מהלך טוב', inaccuracy: 'אי-דיוק', mistake: 'טעות', blunder: 'טעות חמורה',
};
export const SEVERITY_LEVEL: Record<Severity, number> = { none: 0, inaccuracy: 1, mistake: 2, blunder: 3 };

export function severityOf(loss: number, t: Thresholds): Severity {
  if (loss >= t.blunder) return 'blunder';
  if (loss >= t.mistake) return 'mistake';
  if (loss >= t.inaccuracy) return 'inaccuracy';
  return 'none';
}

/** Rolls (out of 36) on which `attacker` can hit at least one of the defender's blots. */
export function shotsAgainst(pos: Position, defender: Side): { rolls: number; blots: number[] } {
  const me = pos[defender], blots: number[] = [];
  for (let p = 1; p <= 24; p++) if (me[p] === 1) blots.push(p);
  if (!blots.length) return { rolls: 0, blots };
  const attacker = other(defender);
  let rolls = 0;
  for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) {
    const opts = turnOptions(pos, attacker, a, b);
    const hits = opts.moves.some(m => m.result[defender][BAR] > me[BAR]);
    if (hits) rolls += a === b ? 1 : 2;
  }
  return { rolls, blots };
}

export interface Features {
  shots: number; blots: number[];
  homePoints: number[]; madePoints: number[];
  prime: number; anchors: number[]; back: number; maxStack: number; stackPoint: number;
  oppOnBar: number; myPips: number; oppPips: number; contact: boolean; off: number;
}

export function features(pos: Position, side: Side): Features {
  const me = pos[side], op = pos[other(side)];
  const sh = shotsAgainst(pos, side);
  const made: number[] = [];
  for (let p = 1; p <= 24; p++) if (me[p] >= 2) made.push(p);
  let run = 0, prime = 0;
  for (let p = 1; p <= 24; p++) { run = me[p] >= 2 ? run + 1 : 0; prime = Math.max(prime, run); }
  let maxStack = 0, stackPoint = 0;
  for (let p = 1; p <= 24; p++) if (me[p] > maxStack) { maxStack = me[p]; stackPoint = p; }
  let myBack = 0, opBack = 0;
  for (let p = 1; p <= 25; p++) { if (me[p]) myBack = p; if (op[p]) opBack = p; }
  let back = me[BAR];
  for (let p = 19; p <= 24; p++) back += me[p];
  return {
    shots: sh.rolls, blots: sh.blots,
    homePoints: made.filter(p => p <= 6), madePoints: made,
    prime, anchors: made.filter(p => p >= 19), back, maxStack, stackPoint,
    oppOnBar: op[BAR], myPips: pipCount(me), oppPips: pipCount(op),
    contact: myBack + opBack > 25, off: me[0],
  };
}

export interface MoveAnalysis {
  dice: [number, number];
  played: { notation: string; eq: number; probs: Probs };
  best: { notation: string; eq: number; probs: Probs; steps: Step[] };
  top: { notation: string; eq: number; probs: Probs }[];
  loss: number;
  severity: Severity;
  reasons: string[];
  bestType: string;
  forced: boolean;
  ply: number;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const pointName = (p: number) => (p === 5 ? 'נקודה 5 (נקודת הזהב)' : p === 7 ? 'נקודה 7 (נקודת הבר)' : `נקודה ${p}`);
const list = (ps: number[]) => ps.length === 1 ? `בנקודה ${ps[0]}` : `בנקודות ${ps.slice(0, -1).join(', ')} ו-${ps[ps.length - 1]}`;

function moveType(before: Position, after: Position, side: Side, fb: Features, fa: Features): string {
  const tags: string[] = [];
  if (after[other(side)][BAR] > before[other(side)][BAR]) tags.push('פגיעה');
  const newPoints = fa.madePoints.filter(p => !fb.madePoints.includes(p));
  if (newPoints.length) tags.push('בנייה');
  if (fa.back < fb.back) tags.push('בריחה');
  if (!fa.contact) tags.push('מרוץ');
  if (!tags.length) tags.push(fa.shots === 0 ? 'משחק בטוח' : 'מיקום');
  return tags.join(' + ');
}

/** Hebrew reasons why `played` is worse than `best`. Most important first. */
export function explain(before: Position, side: Side, playedPos: Position, bestPos: Position,
  played: { probs: Probs }, best: { probs: Probs }): string[] {
  const fp = features(playedPos, side), fb = features(bestPos, side), f0 = features(before, side);
  const out: { w: number; t: string }[] = [];

  if (fp.shots - fb.shots >= 4 && fp.blots.length) {
    const exposed = fp.blots.filter(b => !fb.blots.includes(b));
    const where = exposed.length ? exposed : fp.blots;
    out.push({ w: (fp.shots - fb.shots) / 36 * 3,
      t: `השארת ${where.length === 1 ? 'חייל בודד' : `${where.length} חיילים בודדים`} ${list(where)} בטווח פגיעה של היריב.` });
    out.push({ w: (fp.shots - fb.shots) / 36 * 2.9,
      t: `סיכוי להיפגע: ${fp.shots} מתוך 36 הטלות (${pct(fp.shots / 36)}), לעומת ${fb.shots} (${pct(fb.shots / 36)}) במהלך המומלץ.` });
  }
  const hitP = playedPos[other(side)][BAR] - before[other(side)][BAR];
  const hitB = bestPos[other(side)][BAR] - before[other(side)][BAR];
  if (hitB > hitP) out.push({ w: 0.9, t: `המהלך המומלץ פוגע ${hitB > 1 ? `ב-${hitB} חיילים` : 'בחייל'} של היריב ושולח אותו לבר – היריב מאבד צעדים ומבזבז את התור הבא על כניסה.` });
  if (hitP > hitB && fp.shots > fb.shots) out.push({ w: 0.6, t: 'הפגיעה שביצעת לא שווה את הסיכון: היא משאירה אותך חשוף לפגיעה חוזרת.' });

  const newBest = fb.homePoints.filter(p => !fp.homePoints.includes(p));
  if (newBest.length) out.push({ w: 0.7, t: `המהלך המומלץ סוגר את ${pointName(Math.max(...newBest))} בבית שלך – כל נקודה סגורה בבית מקשה על היריב להיכנס מהבר.` });
  else {
    const key = [7, 8, 9].filter(p => fb.madePoints.includes(p) && !fp.madePoints.includes(p));
    if (key.length) out.push({ w: 0.45, t: `המהלך המומלץ תופס את ${pointName(key[0])} – נקודה חשובה לבניית חסימה מול החיילים האחוריים של היריב.` });
  }
  const newAnchor = fb.anchors.filter(p => !fp.anchors.includes(p) && !f0.anchors.includes(p));
  if (newAnchor.length) {
    const a = Math.min(...newAnchor), golden = a === 20 || a === 21;
    out.push({ w: 0.75, t: `המהלך המומלץ בונה עוגן בנקודה ${a}${golden ? ' (נקודת הזהב של היריב)' : ''} – מקום בטוח לחיילים האחוריים שגם מפריע ליריב לבנות את הבית שלו.` });
  } else if (!newBest.length) {
    const other = fb.madePoints.filter(p => p > 9 && p < 19 && !fp.madePoints.includes(p) && !f0.madePoints.includes(p));
    if (other.length) out.push({ w: 0.3, t: `המהלך המומלץ סוגר את נקודה ${other[0]} ומשאיר פחות חיילים בודדים בדרך.` });
  }
  if (fb.prime > fp.prime && fb.prime >= 3) out.push({ w: 0.4 + fb.prime * 0.05, t: `המהלך המומלץ בונה רצף חסימה (פריים) של ${fb.prime} נקודות, לעומת ${fp.prime} אצלך.` });
  if (fp.anchors.length < f0.anchors.length && fb.anchors.length >= f0.anchors.length)
    out.push({ w: 0.5, t: 'פירקת עוגן (נקודה סגורה בבית של היריב) – העוגן נותן לחיילים האחוריים מקום בטוח.' });
  if (fb.back < fp.back && fp.contact) out.push({ w: 0.35, t: 'המהלך המומלץ מבריח חייל אחורי מהבית של היריב לפני שייחסם.' });
  if (fp.maxStack >= 6 && fp.maxStack > fb.maxStack) out.push({ w: 0.3, t: `ערמת ${fp.maxStack} חיילים על נקודה ${fp.stackPoint} – חיילים עודפים לא עוזרים לבנייה.` });
  if (!fp.contact && !fb.contact) {
    if (fb.off > fp.off) out.push({ w: 0.8, t: `בשלב היציאה כל חייל חשוב: המהלך המומלץ מוציא ${fb.off - fp.off} ${fb.off - fp.off === 1 ? 'חייל' : 'חיילים'} יותר.` });
    else out.push({ w: 0.3, t: 'זה מרוץ: חלק את החיילים כך שלא יתבזבזו צעדים בהמשך היציאה.' });
  }
  const loseG = played.probs[3] - best.probs[3];
  if (loseG > 0.03) out.push({ w: loseG * 6, t: `המהלך שלך מעלה את הסיכון להפסיד במארס ב-${pct(loseG)}.` });
  const winG = best.probs[1] - played.probs[1];
  if (winG > 0.03) out.push({ w: winG * 6, t: `המהלך המומלץ מגדיל את הסיכוי שלך לנצח במארס ב-${pct(winG)}.` });

  out.sort((a, b) => b.w - a.w);
  const reasons = out.slice(0, 3).map(o => o.t);
  if (!reasons.length) reasons.push(`לפי ניתוח המנוע סיכויי הניצחון יורדים מ-${pct(best.probs[0])} ל-${pct(played.probs[0])}. ההבדל נובע מהמבנה הכולל של העמדה.`);
  return reasons;
}

export function buildAnalysis(before: Position, side: Side, dice: [number, number], ranked: RankedMove[],
  playedKey: string, playedPos: Position, bestPos: Position, t: Thresholds): MoveAnalysis | null {
  if (!ranked.length) return null;
  const best = ranked[0];
  const played = ranked.find(r => r.key === playedKey) ?? best;
  const loss = Math.max(0, best.eq - played.eq);
  const forced = ranked.length === 1;
  const severity = forced ? 'none' : severityOf(loss, t);
  const fb = features(before, side), fa = features(bestPos, side);
  return {
    dice,
    played: { notation: played.notation, eq: played.eq, probs: played.probs },
    best: { notation: best.notation, eq: best.eq, probs: best.probs, steps: best.steps },
    top: ranked.slice(0, 3).map(r => ({ notation: r.notation, eq: r.eq, probs: r.probs })),
    loss, severity, forced, ply: best.ply,
    bestType: moveType(before, bestPos, side, fb, fa),
    reasons: severity === 'none' ? [] : explain(before, side, playedPos, bestPos, played, best),
  };
}

/** Performance rating like gnubg's error rate: average equity loss per unforced move × 1000. */
export function performanceRating(analyses: (MoveAnalysis | undefined)[]): number | null {
  const a = analyses.filter((x): x is MoveAnalysis => !!x && !x.forced);
  if (!a.length) return null;
  return (a.reduce((s, x) => s + x.loss, 0) / a.length) * 1000;
}

export function ratingLabel(r: number): string {
  if (r < 2.5) return 'על-אנושי';
  if (r < 5) return 'אלוף עולם';
  if (r < 8) return 'מומחה';
  if (r < 12) return 'מתקדם';
  if (r < 18) return 'בינוני';
  if (r < 26) return 'חובב';
  return 'מתחיל';
}
