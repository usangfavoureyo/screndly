import { ThemeProvider } from "./components/ThemeProvider";
import { TMDbPostsProvider } from "./contexts/TMDbPostsContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import { RSSFeedsProvider } from "./contexts/RSSFeedsContext";
import { VideoStudioTemplatesProvider } from "./contexts/VideoStudioTemplatesContext";
import { CommentAutomationProvider } from "./contexts/CommentAutomationContext";
import { BackNavigationProvider } from "./contexts/BackNavigationContext";
import { KeyboardProvider } from "./contexts/KeyboardContext";
import { UndoProvider } from "./components/UndoContext";
import { AppContent } from "./components/AppContent";
import AuthProvider from "./components/auth/AuthProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initMonitoring, performanceMonitor } from "./utils/monitoring";
import { initializeOptimization } from "./lib/optimization";

// Initialize monitoring services
if (typeof window !== 'undefined') {
  initMonitoring({
    // Add your Sentry DSN here: sentryDsn: 'YOUR_SENTRY_DSN',
    // Add your GA Measurement ID here: gaMeasurementId: 'G-XXXXXXXXXX',
  });

  // Track initial page load
  performanceMonitor.mark('app-start');

  // Initialize analytics-driven optimization layer
  // This starts background analytics ingestion and signal processing
  initializeOptimization();
  console.log('[App] Analytics optimization layer initialized');
}

/**
 * WebAssembly Control System
 * 
 * WHY THIS EXISTS:
 * FFmpeg.wasm attempts to load WebAssembly modules on import, which causes
 * console errors if the modules aren't available or if CSP blocks them.
 * This system blocks WASM loading by default and only enables it when
 * explicitly requested via window.__enableWebAssembly().
 * 
 * HOW TO USE:
 * - Import loadFFmpegSafe() from utils/ffmpegLoader.ts for safe FFmpeg loading
 * - The loader will call __enableWebAssembly() before loading FFmpeg
 * - After FFmpeg operations, __disableWebAssembly() re-enables blocking
 * 
 * DO NOT REMOVE: This prevents excessive console errors in development
 * and ensures WASM only loads when actually needed.
 */
if (typeof window !== 'undefined') {
  // Temporarily disabled console suppression for debugging
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;


  // Flag to control WebAssembly access
  let allowWebAssembly = false;
  (window as any).__enableWebAssembly = () => {
    allowWebAssembly = true;
  };
  (window as any).__disableWebAssembly = () => { allowWebAssembly = false; };

  // 1. Intercept fetch requests to block .wasm files
  const originalFetch = window.fetch;
  window.fetch = function (...args: any[]): Promise<Response> {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

    // Block .wasm files unless explicitly enabled
    if (url.includes('.wasm') || url.includes('ffmpeg') || url.includes('WebAssembly')) {
      if (!allowWebAssembly) {
        return Promise.reject(new Error('WebAssembly blocked - call window.__enableWebAssembly() first'));
      }
    }

    // Fix TS error by explicitly spreading args or checking length
    // @ts-ignore - Valid args for fetch
    return originalFetch.apply(this, args);
  };

  // 2. Override WebAssembly methods
  const originalWebAssembly = {
    compile: WebAssembly.compile,
    compileStreaming: WebAssembly.compileStreaming,
    instantiate: WebAssembly.instantiate,
    instantiateStreaming: WebAssembly.instantiateStreaming,
  };

  // For non-streaming methods
  const wrapWebAssemblyMethod = (method: any) => {
    return async (...args: any[]) => {
      if (!allowWebAssembly) {
        return Promise.reject(new Error('WebAssembly blocked'));
      }
      try {
        return await method.apply(WebAssembly, args);
      } catch (error) {
        return Promise.reject(error);
      }
    };
  };

  // For streaming methods - pass through directly when enabled
  const wrapStreamingMethod = (method: any) => {
    return (...args: any[]) => {
      if (!allowWebAssembly) {
        return Promise.reject(new Error('WebAssembly blocked'));
      }
      // Pass through directly to avoid interfering with streaming
      return method.apply(WebAssembly, args);
    };
  };

  WebAssembly.compile = wrapWebAssemblyMethod(originalWebAssembly.compile);
  WebAssembly.compileStreaming = wrapStreamingMethod(originalWebAssembly.compileStreaming);
  WebAssembly.instantiate = wrapWebAssemblyMethod(originalWebAssembly.instantiate);
  WebAssembly.instantiateStreaming = wrapStreamingMethod(originalWebAssembly.instantiateStreaming);

  // 3. Global error handlers
  const isWasmError = (msg: string) => {
    return msg.includes('WebAssembly') ||
      msg.includes('wasm') ||
      msg.includes('compilation aborted') ||
      msg.includes('Network error: error') ||
      (msg.includes('Network error') && msg.includes('compilation'));
  };

  window.addEventListener('error', (event) => {
    const errorMsg = event.message || event.error?.message || '';
    if (isWasmError(errorMsg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return false;
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const errorMsg = event.reason?.message || String(event.reason) || '';
    if (isWasmError(errorMsg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}



export default function App() {
  // DEACTIVATED: App loading screen - uncomment to reactivate
  // const [isLoading, setIsLoading] = useState(true);

  // useEffect(() => {
  //   // Simulate app initialization
  //   const timer = setTimeout(() => {
  //     setIsLoading(false);
  //   }, 2500);

  //   return () => {
  //     clearTimeout(timer);
  //   };
  // }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        {/* DEACTIVATED: Uncomment this block to reactivate app loading screen */}
        {/* {isLoading ? (
          <LoadingScreen />
        ) : ( */}
        <SettingsProvider>
          <NotificationsProvider>
            <RSSFeedsProvider>
              <VideoStudioTemplatesProvider>
                <TMDbPostsProvider>
                  <UndoProvider>
                    <CommentAutomationProvider>
                      <BackNavigationProvider>
                        <KeyboardProvider>
                          <ErrorBoundary>
                            <AppContent />
                          </ErrorBoundary>
                        </KeyboardProvider>
                      </BackNavigationProvider>
                    </CommentAutomationProvider>
                  </UndoProvider>
                </TMDbPostsProvider>
              </VideoStudioTemplatesProvider>
            </RSSFeedsProvider>
          </NotificationsProvider>
        </SettingsProvider>
        {/* )} */}
      </AuthProvider>
    </ThemeProvider>
  );
}
