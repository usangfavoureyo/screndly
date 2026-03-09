// Haptic feedback utility for mobile devices

const LOCAL_SETTINGS_KEYS = ['screndlySettings', 'screndly_settings'] as const;

// Get haptics enabled state from localStorage
const getHapticsEnabled = (): boolean => {
  try {
    // First check the main settings object (source of truth)
    const settingsStr = LOCAL_SETTINGS_KEYS
      .map((key) => localStorage.getItem(key))
      .find((value): value is string => !!value);
    if (settingsStr) {
      const settings = JSON.parse(settingsStr);
      if (typeof settings.hapticsEnabled === 'boolean') {
        return settings.hapticsEnabled;
      }
    }

    // Fallback to standalone key for backwards compatibility
    const standalone = localStorage.getItem('hapticsEnabled');
    if (standalone !== null) {
      return standalone === 'true';
    }

    // Default to enabled
    return true;
  } catch (_e) {
    // If there's any error parsing, default to enabled
    return true;
  }
};

// Set haptics enabled state in localStorage
// This syncs both the standalone key and the main settings object
export const setHapticsEnabled = (enabled: boolean): void => {
  try {
    // Update standalone key for backwards compatibility
    localStorage.setItem('hapticsEnabled', String(enabled));

    // Update main settings object (source of truth)
    const settingsStr = LOCAL_SETTINGS_KEYS
      .map((key) => localStorage.getItem(key))
      .find((value): value is string => !!value);
    if (settingsStr) {
      const settings = JSON.parse(settingsStr);
      settings.hapticsEnabled = enabled;
      const serialized = JSON.stringify(settings);
      for (const key of LOCAL_SETTINGS_KEYS) {
        localStorage.setItem(key, serialized);
      }
    }
  } catch (e) {
    console.error('Failed to save haptics setting:', e);
  }
};

export const haptics = {
  // Light tap feedback
  light: () => {
    if ('vibrate' in navigator && getHapticsEnabled()) {
      navigator.vibrate(10);
    }
  },

  // Medium tap feedback
  medium: () => {
    if ('vibrate' in navigator && getHapticsEnabled()) {
      navigator.vibrate(20);
    }
  },

  // Strong tap feedback
  heavy: () => {
    if ('vibrate' in navigator && getHapticsEnabled()) {
      navigator.vibrate(30);
    }
  },

  // Success pattern
  success: () => {
    if ('vibrate' in navigator && getHapticsEnabled()) {
      navigator.vibrate([10, 50, 10]);
    }
  },

  // Error pattern
  error: () => {
    if ('vibrate' in navigator && getHapticsEnabled()) {
      navigator.vibrate([20, 50, 20, 50, 20]);
    }
  },

  // Warning pattern
  warning: () => {
    if ('vibrate' in navigator && getHapticsEnabled()) {
      navigator.vibrate([15, 30, 15]);
    }
  },

  // Selection feedback (for toggles, switches)
  selection: () => {
    if ('vibrate' in navigator && getHapticsEnabled()) {
      navigator.vibrate(15);
    }
  }
};
