import type { Position, Side, Step } from '../game/rules';

/** gnubg output order: win, win gammon, win backgammon, lose gammon, lose backgammon. */
export type Probs = [number, number, number, number, number];

export interface RankedMove {
  steps: Step[];
  key: string;
  notation: string;
  eq: number;
  probs: Probs;
  ply: number;
}

export interface Evaluation { eq: number; probs: Probs }

export type Level = 0 | 1 | 2 | 3 | 4;
export const LEVEL_NAMES: Record<Level, string> = {
  0: 'מתחיל', 1: 'בינוני', 2: 'מתקדם', 3: 'מומחה', 4: 'אלוף העולם',
};

export type EngineRequest =
  | { id: number; type: 'init' }
  | { id: number; type: 'best'; pos: Position; side: Side; dice: [number, number]; level: Level }
  | { id: number; type: 'analyze'; pos: Position; side: Side; dice: [number, number]; ply: number }
  | { id: number; type: 'grade'; pos: Position; side: Side; dice: [number, number]; ply: number; played: Step[] }
  | { id: number; type: 'evaluate'; pos: Position; side: Side; ply: number };

export type EngineResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

export interface EngineInfo { kind: 'gnubg' | 'fallback'; detail?: string }
