import { IndexedDBHelper } from './queryOptimizer';

const DB_NAME = 'screndly-offline-cache';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';
const QUEUE_STORE = 'tmdbMutationQueue';
const SNAPSHOT_ID = 'tmdb-posts';
const TMDB_CACHE_SCHEMA_VERSION = 1;
const TMDB_CACHE_TTL_MS = 15 * 60 * 1000;

type SnapshotRecord<T> = {
  id: string;
  schemaVersion: number;
  cachedAt: string;
  expiresAt: string;
  payload: T;
};

export type TMDbMutationOperation =
  | 'restore'
  | 'reschedule'
  | 'update-status'
  | 'update-post'
  | 'delete'
  | 'create-or-update';

export interface TMDbMutationRecord {
  id: string;
  operation: TMDbMutationOperation;
  payload: Record<string, unknown>;
  queuedAt: string;
}

const db = new IndexedDBHelper(DB_NAME, DB_VERSION);
let initPromise: Promise<void> | null = null;

async function ensureDb(): Promise<void> {
  if (!initPromise) {
    initPromise = db.init([SNAPSHOT_STORE, QUEUE_STORE]);
  }

  await initPromise;
}

export async function saveTMDbPostsSnapshot<T>(posts: T): Promise<void> {
  await ensureDb();
  const now = new Date();
  const record: SnapshotRecord<T> = {
    id: SNAPSHOT_ID,
    schemaVersion: TMDB_CACHE_SCHEMA_VERSION,
    cachedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TMDB_CACHE_TTL_MS).toISOString(),
    payload: posts,
  };

  await db.put(SNAPSHOT_STORE, record);
}

export async function getTMDbPostsSnapshot<T>(): Promise<T | null> {
  await ensureDb();
  const record = await db.get<SnapshotRecord<T>>(SNAPSHOT_STORE, SNAPSHOT_ID);
  if (!record) {
    return null;
  }

  if (record.schemaVersion !== TMDB_CACHE_SCHEMA_VERSION) {
    await db.delete(SNAPSHOT_STORE, SNAPSHOT_ID);
    return null;
  }

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await db.delete(SNAPSHOT_STORE, SNAPSHOT_ID);
    return null;
  }

  return record.payload;
}

export async function enqueueTMDbMutation(
  operation: TMDbMutationOperation,
  payload: Record<string, unknown>,
): Promise<void> {
  await ensureDb();
  const record: TMDbMutationRecord = {
    id: `${operation}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    operation,
    payload,
    queuedAt: new Date().toISOString(),
  };

  await db.put(QUEUE_STORE, record);
}

export async function getQueuedTMDbMutations(): Promise<TMDbMutationRecord[]> {
  await ensureDb();
  const records = await db.getAll<TMDbMutationRecord>(QUEUE_STORE);
  return records.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function removeQueuedTMDbMutation(id: string): Promise<void> {
  await ensureDb();
  await db.delete(QUEUE_STORE, id);
}
