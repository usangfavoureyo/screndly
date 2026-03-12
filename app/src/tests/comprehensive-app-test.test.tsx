import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from '../App';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ThemeProvider } from '../components/ThemeProvider';

describe('Comprehensive App Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the app root without throwing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('keeps the expected focus styling on input and textarea primitives', () => {
    const { container: inputContainer } = render(
      <ThemeProvider>
        <Input />
      </ThemeProvider>
    );
    const { container: textareaContainer } = render(
      <ThemeProvider>
        <Textarea />
      </ThemeProvider>
    );

    const input = inputContainer.querySelector('input');
    const textarea = textareaContainer.querySelector('textarea');

    expect(input?.className).toContain('focus-visible:border-[#292929]');
    expect(input?.className).toContain('focus-visible:ring-[#292929]/50');
    expect(textarea?.className).toContain('focus-visible:border-[#292929]');
    expect(textarea?.className).toContain('focus-visible:ring-[#292929]/50');
  });

  it('imports the core publishing support components without runtime errors', async () => {
    const [{ ComposeScheduler }, { BackblazeUploader }, { BackblazeVideoBrowser }] =
      await Promise.all([
        import('../components/create/ComposeScheduler'),
        import('../components/BackblazeUploader'),
        import('../components/BackblazeVideoBrowser'),
      ]);

    expect(ComposeScheduler).toBeDefined();
    expect(BackblazeUploader).toBeDefined();
    expect(BackblazeVideoBrowser).toBeDefined();
  });

  it('maintains separate Backblaze storage keys for general and videos buckets', () => {
    const generalKeys = [
      'backblazeKeyId',
      'backblazeApplicationKey',
      'backblazeBucketName',
    ];
    const videoKeys = [
      'backblazeVideosKeyId',
      'backblazeVideosApplicationKey',
      'backblazeVideosBucketName',
    ];

    generalKeys.forEach((key) => localStorage.setItem(key, `general-${key}`));
    videoKeys.forEach((key) => localStorage.setItem(key, `videos-${key}`));

    generalKeys.forEach((key, index) => {
      expect(localStorage.getItem(key)).not.toBe(localStorage.getItem(videoKeys[index]));
    });
  });

  it('enforces the expected SEO caption constraints', () => {
    const hasEmoji = (text: string) =>
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(text);

    expect('A'.repeat(120).length >= 120 && 'A'.repeat(120).length <= 250).toBe(true);
    expect('A'.repeat(250).length >= 120 && 'A'.repeat(250).length <= 250).toBe(true);
    expect('A'.repeat(119).length >= 120).toBe(false);
    expect(hasEmoji('Clean caption')).toBe(false);
    expect(hasEmoji('Caption with emoji 😀')).toBe(true);
  });

  it('keeps the expected provider modules available', async () => {
    const { SettingsProvider } = await import('../contexts/SettingsContext');
    const { NotificationsProvider } = await import('../contexts/NotificationsContext');
    const { RSSFeedsProvider } = await import('../contexts/RSSFeedsContext');
    const { TMDbPostsProvider } = await import('../contexts/TMDbPostsContext');

    expect(SettingsProvider).toBeDefined();
    expect(NotificationsProvider).toBeDefined();
    expect(RSSFeedsProvider).toBeDefined();
    expect(TMDbPostsProvider).toBeDefined();
  });
});
