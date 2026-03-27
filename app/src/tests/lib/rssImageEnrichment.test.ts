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

    expect(result.strategy).toBe('no-safe-fallback');
    expect(result.images).toHaveLength(0);
  });

  it('rejects partial-title matches like Apex -> Apex Predator', async () => {
    mockExtractSubjectMatter.mockResolvedValue({
      analysis: {
        primarySubject: {
          name: 'Apex',
          type: 'movie',
          status: 'released',
        },
        secondarySubjects: [
          { name: 'Netflix', type: 'studio', relevance: 'high' },
        ],
        contextType: 'trailer',
        imagePreferences: [],
      },
    });
    mockApiGet.mockResolvedValue({
      success: true,
      data: [
        {
          id: 7,
          mediaType: 'movie',
          title: 'Apex Predator',
          backdrop: 'https://tmdb.example/apex-predator-backdrop.jpg',
          poster: 'https://tmdb.example/apex-predator-poster.jpg',
          releaseDate: '2025-05-01',
        },
      ],
    });
    mockSelectSmartImages.mockResolvedValue({
      images: [],
      confidence: 0,
      confidenceLevel: 'low',
      analysis: {
        primarySubject: { name: 'Apex' },
        contextType: 'trailer',
      },
      queries: [],
    });
    mockSearchSerperImagesWithRetry.mockResolvedValue([
      {
        title: 'Apex Predator official logo',
        imageUrl: 'https://serper.example/apex-predator-logo.png',
        imageWidth: 1400,
        imageHeight: 800,
        domain: 'example.com',
        position: 1,
      },
    ]);

    const { enrichArticleWithImages } = await import('../../lib/rss/image-enrichment');
    const result = await enrichArticleWithImages(
      {
        title: "Netflix has released the trailer for 'Apex'",
        description: '',
      },
      null,
      2,
    );

    expect(result.strategy).toBe('no-safe-fallback');
    expect(result.images).toHaveLength(0);
  });

  it('prefers an exact Apex TMDb match over Apex Predator', async () => {
    mockExtractSubjectMatter.mockResolvedValue({
      analysis: {
        primarySubject: {
          name: 'Apex',
          type: 'movie',
          status: 'released',
        },
        secondarySubjects: [
          { name: 'Netflix', type: 'studio', relevance: 'high' },
        ],
        contextType: 'trailer',
        imagePreferences: [],
      },
    });
    mockApiGet.mockResolvedValue({
      success: true,
      data: [
        {
          id: 7,
          mediaType: 'movie',
          title: 'Apex Predator',
          backdrop: 'https://tmdb.example/apex-predator-backdrop.jpg',
          poster: 'https://tmdb.example/apex-predator-poster.jpg',
          releaseDate: '2025-05-01',
        },
        {
          id: 8,
          mediaType: 'movie',
          title: 'Apex',
          backdrop: 'https://tmdb.example/apex-2026-backdrop.jpg',
          poster: 'https://tmdb.example/apex-2026-poster.jpg',
          releaseDate: '2026-01-01',
        },
      ],
    });

    const { enrichArticleWithImages } = await import('../../lib/rss/image-enrichment');
    const result = await enrichArticleWithImages(
      {
        title: "Netflix has released the trailer for 'Apex'",
        description: '',
      },
      null,
      2,
    );

    expect(result.strategy).toBe('project-led');
    expect(result.images[0]?.url).toBe('https://tmdb.example/apex-2026-backdrop.jpg');
  });

  it('blocks ambiguous generic-title project art for announcement stories like Time Out', async () => {
    mockExtractSubjectMatter.mockResolvedValue({
      analysis: {
        primarySubject: {
          name: 'Time Out',
          type: 'movie',
          status: 'development',
        },
        secondarySubjects: [
          { name: 'Adam Sandler', type: 'actor', relevance: 'high' },
          { name: 'Netflix', type: 'studio', relevance: 'high' },
        ],
        contextType: 'announcement',
        imagePreferences: [],
      },
    });
    mockApiGet.mockResolvedValue({
      success: true,
      data: [
        {
          id: 9,
          mediaType: 'movie',
          title: 'Time Out',
          backdrop: 'https://tmdb.example/time-out-backdrop.jpg',
          poster: 'https://tmdb.example/time-out-poster.jpg',
          releaseDate: '2004-01-01',
        },
      ],
    });
    mockSelectSmartImages.mockResolvedValue({
      images: [],
      confidence: 0,
      confidenceLevel: 'low',
      analysis: {
        primarySubject: { name: 'Time Out' },
        contextType: 'announcement',
      },
      queries: [],
    });
    mockSearchSerperImagesWithRetry.mockResolvedValue([
      {
        title: 'Time Out official logo',
        imageUrl: 'https://serper.example/time-out-logo.png',
        imageWidth: 1400,
        imageHeight: 800,
        domain: 'example.com',
        position: 1,
      },
    ]);

    const { enrichArticleWithImages } = await import('../../lib/rss/image-enrichment');
    const result = await enrichArticleWithImages(
      {
        title: "Adam Sandler has set Scott Cooper's 'Time Out' as his next Netflix film.",
        description: '',
      },
      null,
      2,
    );

    expect(result.strategy).toBe('no-safe-fallback');
    expect(result.images).toHaveLength(0);
  });
});
