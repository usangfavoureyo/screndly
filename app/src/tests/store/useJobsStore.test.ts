// ============================================================================
// JOBS STORE TESTS
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useJobsStore, type UploadJob } from '../../store/useJobsStore';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../lib/api/client', () => ({
  apiClient: apiClientMock,
}));

function createServerJob(
  job: Omit<UploadJob, 'id' | 'createdAt' | 'updatedAt' | 'events'>,
  id: string
): UploadJob {
  const now = new Date('2026-03-12T00:00:00.000Z');
  return {
    ...job,
    id,
    createdAt: now,
    updatedAt: now,
    events: [],
  };
}

describe('useJobsStore', () => {
  let jobCounter = 0;

  beforeEach(() => {
    localStorage.clear();
    useJobsStore.setState(useJobsStore.getInitialState(), true);

    jobCounter = 0;
    apiClientMock.post.mockReset();
    apiClientMock.get.mockReset();
    apiClientMock.delete.mockReset();

    apiClientMock.post.mockImplementation(async (endpoint: string, payload?: Omit<UploadJob, 'id' | 'createdAt' | 'updatedAt' | 'events'>) => {
      if (endpoint === '/api/jobs' && payload) {
        jobCounter += 1;
        return {
          success: true,
          data: createServerJob(payload, `job-${jobCounter}`),
        };
      }

      if (endpoint.endsWith('/retry')) {
        return { success: true, data: { retried: true } };
      }

      return { success: true, data: {} };
    });

    apiClientMock.get.mockImplementation(async () => ({
      success: true,
      data: useJobsStore.getState().jobs.map((job) => ({ ...job })),
    }));

    apiClientMock.delete.mockResolvedValue({ success: true, data: null });

    vi.clearAllTimers();
  });

  afterEach(() => {
    useJobsStore.getState().stopPolling();
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('Job Management', () => {
    it('should add a new job', async () => {
      const { addJob } = useJobsStore.getState();

      const jobId = await addJob({
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

    it('should update a job', async () => {
      const { addJob, updateJob } = useJobsStore.getState();

      const jobId = await addJob({
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

    it('should delete a job', async () => {
      const { addJob, deleteJob } = useJobsStore.getState();

      const jobId = await addJob({
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

    it('should duplicate a job', async () => {
      const { addJob, duplicateJob } = useJobsStore.getState();

      const originalId = await addJob({
        fileName: 'original.mp4',
        fileSize: 1000,
        status: 'completed',
        stage: 'published',
        progress: 100,
        metadata: {
          title: 'Test Video',
          thumbnailAvailable: true,
        },
      });

      const duplicatedId = await duplicateJob(originalId);

      const state = useJobsStore.getState();
      expect(state.jobs).toHaveLength(2);
      expect(state.jobs[0].fileName).toBe('original.mp4 (copy)');
      expect(state.jobs[0].status).toBe('pending');
      expect(state.jobs[0].progress).toBe(0);
      expect(duplicatedId).toBeTruthy();
    });

    it('should retry a failed job', async () => {
      const { addJob, updateJob, retryJob } = useJobsStore.getState();

      const jobId = await addJob({
        fileName: 'test.mp4',
        fileSize: 1000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: { thumbnailAvailable: false },
      });

      updateJob(jobId, {
        status: 'failed',
        error: {
          message: 'Upload failed',
        },
      });

      retryJob(jobId);

      const state = useJobsStore.getState();
      expect(state.jobs[0].status).toBe('pending');
      expect(state.jobs[0].stage).toBe('queued');
      expect(state.jobs[0].progress).toBe(0);
      expect(state.jobs[0].error).toBeUndefined();
    });
  });

  describe('Job Queries', () => {
    beforeEach(async () => {
      const { addJob } = useJobsStore.getState();

      await addJob({
        fileName: 'pending.mp4',
        fileSize: 1000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: { thumbnailAvailable: false },
      });

      await addJob({
        fileName: 'processing.mp4',
        fileSize: 2000,
        status: 'processing',
        stage: 'encoding',
        progress: 50,
        metadata: { thumbnailAvailable: false },
      });

      await addJob({
        fileName: 'completed.mp4',
        fileSize: 3000,
        status: 'completed',
        stage: 'published',
        progress: 100,
        metadata: { thumbnailAvailable: true },
      });

      await addJob({
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
      const target = jobs.find((job) => job.fileName === 'pending.mp4');
      const job = getJob(target!.id);

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
      expect(activeJobs).toHaveLength(2);
      expect(activeJobs.some((job) => job.fileName === 'pending.mp4')).toBe(true);
      expect(activeJobs.some((job) => job.fileName === 'processing.mp4')).toBe(true);
    });

    it('should get failed jobs', () => {
      const { getFailedJobs } = useJobsStore.getState();

      const failedJobs = getFailedJobs();
      expect(failedJobs).toHaveLength(1);
      expect(failedJobs[0].fileName).toBe('failed.mp4');
    });
  });

  describe('Job Events', () => {
    it('should add event to job', async () => {
      const { addJob, addJobEvent, getJob } = useJobsStore.getState();

      const jobId = await addJob({
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

      for (let i = 0; i < 600; i += 1) {
        addSystemLog({
          severity: 'info',
          message: `Log ${i}`,
        });
      }

      const state = useJobsStore.getState();
      expect(state.systemLogs).toHaveLength(500);
      expect(state.systemLogs[0].message).toBe('Log 599');
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
    beforeEach(async () => {
      const { addJob } = useJobsStore.getState();

      for (let i = 0; i < 5; i += 1) {
        await addJob({
          fileName: `completed-${i}.mp4`,
          fileSize: 1000,
          status: 'completed',
          stage: 'published',
          progress: 100,
          metadata: { thumbnailAvailable: true },
        });
      }

      for (let i = 0; i < 3; i += 1) {
        await addJob({
          fileName: `failed-${i}.mp4`,
          fileSize: 1000,
          status: 'failed',
          stage: 'uploading',
          progress: 50,
          metadata: { thumbnailAvailable: false },
        });
      }

      await addJob({
        fileName: 'pending.mp4',
        fileSize: 1000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: { thumbnailAvailable: false },
      });
    });

    it('should clear completed jobs', () => {
      const { clearCompletedJobs } = useJobsStore.getState();

      clearCompletedJobs();

      const state = useJobsStore.getState();
      expect(state.jobs).toHaveLength(4);
      expect(state.jobs.every((job) => job.status !== 'completed')).toBe(true);
    });

    it('should clear failed jobs', () => {
      const { clearFailedJobs } = useJobsStore.getState();

      clearFailedJobs();

      const state = useJobsStore.getState();
      expect(state.jobs).toHaveLength(6);
      expect(state.jobs.every((job) => job.status !== 'failed')).toBe(true);
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

    it('should update job progress during polling', async () => {
      const { addJob, startPolling, getJob } = useJobsStore.getState();

      const jobId = await addJob({
        fileName: 'test.mp4',
        fileSize: 1000,
        status: 'pending',
        stage: 'queued',
        progress: 0,
        metadata: { thumbnailAvailable: false },
      });

      apiClientMock.get.mockImplementation(async () => ({
        success: true,
        data: useJobsStore.getState().jobs.map((job) =>
          job.id === jobId
            ? { ...job, status: 'processing', progress: 25, stage: 'encoding' }
            : job
        ),
      }));

      startPolling();
      await vi.advanceTimersByTimeAsync(3000);

      const job = getJob(jobId);
      expect(job?.progress).toBeGreaterThan(0);
      expect(job?.status).toBe('processing');
    });
  });
});
