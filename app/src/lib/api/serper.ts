/**
 * Serper API Integration
 * 
 * Provides Google Image Search functionality via Serper.dev API
 * All requests are proxied through backend for secure API key handling
 * Documentation: https://serper.dev/docs
 */

import { apiClient } from './client';

export interface SerperImageResult {
  title: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  thumbnailUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
  source: string;
  domain: string;
  link: string;
  position: number;
}

export interface SerperSearchParams {
  q: string;                    // Search query
  num?: number;                 // Number of results (default: 10, max: 100)
  gl?: string;                  // Country code (e.g., "us", "uk")
  hl?: string;                  // Language (e.g., "en", "es")
  autocorrect?: boolean;        // Auto-correct spelling (default: true)
  page?: number;                // Page number for pagination
  type?: 'images';              // Search type
  engine?: 'google';            // Search engine
}

export interface SerperResponse {
  images: SerperImageResult[];
  searchParameters: {
    q: string;
    gl: string;
    hl: string;
    num: number;
    type: string;
    engine: string;
  };
}

/**
 * Search Google Images via Serper API (Backend Proxy)
 */
export async function searchSerperImages(
  query: string,
  options: Partial<SerperSearchParams> = {}
): Promise<SerperImageResult[]> {
  // Check if backend is available
  if (!apiClient.isBackendAvailable()) {
    // Return empty array silently when backend is not configured
    return [];
  }

  const params: SerperSearchParams = {
    q: query,
    num: options.num || 10,
    gl: options.gl || 'us',
    hl: options.hl || 'en',
    autocorrect: options.autocorrect !== false,
    page: options.page || 1,
    type: 'images',
    engine: 'google'
  };

  try {
    // Call backend proxy (backend handles API key from database)
    const response = await apiClient.post<SerperResponse>('/api/serper/images', params);

    if (response.success && response.data) {
      return response.data.images || [];
    }

    throw new Error(response.error?.message || 'Serper API request failed');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not configured')) {
        throw new Error('Serper API key not configured. Please add your API key in Settings → API Keys.');
      }
      throw error;
    }
    throw new Error('Serper API error: Unknown error');
  }
}

/**
 * Search web results via Serper API (Backend Proxy)
 */
export async function searchSerperWeb(
  query: string,
  options: Partial<SerperSearchParams> = {}
): Promise<any[]> {
  const params = {
    q: query,
    num: options.num || 10,
    gl: options.gl || 'us',
    hl: options.hl || 'en',
    autocorrect: options.autocorrect !== false,
    page: options.page || 1,
  };

  try {
    // Call backend proxy (backend handles API key from database)
    const response = await apiClient.post<any>('/api/serper/search', params);

    if (response.success && response.data) {
      return response.data.organic || [];
    }

    throw new Error(response.error?.message || 'Serper API request failed');
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Serper API error: Unknown error');
  }
}

/**
 * Search with retry logic (exponential backoff)
 */
export async function searchSerperImagesWithRetry(
  query: string,
  options: Partial<SerperSearchParams> = {},
  maxRetries: number = 3
): Promise<SerperImageResult[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await searchSerperImages(query, options);
    } catch (error) {
      // Don't retry on authentication errors
      if (error instanceof Error && error.message.includes('not configured')) {
        throw error;
      }

      // Last attempt - throw error
      if (attempt === maxRetries - 1) {
        throw error;
      }

      // Wait with exponential backoff (1s, 2s, 4s)
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Serper API retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return [];
}

/**
 * Test Serper API connection
 */
export async function testSerperConnection(): Promise<{
  success: boolean;
  message: string;
  sampleResults?: number;
}> {
  try {
    const results = await searchSerperImages('test movie poster', { num: 5 });
    
    return {
      success: true,
      message: `Serper API connected successfully. Found ${results.length} test results.`,
      sampleResults: results.length
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error testing Serper API'
    };
  }
}
