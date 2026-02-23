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
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  componentName: string
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.localStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.localStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        // Assuming that the user is not on the latest version of the app
        window.localStorage.setItem('page-has-been-force-refreshed', 'true');
        console.log(`[Performance] Reloading ${componentName} due to chunk load error`);
        return window.location.reload();
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
