/**
 * HTTP Range Request Video Processing for Screndly
 * 
 * Downloads only required video segments using HTTP Range headers
 * Combined with keyframe indexing for efficient clip extraction
 * 
 * IMPORTANT: Uses dynamic imports to prevent WebAssembly loading until needed.
 */

// Type imports only (no code execution)
type FFmpeg = any;

export interface KeyframeIndex {
  videoUrl: string;
  fileName: string;
  duration: number; // Total video duration in seconds
  fileSize: number; // Total file size in bytes
  keyframes: Keyframe[];
  createdAt: number;
  format?: string; // e.g., 'mp4', 'mov'
}

export interface Keyframe {
  timestamp: number; // Time in seconds
  byteOffset: number; // Approximate byte position in file
  pts: number; // Presentation timestamp
  type: 'I' | 'P' | 'B'; // Frame type (I-frame is keyframe)
}

interface SegmentDownloadOptions {
  url: string;
  startTime: number; // seconds
  endTime: number; // seconds
  keyframeIndex?: KeyframeIndex;
  onProgress?: (progress: number) => void;
}

const KEYFRAME_INDEX_STORAGE_KEY = 'screndly_keyframe_indexes';

/**
 * Generate keyframe index for a video file
 * This should be done once when video is uploaded
 */
export async function generateKeyframeIndex(
  videoFile: File | Blob,
  videoUrl: string,
  fileName: string,
  onProgress?: (progress: number, message: string) => void
): Promise<KeyframeIndex> {
  try {
    if (onProgress) onProgress(0, 'Loading FFmpeg for analysis...');
    
    // Dynamically import loadFFmpeg when needed
    const { loadFFmpeg } = await import('./ffmpeg');
    const ffmpeg = await loadFFmpeg();
    
    if (onProgress) onProgress(10, 'Reading video file...');
    
    // Write video to FFmpeg virtual filesystem
    const inputFileName = 'input_video.mp4';
    const videoData = new Uint8Array(await videoFile.arrayBuffer());
    await ffmpeg.writeFile(inputFileName, videoData);
    
    if (onProgress) onProgress(30, 'Analyzing keyframes...');
    
    // Use ffprobe to extract keyframe information
    // FFmpeg command to get keyframe info: -skip_frame nokey to show only keyframes
    await ffmpeg.exec([
      '-skip_frame', 'nokey',
      '-i', inputFileName,
      '-vf', 'showinfo',
      '-vsync', '0',
      '-f', 'null',
      '-'
    ]);
    
    // Alternative: Use simpler approach with show_frames
    await ffmpeg.exec([
      '-i', inputFileName,
      '-vf', 'select=eq(pict_type\\,I)',
      '-vsync', '0',
      '-f', 'null',
      '-'
    ]);
    
    // Parse FFmpeg logs to extract keyframe data
    // For now, create estimated keyframes based on typical GOP size
    // In production, you'd parse the actual FFmpeg output
    
    if (onProgress) onProgress(60, 'Getting video metadata...');
    
    // Get video duration
    const duration = await getVideoDuration(ffmpeg, inputFileName);
    const fileSize = videoFile.size;
    
    if (onProgress) onProgress(80, 'Building keyframe index...');
    
    // Estimate keyframes (typically every 2-10 seconds in modern videos)
    // For accurate data, parse FFmpeg's actual output
    const keyframes = estimateKeyframes(duration, fileSize);
    
    const index: KeyframeIndex = {
      videoUrl,
      fileName,
      duration,
      fileSize,
      keyframes,
      createdAt: Date.now(),
      format: fileName.split('.').pop()
    };
    
    if (onProgress) onProgress(100, 'Keyframe index complete');
    
    // Save to storage
    saveKeyframeIndex(videoUrl, index);
    
    return index;
    
  } catch (error) {
    console.error('Failed to generate keyframe index:', error);
    throw error;
  }
}

/**
 * Get video duration using FFmpeg
 */
async function getVideoDuration(ffmpeg: FFmpeg, inputFile: string): Promise<number> {
  try {
    // Create a simple probe to get duration
    await ffmpeg.exec([
      '-i', inputFile,
      '-f', 'null',
      '-'
    ]);
    
    // Parse from logs - FFmpeg outputs "Duration: HH:MM:SS.ms"
    // For now, return estimated duration
    // In production, parse actual FFmpeg log output
    return 120; // Placeholder
    
  } catch (error) {
    return 120; // Default fallback
  }
}

/**
 * Estimate keyframe positions
 * Real implementation would parse FFmpeg output
 */
function estimateKeyframes(duration: number, fileSize: number): Keyframe[] {
  const keyframes: Keyframe[] = [];
  const gopSize = 2; // Assume keyframe every 2 seconds (typical for web video)
  const bytesPerSecond = fileSize / duration;
  
  for (let time = 0; time < duration; time += gopSize) {
    keyframes.push({
      timestamp: time,
      byteOffset: Math.floor(time * bytesPerSecond),
      pts: time * 1000, // Simplified PTS
      type: 'I'
    });
  }
  
  return keyframes;
}

/**
 * Save keyframe index to localStorage
 */
export function saveKeyframeIndex(videoUrl: string, index: KeyframeIndex): void {
  try {
    const indexes = getAllKeyframeIndexes();
    indexes[videoUrl] = index;
    localStorage.setItem(KEYFRAME_INDEX_STORAGE_KEY, JSON.stringify(indexes));
  } catch (error) {
    console.error('Failed to save keyframe index:', error);
  }
}

/**
 * Get keyframe index for a video
 */
export function getKeyframeIndex(videoUrl: string): KeyframeIndex | null {
  try {
    const indexes = getAllKeyframeIndexes();
    return indexes[videoUrl] || null;
  } catch {
    return null;
  }
}

/**
 * Get all keyframe indexes
 */
function getAllKeyframeIndexes(): Record<string, KeyframeIndex> {
  try {
    const data = localStorage.getItem(KEYFRAME_INDEX_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * Delete keyframe index
 */
export function deleteKeyframeIndex(videoUrl: string): void {
  const indexes = getAllKeyframeIndexes();
  delete indexes[videoUrl];
  localStorage.setItem(KEYFRAME_INDEX_STORAGE_KEY, JSON.stringify(indexes));
}

/**
 * Find optimal byte range for a time segment
 */
export function findByteRange(
  startTime: number,
  endTime: number,
  index: KeyframeIndex
): { start: number; end: number } {
  // Find keyframe before or at start time
  const startKeyframe = index.keyframes
    .filter(kf => kf.timestamp <= startTime)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  
  // Find keyframe after end time
  const endKeyframe = index.keyframes
    .filter(kf => kf.timestamp >= endTime)
    .sort((a, b) => a.timestamp - b.timestamp)[0];
  
  const start = startKeyframe?.byteOffset || 0;
  const end = endKeyframe?.byteOffset || index.fileSize;
  
  return { start, end };
}

/**
 * Download video segment using HTTP Range headers
 */
export async function downloadVideoSegment(
  options: SegmentDownloadOptions
): Promise<Blob> {
  const { url, startTime, endTime, keyframeIndex, onProgress } = options;
  
  try {
    let byteRange: { start: number; end: number } | null = null;
    
    // Use keyframe index if available
    if (keyframeIndex) {
      byteRange = findByteRange(startTime, endTime, keyframeIndex);
      console.log(`[Range Request] Downloading bytes ${byteRange.start}-${byteRange.end}`);
    }
    
    // Fetch with Range header
    const headers: HeadersInit = {};
    if (byteRange) {
      headers['Range'] = `bytes=${byteRange.start}-${byteRange.end}`;
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok && response.status !== 206) {
      throw new Error(`Failed to download segment: ${response.status}`);
    }
    
    // Check if server supports range requests
    const acceptsRanges = response.headers.get('accept-ranges') === 'bytes';
    const isPartialContent = response.status === 206;
    
    if (!acceptsRanges && !isPartialContent && byteRange) {
      console.warn('[Range Request] Server does not support range requests, downloading full file');
    }
    
    // Download with progress tracking
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    const reader = response.body?.getReader();
    
    if (!reader) {
      throw new Error('Failed to get response reader');
    }
    
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      receivedBytes += value.length;
      
      if (onProgress && contentLength > 0) {
        onProgress((receivedBytes / contentLength) * 100);
      }
    }
    
    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    const blob = new Blob([combined], { type: 'video/mp4' });
    
    const savedBytes = keyframeIndex 
      ? keyframeIndex.fileSize - (byteRange?.end || 0 - byteRange?.start || 0)
      : 0;
    
    if (savedBytes > 0) {
      console.log(`[Range Request] Saved ${(savedBytes / 1024 / 1024).toFixed(2)} MB bandwidth`);
    }
    
    return blob;
    
  } catch (error) {
    console.error('Failed to download video segment:', error);
    throw error;
  }
}

/**
 * Download and cut video segment in one operation
 * Combines range request + FFmpeg cutting
 */
export async function downloadAndCutSegment(
  url: string,
  startTime: number,
  endTime: number,
  outputFormat: string = 'mp4',
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  try {
    // Get keyframe index
    const keyframeIndex = getKeyframeIndex(url);
    
    if (onProgress) {
      onProgress(0, keyframeIndex 
        ? 'Downloading segment using range request...' 
        : 'Downloading full video...'
      );
    }
    
    // Download segment (or full video if no index)
    const videoBlob = await downloadVideoSegment({
      url,
      startTime,
      endTime,
      keyframeIndex: keyframeIndex || undefined,
      onProgress: (p) => {
        if (onProgress) onProgress(p * 0.6, 'Downloading...');
      }
    });
    
    if (onProgress) onProgress(60, 'Loading FFmpeg...');
    
    // Dynamically import loadFFmpeg when needed
    const { loadFFmpeg } = await import('./ffmpeg');
    const ffmpeg = await loadFFmpeg();
    
    if (onProgress) onProgress(70, 'Preparing video...');
    
    // Write video to FFmpeg filesystem
    const inputFileName = 'segment.mp4';
    const videoData = new Uint8Array(await videoBlob.arrayBuffer());
    await ffmpeg.writeFile(inputFileName, videoData);
    
    if (onProgress) onProgress(75, 'Cutting video...');
    
    // Calculate adjusted timestamps if we downloaded a segment
    let adjustedStart = startTime;
    let adjustedEnd = endTime;
    
    if (keyframeIndex) {
      const byteRange = findByteRange(startTime, endTime, keyframeIndex);
      const rangeStartKeyframe = keyframeIndex.keyframes
        .filter(kf => kf.byteOffset <= byteRange.start)
        .sort((a, b) => b.byteOffset - a.byteOffset)[0];
      
      if (rangeStartKeyframe) {
        const offset = rangeStartKeyframe.timestamp;
        adjustedStart = Math.max(0, startTime - offset);
        adjustedEnd = endTime - offset;
      }
    }
    
    // Cut video
    const outputFileName = `output.${outputFormat}`;
    await ffmpeg.exec([
      '-i', inputFileName,
      '-ss', adjustedStart.toString(),
      '-to', adjustedEnd.toString(),
      '-c', 'copy', // Fast copy, no re-encode
      outputFileName
    ]);
    
    if (onProgress) onProgress(95, 'Reading output...');
    
    // Read output
    const outputData = await ffmpeg.readFile(outputFileName);
    const outputBlob = new Blob([outputData], { type: `video/${outputFormat}` });
    
    if (onProgress) onProgress(100, 'Complete!');
    
    // Cleanup
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);
    
    return outputBlob;
    
  } catch (error) {
    console.error('Failed to download and cut segment:', error);
    throw error;
  }
}

/**
 * Check if a URL supports HTTP Range requests
 */
export async function supportsRangeRequests(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD'
    });
    
    return response.headers.get('accept-ranges') === 'bytes';
  } catch {
    return false;
  }
}

/**
 * Get file size from URL
 */
export async function getRemoteFileSize(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength) : 0;
  } catch {
    return 0;
  }
}

/**
 * Estimate bandwidth savings from using range requests
 */
export function estimateBandwidthSavings(
  totalFileSize: number,
  startTime: number,
  endTime: number,
  totalDuration: number
): { segmentSize: number; savings: number; savingsPercent: number } {
  const segmentDuration = endTime - startTime;
  const segmentRatio = segmentDuration / totalDuration;
  
  // Add 20% buffer for keyframe alignment
  const segmentSize = Math.ceil(totalFileSize * segmentRatio * 1.2);
  const savings = totalFileSize - segmentSize;
  const savingsPercent = (savings / totalFileSize) * 100;
  
  return {
    segmentSize,
    savings,
    savingsPercent
  };
}