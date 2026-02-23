/**
 * FFmpeg Loader Utility
 * 
 * Provides isolated FFmpeg loading with explicit WASM enablement.
 * This module centralizes FFmpeg initialization to prevent scattered WASM errors.
 * 
 * Usage:
 *   import { loadFFmpegSafe, isFFmpegReady, getFFmpegStatus } from './ffmpegLoader';
 *   
 *   // Before using FFmpeg features:
 *   const loaded = await loadFFmpegSafe();
 *   if (loaded) {
 *     // FFmpeg is ready to use
 *   } else {
 *     // Use server-side fallback
 *   }
 */

// Track FFmpeg loading state
let ffmpegLoadingState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
let ffmpegLoadError: Error | null = null;
let loadPromise: Promise<boolean> | null = null;

/**
 * Enable WebAssembly for FFmpeg operations
 * This calls the global WASM enablement function defined in App.tsx
 */
function enableWasm(): void {
    try {
        if (typeof window !== 'undefined' && (window as any).__enableWebAssembly) {
            (window as any).__enableWebAssembly();
        }
    } catch (error) {
        console.warn('[FFmpegLoader] Could not enable WASM:', error);
    }
}

/**
 * Disable WebAssembly after FFmpeg operations complete
 * This helps prevent unexpected WASM errors in other parts of the app
 */
function disableWasm(): void {
    try {
        if (typeof window !== 'undefined' && (window as any).__disableWebAssembly) {
            (window as any).__disableWebAssembly();
        }
    } catch (error) {
        // Silent fail - not critical
    }
}

/**
 * Safely load FFmpeg with WASM enablement
 * Returns true if FFmpeg is ready, false if it failed to load
 * 
 * This function is idempotent - calling it multiple times is safe
 */
export async function loadFFmpegSafe(): Promise<boolean> {
    // Return cached result if already loaded or failed
    if (ffmpegLoadingState === 'ready') {
        return true;
    }

    if (ffmpegLoadingState === 'failed') {
        return false;
    }

    // If already loading, wait for the existing promise
    if (ffmpegLoadingState === 'loading' && loadPromise) {
        return loadPromise;
    }

    // Start loading
    ffmpegLoadingState = 'loading';

    loadPromise = (async () => {
        try {
            // Enable WASM before loading FFmpeg
            enableWasm();

            // Dynamically import the FFmpeg module
            const ffmpegModule = await import('./ffmpeg');

            // If the module has a loadFFmpeg function, call it
            if (typeof ffmpegModule.loadFFmpeg === 'function') {
                await ffmpegModule.loadFFmpeg();
            }

            ffmpegLoadingState = 'ready';
            console.log('[FFmpegLoader] FFmpeg loaded successfully');
            return true;
        } catch (error) {
            ffmpegLoadingState = 'failed';
            ffmpegLoadError = error instanceof Error ? error : new Error(String(error));
            console.warn('[FFmpegLoader] FFmpeg failed to load, will use server fallback:', error);

            // Disable WASM since we failed
            disableWasm();
            return false;
        }
    })();

    return loadPromise;
}

/**
 * Check if FFmpeg is ready to use
 */
export function isFFmpegReady(): boolean {
    return ffmpegLoadingState === 'ready';
}

/**
 * Get current FFmpeg loading status
 */
export function getFFmpegStatus(): {
    state: 'idle' | 'loading' | 'ready' | 'failed';
    error: Error | null;
} {
    return {
        state: ffmpegLoadingState,
        error: ffmpegLoadError,
    };
}

/**
 * Reset FFmpeg loader state (useful for testing or retry scenarios)
 */
export function resetFFmpegLoader(): void {
    if (ffmpegLoadingState !== 'loading') {
        ffmpegLoadingState = 'idle';
        ffmpegLoadError = null;
        loadPromise = null;
        disableWasm();
    }
}

/**
 * Execute a function that requires FFmpeg
 * Automatically loads FFmpeg if needed and handles fallback
 * 
 * @param operation - The operation to execute if FFmpeg is available
 * @param fallback - The fallback operation if FFmpeg isn't available
 */
export async function withFFmpeg<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>
): Promise<T> {
    const ready = await loadFFmpegSafe();

    if (ready) {
        try {
            return await operation();
        } catch (error) {
            console.warn('[FFmpegLoader] FFmpeg operation failed, using fallback:', error);
            return await fallback();
        }
    }

    return await fallback();
}
