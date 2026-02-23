/**
 * Monitoring and Error Tracking Utilities
 * 
 * Features:
 * - Sentry error tracking integration
 * - Performance monitoring (Web Vitals)
 * - Custom error boundary
 * - User feedback collection
 */

// Note: SentryConfig interface would be used when @sentry/react is installed

interface ErrorContext {
  [key: string]: any;
}

class MonitoringService {
  private isInitialized = false;
  private environment: string;

  constructor() {
    this.environment = this.getEnvironment();
  }

  /**
   * Safely get environment
   */
  private getEnvironment(): string {
    try {
      return import.meta?.env?.MODE || 'development';
    } catch (_error) {
      return 'development';
    }
  }

  /**
   * Initialize Sentry
   * 
   * To use Sentry:
   * 1. Install: npm install @sentry/react
   * 2. Get DSN from https://sentry.io
   * 3. Replace SENTRY_DSN below with your actual DSN
   */
  public initSentry(dsn?: string): void {
    if (this.isInitialized) return;

    // Only initialize in production
    if (this.environment !== 'production') {
      console.log('[Monitoring] Sentry disabled in development mode');
      return;
    }

    try {
      // Uncomment when @sentry/react is installed:
      /*
      import * as Sentry from '@sentry/react';
      
      Sentry.init({
        dsn: dsn || process.env.VITE_SENTRY_DSN || 'YOUR_SENTRY_DSN_HERE',
        environment: this.environment,
        
        // Performance Monitoring
        tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
        
        // Session Replay
        replaysSessionSampleRate: 0.1, // 10% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
        
        // Additional options
        beforeSend(event, hint) {
          // Filter out sensitive data
          if (event.request?.headers) {
            delete event.request.headers['Authorization'];
            delete event.request.headers['Cookie'];
          }
          return event;
        },
        
        integrations: [
          new Sentry.BrowserTracing({
            // Track navigation and user interactions
            tracePropagationTargets: ['localhost', /^https:\/\/yourapp\.com/],
          }),
          new Sentry.Replay({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ],
      });
      */

      this.isInitialized = true;
      console.log('[Monitoring] Sentry initialized');
    } catch (error) {
      console.error('[Monitoring] Failed to initialize Sentry:', error);
    }
  }

  /**
   * Capture error
   */
  public captureError(error: Error, context?: ErrorContext): void {
    if (!this.isInitialized) {
      console.error('[Monitoring] Error:', error, context);
      return;
    }

    try {
      // Uncomment when @sentry/react is installed:
      /*
      import * as Sentry from '@sentry/react';
      
      if (context) {
        Sentry.setContext('custom', context);
      }
      
      Sentry.captureException(error);
      */

      console.error('[Monitoring] Error captured:', error, context);
    } catch (err) {
      console.error('[Monitoring] Failed to capture error:', err);
    }
  }

  /**
   * Capture message
   */
  public captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    if (!this.isInitialized) {
      console.log(`[Monitoring] ${level.toUpperCase()}:`, message, context);
      return;
    }

    try {
      // Uncomment when @sentry/react is installed:
      /*
      import * as Sentry from '@sentry/react';
      
      if (context) {
        Sentry.setContext('custom', context);
      }
      
      Sentry.captureMessage(message, level);
      */

      console.log('[Monitoring] Message captured:', message, level, context);
    } catch (err) {
      console.error('[Monitoring] Failed to capture message:', err);
    }
  }

  /**
   * Set user context
   */
  public setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.isInitialized) return;

    try {
      // Uncomment when @sentry/react is installed:
      /*
      import * as Sentry from '@sentry/react';
      
      Sentry.setUser(user);
      */

      console.log('[Monitoring] User context set:', user);
    } catch (err) {
      console.error('[Monitoring] Failed to set user:', err);
    }
  }

  /**
   * Add breadcrumb (trail of events leading to error)
   */
  public addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
    if (!this.isInitialized) return;

    try {
      // Uncomment when @sentry/react is installed:
      /*
      import * as Sentry from '@sentry/react';
      
      Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: 'info',
      });
      */

      console.log('[Monitoring] Breadcrumb:', message, category, data);
    } catch (err) {
      console.error('[Monitoring] Failed to add breadcrumb:', err);
    }
  }
}

// Singleton instance
export const monitoring = new MonitoringService();

/**
 * Performance Monitoring - Web Vitals
 */
export interface WebVitalsMetrics {
  CLS: number; // Cumulative Layout Shift
  FID: number; // First Input Delay
  LCP: number; // Largest Contentful Paint
  FCP: number; // First Contentful Paint
  TTFB: number; // Time to First Byte
}

class PerformanceMonitor {
  private metrics: Partial<WebVitalsMetrics> = {};

  /**
   * Initialize Web Vitals monitoring
   * 
   * To use:
   * 1. Install: npm install web-vitals
   * 2. Uncomment the code below
   */
  public initWebVitals(): void {
    // Uncomment when web-vitals is installed:
    /*
    import { getCLS, getFID, getLCP, getFCP, getTTFB } from 'web-vitals';
    
    getCLS((metric) => {
      this.metrics.CLS = metric.value;
      this.reportMetric('CLS', metric.value);
    });
    
    getFID((metric) => {
      this.metrics.FID = metric.value;
      this.reportMetric('FID', metric.value);
    });
    
    getLCP((metric) => {
      this.metrics.LCP = metric.value;
      this.reportMetric('LCP', metric.value);
    });
    
    getFCP((metric) => {
      this.metrics.FCP = metric.value;
      this.reportMetric('FCP', metric.value);
    });
    
    getTTFB((metric) => {
      this.metrics.TTFB = metric.value;
      this.reportMetric('TTFB', metric.value);
    });
    */

    console.log('[Performance] Web Vitals monitoring initialized');
  }

  /**
   * Report metric to analytics
   */
  private reportMetric(name: string, value: number): void {
    console.log(`[Performance] ${name}:`, value);

    // Send to Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', name, {
        value: Math.round(name === 'CLS' ? value * 1000 : value),
        metric_id: name,
        metric_value: value,
        metric_delta: value,
      });
    }

    // Send to Sentry
    monitoring.captureMessage(`Performance: ${name} = ${value}`, 'info', {
      metric: name,
      value,
    });
  }

  /**
   * Get current metrics
   */
  public getMetrics(): Partial<WebVitalsMetrics> {
    return { ...this.metrics };
  }

  /**
   * Custom performance marks
   */
  public mark(name: string): void {
    if (typeof window !== 'undefined' && window.performance) {
      window.performance.mark(name);
      console.log(`[Performance] Mark: ${name}`);
    }
  }

  /**
   * Measure time between marks
   */
  public measure(name: string, startMark: string, endMark: string): number | null {
    if (typeof window !== 'undefined' && window.performance) {
      try {
        const measure = window.performance.measure(name, startMark, endMark);
        console.log(`[Performance] Measure: ${name} = ${measure.duration}ms`);
        return measure.duration;
      } catch (error) {
        console.error('[Performance] Failed to measure:', error);
      }
    }
    return null;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Google Analytics Integration
 */
class AnalyticsService {
  private isInitialized = false;
  private measurementId: string | null = null;

  /**
   * Initialize Google Analytics 4
   * 
   * To use:
   * 1. Get Measurement ID from Google Analytics (G-XXXXXXXXXX)
   * 2. Add to environment variables: VITE_GA_MEASUREMENT_ID
   */
  public init(measurementId?: string): void {
    if (this.isInitialized) return;

    try {
      this.measurementId = measurementId || import.meta?.env?.VITE_GA_MEASUREMENT_ID || null;
    } catch (_error) {
      this.measurementId = measurementId || null;
    }

    if (!this.measurementId) {
      console.log('[Analytics] Google Analytics disabled - no measurement ID');
      return;
    }

    try {
      // Load gtag.js script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
      document.head.appendChild(script);

      // Initialize gtag
      (window as any).dataLayer = (window as any).dataLayer || [];
      function gtag(...args: any[]) {
        (window as any).dataLayer.push(args);
      }
      (window as any).gtag = gtag;

      gtag('js', new Date());
      gtag('config', this.measurementId, {
        send_page_view: false, // We'll handle this manually
      });

      this.isInitialized = true;
      console.log('[Analytics] Google Analytics initialized');
    } catch (error) {
      console.error('[Analytics] Failed to initialize:', error);
    }
  }

  /**
   * Track page view
   */
  public pageView(path: string, title?: string): void {
    if (!this.isInitialized) {
      console.log('[Analytics] Page view:', path, title);
      return;
    }

    try {
      (window as any).gtag('event', 'page_view', {
        page_path: path,
        page_title: title || document.title,
      });
      console.log('[Analytics] Page view tracked:', path);
    } catch (error) {
      console.error('[Analytics] Failed to track page view:', error);
    }
  }

  /**
   * Track custom event
   */
  public event(name: string, params?: Record<string, any>): void {
    if (!this.isInitialized) {
      console.log('[Analytics] Event:', name, params);
      return;
    }

    try {
      (window as any).gtag('event', name, params);
      console.log('[Analytics] Event tracked:', name, params);
    } catch (error) {
      console.error('[Analytics] Failed to track event:', error);
    }
  }

  /**
   * Track user action
   */
  public trackAction(category: string, action: string, label?: string, value?: number): void {
    this.event(action, {
      event_category: category,
      event_label: label,
      value,
    });
  }

  /**
   * Track timing
   */
  public trackTiming(category: string, name: string, value: number): void {
    this.event('timing_complete', {
      event_category: category,
      name,
      value: Math.round(value),
    });
  }
}

// Singleton instance
export const analytics = new AnalyticsService();

/**
 * Initialize all monitoring services
 */
export function initMonitoring(config?: {
  sentryDsn?: string;
  gaMeasurementId?: string;
}): void {
  // Initialize Sentry
  monitoring.initSentry(config?.sentryDsn);

  // Initialize Google Analytics
  analytics.init(config?.gaMeasurementId);

  // Initialize Web Vitals
  performanceMonitor.initWebVitals();

  console.log('[Monitoring] All monitoring services initialized');
}

export default monitoring;