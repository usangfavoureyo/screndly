/**
 * Unified Web Search API Integration
 * 
 * Supports both Google Search Console and Serper.dev APIs
 * for enhanced AI context in Video Studio
 * All requests are proxied through backend for secure API key handling
 */

import { apiClient } from './client';

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  displayUrl?: string;
}

export interface WebSearchResponse {
  results: WebSearchResult[];
  query: string;
  provider: 'google' | 'serper';
  totalResults: number;
}

/**
 * Search using Google Custom Search API (Backend Proxy)
 */
async function searchGoogle(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      num: String(Math.min(maxResults, 10)),
    });
    const response = await apiClient.get<any>(`/api/google-search?${params.toString()}`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Google Search API request failed');
    }

    if (!response.data.items || response.data.items.length === 0) {
      return [];
    }

    return response.data.items.map((item: any) => ({
      title: item.title || '',
      snippet: item.snippet || '',
      url: item.link || '',
      displayUrl: item.displayLink || ''
    }));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not configured')) {
        throw new Error('Google Search API key not configured');
      }
      throw error;
    }
    throw new Error('Google Search API error: Unknown error');
  }
}

/**
 * Search using Serper API (Backend Proxy)
 */
async function searchSerper(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResult[]> {
  try {
    // Call backend proxy (backend handles API key from database)
    const response = await apiClient.post<any>('/api/serper/search', {
      q: query,
      num: Math.min(maxResults, 10)
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Serper API request failed');
    }

    const results: WebSearchResult[] = [];

    // Extract organic results
    if (response.data.organic) {
      results.push(...response.data.organic.slice(0, maxResults).map((item: any) => ({
        title: item.title || '',
        snippet: item.snippet || '',
        url: item.link || '',
        displayUrl: item.displayedLink || item.link || ''
      })));
    }

    // Extract knowledge graph if available (useful for movies/TV shows)
    if (response.data.knowledgeGraph) {
      const kg = response.data.knowledgeGraph;
      results.unshift({
        title: kg.title || '',
        snippet: kg.description || '',
        url: kg.website || kg.descriptionLink || '',
        displayUrl: 'Knowledge Graph'
      });
    }

    return results;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not configured')) {
        throw new Error('Serper API key not configured');
      }
      throw error;
    }
    throw new Error('Serper API error: Unknown error');
  }
}

/**
 * Unified web search function
 * Automatically selects the appropriate API based on settings
 */
export async function performWebSearch(
  query: string,
  provider: 'google' | 'serper',
  config?: {
    maxResults?: number;
  }
): Promise<WebSearchResponse> {
  const maxResults = config?.maxResults || 5;

  let results: WebSearchResult[] = [];

  if (provider === 'google') {
    results = await searchGoogle(query, maxResults);
  } else if (provider === 'serper') {
    results = await searchSerper(query, maxResults);
  } else {
    throw new Error(`Unknown search provider: ${provider}`);
  }

  return {
    results,
    query,
    provider,
    totalResults: results.length
  };
}

/**
 * Build context string from search results for AI prompts
 */
export function formatSearchResultsForPrompt(results: WebSearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  return results.map((result, index) => {
    return `${index + 1}. ${result.title}
   ${result.snippet}
   Source: ${result.displayUrl || result.url}`;
  }).join('\n\n');
}

/**
 * Create a search query optimized for movie/TV scene information
 */
export function buildSceneSearchQuery(
  movieTitle: string,
  userQuery: string,
  includeKeywords: string[] = ['scene', 'timestamp', 'plot', 'summary']
): string {
  const keywords = includeKeywords.join(' ');
  return `"${movieTitle}" ${userQuery} ${keywords}`;
}
