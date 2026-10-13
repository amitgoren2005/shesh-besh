import { useSyncExternalStore } from 'react';
import type { Level } from '../engine/types';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../training/analysis';

export type Speed = 'slow' | 'normal' | 'fast';
export type CheckerShape = 'flat' | 'dome' | 'outline' | 'engraved' | 'hex' | 'chip';

export interface Settings {
  boardTheme: string;
  checkerShape: CheckerShape;
  diceTheme: string;
  homeSide: 'right' | 'left';
  thresholds: Thresholds;
  sound: boolean;
  speed: Speed;
  lastLevel: Level;
  lastTraining: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  boardTheme: 'emerald-classic', checkerShape: 'flat', diceTheme: 'emerald-classic',
  homeSide: 'right', thresholds: DEFAULT_THRESHOLDS, sound: true, speed: 'normal',
  lastLevel: 4, lastTraining: true,
};

const KEY = 'shesh-besh-settings';
let current: Settings = load();
const subs = new Set<() => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...s, thresholds: { ...DEFAULT_THRESHOLDS, ...(s.thresholds ?? {}) } };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export const getSettings = () => current;
export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage full or disabled */ }
  subs.forEach(f => f());
}
export function useSettings(): Settings {
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, getSettings);
}
export const speedFactor = (s: Speed) => ({ slow: 1.8, normal: 1, fast: 0.4 })[s];
