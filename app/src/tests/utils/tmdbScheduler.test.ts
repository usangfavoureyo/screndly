// ============================================================================
// TMDB SCHEDULER TESTS
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TMDbScheduler } from '../../utils/tmdbScheduler';

describe('TMDbScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Scheduling', () => {
    it('should schedule a task', () => {
      const scheduler = new TMDbScheduler();
      const callback = vi.fn();
      const scheduleTime = new Date(Date.now() + 5000);

      const taskId = scheduler.schedule(scheduleTime, callback);

      expect(taskId).toBeTruthy();
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should schedule multiple tasks', () => {
      const scheduler = new TMDbScheduler();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      scheduler.schedule(new Date(Date.now() + 1000), callback1);
      scheduler.schedule(new Date(Date.now() + 2000), callback2);
      scheduler.schedule(new Date(Date.now() + 3000), callback3);

      vi.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should cancel a scheduled task', () => {
      const scheduler = new TMDbScheduler();
      const callback = vi.fn();
      
      const taskId = scheduler.schedule(new Date(Date.now() + 5000), callback);
      
      scheduler.cancel(taskId);

      vi.advanceTimersByTime(5000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should reschedule a task', () => {
      const scheduler = new TMDbScheduler();
      const callback = vi.fn();
      
      const taskId = scheduler.schedule(new Date(Date.now() + 5000), callback);
      
      scheduler.reschedule(taskId, new Date(Date.now() + 10000));

      vi.advanceTimersByTime(5000);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should get all scheduled tasks', () => {
      const scheduler = new TMDbScheduler();
      
      scheduler.schedule(new Date(Date.now() + 1000), () => {});
      scheduler.schedule(new Date(Date.now() + 2000), () => {});
      scheduler.schedule(new Date(Date.now() + 3000), () => {});

      const tasks = scheduler.getTasks();
      expect(tasks).toHaveLength(3);
    });

    it('should clear all tasks', () => {
      const scheduler = new TMDbScheduler();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      scheduler.schedule(new Date(Date.now() + 1000), callback1);
      scheduler.schedule(new Date(Date.now() + 2000), callback2);

      scheduler.clearAll();

      vi.advanceTimersByTime(5000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('Past Time Handling', () => {
    it('should execute immediately for past times', () => {
      const scheduler = new TMDbScheduler();
      const callback = vi.fn();
      
      const pastTime = new Date(Date.now() - 5000);
      scheduler.schedule(pastTime, callback);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Task Metadata', () => {
    it('should store task metadata', () => {
      const scheduler = new TMDbScheduler();
      const scheduleTime = new Date(Date.now() + 5000);
      
      const taskId = scheduler.schedule(scheduleTime, () => {}, {
        title: 'Test Task',
        type: 'tmdb_today',
      });

      const tasks = scheduler.getTasks();
      const task = tasks.find(t => t.id === taskId);

      expect(task?.metadata?.title).toBe('Test Task');
      expect(task?.metadata?.type).toBe('tmdb_today');
    });
  });
});
