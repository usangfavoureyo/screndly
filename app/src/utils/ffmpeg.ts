/**
 * FFmpeg.wasm Integration for Browser-Based Video Processing
 * 
 * Performs mechanical video cuts with precision timestamps.
 * No scene detection. No AI analysis. Pure extraction.
 * 
 * Now supports HTTP Range Requests for bandwidth optimization.
 * 
 * IMPORTANT: Uses dynamic imports to prevent WebAssembly loading until needed.
 */

import { extractVideoMetadata } from './videoMetadata';

// Type imports only (these don't execute any code)
type FFmpeg = any;
type FFmpegModuleBundle = {
  FFmpeg: any;
  fetchFile: (input: File | Blob | string) => Promise<Uint8Array>;
  toBlobURL: (url: string, mimeType: string) => Promise<string>;
};

let ffmpegInstance: FFmpeg | null = null;
let isLoading = false;
let loadAbortController: AbortController | null = null;
let ffmpegModulesPromise: Promise<FFmpegModuleBundle> | null = null;

const FFMPEG_MODULE_IMPORT_TIMEOUT_MS = 15000;
const FFMPEG_LOAD_TIMEOUT_MS = 90000;
const FFMPEG_FETCH_TIMEOUT_MS = 25000;
const FFMPEG_EXEC_TIMEOUT_MS = 45000;
const FFMPEG_READ_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function getExtensionFromInput(input: string): string {
  try {
    const parsed = new URL(input, window.location.origin);
    const lastSegment = parsed.pathname.split('/').pop() || '';
    const extension = lastSegment.split('.').pop();
    return extension || 'mp4';
  } catch {
    const sanitized = input.split('?')[0] || input;
    const extension = sanitized.split('.').pop();
    return extension || 'mp4';
  }
}

/**
 * Dynamically import FFmpeg modules (only when needed)
 * Uses runtime script loading to completely bypass Vite
 */
async function importRemoteModule<T>(urls: string[], label: string): Promise<T> {
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      return await import(/* @vite-ignore */ url) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[FFmpeg] Failed to load ${label} from ${url}`, lastError);
    }
  }

  throw lastError ?? new Error(`Failed to load ${label}`);
}

async function importFFmpegModules(): Promise<FFmpegModuleBundle> {
  if ((window as any).FFmpegWASM && (window as any).FFmpegUtil) {
    return {
      FFmpeg: (window as any).FFmpegWASM.FFmpeg,
      fetchFile: (window as any).FFmpegUtil.fetchFile,
      toBlobURL: (window as any).FFmpegUtil.toBlobURL,
    };
  }

  if (!ffmpegModulesPromise) {
    ffmpegModulesPromise = withTimeout(
      (async () => {
        const ffmpegModule = await importRemoteModule<{ FFmpeg: any }>(
          [
            'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js',
            'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js',
          ],
          'FFmpeg',
        );
        const utilModule = await importRemoteModule<{ fetchFile: (input: File | Blob | string) => Promise<Uint8Array>; toBlobURL: (url: string, mimeType: string) => Promise<string> }>(
          [
            'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js',
            'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js',
          ],
          'FFmpeg util',
        );

        (window as any).FFmpegWASM = { FFmpeg: ffmpegModule.FFmpeg };
        (window as any).FFmpegUtil = {
          fetchFile: utilModule.fetchFile,
          toBlobURL: utilModule.toBlobURL,
        };

        return {
          FFmpeg: ffmpegModule.FFmpeg,
          fetchFile: utilModule.fetchFile,
          toBlobURL: utilModule.toBlobURL,
        };
      })(),
      FFMPEG_MODULE_IMPORT_TIMEOUT_MS,
      'FFmpeg modules took too long to load. Please try again.',
    ).catch((error) => {
      ffmpegModulesPromise = null;
      throw error;
    });
  }

  return ffmpegModulesPromise;
}

/**
 * Load FFmpeg.wasm (lazy initialization)
 */
export async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (ffmpegInstance) return ffmpegInstance;
  }

  isLoading = true;
  loadAbortController = new AbortController();

  try {
    // Enable WebAssembly before loading
    if (typeof window !== 'undefined' && (window as any).__enableWebAssembly) {
      (window as any).__enableWebAssembly();
    }

    // Dynamically import FFmpeg modules
    const { FFmpeg, toBlobURL } = await importFFmpegModules();
    
    const ffmpeg = new FFmpeg();

    // Listen to progress events
    ffmpeg.on('progress', ({ progress }: any) => {
      if (onProgress) {
        onProgress(Math.round(progress * 100));
      }
    });

    ffmpeg.on('log', ({ message }: any) => {
      console.log('[FFmpeg]', message);
    });

    // We use 0.12.6 which is known to be stable
    // We use jsdelivr because it properly sets Cross-Origin-Resource-Policy headers
    const CORE_VERSION = '0.12.6';
    
    // Try multiple CDNs in sequence for better reliability
    const CDN_URLS = [
      `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`,
      `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`,
    ];

    let lastError: Error | null = null;

    for (let i = 0; i < CDN_URLS.length; i++) {
      const BASE_URL = CDN_URLS[i];
      const classWorkerBaseUrl = BASE_URL
        .replace('@ffmpeg/core@0.12.6/dist/umd', '@ffmpeg/ffmpeg@0.12.10/dist/esm')
        .replace('/dist/umd', '/dist/esm');
      console.log(`[FFmpeg] Attempt ${i + 1}/${CDN_URLS.length}: Loading from ${BASE_URL}`);

      try {
        // Use toBlobURL helper which handles CORS and caching better
        const classWorkerURL = await toBlobURL(
          `${classWorkerBaseUrl}/worker.js`,
          'text/javascript',
        );
        const coreURL = await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');

        console.log('[FFmpeg] Blob URLs created successfully');

        // Check if aborted before loading
        if (loadAbortController?.signal.aborted) {
          throw new Error('Loading cancelled');
        }

        await ffmpeg.load({
          classWorkerURL,
          coreURL,
          wasmURL,
        });

        console.log('[FFmpeg] Loaded successfully from', BASE_URL);
        ffmpegInstance = ffmpeg;
        isLoading = false;
        loadAbortController = null;
        return ffmpeg;

      } catch (error) {
        console.error(`[FFmpeg] Failed from ${BASE_URL}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check for abort/cancel errors - don't retry
        if (error instanceof Error) {
          if (error.name === 'AbortError' || error.message.includes('aborted') || error.message.includes('cancelled')) {
            isLoading = false;
            loadAbortController = null;
            throw new Error('FFmpeg loading was cancelled. Please try again.');
          }
        }
        
        // Continue to next CDN
        console.log(`[FFmpeg] Trying next CDN...`);
      }
    }

    // If all CDN attempts failed, throw the last error
    isLoading = false;
    loadAbortController = null;
    
    if (lastError) {
      // Provide user-friendly error messages
      if (lastError.message.includes('NetworkError') || lastError.message.includes('Network error')) {
        throw new Error('Network error while downloading FFmpeg from all CDNs. Please check your internet connection and try again.');
      }
      if (lastError.message.includes('timeout')) {
        throw new Error('FFmpeg download timed out from all CDNs. Please check your connection and try again.');
      }
      throw new Error(`Failed to load FFmpeg from all CDNs: ${lastError.message}`);
    }
    
    throw new Error('Failed to load FFmpeg from all available CDNs');

  } catch (error) {
    isLoading = false;
    loadAbortController = null;
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load FFmpeg: ${msg}. Check console for details.`);
  }
}

/**
 * Cancel FFmpeg loading (cleanup)
 */
export function cancelFFmpegLoad(): void {
  if (loadAbortController) {
    loadAbortController.abort();
    loadAbortController = null;
  }
  isLoading = false;
}

/**
 * Convert timestamp string (HH:MM:SS or MM:SS) to seconds
 */
function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(p => parseInt(p, 10));
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else {
    return parseInt(timestamp, 10);
  }
}

/**
 * Convert seconds to FFmpeg timestamp format (HH:MM:SS)
 */
function secondsToTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface CutVideoOptions {
  input: File | string; // File object or URL
  startTime: string; // Format: "HH:MM:SS" or "MM:SS"
  endTime: string;   // Format: "HH:MM:SS" or "MM:SS"
  outputFormat?: string; // Default: 'mp4'
  onProgress?: (progress: number, message: string) => void;
}

interface CutVideoResult {
  success: boolean;
  outputBlob?: Blob;
  outputUrl?: string;
  error?: string;
  duration?: number;
}

interface CropVideoOptions {
  input: File | string;
  targetAspectRatio: '3:4';
  focusYPercent?: number;
  outputFormat?: string;
  onProgress?: (progress: number, message: string) => void;
}

/**
 * Cut video segment using FFmpeg.wasm
 * Uses -c copy for fast, lossless extraction
 */
export async function cutVideoSegment(options: CutVideoOptions): Promise<CutVideoResult> {
  const { input, startTime, endTime, outputFormat = 'mp4', onProgress } = options;

  try {
    // Dynamically import fetchFile when needed
    const { fetchFile } = await importFFmpegModules();
    
    // Step 1: Load FFmpeg
    if (onProgress) onProgress(5, 'Loading FFmpeg.wasm...');
    const ffmpeg = await loadFFmpeg();

    // Step 2: Load input file
    if (onProgress) onProgress(15, 'Loading video file...');
    
    let inputFileName = 'input.mp4';
    let inputData: Uint8Array;

    if (typeof input === 'string') {
      // URL (Backblaze or other)
      if (onProgress) onProgress(20, 'Fetching video from cloud...');
      inputData = await fetchFile(input);
      inputFileName = `input.${input.split('.').pop() || 'mp4'}`;
    } else {
      // File object
      if (onProgress) onProgress(20, 'Reading local file...');
      inputData = await fetchFile(input);
      inputFileName = `input.${input.name.split('.').pop() || 'mp4'}`;
    }

    await ffmpeg.writeFile(inputFileName, inputData);

    // Step 3: Calculate duration
    const startSeconds = timestampToSeconds(startTime);
    const endSeconds = timestampToSeconds(endTime);
    const duration = endSeconds - startSeconds;

    if (duration <= 0) {
      return {
        success: false,
        error: 'End time must be after start time'
      };
    }

    if (onProgress) onProgress(30, 'Preparing to cut video...');

    // Step 4: Execute FFmpeg cut command
    // Using -c copy for fast, lossless cutting
    const outputFileName = `output.${outputFormat}`;
    const startTimestamp = secondsToTimestamp(startSeconds);
    const endTimestamp = secondsToTimestamp(endSeconds);

    if (onProgress) onProgress(35, `Cutting from ${startTimestamp} to ${endTimestamp}...`);

    await ffmpeg.exec([
      '-i', inputFileName,
      '-ss', startTimestamp,
      '-to', endTimestamp,
      '-c', 'copy', // Copy codec (no re-encoding)
      outputFileName
    ]);

    if (onProgress) onProgress(90, 'Reading output file...');

    // Step 5: Read output
    const outputData = await ffmpeg.readFile(outputFileName);
    const outputBlob = new Blob([outputData], { type: `video/${outputFormat}` });
    const outputUrl = URL.createObjectURL(outputBlob);

    // Step 6: Cleanup
    if (onProgress) onProgress(95, 'Cleaning up...');
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    if (onProgress) onProgress(100, 'Complete!');

    return {
      success: true,
      outputBlob,
      outputUrl,
      duration
    };

  } catch (error) {
    console.error('FFmpeg cutting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during video cutting'
    };
  }
}

export async function cropVideoToAspectRatio(options: CropVideoOptions): Promise<CutVideoResult> {
  const { input, targetAspectRatio, focusYPercent = 50, outputFormat = 'mp4', onProgress } = options;

  try {
    const { fetchFile } = await importFFmpegModules();
    if (onProgress) onProgress(5, 'Loading FFmpeg.wasm...');
    const ffmpeg = await withTimeout(
      loadFFmpeg(),
      FFMPEG_LOAD_TIMEOUT_MS,
      'FFmpeg took too long to load. Please try again.',
    );

    if (onProgress) onProgress(15, 'Loading source video...');
    let inputFileName = 'input.mp4';
    let inputData: Uint8Array;

    if (typeof input === 'string') {
      if (/^https?:\/\//i.test(input.trim())) {
        const response = await withTimeout(
          fetch(input),
          FFMPEG_FETCH_TIMEOUT_MS,
          'Downloading the source video took too long. Please try again.',
        );
        if (!response.ok) {
          throw new Error(`Failed to download the source video (${response.status}).`);
        }

        const sourceBlob = await withTimeout(
          response.blob(),
          FFMPEG_FETCH_TIMEOUT_MS,
          'Reading the source video took too long. Please try again.',
        );
        inputData = await withTimeout(
          fetchFile(sourceBlob),
          FFMPEG_FETCH_TIMEOUT_MS,
          'Preparing the source video took too long. Please try again.',
        );
        inputFileName = `input.${getExtensionFromInput(input)}`;
      } else {
        inputData = await withTimeout(
          fetchFile(input),
          FFMPEG_FETCH_TIMEOUT_MS,
          'Preparing the source video took too long. Please try again.',
        );
        inputFileName = `input.${getExtensionFromInput(input)}`;
      }
    } else {
      inputData = await withTimeout(
        fetchFile(input),
        FFMPEG_FETCH_TIMEOUT_MS,
        'Preparing the source video took too long. Please try again.',
      );
      inputFileName = `input.${input.name.split('.').pop() || 'mp4'}`;
    }

    await ffmpeg.writeFile(inputFileName, inputData);

    if (onProgress) onProgress(30, 'Reading video dimensions...');
    const targetRatioValue = targetAspectRatio === '3:4' ? 3 / 4 : 3 / 4;
    const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);
    const sourceMetadata = await extractVideoMetadata(input);
    const cropWidth = even(sourceMetadata.width);
    const cropHeight = even(Math.min(sourceMetadata.height, Math.floor(cropWidth / targetRatioValue)));
    const maxYOffset = Math.max(sourceMetadata.height - cropHeight, 0);
    const cropY = even((maxYOffset * Math.max(0, Math.min(focusYPercent, 100))) / 100);

    const outputFileName = `crop-output.${outputFormat}`;
    const filter = `crop=${cropWidth}:${cropHeight}:0:${cropY},setsar=1`;

    if (onProgress) onProgress(45, 'Rendering 3:4 crop...');
    await withTimeout(
      ffmpeg.exec([
        '-i', inputFileName,
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '22',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        outputFileName,
      ]),
      FFMPEG_EXEC_TIMEOUT_MS,
      'Rendering the 3:4 crop took too long. Please try again.',
    );

    if (onProgress) onProgress(90, 'Reading cropped video...');
    const outputData = await withTimeout(
      ffmpeg.readFile(outputFileName),
      FFMPEG_READ_TIMEOUT_MS,
      'Reading the cropped video took too long. Please try again.',
    );
    const outputBlob = new Blob([outputData], { type: `video/${outputFormat}` });
    const outputUrl = URL.createObjectURL(outputBlob);

    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);
    if (onProgress) onProgress(100, 'Complete!');

    return {
      success: true,
      outputBlob,
      outputUrl,
      duration: sourceMetadata.duration,
    };
  } catch (error) {
    console.error('FFmpeg crop error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during video crop',
    };
  }
}

/**
 * Check if FFmpeg is loaded
 */
export function isFFmpegLoaded(): boolean {
  return ffmpegInstance !== null && ffmpegInstance.loaded;
}

/**
 * Validate timestamp format
 */
export function validateTimestamp(timestamp: string): boolean {
  // Accepts HH:MM:SS or MM:SS format
  const hhmmss = /^([0-9]{2}):([0-5][0-9]):([0-5][0-9])$/;
  const mmss = /^([0-5]?[0-9]):([0-5][0-9])$/;
  
  return hhmmss.test(timestamp) || mmss.test(timestamp);
}

/**
 * Get video duration estimate from timestamps
 */
export function getClipDuration(startTime: string, endTime: string): number {
  const startSeconds = timestampToSeconds(startTime);
  const endSeconds = timestampToSeconds(endTime);
  return endSeconds - startSeconds;
}

/**
 * Cut video segment with optimized range request (if available)
 * Falls back to standard cutting if range requests not supported
 */
export async function cutVideoSegmentOptimized(options: CutVideoOptions): Promise<CutVideoResult> {
  const { input, startTime, endTime, outputFormat = 'mp4', onProgress } = options;

  // Only use range requests for URLs
  if (typeof input === 'string') {
    // Dynamically import videoRangeRequest when needed
    const { getKeyframeIndex, downloadAndCutSegment } = await import('./videoRangeRequest');
    const keyframeIndex = getKeyframeIndex(input);
    
    if (keyframeIndex) {
      // Use optimized range request approach
      try {
        if (onProgress) onProgress(5, 'Using optimized range request...');
        
        const startSeconds = timestampToSeconds(startTime);
        const endSeconds = timestampToSeconds(endTime);
        
        const outputBlob = await downloadAndCutSegment(
          input,
          startSeconds,
          endSeconds,
          outputFormat,
          onProgress
        );
        
        const outputUrl = URL.createObjectURL(outputBlob);
        const duration = endSeconds - startSeconds;
        
        return {
          success: true,
          outputBlob,
          outputUrl,
          duration
        };
      } catch (error) {
        console.warn('Range request failed, falling back to standard download:', error);
        // Fall through to standard approach
      }
    }
  }
  
  // Fall back to standard approach
  return cutVideoSegment(options);
}
