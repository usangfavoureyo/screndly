// ============================================================================
// TMDB POSTS CONTEXT TESTS
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TMDbPostsProvider, useTMDbPosts } from '../../contexts/TMDbPostsContext';
import React from 'react';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TMDbPostsProvider>{children}</TMDbPostsProvider>
);

describe('TMDbPostsContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should add a new TMDb post', () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    act(() => {
      result.current.addPost({
        title: 'Inception',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'queued',
        platforms: ['youtube', 'x'],
        imageUrl: 'https://example.com/poster.jpg',
        caption: 'Check out this amazing movie!',
      });
    });

    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0].title).toBe('Inception');
  });

  it('should update a TMDb post', () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    let postId: string;

    act(() => {
      result.current.addPost({
        title: 'Test Movie',
        mediaType: 'movie',
        source: 'tmdb_weekly',
        status: 'queued',
        platforms: [],
      });
      postId = result.current.posts[0].id;
    });

    act(() => {
      result.current.updatePost(postId, {
        status: 'published',
        caption: 'Updated caption',
      });
    });

    expect(result.current.posts[0].status).toBe('published');
    expect(result.current.posts[0].caption).toBe('Updated caption');
  });

  it('should delete a TMDb post', () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    let postId: string;

    act(() => {
      result.current.addPost({
        title: 'Test Movie',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'queued',
        platforms: [],
      });
      postId = result.current.posts[0].id;
    });

    act(() => {
      result.current.deletePost(postId);
    });

    expect(result.current.posts).toHaveLength(0);
  });

  it('should schedule a post', () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    let postId: string;

    act(() => {
      result.current.addPost({
        title: 'Test Movie',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'queued',
        platforms: [],
      });
      postId = result.current.posts[0].id;
    });

    const scheduledDate = new Date('2025-12-25');
    const scheduledTime = '14:30';

    act(() => {
      result.current.schedulePost(postId, scheduledDate, scheduledTime);
    });

    expect(result.current.posts[0].status).toBe('scheduled');
    expect(result.current.posts[0].scheduledDate).toEqual(scheduledDate);
    expect(result.current.posts[0].scheduledTime).toBe(scheduledTime);
  });

  it('should reschedule a post', () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    let postId: string;

    act(() => {
      result.current.addPost({
        title: 'Test Movie',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'queued',
        platforms: [],
      });
      postId = result.current.posts[0].id;
    });

    const initialDate = new Date('2025-12-25');
    const newDate = new Date('2025-12-26');

    act(() => {
      result.current.schedulePost(postId, initialDate, '14:30');
    });

    act(() => {
      result.current.reschedulePost(postId, newDate, '16:45');
    });

    expect(result.current.posts[0].scheduledDate).toEqual(newDate);
    expect(result.current.posts[0].scheduledTime).toBe('16:45');
  });

  it('should publish a post immediately', () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    let postId: string;

    act(() => {
      result.current.addPost({
        title: 'Test Movie',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'queued',
        platforms: ['youtube'],
      });
      postId = result.current.posts[0].id;
    });

    act(() => {
      result.current.publishPost(postId);
    });

    expect(result.current.posts[0].status).toBe('published');
  });

  it('should filter posts by status', () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    act(() => {
      result.current.addPost({
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'queued',
        platforms: [],
      });
      result.current.addPost({
        title: 'Movie 2',
        mediaType: 'movie',
        source: 'tmdb_weekly',
        status: 'published',
        platforms: [],
      });
      result.current.addPost({
        title: 'Movie 3',
        mediaType: 'tv',
        source: 'tmdb_monthly',
        status: 'failed',
        platforms: [],
      });
    });

    const queuedPosts = result.current.posts.filter(p => p.status === 'queued');
    const publishedPosts = result.current.posts.filter(p => p.status === 'published');
    const failedPosts = result.current.posts.filter(p => p.status === 'failed');

    expect(queuedPosts).toHaveLength(1);
    expect(publishedPosts).toHaveLength(1);
    expect(failedPosts).toHaveLength(1);
  });

  it('should filter posts by media type', () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    act(() => {
      result.current.addPost({
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'queued',
        platforms: [],
      });
      result.current.addPost({
        title: 'TV Show 1',
        mediaType: 'tv',
        source: 'tmdb_weekly',
        status: 'queued',
        platforms: [],
      });
      result.current.addPost({
        title: 'Movie 2',
        mediaType: 'movie',
        source: 'tmdb_monthly',
        status: 'queued',
        platforms: [],
      });
    });

    const movies = result.current.posts.filter(p => p.mediaType === 'movie');
    const tvShows = result.current.posts.filter(p => p.mediaType === 'tv');

    expect(movies).toHaveLength(2);
    expect(tvShows).toHaveLength(1);
  });

  it('should filter posts by source', () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    act(() => {
      result.current.addPost({
        title: 'Today Release',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'queued',
        platforms: [],
      });
      result.current.addPost({
        title: 'Weekly Release',
        mediaType: 'movie',
        source: 'tmdb_weekly',
        status: 'queued',
        platforms: [],
      });
      result.current.addPost({
        title: 'Monthly Release',
        mediaType: 'movie',
        source: 'tmdb_monthly',
        status: 'queued',
        platforms: [],
      });
      result.current.addPost({
        title: 'Anniversary',
        mediaType: 'movie',
        source: 'tmdb_anniversary',
        status: 'queued',
        platforms: [],
      });
    });

    const todayPosts = result.current.posts.filter(p => p.source === 'tmdb_today');
    const weeklyPosts = result.current.posts.filter(p => p.source === 'tmdb_weekly');
    const monthlyPosts = result.current.posts.filter(p => p.source === 'tmdb_monthly');
    const anniversaryPosts = result.current.posts.filter(p => p.source === 'tmdb_anniversary');

    expect(todayPosts).toHaveLength(1);
    expect(weeklyPosts).toHaveLength(1);
    expect(monthlyPosts).toHaveLength(1);
    expect(anniversaryPosts).toHaveLength(1);
  });

  it('should persist posts to localStorage', () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    act(() => {
      result.current.addPost({
        title: 'Persisted Movie',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'queued',
        platforms: ['youtube'],
      });
    });

    const stored = localStorage.getItem('screndly_tmdb_posts');
    expect(stored).toBeTruthy();
    
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Persisted Movie');
  });

  it('should load posts from localStorage', () => {
    const mockPosts = [
      {
        id: 'post1',
        title: 'Loaded Movie',
        mediaType: 'movie' as const,
        source: 'tmdb_today' as const,
        status: 'published' as const,
        timestamp: new Date().toISOString(),
        platforms: ['youtube'],
      },
    ];

    localStorage.setItem('screndly_tmdb_posts', JSON.stringify(mockPosts));

    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0].title).toBe('Loaded Movie');
  });

  it('should handle bulk delete', () => {
    const { result } = renderHook(() => useTMDbPosts(), { wrapper });

    let postIds: string[] = [];

    act(() => {
      result.current.addPost({
        title: 'Movie 1',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'published',
        platforms: [],
      });
      result.current.addPost({
        title: 'Movie 2',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'published',
        platforms: [],
      });
      result.current.addPost({
        title: 'Movie 3',
        mediaType: 'movie',
        source: 'tmdb_today',
        status: 'queued',
        platforms: [],
      });
      
      postIds = result.current.posts.slice(0, 2).map(p => p.id);
    });

    act(() => {
      postIds.forEach(id => result.current.deletePost(id));
    });

    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0].title).toBe('Movie 3');
  });
});
