// ============================================================================
// APP STORE TESTS
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useAppStore.setState({
      notifications: [],
      unreadCount: 0,
      currentPage: 'dashboard',
      previousPage: '',
    });
  });

  describe('Navigation', () => {
    it('should navigate to a new page', () => {
      const { navigate, currentPage, previousPage } = useAppStore.getState();
      
      navigate('video-studio');
      
      const state = useAppStore.getState();
      expect(state.currentPage).toBe('video-studio');
      expect(state.previousPage).toBe('dashboard');
    });

    it('should track previous page history', () => {
      const { navigate } = useAppStore.getState();
      
      navigate('settings');
      expect(useAppStore.getState().currentPage).toBe('settings');
      expect(useAppStore.getState().previousPage).toBe('dashboard');
      
      navigate('api-keys');
      expect(useAppStore.getState().currentPage).toBe('api-keys');
      expect(useAppStore.getState().previousPage).toBe('settings');
    });
  });

  describe('Notifications', () => {
    it('should add a notification', () => {
      const { addNotification } = useAppStore.getState();
      
      addNotification('Test Title', 'Test Message', 'success', 'system');
      
      const state = useAppStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.unreadCount).toBe(1);
      expect(state.notifications[0].title).toBe('Test Title');
      expect(state.notifications[0].type).toBe('success');
    });

    it('should mark notification as read', () => {
      const { addNotification, markAsRead } = useAppStore.getState();
      
      addNotification('Test', 'Message', 'info', 'system');
      const notificationId = useAppStore.getState().notifications[0].id;
      
      markAsRead(notificationId);
      
      const state = useAppStore.getState();
      expect(state.notifications[0].read).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it('should mark all notifications as read', () => {
      const { addNotification, markAllAsRead } = useAppStore.getState();
      
      addNotification('Test 1', 'Message 1', 'info', 'system');
      addNotification('Test 2', 'Message 2', 'info', 'system');
      addNotification('Test 3', 'Message 3', 'info', 'system');
      
      markAllAsRead();
      
      const state = useAppStore.getState();
      expect(state.notifications.every(n => n.read)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it('should clear all notifications', () => {
      const { addNotification, clearNotifications } = useAppStore.getState();
      
      addNotification('Test 1', 'Message 1', 'info', 'system');
      addNotification('Test 2', 'Message 2', 'info', 'system');
      
      clearNotifications();
      
      const state = useAppStore.getState();
      expect(state.notifications).toHaveLength(0);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('Settings', () => {
    it('should update a setting', () => {
      const { updateSetting } = useAppStore.getState();
      
      updateSetting('youtubeKey', 'new_key_123');
      
      const state = useAppStore.getState();
      expect(state.settings.youtubeKey).toBe('new_key_123');
    });

    it('should reset settings to defaults', () => {
      const { updateSetting, resetSettings } = useAppStore.getState();
      
      updateSetting('youtubeKey', 'custom_key');
      updateSetting('fetchInterval', '30');
      
      resetSettings();
      
      const state = useAppStore.getState();
      expect(state.settings.youtubeKey).toBe('••••••••••••••••');
      expect(state.settings.fetchInterval).toBe('10');
    });
  });

  describe('Video Studio Settings', () => {
    it('should update Video Studio setting', () => {
      const { updateVideoStudioSetting } = useAppStore.getState();
      
      updateVideoStudioSetting('temperature', 0.5);
      
      const state = useAppStore.getState();
      expect(state.videoStudioSettings.temperature).toBe(0.5);
    });

    it('should update OpenAI model', () => {
      const { updateVideoStudioSetting } = useAppStore.getState();
      
      updateVideoStudioSetting('openaiModel', 'gpt-4o-mini');
      
      const state = useAppStore.getState();
      expect(state.videoStudioSettings.openaiModel).toBe('gpt-4o-mini');
    });
  });

  describe('Video Studio Jobs', () => {
    it('should add a new job', () => {
      const { addJob } = useAppStore.getState();
      
      addJob({
        title: 'Test Job',
        status: 'pending',
        progress: 0,
      });
      
      const state = useAppStore.getState();
      expect(state.videoStudioJobs).toHaveLength(1);
      expect(state.videoStudioJobs[0].title).toBe('Test Job');
      expect(state.videoStudioJobs[0]).toHaveProperty('id');
      expect(state.videoStudioJobs[0]).toHaveProperty('createdAt');
    });

    it('should update job status', () => {
      const { addJob, updateJobStatus } = useAppStore.getState();
      
      addJob({
        title: 'Test Job',
        status: 'pending',
        progress: 0,
      });
      
      const jobId = useAppStore.getState().videoStudioJobs[0].id;
      
      updateJobStatus(jobId, 'processing', 50);
      
      const state = useAppStore.getState();
      expect(state.videoStudioJobs[0].status).toBe('processing');
      expect(state.videoStudioJobs[0].progress).toBe(50);
    });

    it('should set completion time when job completes', () => {
      const { addJob, updateJobStatus } = useAppStore.getState();
      
      addJob({
        title: 'Test Job',
        status: 'pending',
        progress: 0,
      });
      
      const jobId = useAppStore.getState().videoStudioJobs[0].id;
      
      updateJobStatus(jobId, 'completed', 100, undefined, 'https://example.com/video.mp4');
      
      const state = useAppStore.getState();
      expect(state.videoStudioJobs[0].completedAt).toBeDefined();
      expect(state.videoStudioJobs[0].outputUrl).toBe('https://example.com/video.mp4');
    });

    it('should clear completed jobs', () => {
      const { addJob, updateJobStatus, clearCompletedJobs } = useAppStore.getState();
      
      addJob({ title: 'Job 1', status: 'pending', progress: 0 });
      addJob({ title: 'Job 2', status: 'pending', progress: 0 });
      addJob({ title: 'Job 3', status: 'pending', progress: 0 });
      
      const jobs = useAppStore.getState().videoStudioJobs;
      updateJobStatus(jobs[0].id, 'completed', 100);
      updateJobStatus(jobs[1].id, 'processing', 50);
      updateJobStatus(jobs[2].id, 'failed', 0, 'Error occurred');
      
      clearCompletedJobs();
      
      const state = useAppStore.getState();
      expect(state.videoStudioJobs).toHaveLength(1);
      expect(state.videoStudioJobs[0].title).toBe('Job 2');
    });
  });

  describe('UI State', () => {
    it('should toggle settings panel', () => {
      const { toggleSettings } = useAppStore.getState();
      
      toggleSettings();
      expect(useAppStore.getState().isSettingsOpen).toBe(true);
      
      toggleSettings();
      expect(useAppStore.getState().isSettingsOpen).toBe(false);
    });

    it('should open settings with specific page', () => {
      const { openSettings } = useAppStore.getState();
      
      openSettings('api-keys');
      
      const state = useAppStore.getState();
      expect(state.isSettingsOpen).toBe(true);
      expect(state.currentPage).toBe('api-keys');
    });

    it('should manage modal state', () => {
      const { openModal, closeModal } = useAppStore.getState();
      
      openModal('publish-dialog');
      expect(useAppStore.getState().activeModal).toBe('publish-dialog');
      
      closeModal();
      expect(useAppStore.getState().activeModal).toBeNull();
    });
  });
});
