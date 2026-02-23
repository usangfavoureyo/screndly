// ============================================================================
// RSS FEEDS CONTEXT TESTS
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { RSSFeedsProvider, useRSSFeeds } from '../../contexts/RSSFeedsContext';
import React from 'react';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RSSFeedsProvider>{children}</RSSFeedsProvider>
);

describe('RSSFeedsContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should add a new RSS feed', () => {
    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    act(() => {
      result.current.addFeed({
        name: 'Test Feed',
        url: 'https://example.com/feed.xml',
        enabled: true,
        interval: 15,
        keywords: ['trailer', 'teaser'],
        platforms: ['youtube', 'x'],
      });
    });

    expect(result.current.feeds).toHaveLength(1);
    expect(result.current.feeds[0].name).toBe('Test Feed');
  });

  it('should update an RSS feed', () => {
    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    let feedId: string;

    act(() => {
      result.current.addFeed({
        name: 'Original Name',
        url: 'https://example.com/feed.xml',
        enabled: true,
        interval: 15,
        keywords: [],
        platforms: [],
      });
      feedId = result.current.feeds[0].id;
    });

    act(() => {
      result.current.updateFeed(feedId, {
        name: 'Updated Name',
        interval: 30,
      });
    });

    expect(result.current.feeds[0].name).toBe('Updated Name');
    expect(result.current.feeds[0].interval).toBe(30);
  });

  it('should delete an RSS feed', () => {
    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    let feedId: string;

    act(() => {
      result.current.addFeed({
        name: 'Test Feed',
        url: 'https://example.com/feed.xml',
        enabled: true,
        interval: 15,
        keywords: [],
        platforms: [],
      });
      feedId = result.current.feeds[0].id;
    });

    act(() => {
      result.current.deleteFeed(feedId);
    });

    expect(result.current.feeds).toHaveLength(0);
  });

  it('should toggle feed enabled state', () => {
    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    let feedId: string;

    act(() => {
      result.current.addFeed({
        name: 'Test Feed',
        url: 'https://example.com/feed.xml',
        enabled: true,
        interval: 15,
        keywords: [],
        platforms: [],
      });
      feedId = result.current.feeds[0].id;
    });

    act(() => {
      result.current.toggleFeed(feedId);
    });

    expect(result.current.feeds[0].enabled).toBe(false);

    act(() => {
      result.current.toggleFeed(feedId);
    });

    expect(result.current.feeds[0].enabled).toBe(true);
  });

  it('should update feed stats', () => {
    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    let feedId: string;

    act(() => {
      result.current.addFeed({
        name: 'Test Feed',
        url: 'https://example.com/feed.xml',
        enabled: true,
        interval: 15,
        keywords: [],
        platforms: [],
      });
      feedId = result.current.feeds[0].id;
    });

    act(() => {
      result.current.updateFeedStats(feedId, {
        itemsFound: 10,
        itemsProcessed: 5,
        lastError: 'Network error',
      });
    });

    expect(result.current.feeds[0].itemsFound).toBe(10);
    expect(result.current.feeds[0].itemsProcessed).toBe(5);
    expect(result.current.feeds[0].lastError).toBe('Network error');
  });

  it('should persist feeds to localStorage', () => {
    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    act(() => {
      result.current.addFeed({
        name: 'Persisted Feed',
        url: 'https://example.com/feed.xml',
        enabled: true,
        interval: 15,
        keywords: [],
        platforms: [],
      });
    });

    const stored = localStorage.getItem('screndly_rss_feeds');
    expect(stored).toBeTruthy();
    
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Persisted Feed');
  });

  it('should load feeds from localStorage', () => {
    const mockFeeds = [
      {
        id: 'feed1',
        name: 'Loaded Feed',
        url: 'https://example.com/feed.xml',
        enabled: true,
        interval: 15,
        keywords: ['test'],
        platforms: ['youtube'],
        itemsFound: 0,
        itemsProcessed: 0,
      },
    ];

    localStorage.setItem('screndly_rss_feeds', JSON.stringify(mockFeeds));

    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    expect(result.current.feeds).toHaveLength(1);
    expect(result.current.feeds[0].name).toBe('Loaded Feed');
  });

  it('should handle multiple feeds', () => {
    const { result } = renderHook(() => useRSSFeeds(), { wrapper });

    act(() => {
      result.current.addFeed({
        name: 'Feed 1',
        url: 'https://example.com/feed1.xml',
        enabled: true,
        interval: 15,
        keywords: [],
        platforms: [],
      });

      result.current.addFeed({
        name: 'Feed 2',
        url: 'https://example.com/feed2.xml',
        enabled: true,
        interval: 30,
        keywords: [],
        platforms: [],
      });

      result.current.addFeed({
        name: 'Feed 3',
        url: 'https://example.com/feed3.xml',
        enabled: false,
        interval: 60,
        keywords: [],
        platforms: [],
      });
    });

    expect(result.current.feeds).toHaveLength(3);
    expect(result.current.feeds.filter(f => f.enabled)).toHaveLength(2);
  });
});
