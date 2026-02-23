// ============================================================================
// TMDB API SERVICE
// ============================================================================
// Handles all TMDb (The Movie Database) API interactions

import { apiClient } from './client';
import { TMDbMovie, TMDbSearchRequest, TMDbFeed, ApiResponse, PaginatedResponse } from './types';

export class TMDbApi {
  /**
   * Search for movies
   */
  async searchMovies(request: TMDbSearchRequest): Promise<ApiResponse<PaginatedResponse<TMDbMovie>>> {
    return apiClient.get<PaginatedResponse<TMDbMovie>>('/tmdb/search/movie', {
      headers: {
        'X-Query': request.query,
        'X-Page': String(request.page || 1),
        'X-Year': request.year ? String(request.year) : '',
      },
    });
  }

  /**
   * Get movie details
   */
  async getMovie(movieId: number): Promise<ApiResponse<TMDbMovie>> {
    return apiClient.get<TMDbMovie>(`/tmdb/movies/${movieId}`);
  }

  /**
   * Get upcoming movies
   */
  async getUpcoming(page: number = 1): Promise<ApiResponse<PaginatedResponse<TMDbMovie>>> {
    return apiClient.get<PaginatedResponse<TMDbMovie>>('/tmdb/movies/upcoming', {
      headers: { 'X-Page': String(page) },
    });
  }

  /**
   * Get now playing movies
   */
  async getNowPlaying(page: number = 1): Promise<ApiResponse<PaginatedResponse<TMDbMovie>>> {
    return apiClient.get<PaginatedResponse<TMDbMovie>>('/tmdb/movies/now_playing', {
      headers: { 'X-Page': String(page) },
    });
  }

  /**
   * Get popular movies
   */
  async getPopular(page: number = 1): Promise<ApiResponse<PaginatedResponse<TMDbMovie>>> {
    return apiClient.get<PaginatedResponse<TMDbMovie>>('/tmdb/movies/popular', {
      headers: { 'X-Page': String(page) },
    });
  }

  /**
   * Get top rated movies
   */
  async getTopRated(page: number = 1): Promise<ApiResponse<PaginatedResponse<TMDbMovie>>> {
    return apiClient.get<PaginatedResponse<TMDbMovie>>('/tmdb/movies/top_rated', {
      headers: { 'X-Page': String(page) },
    });
  }

  /**
   * Get trending movies
   */
  async getTrending(timeWindow: 'day' | 'week' = 'week'): Promise<ApiResponse<TMDbMovie[]>> {
    return apiClient.get<TMDbMovie[]>(`/tmdb/trending/movie/${timeWindow}`);
  }

  /**
   * Get movie anniversaries for a specific date
   */
  async getAnniversaries(date: Date, yearsAgo: number[] = [10, 20, 30, 40, 50]): Promise<ApiResponse<TMDbMovie[]>> {
    return apiClient.post<TMDbMovie[]>('/tmdb/anniversaries', {
      date: date.toISOString(),
      yearsAgo,
    });
  }

  /**
   * Get configured TMDb feeds
   */
  async getFeeds(): Promise<ApiResponse<TMDbFeed[]>> {
    return apiClient.get<TMDbFeed[]>('/tmdb/feeds');
  }

  /**
   * Create a new TMDb feed
   */
  async createFeed(feed: Omit<TMDbFeed, 'id'>): Promise<ApiResponse<TMDbFeed>> {
    return apiClient.post<TMDbFeed>('/tmdb/feeds', feed);
  }

  /**
   * Update a TMDb feed
   */
  async updateFeed(id: string, updates: Partial<TMDbFeed>): Promise<ApiResponse<TMDbFeed>> {
    return apiClient.patch<TMDbFeed>(`/tmdb/feeds/${id}`, updates);
  }

  /**
   * Delete a TMDb feed
   */
  async deleteFeed(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/tmdb/feeds/${id}`);
  }

  /**
   * Trigger feed manually
   */
  async triggerFeed(id: string): Promise<ApiResponse<{ moviesFound: number }>> {
    return apiClient.post<{ moviesFound: number }>(`/tmdb/feeds/${id}/trigger`);
  }

  /**
   * Get image URL for TMDb poster/backdrop
   */
  getImageUrl(path: string, size: 'small' | 'medium' | 'large' | 'original' = 'medium'): string {
    const sizeMap = {
      small: 'w200',
      medium: 'w500',
      large: 'w780',
      original: 'original',
    };
    
    return `https://image.tmdb.org/t/p/${sizeMap[size]}${path}`;
  }
}

export const tmdbApi = new TMDbApi();
