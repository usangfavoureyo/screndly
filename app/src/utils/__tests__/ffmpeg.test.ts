import { describe, expect, it } from 'vitest';
import { getClipDuration, validateTimestamp } from '../ffmpeg';

describe('FFmpeg Utilities', () => {
  describe('validateTimestamp', () => {
    it('should validate HH:MM:SS format', () => {
      expect(validateTimestamp('01:23:45')).toBe(true);
      expect(validateTimestamp('00:00:00')).toBe(true);
      expect(validateTimestamp('23:59:59')).toBe(true);
    });

    it('should validate MM:SS format', () => {
      expect(validateTimestamp('23:45')).toBe(true);
      expect(validateTimestamp('00:00')).toBe(true);
      expect(validateTimestamp('59:59')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(validateTimestamp('1:23:45')).toBe(false);
      expect(validateTimestamp('01:60:00')).toBe(false);
      expect(validateTimestamp('01:23:60')).toBe(false);
      expect(validateTimestamp('abc:de:fg')).toBe(false);
      expect(validateTimestamp('60:00')).toBe(false);
      expect(validateTimestamp('')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateTimestamp('00:00:01')).toBe(true);
      expect(validateTimestamp('99:59:59')).toBe(true);
      expect(validateTimestamp('0:0:0')).toBe(false);
      expect(validateTimestamp('01:23')).toBe(true);
    });
  });

  describe('getClipDuration', () => {
    it('should calculate duration in seconds (HH:MM:SS)', () => {
      expect(getClipDuration('00:00:00', '00:00:10')).toBe(10);
      expect(getClipDuration('00:00:00', '00:01:00')).toBe(60);
      expect(getClipDuration('00:00:00', '01:00:00')).toBe(3600);
      expect(getClipDuration('01:23:45', '01:25:30')).toBe(105);
    });

    it('should calculate duration in seconds (MM:SS)', () => {
      expect(getClipDuration('00:00', '00:30')).toBe(30);
      expect(getClipDuration('00:00', '05:00')).toBe(300);
      expect(getClipDuration('12:30', '15:45')).toBe(195);
    });

    it('should handle mixed formats', () => {
      expect(getClipDuration('00:00:00', '05:30')).toBe(330);
    });

    it('should return negative for invalid ranges', () => {
      expect(getClipDuration('00:10:00', '00:05:00')).toBe(-300);
      expect(getClipDuration('05:00', '02:00')).toBe(-180);
    });

    it('should handle same timestamps', () => {
      expect(getClipDuration('00:00:00', '00:00:00')).toBe(0);
      expect(getClipDuration('12:34', '12:34')).toBe(0);
    });

    it('should calculate real-world examples', () => {
      expect(getClipDuration('00:12:00', '00:14:15')).toBe(135);
      expect(getClipDuration('01:23:45', '01:24:15')).toBe(30);
      expect(getClipDuration('00:45:20', '00:50:20')).toBe(300);
    });
  });
});
