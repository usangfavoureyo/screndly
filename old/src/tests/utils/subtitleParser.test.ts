/**
 * Tests for Subtitle Parser
 */

import { describe, it, expect } from 'vitest';
import {
  parseSRT,
  srtTimeToSeconds,
  secondsToSrtTime,
  secondsToFFmpegTime,
  searchSubtitles,
  getSubtitlesInRange,
  validateSRT,
  formatDuration,
  generateExtractSubtitlesCommand
} from '../../utils/subtitleParser';

describe('Subtitle Parser', () => {
  const sampleSRT = `1
00:00:10,500 --> 00:00:13,000
This is the first subtitle.

2
00:00:15,000 --> 00:00:18,500
This is the second subtitle.
It has multiple lines.

3
00:01:20,000 --> 00:01:23,500
This is the third subtitle.`;

  describe('Time Conversion', () => {
    it('should convert SRT time to seconds', () => {
      expect(srtTimeToSeconds('00:00:10,500')).toBe(10.5);
      expect(srtTimeToSeconds('00:01:20,000')).toBe(80);
      expect(srtTimeToSeconds('01:30:45,250')).toBe(5445.25);
    });

    it('should convert seconds to SRT time', () => {
      expect(secondsToSrtTime(10.5)).toBe('00:00:10,500');
      expect(secondsToSrtTime(80)).toBe('00:01:20,000');
      expect(secondsToSrtTime(5445.25)).toBe('01:30:45,250');
    });

    it('should convert seconds to FFmpeg time', () => {
      expect(secondsToFFmpegTime(10.5)).toBe('00:00:10.500');
      expect(secondsToFFmpegTime(80)).toBe('00:01:20.000');
      expect(secondsToFFmpegTime(5445.25)).toBe('01:30:45.250');
    });
  });

  describe('SRT Parsing', () => {
    it('should parse valid SRT content', () => {
      const entries = parseSRT(sampleSRT);
      
      expect(entries).toHaveLength(3);
      
      expect(entries[0]).toMatchObject({
        index: 1,
        startTime: '00:00:10,500',
        endTime: '00:00:13,000',
        text: 'This is the first subtitle.',
        startSeconds: 10.5,
        endSeconds: 13,
        duration: 2.5
      });

      expect(entries[1]).toMatchObject({
        index: 2,
        startTime: '00:00:15,000',
        endTime: '00:00:18,500',
        text: 'This is the second subtitle.\nIt has multiple lines.',
      });
    });

    it('should handle empty input', () => {
      const entries = parseSRT('');
      expect(entries).toHaveLength(0);
    });

    it('should skip invalid blocks', () => {
      const invalidSRT = `1
00:00:10,500 --> 00:00:13,000
Valid subtitle

Not a number
00:00:15,000 --> 00:00:18,500
Invalid subtitle

3
Invalid timestamp
Another invalid subtitle`;

      const entries = parseSRT(invalidSRT);
      expect(entries).toHaveLength(1); // Only the first valid one
    });
  });

  describe('Search Functions', () => {
    const entries = parseSRT(sampleSRT);

    it('should search subtitles by keyword', () => {
      const results = searchSubtitles(entries, 'second');
      expect(results).toHaveLength(1);
      expect(results[0].text).toContain('second');
    });

    it('should be case-insensitive', () => {
      const results = searchSubtitles(entries, 'SECOND');
      expect(results).toHaveLength(1);
    });

    it('should return empty array when no match', () => {
      const results = searchSubtitles(entries, 'nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should get subtitles in time range', () => {
      const results = getSubtitlesInRange(entries, 10, 20);
      expect(results).toHaveLength(2); // First and second subtitles
    });

    it('should return empty array when no subtitles in range', () => {
      const results = getSubtitlesInRange(entries, 100, 200);
      expect(results).toHaveLength(0);
    });
  });

  describe('Validation', () => {
    it('should validate correct SRT format', () => {
      const result = validateSRT(sampleSRT);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty content', () => {
      const result = validateSRT('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Empty file');
    });

    it('should reject invalid format', () => {
      const result = validateSRT('Just some random text without timestamps');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid SRT format');
    });
  });

  describe('Utility Functions', () => {
    it('should format duration correctly', () => {
      expect(formatDuration(30)).toBe('30.0s');
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(125)).toBe('2m 5s');
    });

    it('should generate extract command', () => {
      const command = generateExtractSubtitlesCommand('video.mp4');
      expect(command).toBe('ffmpeg -i "video.mp4" -map 0:s:0 "subs.srt"');
      
      const customCommand = generateExtractSubtitlesCommand('video.mp4', 'output.srt');
      expect(customCommand).toBe('ffmpeg -i "video.mp4" -map 0:s:0 "output.srt"');
    });
  });
});
