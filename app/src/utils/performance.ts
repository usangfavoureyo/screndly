// Performance Monitoring Utilities

/**
 * Measure component render time
 */
export function measureRenderTime(componentName: string, callback: () => void) {
  const start = performance.now();
  callback();
  const end = performance.now();
  console.log(`[Performance] ${componentName} rendered in ${(end - start).toFixed(2)}ms`);
}

/**
 * Report Web Vitals
 */
export function reportWebVitals(metric: any) {
  console.log('[Web Vitals]', {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
  });

  // Send to analytics (e.g., Google Analytics)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    });
  }
}

/**
 * Lazy load component with retry logic
 */
const FORCE_REFRESH_STORAGE_KEY = 'page-has-been-force-refreshed';

function isRecoverableChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  componentName: string
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const isDev = import.meta.env.DEV;
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.localStorage.getItem(FORCE_REFRESH_STORAGE_KEY) || 'false'
    );

    try {
      const component = await componentImport();
      window.localStorage.setItem(FORCE_REFRESH_STORAGE_KEY, 'false');
      return component;
    } catch (error) {
      if (isDev && isRecoverableChunkError(error)) {
        try {
          // During local Vite development, hot updates can briefly invalidate a lazy chunk.
          // Retry once before surfacing an error or forcing a full reload.
          await new Promise((resolve) => window.setTimeout(resolve, 150));
          const component = await componentImport();
          window.localStorage.setItem(FORCE_REFRESH_STORAGE_KEY, 'false');
          return component;
        } catch {
          // Fall through to existing recovery/error behavior.
        }
      }

      if (!pageHasAlreadyBeenForceRefreshed && isRecoverableChunkError(error)) {
        // Force a single full refresh so the latest app shell can recover stale chunks.
        window.localStorage.setItem(FORCE_REFRESH_STORAGE_KEY, 'true');
        console.log(`[Performance] Reloading ${componentName} due to chunk load error`);
        window.location.reload();

        return new Promise<{ default: T }>(() => {
          // Keep the lazy boundary pending while the reload is taking over.
        });
      }

      // If the page has already been force refreshed, throw the error
      throw error;
    }
  });
}

/**
 * Preload critical resources
 */
export function preloadResource(url: string, type: 'script' | 'style' | 'image' | 'font') {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  
  switch (type) {
    case 'script':
      link.as = 'script';
      break;
    case 'style':
      link.as = 'style';
      break;
    case 'image':
      link.as = 'image';
      break;
    case 'font':
      link.as = 'font';
      link.crossOrigin = 'anonymous';
      break;
  }
  
  document.head.appendChild(link);
}

/**
 * Check if connection is slow
 */
export function isSlowConnection(): boolean {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    return connection.saveData || 
           connection.effectiveType === 'slow-2g' || 
           connection.effectiveType === '2g';
  }
  return false;
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Memoize pure function results by serialized arguments
 */
export function memoize<T extends (...args: any[]) => any>(func: T): T {
  const cache = new Map<string, ReturnType<T>>();
  const serialize = (value: unknown): string => {
    if (value === undefined) {
      return '__undefined__';
    }

    return JSON.stringify(value);
  };

  return ((...args: Parameters<T>) => {
    const key = args.map(serialize).join('|');

    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }

    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Request Idle Callback polyfill
 */
export const requestIdleCallback =
  typeof window !== 'undefined'
    ? window.requestIdleCallback ||
      function (cb: IdleRequestCallback) {
        const start = Date.now();
        return setTimeout(function () {
          cb({
            didTimeout: false,
            timeRemaining: function () {
              return Math.max(0, 50 - (Date.now() - start));
            },
          });
        }, 1);
      }
    : (cb: IdleRequestCallback) => setTimeout(cb, 1);

/**
 * Monitor bundle size and log warnings
 */
export function monitorBundleSize() {
  if (typeof window !== 'undefined' && 'performance' in window) {
    window.addEventListener('load', () => {
      const resources = performance.getEntriesByType('resource');
      const jsResources = resources.filter((r: any) => r.name.endsWith('.js'));
      
      let totalSize = 0;
      jsResources.forEach((resource: any) => {
        totalSize += resource.transferSize || resource.encodedBodySize || 0;
      });
      
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      
      if (totalSize > 1024 * 1024) { // > 1MB
        console.warn(`[Performance] Total JS bundle size: ${totalSizeMB}MB - Consider code splitting`);
      } else {
        console.log(`[Performance] Total JS bundle size: ${totalSizeMB}MB ✓`);
      }
    });
  }
}

/**
 * Import React lazily for the lazyWithRetry function
 */
import * as React from 'react';
