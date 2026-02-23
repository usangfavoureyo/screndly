import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  source: 'upload' | 'rss' | 'tmdb' | 'videostudio' | 'system';
  timestamp: Date;
  read: boolean;
}

export interface VideoStudioJob {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  outputUrl?: string;
}

export interface Settings {
  // API Keys
  youtubeKey: string;
  openaiKey: string;
  serperKey: string;
  tmdbKey: string;
  s3Key: string;
  redisUrl: string;
  databaseUrl: string;
  
  // Video
  fetchInterval: string;
  regionFilter: string;
  advancedFilters: string;
  
  // Comment Reply
  commentRepliesActive: boolean;
  totalCommentsProcessed: number;
  repliesPosted: number;
  commentErrors: number;
  commentBlacklistUsernames: string;
  commentBlacklistKeywords: string;
  commentReplyFrequency: string;
  commentThrottle: string;
  
  // RSS
  rssEnabled: boolean;
  rssImageCount: string;
  rssPlatforms: string[];
  rssFetchInterval: string;
  rssPostingInterval: string;
  rssDeduplication: boolean;
  rssLogLevel: string;
  
  // Cleanup
  cleanupEnabled: boolean;
  cleanupInterval: string;
  storageRetention: string;
  
  // Appearance
  darkMode: boolean;
  hapticsEnabled: boolean;
  
  // Notifications
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface VideoStudioSettings {
  openaiModel: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
  useStructuredOutput: boolean;
  validateTimestamps: boolean;
  autoRetryOnMismatch: boolean;
  previewBeforeRender: boolean;
}

interface AppState {
  // Navigation
  currentPage: string;
  previousPage: string;
  navigate: (page: string) => void;
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  addNotification: (title: string, message: string, type: Notification['type'], source: Notification['source']) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  
  // Settings
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
  
  // Video Studio Settings
  videoStudioSettings: VideoStudioSettings;
  updateVideoStudioSetting: <K extends keyof VideoStudioSettings>(key: K, value: VideoStudioSettings[K]) => void;
  
  // Video Studio Jobs
  videoStudioJobs: VideoStudioJob[];
  addJob: (job: Omit<VideoStudioJob, 'id' | 'createdAt'>) => void;
  updateJobStatus: (id: string, status: VideoStudioJob['status'], progress?: number, error?: string, outputUrl?: string) => void;
  clearCompletedJobs: () => void;
  
  // UI State
  isSettingsOpen: boolean;
  toggleSettings: () => void;
  openSettings: (page?: string) => void;
  closeSettings: () => void;
  
  // Modals
  activeModal: string | null;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

const defaultSettings: Settings = {
  // API Keys
  youtubeKey: '••••••••••••••••',
  openaiKey: '••••••••••••••••',
  serperKey: '••••••••••••••••',
  tmdbKey: '••••••••••••••••',
  s3Key: '••••••••••••••••',
  redisUrl: 'redis://localhost:6379',
  databaseUrl: 'postgresql://localhost/screndly',
  
  // Video
  fetchInterval: '10',
  regionFilter: 'US,UK',
  advancedFilters: 'trailer, official, teaser',
  
  // Comment Reply
  commentRepliesActive: true,
  totalCommentsProcessed: 1247,
  repliesPosted: 1189,
  commentErrors: 4,
  commentBlacklistUsernames: '',
  commentBlacklistKeywords: '',
  commentReplyFrequency: 'instant',
  commentThrottle: 'low',
  
  // RSS
  rssEnabled: false,
  rssImageCount: 'random',
  rssPlatforms: ['x', 'threads'],
  rssFetchInterval: '5',
  rssPostingInterval: '10',
  rssDeduplication: true,
  rssLogLevel: 'standard',
  
  // Cleanup
  cleanupEnabled: true,
  cleanupInterval: 'daily',
  storageRetention: '48',
  
  // Appearance
  darkMode: true,
  hapticsEnabled: true,
  
  // Notifications
  emailNotifications: true,
  pushNotifications: false,
};

const defaultVideoStudioSettings: VideoStudioSettings = {
  openaiModel: 'gpt-4o',
  temperature: 0,
  topP: 0.95,
  maxTokens: 4096,
  systemPrompt: `You are an editor-prompt generator. Input: validated job JSON (segments, timestamps, audio_rules, caption_template, aspect). Output: (1) a Visla natural-language prompt that contains exact timestamps, audio ducking rules, caption template reference, and aspect directives; (2) a JSON validation summary with keys: segments_count, missing_fields, warnings. Strictly produce the Visla prompt in the field "visla_prompt_text" and do not add extra commentary. Follow the structured output schema exactly.`,
  useStructuredOutput: true,
  validateTimestamps: true,
  autoRetryOnMismatch: true,
  previewBeforeRender: true,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Navigation
      currentPage: 'dashboard',
      previousPage: '',
      navigate: (page: string) => {
        const currentPage = get().currentPage;
        set({ previousPage: currentPage, currentPage: page });
      },
      
      // Notifications
      notifications: [],
      unreadCount: 0,
      addNotification: (title, message, type, source) => {
        const notification: Notification = {
          id: Date.now().toString(),
          title,
          message,
          type,
          source,
          timestamp: new Date(),
          read: false,
        };
        set(state => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));
      },
      markAsRead: (id: string) => {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      },
      markAllAsRead: () => {
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },
      clearNotifications: () => {
        set({ notifications: [], unreadCount: 0 });
      },
      
      // Settings
      settings: defaultSettings,
      updateSetting: (key, value) => {
        set(state => ({
          settings: { ...state.settings, [key]: value },
        }));
      },
      resetSettings: () => {
        set({ settings: defaultSettings });
      },
      
      // Video Studio Settings
      videoStudioSettings: defaultVideoStudioSettings,
      updateVideoStudioSetting: (key, value) => {
        set(state => ({
          videoStudioSettings: { ...state.videoStudioSettings, [key]: value },
        }));
      },
      
      // Video Studio Jobs
      videoStudioJobs: [],
      addJob: (job) => {
        const newJob: VideoStudioJob = {
          ...job,
          id: Date.now().toString(),
          createdAt: new Date(),
        };
        set(state => ({
          videoStudioJobs: [newJob, ...state.videoStudioJobs],
        }));
        return newJob.id;
      },
      updateJobStatus: (id, status, progress, error, outputUrl) => {
        set(state => ({
          videoStudioJobs: state.videoStudioJobs.map(job =>
            job.id === id
              ? {
                  ...job,
                  status,
                  progress: progress ?? job.progress,
                  error,
                  outputUrl,
                  completedAt: status === 'completed' || status === 'failed' ? new Date() : job.completedAt,
                }
              : job
          ),
        }));
      },
      clearCompletedJobs: () => {
        set(state => ({
          videoStudioJobs: state.videoStudioJobs.filter(
            job => job.status !== 'completed' && job.status !== 'failed'
          ),
        }));
      },
      
      // UI State
      isSettingsOpen: false,
      toggleSettings: () => set(state => ({ isSettingsOpen: !state.isSettingsOpen })),
      openSettings: (page?: string) => {
        set({ isSettingsOpen: true });
        if (page) {
          get().navigate(page);
        }
      },
      closeSettings: () => set({ isSettingsOpen: false }),
      
      // Modals
      activeModal: null,
      openModal: (modalId: string) => set({ activeModal: modalId }),
      closeModal: () => set({ activeModal: null }),
    }),
    {
      name: 'screndly-store',
      partialize: (state) => ({
        // Only persist certain parts of state
        settings: state.settings,
        videoStudioSettings: state.videoStudioSettings,
        notifications: state.notifications.slice(0, 100), // Keep last 100
        currentPage: state.currentPage,
        previousPage: state.previousPage,
      }),
    }
  )
);
