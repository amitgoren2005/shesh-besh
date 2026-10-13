import type { Position, Side, Step, WinKind } from '../game/rules';
import type { Level } from '../engine/types';
import type { MoveAnalysis } from '../training/analysis';

export interface TurnRecord {
  side: Side;
  dice: [number, number];
  steps: Step[];
  notation: string;
  before: Position;
  after: Position;
  analysis?: MoveAnalysis;
  /** Equity gained from this roll vs an average roll (positive = lucky), from the mover's view. */
  luck?: number;
}

export type GameStatus = 'active' | 'paused' | 'finished' | 'stopped';

export interface LiveState {
  pos: Position;
  toMove: Side;
  dice: [number, number] | null;
}

export interface GameRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  level: Level;
  training: boolean;
  status: GameStatus;
  openingRolls: { w: number; b: number }[];
  starter: Side | null;
  turns: TurnRecord[];
  live: LiveState | null;
  result?: { winner: Side; kind: WinKind; points: 1 | 2 | 3 };
  rating?: number | null;
}
