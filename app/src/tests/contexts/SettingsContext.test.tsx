import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from '../../contexts/SettingsContext';

const settingsApiMock = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  saveSettings: vi.fn(),
  deleteSettings: vi.fn(),
  checkBackendHealth: vi.fn(),
  mergeSettings: vi.fn(),
  isSensitiveSetting: vi.fn(),
}));

const analyticsIngesterMock = vi.hoisted(() => ({
  trackSettingChange: vi.fn(),
}));

const themeStorageMock = vi.hoisted(() => ({
  dispatchThemeChange: vi.fn(),
  persistThemePreference: vi.fn(),
}));

vi.mock('../../lib/api/settings', () => ({
  fetchSettings: settingsApiMock.fetchSettings,
  saveSettings: settingsApiMock.saveSettings,
  deleteSettings: settingsApiMock.deleteSettings,
  checkBackendHealth: settingsApiMock.checkBackendHealth,
  mergeSettings: settingsApiMock.mergeSettings,
  isSensitiveSetting: settingsApiMock.isSensitiveSetting,
}));

vi.mock('../../lib/optimization/analyticsIngester', () => ({
  analyticsIngester: analyticsIngesterMock,
}));

vi.mock('../../lib/theme/themeStorage', () => themeStorageMock);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    settingsApiMock.checkBackendHealth.mockResolvedValue(false);
    settingsApiMock.fetchSettings.mockResolvedValue({ success: false });
    settingsApiMock.saveSettings.mockResolvedValue({ success: true });
    settingsApiMock.deleteSettings.mockResolvedValue({ success: true });
    settingsApiMock.mergeSettings.mockImplementation((backendSettings = {}, localSettings = {}) => ({
      ...backendSettings,
      ...localSettings,
    }));
    settingsApiMock.isSensitiveSetting.mockImplementation((key: string) =>
      ['youtubeKey', 'openaiKey', 'serperKey', 'tmdbKey'].includes(key)
    );
  });

  it('loads backend settings when the backend is available', async () => {
    settingsApiMock.checkBackendHealth.mockResolvedValue(true);
    settingsApiMock.fetchSettings.mockResolvedValue({
      success: true,
      data: {
        darkMode: false,
        hapticsEnabled: false,
        youtubeKey: 'masked-youtube',
      },
    });

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.settings.darkMode).toBe(false);
    expect(result.current.settings.hapticsEnabled).toBe(false);
    expect(result.current.settings.youtubeKey).toBe('masked-youtube');
    expect(settingsApiMock.fetchSettings).toHaveBeenCalledTimes(1);
  });

  it('loads local preference settings when the backend is unavailable', async () => {
    localStorage.setItem(
      'screndlySettings',
      JSON.stringify({
        darkMode: false,
        hapticsEnabled: false,
        desktopNotifications: true,
      })
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.settings.darkMode).toBe(false);
    expect(result.current.settings.hapticsEnabled).toBe(false);
    expect(result.current.settings.desktopNotifications).toBe(true);
  });

  it('updates settings immediately in memory', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateSetting('timezone', 'Africa/Lagos');
    });

    expect(result.current.settings.timezone).toBe('Africa/Lagos');
    expect(analyticsIngesterMock.trackSettingChange).toHaveBeenCalledWith(
      'timezone',
      'Africa/Lagos',
      expect.anything(),
      'SettingsContext'
    );
  });

  it('persists non-sensitive settings to localStorage after the debounce window', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateSetting('desktopNotifications', true);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    const stored = JSON.parse(localStorage.getItem('screndlySettings') ?? '{}');
    expect(stored.desktopNotifications).toBe(true);
    expect(localStorage.getItem('screndly_settings')).toBeTruthy();
  });

  it('does not persist sensitive API keys to localStorage', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateSetting('youtubeKey', 'super-secret-key');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    const stored = JSON.parse(localStorage.getItem('screndlySettings') ?? '{}');
    expect(stored.youtubeKey).toBeUndefined();
  });
});
