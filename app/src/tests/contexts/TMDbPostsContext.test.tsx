import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TMDbPostsProvider,
  type TMDbPost,
  useTMDbPosts,
} from '../../contexts/TMDbPostsContext';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../lib/api/client', () => ({
  apiClient: apiClientMock,
}));

vi.mock('../../lib/tmdb', () => ({
  getSettingsForBackend: vi.fn(() => ({ timezone: 'UTC' })),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TMDbPostsProvider>{children}</TMDbPostsProvider>
);

function createPost(overrides: Partial<TMDbPost> = {}): TMDbPost {
  return {
    id: overrides.id ?? 'post-1',
    tmdbId: overrides.tmdbId ?? 550,
    mediaType: overrides.mediaType ?? 'movie',
    title: overrides.title ?? 'Fight Club',
    year: overrides.year ?? 1999,
    releaseDate: overrides.releaseDate ?? '1999-10-15',
    caption: overrides.caption ?? 'A cult classic worth revisiting.',
    imageUrl: overrides.imageUrl ?? 'https://example.com/poster.jpg',
    imageType: overrides.imageType ?? 'poster',
    scheduledTime: overrides.scheduledTime ?? '2026-03-12T12:00:00.000Z',
    source: overrides.source ?? 'tmdb_today',
    cast: overrides.cast ?? ['Brad Pitt'],
    popularity: overrides.popularity ?? 90,
    cacheHit: overrides.cacheHit ?? false,
    status: overrides.status ?? 'queued',
    platforms: overrides.platforms ?? ['x'],
    publishedTime: overrides.publishedTime,
    errorMessage: overrides.errorMessage,
    createdAt: overrides.createdAt ?? '2026-03-12T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-12T00:00:00.000Z',
  };
}

describe('TMDbPostsContext', () => {
  let backendPosts: TMDbPost[];

  beforeEach(() => {
    backendPosts = [];
    localStorage.clear();
    vi.clearAllMocks();

    apiClientMock.get.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/api/tmdb/posts') {
        return { success: true, data: [...backendPosts] };
      }

      return { success: true, data: null };
    });

    apiClientMock.post.mockImplementation(async (endpoint: string, payload?: TMDbPost) => {
      if (endpoint === '/api/tmdb/posts' && payload) {
        backendPosts = [payload, ...backendPosts];
        return { success: true, data: payload };
      }

      if (endpoint === '/api/tmdb/refresh') {
        return { success: true, data: { added: 0, errors: [] } };
      }

      return { success: true, data: null };
    });

    apiClientMock.put.mockImplementation(async (endpoint: string, updates: Partial<TMDbPost>) => {
      const postId = endpoint.split('/').pop()!;
      backendPosts = backendPosts.map((post) =>
        post.id === postId ? { ...post, ...updates } : post
      );

      return { success: true, data: backendPosts.find((post) => post.id === postId) };
    });

    apiClientMock.delete.mockImplementation(async (endpoint: string) => {
      const postId = endpoint.split('/').pop()!;
      backendPosts = backendPosts.filter((post) => post.id !== postId);
      return { success: true, data: null };
    });
  });

  it('fetches posts from the backend on mount and caches them locally', async () => {
    backendPosts = [createPost({ id: 'post-loaded', title: 'Loaded Movie' })];

    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0].title).toBe('Loaded Movie');
    expect(JSON.parse(localStorage.getItem('screndlyTMDbPosts') ?? '[]')).toHaveLength(1);
  });

  it('adds a post locally without waiting for a backend fetch', async () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const draftPost = createPost({ id: 'post-local', title: 'Inception' });

    await act(async () => {
      await result.current.addPost(draftPost);
    });

    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0].title).toBe('Inception');
  });

  it('updates a post and syncs the changes to the backend', async () => {
    backendPosts = [createPost({ id: 'post-update', title: 'Before Update' })];

    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    await waitFor(() => expect(result.current.posts).toHaveLength(1));

    await act(async () => {
      await result.current.updatePost('post-update', {
        title: 'After Update',
        caption: 'Updated caption text',
      });
    });

    expect(result.current.posts[0].title).toBe('After Update');
    expect(result.current.posts[0].caption).toBe('Updated caption text');
    expect(backendPosts[0].title).toBe('After Update');
  });

  it('sanitizes injected source links from backend TMDb captions', async () => {
    backendPosts = [
      createPost({
        id: 'post-caption-link',
        source: 'tmdb_weekly',
        releaseDate: '2026-04-14',
        caption:
          "'Margo's Got Money Troubles' premieres this week on April 14 with Elle Fanning. (apple.com) (https://www.apple.com/tv-pr/news/2026/02/apple-tv-reveals-teaser-for-margos-got-money-troubles/?utm_source=openai)",
      }),
    ];

    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    await waitFor(() => expect(result.current.posts).toHaveLength(1));

    expect(result.current.posts[0].caption).toContain("Margo's Got Money Troubles");
    expect(result.current.posts[0].caption).not.toMatch(/https?:\/\//i);
    expect(result.current.posts[0].caption).not.toMatch(/\bapple\.com\b/i);
  });

  it('sanitizes injected source links when updating a TMDb caption', async () => {
    backendPosts = [createPost({ id: 'post-update-caption' })];

    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    await waitFor(() => expect(result.current.posts).toHaveLength(1));

    await act(async () => {
      await result.current.updatePost('post-update-caption', {
        caption:
          "'The Testaments' premieres today. (newsweek.com) https://www.newsweek.com/entertainment/testaments-season-1-episode-1-release-date?utm_source=openai",
      });
    });

    expect(result.current.posts[0].caption).toBe("'The Testaments' premieres today.");
    expect(backendPosts[0].caption).toBe("'The Testaments' premieres today.");
  });

  it('schedules and reschedules a post', async () => {
    backendPosts = [createPost({ id: 'post-schedule', status: 'queued' })];

    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    await waitFor(() => expect(result.current.posts).toHaveLength(1));

    await act(async () => {
      await result.current.schedulePost({
        ...result.current.posts[0],
        scheduledTime: '2026-03-13T14:30:00.000Z',
      });
    });

    expect(result.current.posts[0].status).toBe('scheduled');
    expect(result.current.posts[0].scheduledTime).toBe('2026-03-13T14:30:00.000Z');

    await act(async () => {
      await result.current.reschedulePost('post-schedule', '2026-03-14T16:45:00.000Z');
    });

    expect(result.current.posts[0].scheduledTime).toBe('2026-03-14T16:45:00.000Z');
  });

  it('deletes a post optimistically and syncs with the backend', async () => {
    backendPosts = [createPost({ id: 'post-delete', title: 'Delete Me' })];

    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    await waitFor(() => expect(result.current.posts).toHaveLength(1));

    await act(async () => {
      await result.current.deletePost('post-delete');
    });

    expect(result.current.posts).toHaveLength(0);
    expect(backendPosts).toHaveLength(0);
  });

  it('falls back to cached localStorage posts when the backend request fails', async () => {
    localStorage.setItem(
      'screndlyTMDbPosts',
      JSON.stringify([createPost({ id: 'post-cached', title: 'Cached Movie' })])
    );

    apiClientMock.get.mockRejectedValueOnce(new Error('Backend unavailable'));

    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0].title).toBe('Cached Movie');
    expect(result.current.error).toBe('Backend unavailable');
  });
});
