import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubjectMatterAnalysis } from '../../lib/ai/subject-extraction';

const mockExtractSubjectMatter = vi.fn();
const mockSelectSmartImages = vi.fn();
const mockApiGet = vi.fn();
const mockSearchSerperImagesWithRetry = vi.fn();

vi.mock('../../lib/ai/subject-extraction', () => ({
  extractSubjectMatter: mockExtractSubjectMatter,
}));

vi.mock('../../lib/ai/image-selection', () => ({
  selectSmartImages: mockSelectSmartImages,
}));

vi.mock('../../lib/api/client', () => ({
  apiClient: {
    get: mockApiGet,
  },
}));

vi.mock('../../lib/api/serper', () => ({
  searchSerperImagesWithRetry: mockSearchSerperImagesWithRetry,
}));

vi.mock('../../utils/image-scoring', () => ({
  filterByQuality: (images: unknown) => images,
}));

const quotedTitleAnalysis: SubjectMatterAnalysis = {
  primarySubject: {
    name: 'Project Hail Mary',
    type: 'movie',
    status: 'released',
  },
  secondarySubjects: [],
  contextType: 'boxoffice',
  imagePreferences: [],
};

describe('rss image enrichment', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('prefers quoted project titles over corporate entities', async () => {
    const { extractProjectCandidates } = await import('../../lib/rss/image-enrichment');

    const analysis: SubjectMatterAnalysis = {
      primarySubject: {
        name: 'Lucaville Global',
        type: 'franchise',
        status: 'development',
      },
      secondarySubjects: [
        {
          name: 'The Treasure of San Gennaro',
          type: 'movie',
          relevance: 'high',
        },
      ],
      contextType: 'announcement',
      imagePreferences: [],
    };

    const candidates = extractProjectCandidates(
      {
        title: "Lucaville Global launches JV with Titanus",
        description: "First projects include a remake of 'The Treasure of San Gennaro' with Lawrence Bender.",
      },
      analysis,
    );

    expect(candidates).toContain('The Treasure of San Gennaro');
    expect(candidates).not.toContain('Lucaville Global');
  });

  it('uses the exact quoted-title TMDb backdrop strategy for single-image title-led stories', async () => {
    mockExtractSubjectMatter.mockResolvedValue({ analysis: quotedTitleAnalysis });
    mockApiGet.mockResolvedValue({
      success: true,
      data: [
        {
          id: 42,
          mediaType: 'movie',
          title: 'Project Hail Mary',
          backdrop: 'https://tmdb.example/project-hail-mary-backdrop.jpg',
          poster: 'https://tmdb.example/project-hail-mary-poster.jpg',
          releaseDate: '2026-03-20',
        },
      ],
    });

    const { enrichArticleWithImages } = await import('../../lib/rss/image-enrichment');
    const result = await enrichArticleWithImages(
      {
        title: "'Project Hail Mary' tops the U.K. and Ireland box office.",
        description: '',
        images: [{ url: 'https://rss.example/hero.jpg' }],
      },
      null,
      1,
    );

    expect(result.strategy).toBe('tmdb-exact-quoted-title-match');
    expect(result.images[0]?.url).toBe('https://tmdb.example/project-hail-mary-backdrop.jpg');
    expect(result.debug?.winnerReasons).toContain('tmdb-exact-quoted-title-match');
  });

  it('blocks low-confidence article-hero fallback for title-led stories', async () => {
    mockExtractSubjectMatter.mockResolvedValue({ analysis: quotedTitleAnalysis });
    mockApiGet.mockResolvedValue({
      success: true,
      data: [],
    });
    mockSelectSmartImages.mockResolvedValue({
      images: [
        {
          url: 'https://rss.example/hero.jpg',
          width: 1200,
          height: 800,
          source: 'RSS Feed',
          reason: 'Hero image',
          totalScore: 42,
        },
      ],
      confidence: 42,
      confidenceLevel: 'low',
      analysis: {
        primarySubject: { name: 'Project Hail Mary' },
        contextType: 'boxoffice',
      },
      queries: [],
    });
    mockSearchSerperImagesWithRetry.mockResolvedValue([
      {
        title: 'Project Hail Mary official logo',
        imageUrl: 'https://serper.example/project-hail-mary-logo.png',
        imageWidth: 1400,
        imageHeight: 800,
        domain: 'example.com',
        position: 1,
      },
    ]);

    const { enrichArticleWithImages } = await import('../../lib/rss/image-enrichment');
    const result = await enrichArticleWithImages(
      {
        title: "'Project Hail Mary' tops the U.K. and Ireland box office.",
        description: '',
        images: [{ url: 'https://rss.example/hero.jpg' }],
      },
      null,
      1,
    );

    expect(result.strategy).toBe('safe-title-fallback');
    expect(result.images[0]?.url).toBe('https://serper.example/project-hail-mary-logo.png');
    expect(result.images[0]?.url).not.toBe('https://rss.example/hero.jpg');
  });
});
