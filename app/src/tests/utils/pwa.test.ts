// ============================================================================
// PWA UTILITY TESTS
// ============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isInstallPromptAvailable,
  isPWAInstalled,
  registerServiceWorker,
  setupInstallPrompt,
  showInstallPrompt,
  unregisterServiceWorker,
} from '../../utils/pwa';

function createInstallPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    preventDefault: () => void;
  };

  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome });
  event.preventDefault = vi.fn();

  return { event, prompt };
}

describe('PWA Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    delete (navigator as Navigator & { standalone?: boolean }).standalone;
    window.dispatchEvent(new Event('appinstalled'));
  });

  describe('isPWAInstalled', () => {
    it('should return true when running in standalone mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(isPWAInstalled()).toBe(true);
    });

    it('should return true when navigator.standalone is true (iOS)', () => {
      (navigator as Navigator & { standalone?: boolean }).standalone = true;

      expect(isPWAInstalled()).toBe(true);
    });

    it('should return false when not installed', () => {
      expect(isPWAInstalled()).toBe(false);
    });
  });

  describe('install prompt flow', () => {
    it('should report prompt availability after capturing the install event', () => {
      setupInstallPrompt();
      const { event } = createInstallPromptEvent();

      window.dispatchEvent(event);

      expect(isInstallPromptAvailable()).toBe(true);
    });

    it('should show the install prompt and clear it after user acceptance', async () => {
      setupInstallPrompt();
      const { event, prompt } = createInstallPromptEvent('accepted');

      window.dispatchEvent(event);

      const result = await showInstallPrompt();

      expect(prompt).toHaveBeenCalledTimes(1);
      expect(result).toBe('accepted');
      expect(isInstallPromptAvailable()).toBe(false);
    });

    it('should return unavailable when no prompt has been captured', async () => {
      expect(isInstallPromptAvailable()).toBe(false);
      await expect(showInstallPrompt()).resolves.toBe('unavailable');
    });
  });

  describe('Service Worker', () => {
    it('should register the service worker with the current build id', async () => {
      const registration = {
        scope: '/',
        installing: null,
        update: vi.fn(),
        addEventListener: vi.fn(),
      };

      const register = vi.fn().mockResolvedValue(registration);
      (navigator as Navigator & { serviceWorker: any }).serviceWorker = {
        controller: null,
        register,
        getRegistrations: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
      };

      const result = await registerServiceWorker();

      expect(register).toHaveBeenCalledWith('/sw.js?build=test-build', { scope: '/' });
      expect(result).toBe(registration);
    });

    it('should return null when service worker registration fails', async () => {
      const register = vi.fn().mockRejectedValue(new Error('Registration failed'));
      (navigator as Navigator & { serviceWorker: any }).serviceWorker = {
        controller: null,
        register,
        getRegistrations: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
      };

      await expect(registerServiceWorker()).resolves.toBeNull();
    });

    it('should unregister the active service worker', async () => {
      const unregister = vi.fn().mockResolvedValue(true);
      const getRegistration = vi.fn().mockResolvedValue({ unregister });

      (navigator as Navigator & { serviceWorker: any }).serviceWorker = {
        getRegistration,
      };

      await expect(unregisterServiceWorker()).resolves.toBe(true);
      expect(getRegistration).toHaveBeenCalledTimes(1);
      expect(unregister).toHaveBeenCalledTimes(1);
    });
  });
});
