// ============================================================================
// JOBS STORE TESTS
// ============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useJobsStore } from '../../store/useJobsStore';

describe('useJobsStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useJobsStore.setState({
      jobs: [],
      selectedJobId: null,
      isPolling: false,
      lastPollTime: null,
      systemLogs: [],
    });
    vi.clearAllTimers();
  });

  afterEach(() => {
    const { stopPolling } = useJobsStore.getState();
    stopPolling();
    vi.clearAllTimers();
  });

  describe('Job Management', () => {
    it('should add a new job', () => {
      const { addJob, jobs } = useJobsStore.getState();

      const jobId = addJob({
        fileName: 'trailer.mp4',
        fileSize: 1024000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: {
          thumbnailAvailable: false,
        },
      });

      const state = useJobsStore.getState();
      expect(state.jobs).toHaveLength(1);
      expect(state.jobs[0].id).toBe(jobId);
      expect(state.jobs[0].fileName).toBe('trailer.mp4');
      expect(state.jobs[0]).toHaveProperty('createdAt');
      expect(state.jobs[0]).toHaveProperty('updatedAt');
    });

    it('should update a job', () => {
      const { addJob, updateJob } = useJobsStore.getState();

      const jobId = addJob({
        fileName: 'test.mp4',
        fileSize: 1000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: { thumbnailAvailable: false },
      });

      updateJob(jobId, {
        status: 'processing',
        progress: 50,
        stage: 'encoding',
      });

      const state = useJobsStore.getState();
      expect(state.jobs[0].status).toBe('processing');
      expect(state.jobs[0].progress).toBe(50);
      expect(state.jobs[0].stage).toBe('encoding');
    });

    it('should delete a job', () => {
      const { addJob, deleteJob } = useJobsStore.getState();

      const jobId = addJob({
        fileName: 'test.mp4',
        fileSize: 1000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: { thumbnailAvailable: false },
      });

      deleteJob(jobId);

      const state = useJobsStore.getState();
      expect(state.jobs).toHaveLength(0);
    });

    it('should duplicate a job', () => {
      const { addJob, duplicateJob } = useJobsStore.getState();

      const originalId = addJob({
        fileName: 'original.mp4',
        fileSize: 1000,
        status: 'completed',
        stage: 'published',
        progress: 100,
        metadata: { 
          title: 'Test Video',
          thumbnailAvailable: true 
        },
      });

      const duplicatedId = duplicateJob(originalId);

      const state = useJobsStore.getState();
      expect(state.jobs).toHaveLength(2);
      expect(state.jobs[0].fileName).toBe('original.mp4 (copy)');
      expect(state.jobs[0].status).toBe('pending');
      expect(state.jobs[0].progress).toBe(0);
      expect(duplicatedId).toBeTruthy();
    });

    it('should retry a failed job', () => {
      const { addJob, updateJob, retryJob } = useJobsStore.getState();

      const jobId = addJob({
        fileName: 'test.mp4',
        fileSize: 1000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: { thumbnailAvailable: false },
      });

      // Simulate failure
      updateJob(jobId, {
        status: 'failed',
        error: {
          message: 'Upload failed',
        },
      });

      // Retry the job
      retryJob(jobId);

      const state = useJobsStore.getState();
      expect(state.jobs[0].status).toBe('pending');
      expect(state.jobs[0].stage).toBe('queued');
      expect(state.jobs[0].progress).toBe(0);
      expect(state.jobs[0].error).toBeUndefined();
    });
  });

  describe('Job Queries', () => {
    beforeEach(() => {
      const { addJob } = useJobsStore.getState();
      
      addJob({
        fileName: 'pending.mp4',
        fileSize: 1000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: { thumbnailAvailable: false },
      });

      addJob({
        fileName: 'processing.mp4',
        fileSize: 2000,
        status: 'processing',
        stage: 'encoding',
        progress: 50,
        metadata: { thumbnailAvailable: false },
      });

      addJob({
        fileName: 'completed.mp4',
        fileSize: 3000,
        status: 'completed',
        stage: 'published',
        progress: 100,
        metadata: { thumbnailAvailable: true },
      });

      addJob({
        fileName: 'failed.mp4',
        fileSize: 4000,
        status: 'failed',
        stage: 'uploading',
        progress: 75,
        metadata: { thumbnailAvailable: false },
        error: { message: 'Upload failed' },
      });
    });

    it('should get job by ID', () => {
      const { jobs, getJob } = useJobsStore.getState();
      const job = getJob(jobs[0].id);
      
      expect(job).toBeDefined();
      expect(job?.fileName).toBe('pending.mp4');
    });

    it('should get jobs by status', () => {
      const { getJobsByStatus } = useJobsStore.getState();
      
      const completedJobs = getJobsByStatus('completed');
      expect(completedJobs).toHaveLength(1);
      expect(completedJobs[0].fileName).toBe('completed.mp4');
    });

    it('should get active jobs', () => {
      const { getActiveJobs } = useJobsStore.getState();
      
      const activeJobs = getActiveJobs();
      expect(activeJobs).toHaveLength(2); // pending + processing
      expect(activeJobs.some(j => j.fileName === 'pending.mp4')).toBe(true);
      expect(activeJobs.some(j => j.fileName === 'processing.mp4')).toBe(true);
    });

    it('should get failed jobs', () => {
      const { getFailedJobs } = useJobsStore.getState();
      
      const failedJobs = getFailedJobs();
      expect(failedJobs).toHaveLength(1);
      expect(failedJobs[0].fileName).toBe('failed.mp4');
    });
  });

  describe('Job Events', () => {
    it('should add event to job', () => {
      const { addJob, addJobEvent, getJob } = useJobsStore.getState();

      const jobId = addJob({
        fileName: 'test.mp4',
        fileSize: 1000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: { thumbnailAvailable: false },
      });

      addJobEvent(jobId, {
        severity: 'info',
        message: 'Processing started',
      });

      const job = getJob(jobId);
      expect(job?.events).toHaveLength(1);
      expect(job?.events[0].message).toBe('Processing started');
      expect(job?.events[0].severity).toBe('info');
    });
  });

  describe('System Logs', () => {
    it('should add system log', () => {
      const { addSystemLog } = useJobsStore.getState();

      addSystemLog({
        severity: 'info',
        message: 'System started',
      });

      const state = useJobsStore.getState();
      expect(state.systemLogs).toHaveLength(1);
      expect(state.systemLogs[0].message).toBe('System started');
    });

    it('should limit system logs to 500', () => {
      const { addSystemLog } = useJobsStore.getState();

      // Add 600 logs
      for (let i = 0; i < 600; i++) {
        addSystemLog({
          severity: 'info',
          message: `Log ${i}`,
        });
      }

      const state = useJobsStore.getState();
      expect(state.systemLogs).toHaveLength(500);
      expect(state.systemLogs[0].message).toBe('Log 599'); // Most recent
    });

    it('should clear system logs', () => {
      const { addSystemLog, clearSystemLogs } = useJobsStore.getState();

      addSystemLog({ severity: 'info', message: 'Test 1' });
      addSystemLog({ severity: 'info', message: 'Test 2' });

      clearSystemLogs();

      const state = useJobsStore.getState();
      expect(state.systemLogs).toHaveLength(0);
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(() => {
      const { addJob } = useJobsStore.getState();
      
      for (let i = 0; i < 5; i++) {
        addJob({
          fileName: `completed-${i}.mp4`,
          fileSize: 1000,
          status: 'completed',
          stage: 'published',
          progress: 100,
          metadata: { thumbnailAvailable: true },
        });
      }

      for (let i = 0; i < 3; i++) {
        addJob({
          fileName: `failed-${i}.mp4`,
          fileSize: 1000,
          status: 'failed',
          stage: 'uploading',
          progress: 50,
          metadata: { thumbnailAvailable: false },
        });
      }

      addJob({
        fileName: 'pending.mp4',
        fileSize: 1000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: { thumbnailAvailable: false },
      });
    });

    it('should clear completed jobs', () => {
      const { clearCompletedJobs, jobs } = useJobsStore.getState();

      clearCompletedJobs();

      const state = useJobsStore.getState();
      expect(state.jobs).toHaveLength(4); // 3 failed + 1 pending
      expect(state.jobs.every(j => j.status !== 'completed')).toBe(true);
    });

    it('should clear failed jobs', () => {
      const { clearFailedJobs } = useJobsStore.getState();

      clearFailedJobs();

      const state = useJobsStore.getState();
      expect(state.jobs).toHaveLength(6); // 5 completed + 1 pending
      expect(state.jobs.every(j => j.status !== 'failed')).toBe(true);
    });

    it('should clear all jobs', () => {
      const { clearAllJobs } = useJobsStore.getState();

      clearAllJobs();

      const state = useJobsStore.getState();
      expect(state.jobs).toHaveLength(0);
      expect(state.selectedJobId).toBeNull();
    });
  });

  describe('Polling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start polling', () => {
      const { startPolling } = useJobsStore.getState();

      startPolling();

      const state = useJobsStore.getState();
      expect(state.isPolling).toBe(true);
    });

    it('should stop polling', () => {
      const { startPolling, stopPolling } = useJobsStore.getState();

      startPolling();
      stopPolling();

      const state = useJobsStore.getState();
      expect(state.isPolling).toBe(false);
    });

    it('should update job progress during polling', () => {
      const { addJob, startPolling, getJob } = useJobsStore.getState();

      const jobId = addJob({
        fileName: 'test.mp4',
        fileSize: 1000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: { thumbnailAvailable: false },
      });

      startPolling();

      // Fast forward through polling intervals
      vi.advanceTimersByTime(3000);

      const job = getJob(jobId);
      expect(job?.progress).toBeGreaterThan(0);
    });
  });
});
