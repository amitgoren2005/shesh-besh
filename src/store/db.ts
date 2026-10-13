import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GameRecord } from './types';

interface Schema extends DBSchema {
  games: { key: string; value: GameRecord; indexes: { updatedAt: number } };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
const db = () => (dbp ??= openDB<Schema>('shesh-besh', 1, {
  upgrade(d) {
    const s = d.createObjectStore('games', { keyPath: 'id' });
    s.createIndex('updatedAt', 'updatedAt');
  },
}));

export async function saveGame(g: GameRecord): Promise<void> {
  await (await db()).put('games', structuredClone(g));
}
export async function getGame(id: string): Promise<GameRecord | undefined> {
  return (await db()).get('games', id);
}
export async function listGames(): Promise<GameRecord[]> {
  const all = await (await db()).getAllFromIndex('games', 'updatedAt');
  return all.reverse();
}
export async function deleteGame(id: string): Promise<void> {
  await (await db()).delete('games', id);
}

export interface Backup { app: 'shesh-besh'; version: 1; exportedAt: number; games: GameRecord[]; settings: unknown }

export async function exportBackup(settings: unknown): Promise<Backup> {
  return { app: 'shesh-besh', version: 1, exportedAt: Date.now(), games: await listGames(), settings };
}

export async function importBackup(data: unknown): Promise<{ games: number; settings: unknown }> {
  const b = data as Backup;
  if (!b || b.app !== 'shesh-besh' || !Array.isArray(b.games)) throw new Error('bad-file');
  const d = await db();
  const tx = d.transaction('games', 'readwrite');
  for (const g of b.games) if (g && typeof g.id === 'string' && Array.isArray(g.turns)) await tx.store.put(g);
  await tx.done;
  return { games: b.games.length, settings: b.settings };
}
