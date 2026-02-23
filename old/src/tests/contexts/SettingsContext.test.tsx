// ============================================================================
// SETTINGS CONTEXT TESTS
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../../contexts/SettingsContext';
import React from 'react';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('General Settings', () => {
    it('should update a setting', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('youtubeApiKey', 'test_api_key_123');
      });

      expect(result.current.settings.youtubeApiKey).toBe('test_api_key_123');
    });

    it('should persist settings to localStorage', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('youtubeApiKey', 'persisted_key');
      });

      const stored = localStorage.getItem('screndly_settings');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.youtubeApiKey).toBe('persisted_key');
    });

    it('should load settings from localStorage on mount', () => {
      localStorage.setItem('screndly_settings', JSON.stringify({
        youtubeApiKey: 'loaded_key',
        tmdbApiKey: 'loaded_tmdb_key',
      }));

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings.youtubeApiKey).toBe('loaded_key');
      expect(result.current.settings.tmdbApiKey).toBe('loaded_tmdb_key');
    });
  });

  describe('Haptic Settings', () => {
    it('should toggle haptics', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      const initialState = result.current.settings.hapticsEnabled;

      act(() => {
        result.current.updateSetting('hapticsEnabled', !initialState);
      });

      expect(result.current.settings.hapticsEnabled).toBe(!initialState);
    });

    it('should update haptic intensity', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('hapticsIntensity', 'heavy');
      });

      expect(result.current.settings.hapticsIntensity).toBe('heavy');
    });
  });

  describe('Notification Settings', () => {
    it('should toggle desktop notifications', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('desktopNotifications', true);
      });

      expect(result.current.settings.desktopNotifications).toBe(true);
    });

    it('should toggle sound notifications', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('soundNotifications', false);
      });

      expect(result.current.settings.soundNotifications).toBe(false);
    });
  });

  describe('Error Handling Settings', () => {
    it('should toggle auto retry', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('errorAutoRetry', true);
      });

      expect(result.current.settings.errorAutoRetry).toBe(true);
    });

    it('should update max retry attempts', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('errorMaxRetries', 5);
      });

      expect(result.current.settings.errorMaxRetries).toBe(5);
    });
  });

  describe('Platform Settings', () => {
    it('should update YouTube settings', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('youtubeDefaultPrivacy', 'unlisted');
        result.current.updateSetting('youtubeAutoPublish', true);
      });

      expect(result.current.settings.youtubeDefaultPrivacy).toBe('unlisted');
      expect(result.current.settings.youtubeAutoPublish).toBe(true);
    });

    it('should update X (Twitter) settings', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('xAutoPublish', false);
        result.current.updateSetting('xDefaultVisibility', 'public');
      });

      expect(result.current.settings.xAutoPublish).toBe(false);
      expect(result.current.settings.xDefaultVisibility).toBe('public');
    });

    it('should update Meta settings', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('metaAutoPublish', true);
        result.current.updateSetting('metaDefaultImageCount', '3');
      });

      expect(result.current.settings.metaAutoPublish).toBe(true);
      expect(result.current.settings.metaDefaultImageCount).toBe('3');
    });
  });

  describe('RSS Feed Settings', () => {
    it('should update RSS polling interval', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('rssPollingInterval', 30);
      });

      expect(result.current.settings.rssPollingInterval).toBe(30);
    });

    it('should update RSS caption model', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('rssCaptionModel', 'gpt-4o-mini');
      });

      expect(result.current.settings.rssCaptionModel).toBe('gpt-4o-mini');
    });
  });

  describe('TMDb Settings', () => {
    it('should update TMDb API key', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('tmdbApiKey', 'tmdb_test_key');
      });

      expect(result.current.settings.tmdbApiKey).toBe('tmdb_test_key');
    });

    it('should toggle TMDb feeds', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('tmdbTodayEnabled', true);
        result.current.updateSetting('tmdbWeeklyEnabled', false);
      });

      expect(result.current.settings.tmdbTodayEnabled).toBe(true);
      expect(result.current.settings.tmdbWeeklyEnabled).toBe(false);
    });
  });

  describe('Video Studio Settings', () => {
    it('should update OpenAI model', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('openaiModel', 'gpt-4-turbo');
      });

      expect(result.current.settings.openaiModel).toBe('gpt-4-turbo');
    });

    it('should update temperature setting', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('temperature', 0.8);
      });

      expect(result.current.settings.temperature).toBe(0.8);
    });

    it('should update caption model', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('captionOpenaiModel', 'gpt-4o-mini');
      });

      expect(result.current.settings.captionOpenaiModel).toBe('gpt-4o-mini');
    });
  });
});
