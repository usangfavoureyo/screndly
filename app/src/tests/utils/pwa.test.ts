// ============================================================================
// PWA UTILITY TESTS
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  isPWAInstalled, 
  isInstallPromptAvailable, 
  showInstallPrompt,
  registerServiceWorker,
  unregisterServiceWorker
} from '../../utils/pwa';

describe('PWA Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).matchMedia;
  });

  describe('isPWAInstalled', () => {
    it('should return true when running in standalone mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      expect(isPWAInstalled()).toBe(true);
    });

    it('should return true when navigator.standalone is true (iOS)', () => {
      (window.navigator as any).standalone = true;
      expect(isPWAInstalled()).toBe(true);
    });

    it('should return false when not installed', () => {
      window.matchMedia = vi.fn().mockReturnValue({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      
      expect(isPWAInstalled()).toBe(false);
    });
  });

  describe('isInstallPromptAvailable', () => {
    it('should return true when install prompt event exists', () => {
      (window as any).deferredPrompt = {};
      expect(isInstallPromptAvailable()).toBe(true);
    });

    it('should return false when no prompt available', () => {
      delete (window as any).deferredPrompt;
      expect(isInstallPromptAvailable()).toBe(false);
    });
  });

  describe('showInstallPrompt', () => {
    it('should trigger prompt when available', async () => {
      const mockPrompt = vi.fn().mockResolvedValue({ outcome: 'accepted' });
      (window as any).deferredPrompt = { prompt: mockPrompt };

      const result = await showInstallPrompt();

      expect(mockPrompt).toHaveBeenCalled();
      expect(result).toBe('accepted');
      expect((window as any).deferredPrompt).toBeNull();
    });

    it('should return null when no prompt available', async () => {
      delete (window as any).deferredPrompt;
      const result = await showInstallPrompt();
      expect(result).toBeNull();
    });
  });

  describe('Service Worker', () => {
    it('should register service worker successfully', async () => {
      const mockRegister = vi.fn().mockResolvedValue({});
      (navigator as any).serviceWorker = {
        register: mockRegister,
      };

      await registerServiceWorker();

      expect(mockRegister).toHaveBeenCalledWith('/sw.js');
    });

    it('should handle service worker registration failure', async () => {
      const mockRegister = vi.fn().mockRejectedValue(new Error('Registration failed'));
      (navigator as any).serviceWorker = {
        register: mockRegister,
      };

      await expect(registerServiceWorker()).rejects.toThrow('Registration failed');
    });

    it('should unregister service worker', async () => {
      const mockUnregister = vi.fn().mockResolvedValue(true);
      const mockGetRegistration = vi.fn().mockResolvedValue({
        unregister: mockUnregister,
      });
      
      (navigator as any).serviceWorker = {
        getRegistration: mockGetRegistration,
      };

      await unregisterServiceWorker();

      expect(mockGetRegistration).toHaveBeenCalled();
      expect(mockUnregister).toHaveBeenCalled();
    });
  });
});
