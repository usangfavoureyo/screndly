import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Job stages for 7-stage pipeline
export type JobStage = 
  | 'queued'
  | 'processing'
  | 'generating_metadata'
  | 'encoding'
  | 'waiting_schedule'
  | 'uploading'
  | 'published';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobMetadata {
  title?: string;
  titleScore?: number; // 0-100
  description?: string;
  descriptionWordCount?: number;
  seoScore?: number; // 0-100
  tags?: string[];
  thumbnailUrl?: string;
  thumbnailAvailable: boolean;
}

export interface JobEvent {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: string;
}

export interface UploadJob {
  id: string;
  fileName: string;
  fileSize: number;
  sourceUrl?: string;
  status: JobStatus;
  stage: JobStage;
  progress: number; // 0-100
  metadata: JobMetadata;
  scheduledFor?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: {
    message: string;
    cause?: string;
    stack?: string;
  };
  events: JobEvent[];
  costEstimate?: number;
  backendUsed?: 'google-video-intelligence' | 'ffmpeg';
}

interface JobsState {
  jobs: UploadJob[];
  selectedJobId: string | null;
  isPolling: boolean;
  lastPollTime: Date | null;
  
  // Job management
  addJob: (job: Omit<UploadJob, 'id' | 'createdAt' | 'updatedAt' | 'events'>) => string;
  restoreJob: (job: UploadJob) => void;
  updateJob: (id: string, updates: Partial<UploadJob>) => void;
  deleteJob: (id: string) => void;
  duplicateJob: (id: string) => string;
  retryJob: (id: string) => void;
  
  // Job selection
  selectJob: (id: string | null) => void;
  
  // Job queries
  getJob: (id: string) => UploadJob | undefined;
  getJobsByStatus: (status: JobStatus) => UploadJob[];
  getActiveJobs: () => UploadJob[];
  getFailedJobs: () => UploadJob[];
  
  // Event logging
  addJobEvent: (jobId: string, event: Omit<JobEvent, 'id' | 'timestamp'>) => void;
  
  // System logs
  systemLogs: JobEvent[];
  addSystemLog: (event: Omit<JobEvent, 'id' | 'timestamp'>) => void;
  clearSystemLogs: () => void;
  
  // Polling
  startPolling: () => void;
  stopPolling: () => void;
  
  // Bulk operations
  clearCompletedJobs: () => void;
  clearFailedJobs: () => void;
  clearAllJobs: () => void;
}

// Simulate API polling for job status updates
let pollingInterval: NodeJS.Timeout | null = null;

export const useJobsStore = create<JobsState>()(
  persist(
    (set, get) => ({
      jobs: [],
      selectedJobId: null,
      isPolling: false,
      lastPollTime: null,
      
      // Job management
      addJob: (job) => {
        const newJob: UploadJob = {
          ...job,
          id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          events: [],
        };
        
        set(state => ({
          jobs: [newJob, ...state.jobs],
        }));
        
        // Add system log
        get().addSystemLog({
          severity: 'info',
          message: `New job created: ${job.fileName}`,
          details: `Job ID: ${newJob.id}`,
        });
        
        return newJob.id;
      },
      
      restoreJob: (job) => {
        set(state => ({
          jobs: [job, ...state.jobs],
        }));
      },
      
      updateJob: (id, updates) => {
        set(state => ({
          jobs: state.jobs.map(job =>
            job.id === id
              ? {
                  ...job,
                  ...updates,
                  updatedAt: new Date(),
                  completedAt: 
                    (updates.status === 'completed' || updates.status === 'failed') && !job.completedAt
                      ? new Date()
                      : job.completedAt,
                }
              : job
          ),
        }));
      },
      
      deleteJob: (id) => {
        const job = get().getJob(id);
        set(state => ({
          jobs: state.jobs.filter(j => j.id !== id),
          selectedJobId: state.selectedJobId === id ? null : state.selectedJobId,
        }));
        
        if (job) {
          get().addSystemLog({
            severity: 'info',
            message: `Job deleted: ${job.fileName}`,
            details: `Job ID: ${id}`,
          });
        }
      },
      
      duplicateJob: (id) => {
        const job = get().getJob(id);
        if (!job) return '';
        
        const duplicatedJob: Omit<UploadJob, 'id' | 'createdAt' | 'updatedAt' | 'events'> = {
          fileName: `${job.fileName} (copy)`,
          fileSize: job.fileSize,
          sourceUrl: job.sourceUrl,
          status: 'pending',
          stage: 'queued',
          progress: 0,
          metadata: {
            ...job.metadata,
            thumbnailAvailable: false,
          },
        };
        
        const newId = get().addJob(duplicatedJob);
        
        get().addSystemLog({
          severity: 'info',
          message: `Job duplicated: ${job.fileName}`,
          details: `Original ID: ${id}, New ID: ${newId}`,
        });
        
        return newId;
      },
      
      retryJob: (id) => {
        const job = get().getJob(id);
        if (!job) return;
        
        get().updateJob(id, {
          status: 'pending',
          stage: 'queued',
          progress: 0,
          error: undefined,
        });
        
        get().addJobEvent(id, {
          severity: 'info',
          message: 'Job retry initiated',
        });
        
        get().addSystemLog({
          severity: 'info',
          message: `Job retry: ${job.fileName}`,
          details: `Job ID: ${id}`,
        });
      },
      
      // Job selection
      selectJob: (id) => {
        set({ selectedJobId: id });
      },
      
      // Job queries
      getJob: (id) => {
        return get().jobs.find(job => job.id === id);
      },
      
      getJobsByStatus: (status) => {
        return get().jobs.filter(job => job.status === status);
      },
      
      getActiveJobs: () => {
        return get().jobs.filter(job => 
          job.status === 'pending' || job.status === 'processing'
        );
      },
      
      getFailedJobs: () => {
        return get().jobs.filter(job => job.status === 'failed');
      },
      
      // Event logging
      addJobEvent: (jobId, event) => {
        const newEvent: JobEvent = {
          ...event,
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        };
        
        set(state => ({
          jobs: state.jobs.map(job =>
            job.id === jobId
              ? {
                  ...job,
                  events: [newEvent, ...job.events],
                  updatedAt: new Date(),
                }
              : job
          ),
        }));
      },
      
      // System logs
      systemLogs: [],
      
      addSystemLog: (event) => {
        const newEvent: JobEvent = {
          ...event,
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        };
        
        set(state => ({
          systemLogs: [newEvent, ...state.systemLogs].slice(0, 500), // Keep last 500 logs
        }));
      },
      
      clearSystemLogs: () => {
        set({ systemLogs: [] });
      },
      
      // Polling
      startPolling: () => {
        if (pollingInterval) return;
        
        set({ isPolling: true });
        
        pollingInterval = setInterval(() => {
          const activeJobs = get().getActiveJobs();
          
          // Simulate status updates for active jobs
          activeJobs.forEach(job => {
            // Simulate progress
            if (job.progress < 100) {
              const progressIncrement = Math.random() * 10;
              const newProgress = Math.min(100, job.progress + progressIncrement);
              
              // Determine stage based on progress
              let newStage = job.stage;
              if (newProgress < 15) newStage = 'queued';
              else if (newProgress < 30) newStage = 'processing';
              else if (newProgress < 50) newStage = 'generating_metadata';
              else if (newProgress < 70) newStage = 'encoding';
              else if (newProgress < 85) newStage = 'waiting_schedule';
              else if (newProgress < 100) newStage = 'uploading';
              else newStage = 'published';
              
              get().updateJob(job.id, {
                progress: newProgress,
                stage: newStage,
                status: newProgress >= 100 ? 'completed' : 'processing',
              });
              
              // Add event for stage changes
              if (newStage !== job.stage) {
                get().addJobEvent(job.id, {
                  severity: 'info',
                  message: `Stage changed to ${newStage}`,
                });
              }
            }
          });
          
          set({ lastPollTime: new Date() });
        }, 3000); // Poll every 3 seconds
      },
      
      stopPolling: () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
        set({ isPolling: false });
      },
      
      // Bulk operations
      clearCompletedJobs: () => {
        const completedCount = get().jobs.filter(j => j.status === 'completed').length;
        set(state => ({
          jobs: state.jobs.filter(job => job.status !== 'completed'),
        }));
        
        get().addSystemLog({
          severity: 'info',
          message: `Cleared ${completedCount} completed jobs`,
        });
      },
      
      clearFailedJobs: () => {
        const failedCount = get().jobs.filter(j => j.status === 'failed').length;
        set(state => ({
          jobs: state.jobs.filter(job => job.status !== 'failed'),
        }));
        
        get().addSystemLog({
          severity: 'info',
          message: `Cleared ${failedCount} failed jobs`,
        });
      },
      
      clearAllJobs: () => {
        const jobCount = get().jobs.length;
        set({ 
          jobs: [],
          selectedJobId: null,
        });
        
        get().addSystemLog({
          severity: 'warning',
          message: `Cleared all ${jobCount} jobs`,
        });
      },
    }),
    {
      name: 'screndly-jobs-store',
      partialize: (state) => ({
        jobs: state.jobs.slice(0, 100), // Keep last 100 jobs
        systemLogs: state.systemLogs.slice(0, 100), // Keep last 100 logs
      }),
    }
  )
);
