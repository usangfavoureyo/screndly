/**
 * Performance Monitoring Hook
 * 
 * Tracks component render times, API call durations, and user interactions
 */

import { useEffect, useRef, useCallback } from 'react';
import { performanceMonitor, analytics } from '../utils/monitoring';

interface PerformanceMetrics {
  renderTime: number;
  mountTime: number;
  updateCount: number;
}

/**
 * Track component performance
 */
export function usePerformance(componentName: string) {
  const renderCount = useRef(0);
  const mountTime = useRef<number>(0);
  const lastRenderTime = useRef<number>(0);

  useEffect(() => {
    // Track mount
    mountTime.current = performance.now();
    performanceMonitor.mark(`${componentName}-mount`);

    return () => {
      // Track unmount and total time
      const totalTime = performance.now() - mountTime.current;
      performanceMonitor.mark(`${componentName}-unmount`);
      performanceMonitor.measure(
        `${componentName}-lifetime`,
        `${componentName}-mount`,
        `${componentName}-unmount`
      );

      analytics.trackTiming('Component Lifetime', componentName, totalTime);
    };
  }, [componentName]);

  useEffect(() => {
    // Track render
    renderCount.current++;
    const now = performance.now();
    
    if (lastRenderTime.current > 0) {
      const renderTime = now - lastRenderTime.current;
      
      // Warn if render takes too long (>16ms for 60fps)
      if (renderTime > 16) {
        console.warn(`[Performance] Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }

      analytics.trackTiming('Component Render', componentName, renderTime);
    }

    lastRenderTime.current = now;
  });

  const getMetrics = useCallback((): PerformanceMetrics => {
    return {
      renderTime: lastRenderTime.current > 0 ? performance.now() - lastRenderTime.current : 0,
      mountTime: performance.now() - mountTime.current,
      updateCount: renderCount.current,
    };
  }, []);

  return { getMetrics };
}

/**
 * Track API call performance
 */
export function useApiPerformance() {
  const trackApiCall = useCallback(async <T,>(
    name: string,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    performanceMonitor.mark(`api-${name}-start`);

    try {
      const result = await apiCall();
      
      const duration = performance.now() - startTime;
      performanceMonitor.mark(`api-${name}-end`);
      performanceMonitor.measure(`api-${name}`, `api-${name}-start`, `api-${name}-end`);

      analytics.trackTiming('API Call', name, duration);
      
      // Warn if API call is slow (>3s)
      if (duration > 3000) {
        console.warn(`[Performance] Slow API call ${name}: ${duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      analytics.event('api_error', {
        api_name: name,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, []);

  return { trackApiCall };
}

/**
 * Track user interaction performance
 */
export function useInteractionPerformance() {
  const trackInteraction = useCallback((
    interactionName: string,
    callback: () => void | Promise<void>
  ) => {
    return async () => {
      const startTime = performance.now();
      performanceMonitor.mark(`interaction-${interactionName}-start`);

      try {
        await callback();
        
        const duration = performance.now() - startTime;
        performanceMonitor.mark(`interaction-${interactionName}-end`);
        performanceMonitor.measure(
          `interaction-${interactionName}`,
          `interaction-${interactionName}-start`,
          `interaction-${interactionName}-end`
        );

        analytics.trackAction('User Interaction', interactionName, undefined, duration);
        
        // Warn if interaction response is slow (>100ms)
        if (duration > 100) {
          console.warn(`[Performance] Slow interaction ${interactionName}: ${duration.toFixed(2)}ms`);
        }
      } catch (error) {
        const duration = performance.now() - startTime;
        analytics.event('interaction_error', {
          interaction_name: interactionName,
          duration,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
  }, []);

  return { trackInteraction };
}

/**
 * Monitor page load performance
 */
export function usePageLoadPerformance(pageName: string) {
  useEffect(() => {
    const loadTime = performance.now();
    
    // Track page view
    analytics.pageView(window.location.pathname, pageName);

    // Get navigation timing
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
      const domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
      const firstPaintTime = timing.responseEnd - timing.fetchStart;

      analytics.trackTiming('Page Load', pageName, pageLoadTime);
      analytics.trackTiming('DOM Ready', pageName, domReadyTime);
      analytics.trackTiming('First Paint', pageName, firstPaintTime);

      console.log(`[Performance] ${pageName} loaded in ${pageLoadTime}ms`);
    }

    return () => {
      const timeOnPage = performance.now() - loadTime;
      analytics.trackTiming('Time on Page', pageName, timeOnPage);
    };
  }, [pageName]);
}

export default usePerformance;
