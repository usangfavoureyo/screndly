// ============================================================================
// PERFORMANCE UTILITY TESTS
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { debounce, throttle, memoize } from '../../utils/performance';

describe('Performance Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('debounce', () => {
    it('should debounce function calls', () => {
      const callback = vi.fn();
      const debounced = debounce(callback, 100);

      debounced();
      debounced();
      debounced();

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to debounced function', () => {
      const callback = vi.fn();
      const debounced = debounce(callback, 100);

      debounced('arg1', 'arg2', 'arg3');

      vi.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('should use latest arguments', () => {
      const callback = vi.fn();
      const debounced = debounce(callback, 100);

      debounced('first');
      debounced('second');
      debounced('third');

      vi.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalledWith('third');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on each call', () => {
      const callback = vi.fn();
      const debounced = debounce(callback, 100);

      debounced();
      vi.advanceTimersByTime(50);
      
      debounced();
      vi.advanceTimersByTime(50);
      
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', () => {
      const callback = vi.fn();
      const throttled = throttle(callback, 100);

      throttled();
      throttled();
      throttled();

      expect(callback).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      throttled();

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to throttled function', () => {
      const callback = vi.fn();
      const throttled = throttle(callback, 100);

      throttled('test', 123);

      expect(callback).toHaveBeenCalledWith('test', 123);
    });

    it('should execute immediately on first call', () => {
      const callback = vi.fn();
      const throttled = throttle(callback, 100);

      throttled();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not execute during cooldown period', () => {
      const callback = vi.fn();
      const throttled = throttle(callback, 100);

      throttled(); // First call - executes
      expect(callback).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      throttled(); // During cooldown - doesn't execute
      expect(callback).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      throttled(); // After cooldown - executes
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('memoize', () => {
    it('should cache function results', () => {
      const expensiveFunction = vi.fn((n: number) => n * 2);
      const memoized = memoize(expensiveFunction);

      const result1 = memoized(5);
      const result2 = memoized(5);

      expect(result1).toBe(10);
      expect(result2).toBe(10);
      expect(expensiveFunction).toHaveBeenCalledTimes(1);
    });

    it('should cache different argument results separately', () => {
      const expensiveFunction = vi.fn((n: number) => n * 2);
      const memoized = memoize(expensiveFunction);

      memoized(5);
      memoized(10);
      memoized(5);
      memoized(10);

      expect(expensiveFunction).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple arguments', () => {
      const sum = vi.fn((a: number, b: number) => a + b);
      const memoized = memoize(sum);

      memoized(2, 3);
      memoized(2, 3);
      memoized(5, 7);
      memoized(2, 3);

      expect(sum).toHaveBeenCalledTimes(2);
    });

    it('should handle undefined and null arguments', () => {
      const fn = vi.fn((value: any) => String(value));
      const memoized = memoize(fn);

      memoized(undefined);
      memoized(undefined);
      memoized(null);
      memoized(null);

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
