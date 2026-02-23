/**
 * Subtitle Parser for .srt files
 * Provides dialogue-anchored timecodes for scene cutting
 */

export interface SubtitleEntry {
  index: number;
  startTime: string; // HH:MM:SS,mmm format
  endTime: string;   // HH:MM:SS,mmm format
  startSeconds: number; // Converted to seconds for FFmpeg
  endSeconds: number;
  text: string;
  duration: number; // Duration in seconds
}

/**
 * Convert SRT timestamp (HH:MM:SS,mmm) to seconds
 */
export function srtTimeToSeconds(time: string): number {
  const [timePart, millisPart] = time.split(',');
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  const millis = Number(millisPart) || 0;
  
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

/**
 * Convert seconds to SRT timestamp format (HH:MM:SS,mmm)
 */
export function secondsToSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
}

/**
 * Convert seconds to FFmpeg timestamp format (HH:MM:SS.mmm)
 */
export function secondsToFFmpegTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

/**
 * Parse .srt subtitle file content
 */
export function parseSRT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  
  // Split by double newlines to separate subtitle blocks
  const blocks = content.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    
    if (lines.length < 3) continue; // Invalid block
    
    // Line 1: Index number
    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;
    
    // Line 2: Timestamp
    const timestampMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timestampMatch) continue;
    
    const startTime = timestampMatch[1];
    const endTime = timestampMatch[2];
    const startSeconds = srtTimeToSeconds(startTime);
    const endSeconds = srtTimeToSeconds(endTime);
    
    // Line 3+: Subtitle text (may span multiple lines)
    const text = lines.slice(2).join('\n').trim();
    
    entries.push({
      index,
      startTime,
      endTime,
      startSeconds,
      endSeconds,
      text,
      duration: endSeconds - startSeconds
    });
  }
  
  return entries;
}

/**
 * Search subtitles for specific keywords
 */
export function searchSubtitles(entries: SubtitleEntry[], query: string): SubtitleEntry[] {
  const lowerQuery = query.toLowerCase();
  return entries.filter(entry => 
    entry.text.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get subtitles within a time range
 */
export function getSubtitlesInRange(
  entries: SubtitleEntry[],
  startSeconds: number,
  endSeconds: number
): SubtitleEntry[] {
  return entries.filter(entry => 
    entry.startSeconds >= startSeconds && entry.endSeconds <= endSeconds
  );
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

/**
 * Generate FFmpeg command to extract subtitles from video
 */
export function generateExtractSubtitlesCommand(inputFile: string, outputFile: string = 'subs.srt'): string {
  return `ffmpeg -i "${inputFile}" -map 0:s:0 "${outputFile}"`;
}

/**
 * Validate SRT file content
 */
export function validateSRT(content: string): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Empty file' };
  }
  
  // Check for basic SRT structure
  const hasTimestamps = /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(content);
  
  if (!hasTimestamps) {
    return { valid: false, error: 'Invalid SRT format: No valid timestamps found' };
  }
  
  return { valid: true };
}
