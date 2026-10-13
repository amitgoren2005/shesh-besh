import type { Position, Side, Step } from '../game/rules';
import type { EngineInfo, EngineRequest, EngineResponse, Evaluation, Level, RankedMove } from './types';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

// Distributes the Omit over each member of the request union.
type Req<T = EngineRequest> = T extends EngineRequest ? Omit<T, 'id'> : never;

class EngineClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  readonly info: Promise<EngineInfo>;

  constructor() {
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev: MessageEvent<EngineResponse>) => {
      const r = ev.data, p = this.pending.get(r.id);
      if (!p) return;
      this.pending.delete(r.id);
      if (r.ok) p.resolve(r.result); else p.reject(new Error(r.error));
    };
    this.info = this.call<EngineInfo>({ type: 'init' });
  }

  private call<T>(req: Req): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ ...req, id });
    });
  }

  bestMove(pos: Position, side: Side, dice: [number, number], level: Level) {
    return this.call<RankedMove | null>({ type: 'best', pos, side, dice, level });
  }
  analyze(pos: Position, side: Side, dice: [number, number], ply = 2) {
    return this.call<RankedMove[]>({ type: 'analyze', pos, side, dice, ply });
  }
  /** Like analyze, but guarantees the played move is evaluated at full depth (for grading). */
  grade(pos: Position, side: Side, dice: [number, number], played: Step[], ply = 2) {
    return this.call<RankedMove[]>({ type: 'grade', pos, side, dice, ply, played });
  }
  evaluate(pos: Position, side: Side, ply = 0) {
    return this.call<Evaluation>({ type: 'evaluate', pos, side, ply });
  }
}

let client: EngineClient | null = null;
export const engine = () => (client ??= new EngineClient());
