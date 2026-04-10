import { describe, expect, it } from 'vitest';
import { __tmdbCaptionSanitizer } from '../../utils/tmdbCaptionGenerator';

describe('tmdb caption sanitizer', () => {
  it('removes malformed markdown source links and raw domain fragments', () => {
    const input = "‘Parish’ turns 2 years old today—released 2 years ago today as Giancarlo Esposito led the crime-drama cast alongside Zakary Momoh and Paula Malcomson. 🎬 ([amcnetworks.com](amcnetworks.com/press-releases...";

    const output = __tmdbCaptionSanitizer.stripCaptionLinks(input);

    expect(output).toContain('Parish');
    expect(output).not.toContain('amcnetworks.com');
    expect(output).not.toContain('press-releases');
    expect(output).not.toContain('](');
    expect(output.trim().endsWith('(')).toBe(false);
  });

  it('removes redundant anniversary date phrasing after ago today wording', () => {
    const input = 'The Bondsman premiered 1 year ago today. Starring Kevin Bacon and Jennifer Nettles; premiered April 3, 2025.';

    const output = __tmdbCaptionSanitizer.sanitizeTMDbCaption(
      input,
      { title: 'The Bondsman', mediaType: 'tv', releaseDate: '2025-04-03' },
      { model: 'gpt-5.4-nano', prompt: '', maxLength: 280, includeCast: true, includeDate: true, feedType: 'anniversary' }
    );

    expect(output).toContain('1 year ago today');
    expect(output).not.toContain('premiered April 3, 2025');
  });

  it('changes weekly this week wording to next week when the release falls in the next calendar week', () => {
    const RealDate = Date;

    class MockDate extends Date {
      constructor(value?: string | number | Date) {
        super(value ?? '2026-04-03T12:00:00.000Z');
      }

      static now() {
        return new RealDate('2026-04-03T12:00:00.000Z').getTime();
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.Date = MockDate as any;

    try {
      const output = __tmdbCaptionSanitizer.sanitizeTMDbCaption(
        'Faces of Death releases this week.',
        { title: 'Faces of Death', mediaType: 'movie', releaseDate: '2026-04-10' },
        { model: 'gpt-5.4-nano', prompt: '', maxLength: 280, includeCast: true, includeDate: true, feedType: 'weekly' }
      );

      expect(output).toContain('next week');
      expect(output).not.toContain('this week');
    } finally {
      globalThis.Date = RealDate;
    }
  });

  it('preserves paragraph breaks while still cleaning inline spacing', () => {
    const input = 'First line with   extra spaces.\n\nSecond paragraph keeps its break.';

    const output = __tmdbCaptionSanitizer.sanitizeTMDbCaption(
      input,
      { title: 'Example Movie', mediaType: 'movie', releaseDate: '2026-04-10' },
      { model: 'gpt-5.4-nano', prompt: '', maxLength: 280, includeCast: true, includeDate: true, feedType: 'today' }
    );

    expect(output).toBe('First line with extra spaces.\n\nSecond paragraph keeps its break.');
  });

  it('splits a release lead and cast lead into two paragraphs when that improves readability', () => {
    const input = 'Mortal Kombat II premieres next month on Friday, May 1. Starring Karl Urban, Adeline Rudolph, Jessica McNamee, and Josh Lawson.';

    const output = __tmdbCaptionSanitizer.sanitizeTMDbCaption(
      input,
      { title: 'Mortal Kombat II', mediaType: 'movie', releaseDate: '2026-05-01' },
      { model: 'gpt-5.4-nano', prompt: '', maxLength: 280, includeCast: true, includeDate: true, feedType: 'monthly' }
    );

    expect(output).toContain('premieres next month');
    expect(output).toContain('\n\nStarring Karl Urban');
  });

  it('rewrites generic OUT NOW fallback captions to match today-release prompt style', () => {
    const output = __tmdbCaptionSanitizer.sanitizeTMDbCaption(
      '🚨 OUT NOW: Newborn',
      {
        title: 'Newborn',
        mediaType: 'movie',
        releaseDate: '2026-04-10',
        cast: ['David Oyelowo', 'Olivia Washington', 'Barry Pepper'],
      },
      { model: 'gpt-5.4-nano', prompt: '', maxLength: 280, includeCast: true, includeDate: false, feedType: 'today' }
    );

    expect(output).toBe("'Newborn' releases today.\n\nStarring David Oyelowo, Olivia Washington, Barry Pepper.");
    expect(output).not.toContain('OUT NOW');
  });

  it('builds weekly temporal guidance with weekday and date for next-week releases', () => {
    const RealDate = Date;

    class MockDate extends Date {
      constructor(value?: string | number | Date) {
        super(value ?? '2026-04-03T12:00:00.000Z');
      }

      static now() {
        return new RealDate('2026-04-03T12:00:00.000Z').getTime();
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.Date = MockDate as any;

    try {
      const guidance = __tmdbCaptionSanitizer.buildTemporalGuidance(
        { title: 'Faces of Death', mediaType: 'movie', releaseDate: '2026-04-10' },
        { model: 'gpt-5.4-nano', prompt: '', maxLength: 280, includeCast: true, includeDate: true, feedType: 'weekly' }
      );

      expect(guidance.join(' ')).toContain('next week');
      expect(guidance.join(' ')).toContain('Friday, April 10');
    } finally {
      globalThis.Date = RealDate;
    }
  });

  it('builds monthly temporal guidance with weekday and date for next-month releases', () => {
    const RealDate = Date;

    class MockDate extends Date {
      constructor(value?: string | number | Date) {
        super(value ?? '2026-04-03T12:00:00.000Z');
      }

      static now() {
        return new RealDate('2026-04-03T12:00:00.000Z').getTime();
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.Date = MockDate as any;

    try {
      const guidance = __tmdbCaptionSanitizer.buildTemporalGuidance(
        { title: 'Example Movie', mediaType: 'movie', releaseDate: '2026-05-01' },
        { model: 'gpt-5.4-nano', prompt: '', maxLength: 280, includeCast: true, includeDate: true, feedType: 'monthly' }
      );

      expect(guidance.join(' ')).toContain('next month');
      expect(guidance.join(' ')).toContain('Friday, May 1');
    } finally {
      globalThis.Date = RealDate;
    }
  });
});
