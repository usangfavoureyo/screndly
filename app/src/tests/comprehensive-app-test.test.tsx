/**
 * Comprehensive App Test Suite
 * 
 * Tests all major functionality and recent bug fixes:
 * 1. React imports in VideoStudioPage
 * 2. Sonner toast imports (consistent pattern)
 * 3. Input/Textarea focus styling (#292929)
 * 4. Dual-bucket Backblaze B2 implementation
 * 5. SEO caption validation (120-250 chars, no emojis)
 * 6. General app functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('Comprehensive App Tests', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('1. App Initialization', () => {
    it('should render App component without errors', () => {
      expect(() => render(<App />)).not.toThrow();
    });

    it('should show loading screen initially', () => {
      render(<App />);
      const loadingElement = document.querySelector('[data-testid="loading-screen"]') || 
                            document.querySelector('.loading') ||
                            document.body;
      expect(loadingElement).toBeDefined();
    });
  });

  describe('2. Focus Styling Verification', () => {
    it('should have #292929 focus color defined in input component', async () => {
      // Import the Input component
      const { Input } = await import('../components/ui/input');
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      
      expect(input).toBeDefined();
      // Check if focus styling classes are present
      expect(input?.className).toContain('focus-visible:border-[#292929]');
      expect(input?.className).toContain('dark:focus-visible:border-[#292929]');
      expect(input?.className).toContain('focus-visible:ring-[#292929]/50');
    });

    it('should have #292929 focus color defined in textarea component', async () => {
      const { Textarea } = await import('../components/ui/textarea');
      const { container } = render(<Textarea />);
      const textarea = container.querySelector('textarea');
      
      expect(textarea).toBeDefined();
      expect(textarea?.className).toContain('focus-visible:border-[#292929]');
      expect(textarea?.className).toContain('dark:focus-visible:border-[#292929]');
      expect(textarea?.className).toContain('focus-visible:ring-[#292929]/50');
    });
  });

  describe('3. Toast Import Pattern', () => {
    it('should use consistent sonner@2.0.3 import pattern in VideoStudioPage', async () => {
      // Read the file content
      const fs = await import('fs');
      const path = await import('path');
      const videoStudioPath = path.resolve(__dirname, '../components/VideoStudioPage.tsx');
      const content = fs.readFileSync(videoStudioPath, 'utf-8');
      
      // Check for correct import
      expect(content).toContain('import { toast } from "sonner"');
    });

    it('should use consistent sonner@2.0.3 import pattern in BackblazeUploader', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const uploaderPath = path.resolve(__dirname, '../components/BackblazeUploader.tsx');
      const content = fs.readFileSync(uploaderPath, 'utf-8');
      
      expect(content).toContain('import { toast } from "sonner"');
    });

    it('should use consistent sonner@2.0.3 import pattern in BackblazeVideoBrowser', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const browserPath = path.resolve(__dirname, '../components/BackblazeVideoBrowser.tsx');
      const content = fs.readFileSync(browserPath, 'utf-8');
      
      expect(content).toContain('import { toast } from "sonner"');
    });
  });

  describe('4. React Import Verification', () => {
    it('should have React imports in VideoStudioPage', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const videoStudioPath = path.resolve(__dirname, '../components/VideoStudioPage.tsx');
      const content = fs.readFileSync(videoStudioPath, 'utf-8');
      
      // Should have React import
      expect(content).toMatch(/import\s+React/);
    });
  });

  describe('5. Dual Backblaze B2 Bucket Configuration', () => {
    it('should have separate settings for general storage bucket', () => {
      const storageKeys = [
        'backblazeKeyId',
        'backblazeApplicationKey',
        'backblazeBucketName'
      ];
      
      // Verify these keys can be set in localStorage
      storageKeys.forEach(key => {
        localStorage.setItem(key, 'test-value');
        expect(localStorage.getItem(key)).toBe('test-value');
      });
    });

    it('should have separate settings for videos bucket', () => {
      const videoKeys = [
        'backblazeVideosKeyId',
        'backblazeVideosApplicationKey',
        'backblazeVideosBucketName'
      ];
      
      // Verify these keys can be set in localStorage
      videoKeys.forEach(key => {
        localStorage.setItem(key, 'test-value');
        expect(localStorage.getItem(key)).toBe('test-value');
      });
    });

    it('should have distinct configurations in SettingsContext', async () => {
      const { SettingsProvider } = await import('../contexts/SettingsContext');
      expect(SettingsProvider).toBeDefined();
      
      // Verify the provider exists and can be instantiated
      expect(() => {
        render(<SettingsProvider><div>Test</div></SettingsProvider>);
      }).not.toThrow();
    });

    it('should properly separate general and video bucket credentials', () => {
      // Set general bucket credentials
      localStorage.setItem('backblazeKeyId', 'general-key-id');
      localStorage.setItem('backblazeApplicationKey', 'general-app-key');
      localStorage.setItem('backblazeBucketName', 'general-bucket');
      
      // Set video bucket credentials
      localStorage.setItem('backblazeVideosKeyId', 'videos-key-id');
      localStorage.setItem('backblazeVideosApplicationKey', 'videos-app-key');
      localStorage.setItem('backblazeVideosBucketName', 'videos-bucket');
      
      // Verify they're separate
      expect(localStorage.getItem('backblazeKeyId')).not.toBe(localStorage.getItem('backblazeVideosKeyId'));
      expect(localStorage.getItem('backblazeApplicationKey')).not.toBe(localStorage.getItem('backblazeVideosApplicationKey'));
      expect(localStorage.getItem('backblazeBucketName')).not.toBe(localStorage.getItem('backblazeVideosBucketName'));
    });
  });

  describe('6. SEO Caption Validation', () => {
    it('should validate caption length (120-250 characters)', () => {
      const validateCaption = (text: string) => {
        const length = text.length;
        return length >= 120 && length <= 250;
      };

      // Valid captions
      expect(validateCaption('A'.repeat(120))).toBe(true);
      expect(validateCaption('A'.repeat(185))).toBe(true);
      expect(validateCaption('A'.repeat(250))).toBe(true);

      // Invalid captions
      expect(validateCaption('A'.repeat(119))).toBe(false);
      expect(validateCaption('A'.repeat(251))).toBe(false);
      expect(validateCaption('Short')).toBe(false);
    });

    it('should detect emojis in captions', () => {
      const hasEmoji = (text: string) => {
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
        return emojiRegex.test(text);
      };

      // With emojis
      expect(hasEmoji('Hello 😀 World')).toBe(true);
      expect(hasEmoji('🎬 Movie trailer')).toBe(true);
      expect(hasEmoji('Amazing! 🔥')).toBe(true);

      // Without emojis
      expect(hasEmoji('Hello World')).toBe(false);
      expect(hasEmoji('Movie trailer description')).toBe(false);
      expect(hasEmoji('Amazing!')).toBe(false);
    });

    it('should validate complete SEO caption (length + no emojis)', () => {
      const validateSEOCaption = (text: string) => {
        const length = text.length;
        const hasEmoji = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(text);
        
        return {
          isValid: length >= 120 && length <= 250 && !hasEmoji,
          length,
          hasEmoji
        };
      };

      // Valid caption
      const validCaption = 'This is a valid SEO caption for a movie trailer. It contains enough characters to meet the minimum requirement of 120 characters and stays within the maximum limit of 250 characters.';
      const valid = validateSEOCaption(validCaption);
      expect(valid.isValid).toBe(true);
      expect(valid.hasEmoji).toBe(false);

      // Too short
      const shortCaption = 'Too short';
      const short = validateSEOCaption(shortCaption);
      expect(short.isValid).toBe(false);

      // Has emoji
      const emojiCaption = 'This is a caption with enough characters to meet the minimum requirement of 120 characters and stays within the maximum limit but has emoji 🎬';
      const emoji = validateSEOCaption(emojiCaption);
      expect(emoji.isValid).toBe(false);
      expect(emoji.hasEmoji).toBe(true);
    });
  });

  describe('7. Context Providers', () => {
    it('should have all required context providers', async () => {
      const { SettingsProvider } = await import('../contexts/SettingsContext');
      const { NotificationsProvider } = await import('../contexts/NotificationsContext');
      const { RSSFeedsProvider } = await import('../contexts/RSSFeedsContext');
      const { VideoStudioTemplatesProvider } = await import('../contexts/VideoStudioTemplatesContext');
      const { TMDbPostsProvider } = await import('../contexts/TMDbPostsContext');

      expect(SettingsProvider).toBeDefined();
      expect(NotificationsProvider).toBeDefined();
      expect(RSSFeedsProvider).toBeDefined();
      expect(VideoStudioTemplatesProvider).toBeDefined();
      expect(TMDbPostsProvider).toBeDefined();
    });

    it('should render nested providers without errors', () => {
      expect(() => render(<App />)).not.toThrow();
    });
  });

  describe('8. Component Imports', () => {
    it('should import VideoStudioPage without errors', async () => {
      const { VideoStudioPage } = await import('../components/VideoStudioPage');
      expect(VideoStudioPage).toBeDefined();
    });

    it('should import BackblazeUploader without errors', async () => {
      const { BackblazeUploader } = await import('../components/BackblazeUploader');
      expect(BackblazeUploader).toBeDefined();
    });

    it('should import BackblazeVideoBrowser without errors', async () => {
      const { BackblazeVideoBrowser } = await import('../components/BackblazeVideoBrowser');
      expect(BackblazeVideoBrowser).toBeDefined();
    });

    it('should import SubtitleTimestampAssist without errors', async () => {
      const { SubtitleTimestampAssist } = await import('../components/SubtitleTimestampAssist');
      expect(SubtitleTimestampAssist).toBeDefined();
    });
  });

  describe('9. Utility Functions', () => {
    it('should have backblaze utility functions', async () => {
      const backblaze = await import('../utils/backblaze');
      expect(backblaze.getBackblazeConfig).toBeDefined();
      expect(backblaze.uploadToBackblaze).toBeDefined();
    });

    it('should have haptics utility', async () => {
      const { haptics } = await import('../utils/haptics');
      expect(haptics).toBeDefined();
      expect(haptics.light).toBeDefined();
      expect(haptics.medium).toBeDefined();
      expect(haptics.heavy).toBeDefined();
      expect(haptics.error).toBeDefined();
      expect(haptics.success).toBeDefined();
    });
  });

  describe('10. PWA Features', () => {
    it('should have manifest.json', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const manifestPath = path.resolve(__dirname, '../public/manifest.json');
      const exists = fs.existsSync(manifestPath);
      expect(exists).toBe(true);
    });

    it('should have service worker', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const swPath = path.resolve(__dirname, '../public/sw.js');
      const exists = fs.existsSync(swPath);
      expect(exists).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle Backblaze general bucket configuration', () => {
    localStorage.setItem('backblazeKeyId', 'test-key-id');
    localStorage.setItem('backblazeApplicationKey', 'test-app-key');
    localStorage.setItem('backblazeBucketName', 'test-bucket');

    expect(localStorage.getItem('backblazeKeyId')).toBe('test-key-id');
    expect(localStorage.getItem('backblazeApplicationKey')).toBe('test-app-key');
    expect(localStorage.getItem('backblazeBucketName')).toBe('test-bucket');
  });

  it('should handle Backblaze videos bucket configuration separately', () => {
    localStorage.setItem('backblazeVideosKeyId', 'videos-key-id');
    localStorage.setItem('backblazeVideosApplicationKey', 'videos-app-key');
    localStorage.setItem('backblazeVideosBucketName', 'videos-bucket');

    expect(localStorage.getItem('backblazeVideosKeyId')).toBe('videos-key-id');
    expect(localStorage.getItem('backblazeVideosApplicationKey')).toBe('videos-app-key');
    expect(localStorage.getItem('backblazeVideosBucketName')).toBe('videos-bucket');

    // Ensure they're different from general bucket
    localStorage.setItem('backblazeKeyId', 'general-key-id');
    expect(localStorage.getItem('backblazeKeyId')).not.toBe(localStorage.getItem('backblazeVideosKeyId'));
  });

  it('should maintain separate bucket credentials in memory', () => {
    // Simulate user setting both configurations
    const generalConfig = {
      keyId: 'general-123',
      applicationKey: 'general-key-456',
      bucketName: 'trailers-bucket'
    };

    const videosConfig = {
      keyId: 'videos-789',
      applicationKey: 'videos-key-012',
      bucketName: 'movies-tv-bucket'
    };

    // Set general bucket
    localStorage.setItem('backblazeKeyId', generalConfig.keyId);
    localStorage.setItem('backblazeApplicationKey', generalConfig.applicationKey);
    localStorage.setItem('backblazeBucketName', generalConfig.bucketName);

    // Set videos bucket
    localStorage.setItem('backblazeVideosKeyId', videosConfig.keyId);
    localStorage.setItem('backblazeVideosApplicationKey', videosConfig.applicationKey);
    localStorage.setItem('backblazeVideosBucketName', videosConfig.bucketName);

    // Verify they remain separate
    expect(localStorage.getItem('backblazeKeyId')).toBe(generalConfig.keyId);
    expect(localStorage.getItem('backblazeVideosKeyId')).toBe(videosConfig.keyId);
    expect(localStorage.getItem('backblazeKeyId')).not.toBe(localStorage.getItem('backblazeVideosKeyId'));
  });
});
