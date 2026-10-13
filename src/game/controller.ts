import { engine } from '../engine/client';
import type { Level } from '../engine/types';
import { saveGame } from '../store/db';
import { getSettings, speedFactor } from '../store/settings';
import type { GameRecord, TurnRecord } from '../store/types';
import { buildAnalysis, performanceRating, type MoveAnalysis } from '../training/analysis';
import { sound } from '../ui/sound';
import {
  applyStep, applySteps, destinations, hasWon, initialPosition, movableFroms, notation, posKey,
  turnComplete, turnOptions, winResult, type Dest, type Position, type Side, type Step, type TurnOptions,
} from './rules';

export type Phase = 'opening' | 'rolling' | 'human' | 'analyzing' | 'review' | 'demo' | 'bot' | 'over';

export interface DieView { v: number; used: boolean }

export interface Snapshot {
  pos: Position;
  phase: Phase;
  turn: Side;
  dice: DieView[];
  diceSide: Side;
  rollFaces: [number, number] | null;
  opening: { w: number; b: number; winner: Side | null; tie: boolean } | null;
  selected: number | null;
  dests: Dest[];
  movable: number[];
  canDone: boolean;
  canUndo: boolean;
  lastBot: number[];
  review: MoveAnalysis | null;
  demo: { which: 'best' | 'mine'; from: Position; steps: Step[]; nonce: number } | null;
  paused: boolean;
  thinking: boolean;
  toast: { text: string; n: number } | null;
  record: GameRecord;
}

const CANCEL = Symbol('cancel');
const rnd = () => 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 6);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function defaultGameName(d = new Date()) {
  return `משחק ${d.getDate()}.${d.getMonth() + 1} · ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export class Game {
  private rec: GameRecord;
  private pos: Position;
  private phase: Phase = 'opening';
  private turn: Side = 'w';
  private diceVals: [number, number] | null = null;
  private diceSide: Side = 'w';
  private opts: TurnOptions | null = null;
  private played: Step[] = [];
  private turnStart: Position;
  private sel: number | null = null;
  private rollFaces: [number, number] | null = null;
  private opening: Snapshot['opening'] = null;
  private lastBot: number[] = [];
  private review: MoveAnalysis | null = null;
  private reviewDone: (() => void) | null = null;
  private demo: Snapshot['demo'] = null;
  private paused = false;
  private thinking = false;
  private toastMsg: Snapshot['toast'] = null;
  private token = 0;
  private pending: Promise<unknown>[] = [];
  private saving: Promise<void> = Promise.resolve();
  private subs = new Set<() => void>();
  private snap: Snapshot;

  private constructor(rec: GameRecord) {
    this.rec = rec;
    this.pos = rec.live?.pos ?? initialPosition();
    this.turnStart = this.pos;
    this.snap = this.build();
  }

  static create(name: string, level: Level, training: boolean): Game {
    const now = Date.now();
    return new Game({
      id: newId(), name: name || defaultGameName(), createdAt: now, updatedAt: now, level, training,
      status: 'active', openingRolls: [], starter: null, turns: [], live: null,
    });
  }
  static resume(rec: GameRecord): Game {
    return new Game({ ...structuredClone(rec), status: 'active' });
  }

  get id() { return this.rec.id; }
  subscribe = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f); }; };
  getSnapshot = () => this.snap;

  private build(): Snapshot {
    const human = this.phase === 'human';
    const dice: DieView[] = [];
    if (this.diceVals) {
      const [a, b] = this.diceVals;
      const vals = a === b ? [a, a, a, a] : [a, b];
      const usedCount = new Map<number, number>();
      if (this.diceSide === 'w' && this.phase === 'human') for (const s of this.played) usedCount.set(s.die, (usedCount.get(s.die) ?? 0) + 1);
      for (const v of vals) {
        const u = usedCount.get(v) ?? 0;
        dice.push({ v, used: u > 0 });
        if (u > 0) usedCount.set(v, u - 1);
      }
    }
    return {
      pos: this.pos, phase: this.phase, turn: this.turn, dice, diceSide: this.diceSide,
      rollFaces: this.rollFaces, opening: this.opening,
      selected: human ? this.sel : null,
      dests: human && this.sel != null && this.opts ? destinations(this.opts, this.played, this.sel) : [],
      movable: human && this.opts ? movableFroms(this.opts, this.played) : [],
      canDone: human && !!this.opts && turnComplete(this.opts, this.played),
      canUndo: human && this.played.length > 0,
      lastBot: this.lastBot, review: this.review, demo: this.demo, paused: this.paused,
      thinking: this.thinking, toast: this.toastMsg, record: this.rec,
    };
  }
  private emit() { this.snap = this.build(); this.subs.forEach(f => f()); }
  private toast(text: string) { this.toastMsg = { text, n: (this.toastMsg?.n ?? 0) + 1 }; }

  private save() {
    this.rec.updatedAt = Date.now();
    const copy = structuredClone(this.rec);
    this.saving = this.saving.then(() => saveGame(copy)).catch(() => undefined);
  }

  private async wait(ms: number, botSpeed = false) {
    const t = this.token;
    await sleep(ms * (botSpeed ? speedFactor(getSettings().speed) : 1));
    while (this.paused && t === this.token) await sleep(120);
    if (t !== this.token) throw CANCEL;
  }

  private run(f: () => Promise<void>) {
    f().catch(e => { if (e !== CANCEL) console.error(e); });
  }

  /** Begin or continue the game. */
  start() {
    const live = this.rec.live;
    this.run(async () => {
      if (!live) return this.openingRoll();
      if (live.toMove === 'w') return live.dice ? this.humanTurn(live.dice) : this.rollHuman();
      return this.botTurn(live.dice ?? undefined);
    });
  }

  private async rollAnim(side: Side) {
    this.phase = 'rolling'; this.turn = side; this.diceSide = side; this.diceVals = null;
    sound.dice();
    for (let i = 0; i < 8; i++) { this.rollFaces = [rnd(), rnd()]; this.emit(); await this.wait(70); }
    this.rollFaces = null;
  }

  private async openingRoll() {
    this.phase = 'opening';
    for (;;) {
      sound.dice();
      for (let i = 0; i < 9; i++) { this.opening = { w: rnd(), b: rnd(), winner: null, tie: false }; this.emit(); await this.wait(70); }
      const w = rnd(), b = rnd();
      this.rec.openingRolls.push({ w, b });
      if (w === b) {
        this.opening = { w, b, winner: null, tie: true }; this.emit();
        await this.wait(1400);
        continue;
      }
      const winner: Side = w > b ? 'w' : 'b';
      this.opening = { w, b, winner, tie: false }; this.emit();
      await this.wait(1700);
      this.opening = null;
      this.rec.starter = winner;
      // House rule: the starter rolls two fresh dice for the first move.
      return winner === 'w' ? this.rollHuman() : this.botTurn();
    }
  }

  private async rollHuman() {
    await this.rollAnim('w');
    await this.humanTurn([rnd(), rnd()]);
  }

  private async humanTurn(dice: [number, number]) {
    this.turn = 'w'; this.diceSide = 'w'; this.diceVals = dice;
    this.opts = turnOptions(this.pos, 'w', dice[0], dice[1]);
    this.played = []; this.turnStart = this.pos; this.sel = null;
    this.rec.live = { pos: this.pos, toMove: 'w', dice };
    this.save();
    this.phase = 'human';
    if (this.opts.maxSteps === 0) {
      // Leave the human phase first so Done/taps can't start a second turn while we wait.
      this.opts = null; this.phase = 'bot';
      this.toast('אין לך מהלך אפשרי'); this.emit();
      await this.wait(1700);
      this.rec.turns.push({ side: 'w', dice, steps: [], notation: '', before: this.pos, after: this.pos });
      return this.botTurn();
    }
    this.emit();
  }

  /** Tap on a point (white's numbering 1..24), 25 = bar, 0 = bear-off tray. */
  tap(p: number) {
    if (this.phase !== 'human' || !this.opts) return;
    if (this.sel != null) {
      const d = destinations(this.opts, this.played, this.sel).find(x => x.to === p);
      if (d) { this.play(d.steps); return; }
    }
    const movable = movableFroms(this.opts, this.played);
    if (movable.includes(p)) this.sel = this.sel === p ? null : p;
    else if (this.sel != null || p !== 0) { this.sel = null; if (p > 0 && this.pos.w[p] > 0) sound.error(); }
    this.emit();
  }

  private play(steps: Step[]) {
    for (const s of steps) {
      const r = applyStep(this.pos, 'w', s);
      this.pos = r.pos;
      this.played.push({ ...s, hit: r.hit });
    }
    this.sel = null;
    sound.checker();
    this.emit();
  }

  undo() {
    if (this.phase !== 'human' || !this.played.length) return;
    this.pos = this.turnStart; this.played = []; this.sel = null; this.emit();
  }

  /** Commit the human move. Returns false if dice remain to be played. */
  done(): boolean {
    if (this.phase !== 'human' || !this.opts) return false;
    if (!turnComplete(this.opts, this.played)) { this.toast('יש עוד קוביות לשחק'); sound.error(); this.emit(); return false; }
    const before = this.turnStart, after = this.pos, dice = this.diceVals!;
    const steps = this.played.slice();
    const turn: TurnRecord = { side: 'w', dice, steps, notation: notation(steps), before, after };
    this.rec.turns.push(turn);
    this.sel = null; this.opts = null;
    const won = hasWon(after, 'w');
    this.rec.live = won ? null : { pos: after, toMove: 'b', dice: null };
    this.save();

    const analysis = this.analyzeTurn(turn);
    const t = this.token;
    this.run(async () => {
      if (this.rec.training && !won) {
        this.phase = 'analyzing'; this.emit();
        const a = await analysis;
        if (t !== this.token) return;
        if (a && a.severity !== 'none') {
          this.review = a; this.phase = 'review'; this.emit();
          await new Promise<void>(res => (this.reviewDone = res));
          this.review = null; this.demo = null;
        }
      }
      if (won) return this.finish('w');
      return this.botTurn();
    });
    return true;
  }

  private analyzeTurn(turn: TurnRecord): Promise<MoveAnalysis | null> {
    const p = (async () => {
      const ranked = await engine().grade(turn.before, turn.side, turn.dice, turn.steps, 2);
      const bestPos = ranked.length ? applySteps(turn.before, turn.side, ranked[0].steps) : turn.after;
      const a = buildAnalysis(turn.before, turn.side, turn.dice, ranked, posKey(turn.after), turn.after, bestPos, getSettings().thresholds);
      if (a) { turn.analysis = a; this.save(); }
      return a;
    })().catch(() => null);
    this.pending.push(p);
    this.pending.push(this.luckOf(turn));
    return p;
  }

  private async luckOf(turn: TurnRecord) {
    try {
      let sum = 0, mine = 0;
      for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) {
        const r = await engine().analyze(turn.before, turn.side, [a, b], 0);
        // No legal play: the opponent is simply on roll in the same position.
        const eq = r.length ? r[0].eq : -(await engine().evaluate(turn.before, turn.side === 'w' ? 'b' : 'w', 0)).eq;
        const w = a === b ? 1 : 2;
        sum += eq * w;
        if ((a === turn.dice[0] && b === turn.dice[1]) || (a === turn.dice[1] && b === turn.dice[0])) mine = eq;
      }
      turn.luck = mine - sum / 36;
      this.save();
    } catch { /* luck is optional */ }
  }

  continueReview() { this.reviewDone?.(); this.reviewDone = null; }

  showDemo(which: 'best' | 'mine') {
    if (!this.review) return;
    const last = this.rec.turns[this.rec.turns.length - 1];
    this.demo = { which, from: last.before, steps: which === 'best' ? this.review.best.steps : last.steps, nonce: (this.demo?.nonce ?? 0) + 1 };
    this.phase = 'demo';
    this.emit();
  }

  private async botTurn(given?: [number, number]) {
    let dice = given;
    if (!dice) { await this.rollAnim('b'); dice = [rnd(), rnd()]; }
    this.turn = 'b'; this.diceSide = 'b'; this.diceVals = dice; this.phase = 'bot';
    this.rec.live = { pos: this.pos, toMove: 'b', dice };
    this.save();
    this.thinking = true; this.lastBot = []; this.emit();
    const t0 = performance.now();
    const before = this.pos;
    const mv = await engine().bestMove(this.pos, 'b', dice, this.rec.level);
    const elapsed = performance.now() - t0;
    await this.wait(Math.max(0, 700 - elapsed), true);
    this.thinking = false;
    const steps: Step[] = [];
    if (!mv) { this.toast('למחשב אין מהלך אפשרי'); this.emit(); await this.wait(1300); }
    else for (const s of mv.steps) {
      const r = applyStep(this.pos, 'b', s);
      this.pos = r.pos; steps.push({ ...s, hit: r.hit });
      this.lastBot = [...this.lastBot, s.to];
      sound.checker(); this.emit();
      await this.wait(380, true);
    }
    const turn: TurnRecord = { side: 'b', dice, steps, notation: notation(steps), before, after: this.pos };
    this.rec.turns.push(turn);
    this.pending.push(this.luckOf(turn));
    if (hasWon(this.pos, 'b')) return this.finish('b');
    this.rec.live = { pos: this.pos, toMove: 'w', dice: null };
    this.save();
    await this.wait(450, true);
    return this.rollHuman();
  }

  private async finish(winner: Side) {
    const r = winResult(this.pos, winner);
    this.rec.result = { winner, ...r };
    this.rec.status = 'finished';
    this.rec.live = null;
    this.phase = 'over'; this.diceVals = null; this.thinking = false;
    sound.win(winner === 'w');
    this.emit();
    this.save();
    await Promise.allSettled(this.pending);
    this.rec.rating = performanceRating(this.rec.turns.filter(t => t.side === 'w').map(t => t.analysis));
    this.save();
    this.emit();
  }

  pause() { if (this.phase === 'over') return; this.paused = true; this.rec.status = 'paused'; this.save(); this.emit(); }
  resume() { if (this.phase === 'over' || this.rec.status === 'stopped') return; this.paused = false; this.rec.status = 'active'; this.emit(); }

  /** Leave the game screen: the game pauses and resumes when the screen is shown again. */
  leave() {
    if (this.phase === 'over' || this.rec.status === 'stopped') return;
    this.paused = true;
    this.rec.status = 'paused';
    this.save();
  }

  /** Discard this in-memory game (another game replaces it). Its saved record stays resumable. */
  dispose() {
    this.token++;
    if (this.rec.status === 'active') { this.rec.status = 'paused'; this.save(); }
  }

  stop() {
    this.token++;
    this.rec.status = 'stopped'; this.rec.live = null;
    this.save();
  }

  rename(name: string) { this.rec.name = name.trim() || this.rec.name; this.save(); this.emit(); }
  setTraining(on: boolean) { this.rec.training = on; this.save(); this.emit(); }
  flush() { return this.saving; }
}
