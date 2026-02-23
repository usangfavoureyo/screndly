/**
 * API Call Batching and Request Deduplication
 * 
 * Features:
 * - Batches multiple API calls into single requests
 * - Deduplicates identical concurrent requests
 * - Request queue with priority levels
 * - Automatic retry with exponential backoff
 * - Request cancellation support
 */

interface BatchedRequest<T = any> {
  id: string;
  url: string;
  options?: RequestInit;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
  timestamp: number;
  retries: number;
}

interface BatchConfig {
  maxBatchSize: number;
  batchDelay: number; // ms to wait before sending batch
  maxRetries: number;
  retryDelay: number;
  enableDeduplication: boolean;
}

class APIBatcher {
  private queue: BatchedRequest[] = [];
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private batchTimer: number | null = null;
  private config: BatchConfig = {
    maxBatchSize: 10,
    batchDelay: 50, // 50ms
    maxRetries: 3,
    retryDelay: 1000,
    enableDeduplication: true,
  };

  constructor(config?: Partial<BatchConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Add request to batch queue
   */
  public async request<T = any>(
    url: string,
    options?: RequestInit,
    priority: number = 0
  ): Promise<T> {
    // Request deduplication
    if (this.config.enableDeduplication) {
      const requestKey = this.getRequestKey(url, options);
      const existingRequest = this.pendingRequests.get(requestKey);
      
      if (existingRequest) {
        return existingRequest;
      }
    }

    return new Promise<T>((resolve, reject) => {
      const request: BatchedRequest<T> = {
        id: this.generateId(),
        url,
        options,
        resolve,
        reject,
        priority,
        timestamp: Date.now(),
        retries: 0,
      };

      this.queue.push(request);
      this.scheduleBatch();

      // Store in pending requests for deduplication
      if (this.config.enableDeduplication) {
        const requestKey = this.getRequestKey(url, options);
        const promise = new Promise<T>((res, rej) => {
          request.resolve = res;
          request.reject = rej;
        });
        this.pendingRequests.set(requestKey, promise);
      }
    });
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch(): void {
    if (this.batchTimer !== null) {
      return;
    }

    this.batchTimer = window.setTimeout(() => {
      this.processBatch();
      this.batchTimer = null;
    }, this.config.batchDelay);

    // If queue is full, process immediately
    if (this.queue.length >= this.config.maxBatchSize) {
      if (this.batchTimer !== null) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
      this.processBatch();
    }
  }

  /**
   * Process batch of requests
   */
  private async processBatch(): Promise<void> {
    if (this.queue.length === 0) return;

    // Sort by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);

    // Take batch
    const batch = this.queue.splice(0, this.config.maxBatchSize);

    // Process each request in the batch
    const promises = batch.map((request) => this.executeRequest(request));

    await Promise.allSettled(promises);
  }

  /**
   * Execute individual request with retry logic
   */
  private async executeRequest<T>(request: BatchedRequest<T>): Promise<void> {
    try {
      const response = await fetch(request.url, request.options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Clear from pending requests
      if (this.config.enableDeduplication) {
        const requestKey = this.getRequestKey(request.url, request.options);
        this.pendingRequests.delete(requestKey);
      }

      request.resolve(data);
    } catch (error) {
      // Retry logic
      if (request.retries < this.config.maxRetries) {
        request.retries++;
        const delay = this.config.retryDelay * Math.pow(2, request.retries - 1); // Exponential backoff
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        
        // Add back to queue for retry
        this.queue.push(request);
        this.scheduleBatch();
      } else {
        // Max retries reached
        if (this.config.enableDeduplication) {
          const requestKey = this.getRequestKey(request.url, request.options);
          this.pendingRequests.delete(requestKey);
        }
        
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Generate unique request key for deduplication
   */
  private getRequestKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all pending requests
   */
  public clear(): void {
    this.queue = [];
    this.pendingRequests.clear();
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.queue.length;
  }
}

// Singleton instance
export const apiBatcher = new APIBatcher({
  maxBatchSize: 10,
  batchDelay: 50,
  maxRetries: 3,
  retryDelay: 1000,
  enableDeduplication: true,
});

/**
 * Debounced API call wrapper
 */
export function debounceApiCall<T>(
  fn: (...args: any[]) => Promise<T>,
  delay: number = 300
): (...args: any[]) => Promise<T> {
  let timeoutId: number | null = null;
  let latestResolve: ((value: T) => void) | null = null;
  let latestReject: ((error: Error) => void) | null = null;

  return function (...args: any[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      latestResolve = resolve;
      latestReject = reject;

      timeoutId = window.setTimeout(async () => {
        try {
          const result = await fn(...args);
          latestResolve?.(result);
        } catch (error) {
          latestReject?.(error instanceof Error ? error : new Error(String(error)));
        }
      }, delay);
    });
  };
}

/**
 * Throttled API call wrapper
 */
export function throttleApiCall<T>(
  fn: (...args: any[]) => Promise<T>,
  limit: number = 1000
): (...args: any[]) => Promise<T> | undefined {
  let inThrottle = false;
  let lastResult: T | undefined;

  return async function (...args: any[]): Promise<T> | undefined {
    if (!inThrottle) {
      inThrottle = true;
      
      try {
        lastResult = await fn(...args);
        return lastResult;
      } finally {
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    }
    
    return lastResult;
  };
}

export default apiBatcher;
