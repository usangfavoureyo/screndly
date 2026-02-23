/**
 * Database Query Optimization Utilities
 * 
 * Features:
 * - Query result caching
 * - Batch query execution
 * - Query deduplication
 * - IndexedDB optimization helpers
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface QueryOptions {
  cacheTime?: number; // Cache duration in ms
  forceFresh?: boolean; // Skip cache
  priority?: number; // Query priority
}

class QueryOptimizer {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingQueries: Map<string, Promise<any>> = new Map();
  private queryQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;

  /**
   * Execute query with caching and deduplication
   */
  public async query<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const {
      cacheTime = 5 * 60 * 1000, // 5 minutes default
      forceFresh = false,
      priority = 0,
    } = options;

    // Check cache first
    if (!forceFresh) {
      const cached = this.getFromCache<T>(key);
      if (cached !== null) {
        return cached;
      }
    }

    // Check if query is already pending (deduplication)
    const pending = this.pendingQueries.get(key);
    if (pending) {
      return pending;
    }

    // Create new query promise
    const queryPromise = this.executeQuery(key, queryFn, cacheTime);
    this.pendingQueries.set(key, queryPromise);

    try {
      const result = await queryPromise;
      return result;
    } finally {
      this.pendingQueries.delete(key);
    }
  }

  /**
   * Execute query and cache result
   */
  private async executeQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    cacheTime: number
  ): Promise<T> {
    const result = await queryFn();
    
    // Cache the result
    this.setCache(key, result, cacheTime);
    
    return result;
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache entry
   */
  private setCache<T>(key: string, data: T, cacheTime: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + cacheTime,
    };

    this.cache.set(key, entry);

    // Clean up expired entries periodically
    this.cleanupCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Invalidate cache entry
   */
  public invalidate(key: string | RegExp): void {
    if (typeof key === 'string') {
      this.cache.delete(key);
    } else {
      // Invalidate all keys matching regex
      const keysToDelete: string[] = [];
      this.cache.forEach((_, cacheKey) => {
        if (key.test(cacheKey)) {
          keysToDelete.push(cacheKey);
        }
      });
      keysToDelete.forEach((k) => this.cache.delete(k));
    }
  }

  /**
   * Clear all cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Batch multiple queries
   */
  public async batchQuery<T>(
    queries: Array<{ key: string; queryFn: () => Promise<T>; options?: QueryOptions }>
  ): Promise<T[]> {
    return Promise.all(
      queries.map(({ key, queryFn, options }) => this.query(key, queryFn, options))
    );
  }

  /**
   * Prefetch data (fire and forget)
   */
  public prefetch<T>(
    key: string,
    queryFn: () => Promise<T>,
    options?: QueryOptions
  ): void {
    this.query(key, queryFn, options).catch((error) => {
      console.warn('[QueryOptimizer] Prefetch failed:', error);
    });
  }
}

// Singleton instance
export const queryOptimizer = new QueryOptimizer();

/**
 * IndexedDB Optimization Helpers
 */
export class IndexedDBHelper {
  private dbName: string;
  private version: number;
  private db: IDBDatabase | null = null;

  constructor(dbName: string, version: number = 1) {
    this.dbName = dbName;
    this.version = version;
  }

  /**
   * Initialize database
   */
  public async init(stores: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        stores.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
          }
        });
      };
    });
  }

  /**
   * Get item from store
   */
  public async get<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all items from store
   */
  public async getAll<T>(storeName: string): Promise<T[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Put item in store
   */
  public async put<T>(storeName: string, item: T): Promise<IDBValidKey> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete item from store
   */
  public async delete(storeName: string, key: IDBValidKey): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear store
   */
  public async clear(storeName: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Batch operations
   */
  public async batchPut<T>(storeName: string, items: T[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      let completed = 0;
      const total = items.length;

      items.forEach((item) => {
        const request = store.put(item);
        
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
        
        request.onerror = () => reject(request.error);
      });

      if (total === 0) {
        resolve();
      }
    });
  }
}

/**
 * LocalStorage optimization with compression
 */
export class OptimizedLocalStorage {
  /**
   * Set item with automatic JSON stringification
   */
  public static setItem(key: string, value: any): void {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.error('[LocalStorage] Failed to set item:', error);
    }
  }

  /**
   * Get item with automatic JSON parsing
   */
  public static getItem<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue || null;
      }
      return JSON.parse(item);
    } catch (error) {
      console.error('[LocalStorage] Failed to get item:', error);
      return defaultValue || null;
    }
  }

  /**
   * Remove item
   */
  public static removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('[LocalStorage] Failed to remove item:', error);
    }
  }

  /**
   * Clear all items
   */
  public static clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('[LocalStorage] Failed to clear:', error);
    }
  }

  /**
   * Get storage size
   */
  public static getSize(): number {
    let size = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        size += localStorage[key].length + key.length;
      }
    }
    return size;
  }
}

export default queryOptimizer;
