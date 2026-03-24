import { IndexedDBHelper } from './queryOptimizer';

const DB_NAME = 'screndly-offline-cache';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';

const RSS_FEEDS_SNAPSHOT_ID = 'rss-feeds';
const RSS_ACTIVITY_SNAPSHOT_ID = 'rss-activity';
const RSS_CACHE_SCHEMA_VERSION = 1;
const RSS_FEEDS_CACHE_TTL_MS = 15 * 60 * 1000;
const RSS_ACTIVITY_CACHE_TTL_MS = 10 * 60 * 1000;

type SnapshotRecord<T> = {
  id: string;
  schemaVersion: number;
  cachedAt: string;
  expiresAt: string;
  payload: T;
};

const db = new IndexedDBHelper(DB_NAME, DB_VERSION);
let initPromise: Promise<void> | null = null;

async function ensureDb(): Promise<void> {
  if (!initPromise) {
    initPromise = db.init([SNAPSHOT_STORE]);
  }

  await initPromise;
}

async function saveSnapshot<T>(id: string, payload: T, ttlMs: number): Promise<void> {
  await ensureDb();
  const now = new Date();
  const record: SnapshotRecord<T> = {
    id,
    schemaVersion: RSS_CACHE_SCHEMA_VERSION,
    cachedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    payload,
  };

  await db.put(SNAPSHOT_STORE, record);
}

async function getSnapshot<T>(id: string): Promise<T | null> {
  await ensureDb();
  const record = await db.get<SnapshotRecord<T>>(SNAPSHOT_STORE, id);
  if (!record) {
    return null;
  }

  if (record.schemaVersion !== RSS_CACHE_SCHEMA_VERSION) {
    await db.delete(SNAPSHOT_STORE, id);
    return null;
  }

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await db.delete(SNAPSHOT_STORE, id);
    return null;
  }

  return record.payload;
}

export async function saveRSSFeedsSnapshot<T>(feeds: T): Promise<void> {
  await saveSnapshot(RSS_FEEDS_SNAPSHOT_ID, feeds, RSS_FEEDS_CACHE_TTL_MS);
}

export async function getRSSFeedsSnapshot<T>(): Promise<T | null> {
  return getSnapshot<T>(RSS_FEEDS_SNAPSHOT_ID);
}

export async function saveRSSActivitySnapshot<T>(activity: T): Promise<void> {
  await saveSnapshot(RSS_ACTIVITY_SNAPSHOT_ID, activity, RSS_ACTIVITY_CACHE_TTL_MS);
}

export async function getRSSActivitySnapshot<T>(): Promise<T | null> {
  return getSnapshot<T>(RSS_ACTIVITY_SNAPSHOT_ID);
}
