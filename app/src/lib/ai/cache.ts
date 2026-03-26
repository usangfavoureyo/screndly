import type { AIRouterTaskType } from './router';

interface AIResponseCacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

interface AIResponseCacheOptions {
  ttlMs: number;
  persist?: boolean;
  forceFresh?: boolean;
}

const STORAGE_PREFIX = 'screndly_ai_cache:';
const memoryCache = new Map<string, AIResponseCacheEntry<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
    .join(',')}}`;
}

function createCacheKey(namespace: string, payload: unknown): string {
  return `${STORAGE_PREFIX}${namespace}:${stableSerialize(payload)}`;
}

function readStoredEntry<T>(key: string): AIResponseCacheEntry<T> | null {
  const inMemory = memoryCache.get(key);
  if (inMemory && inMemory.expiresAt > Date.now()) {
    return inMemory as AIResponseCacheEntry<T>;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AIResponseCacheEntry<T>;
    if (parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(key);
      memoryCache.delete(key);
      return null;
    }

    memoryCache.set(key, parsed as AIResponseCacheEntry<unknown>);
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredEntry<T>(key: string, entry: AIResponseCacheEntry<T>, persist: boolean) {
  memoryCache.set(key, entry as AIResponseCacheEntry<unknown>);

  if (!persist || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore storage quota errors and keep the in-memory cache.
  }
}

export function getDefaultTaskCacheTtl(taskType: AIRouterTaskType): number {
  switch (taskType) {
    case 'comment-automation':
      return 60 * 60 * 1000;
    case 'youtube-validation':
    case 'validator':
      return 4 * 60 * 60 * 1000;
    case 'rss-entity-extraction':
    case 'classification':
    case 'metadata-extraction':
    case 'movie-tv-detection':
    case 'image-ranking':
      return 12 * 60 * 60 * 1000;
    case 'caption-generation':
    case 'summary-generation':
      return 24 * 60 * 60 * 1000;
    case 'editorial-rewrite':
    case 'low-confidence-arbitration':
    case 'complex-disambiguation':
      return 6 * 60 * 60 * 1000;
    default:
      return 12 * 60 * 60 * 1000;
  }
}

export async function getCachedAIResponse<T>(
  namespace: string,
  payload: unknown,
  loader: () => Promise<T>,
  options: AIResponseCacheOptions,
): Promise<{ data: T; cacheHit: boolean }> {
  const key = createCacheKey(namespace, payload);

  if (!options.forceFresh) {
    const cached = readStoredEntry<T>(key);
    if (cached) {
      return {
        data: cached.data,
        cacheHit: true,
      };
    }
  }

  const pending = pendingRequests.get(key);
  if (pending) {
    const data = await pending as T;
    return { data, cacheHit: false };
  }

  const promise = loader();
  pendingRequests.set(key, promise);

  try {
    const data = await promise;
    writeStoredEntry(
      key,
      {
        data,
        cachedAt: Date.now(),
        expiresAt: Date.now() + options.ttlMs,
      },
      options.persist !== false,
    );
    return { data, cacheHit: false };
  } finally {
    pendingRequests.delete(key);
  }
}
