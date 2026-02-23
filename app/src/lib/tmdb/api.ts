/**
 * TMDb API Integration
 * 
 * Fetches movies and TV shows from The Movie Database API
 * with comprehensive filtering and ranking
 */

import type { TMDbMovie, TMDbTVShow } from './filters';
import { applyAllFilters } from './filters';
import { calculateScore, prioritizeItems, type ScoredItem } from './ranking';
import { deduplicateCandidates } from './deduplication';
import type { TMDbPost } from '../../contexts/TMDbPostsContext';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';

export interface TMDbFetchOptions {
  apiKey: string;
  feedType: 'today' | 'weekly' | 'monthly' | 'anniversary';
  maxItems?: number; // Max items per category (movies/TV). User-configurable via TMDb Settings -> todayMaxItems / weeklyMaxItems / monthlyMaxItems / anniversaryMaxItems
  region?: string;
  existingPosts?: TMDbPost[];
}

export interface TMDbFetchResult {
  items: ScoredItem[];
  filtered: {
    total: number;
    passed: number;
    failed: number;
    reasons: Record<string, number>;
  };
  confidence: number;
}

/**
 * Fetch today's releases (US only)
 */
export async function fetchTodayReleases(
  options: TMDbFetchOptions
): Promise<TMDbFetchResult> {
  const today = new Date().toISOString().split('T')[0];
  
  // Fetch movies releasing today
  const moviesUrl = `${TMDB_API_BASE}/discover/movie?api_key=${options.apiKey}&region=US&primary_release_date.gte=${today}&primary_release_date.lte=${today}&sort_by=popularity.desc&page=1`;
  
  // Fetch TV shows releasing today
  const tvUrl = `${TMDB_API_BASE}/discover/tv?api_key=${options.apiKey}&region=US&first_air_date.gte=${today}&first_air_date.lte=${today}&sort_by=popularity.desc&page=1`;
  
  const [moviesRes, tvRes] = await Promise.all([
    fetch(moviesUrl).then(r => r.json()),
    fetch(tvUrl).then(r => r.json())
  ]);
  
  const movies: TMDbMovie[] = moviesRes.results || [];
  const tvShows: TMDbTVShow[] = tvRes.results || [];
  
  return processAndRank([...movies, ...tvShows], options);
}

/**
 * Fetch weekly releases (next 7 days, US only)
 */
export async function fetchWeeklyReleases(
  options: TMDbFetchOptions
): Promise<TMDbFetchResult> {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const todayStr = today.toISOString().split('T')[0];
  const nextWeekStr = nextWeek.toISOString().split('T')[0];
  
  // Fetch movies
  const moviesUrl = `${TMDB_API_BASE}/discover/movie?api_key=${options.apiKey}&region=US&primary_release_date.gte=${todayStr}&primary_release_date.lte=${nextWeekStr}&sort_by=popularity.desc&page=1`;
  
  // Fetch TV shows
  const tvUrl = `${TMDB_API_BASE}/discover/tv?api_key=${options.apiKey}&region=US&first_air_date.gte=${todayStr}&first_air_date.lte=${nextWeekStr}&sort_by=popularity.desc&page=1`;
  
  const [moviesRes, tvRes] = await Promise.all([
    fetch(moviesUrl).then(r => r.json()),
    fetch(tvUrl).then(r => r.json())
  ]);
  
  const movies: TMDbMovie[] = moviesRes.results || [];
  const tvShows: TMDbTVShow[] = tvRes.results || [];
  
  return processAndRank([...movies, ...tvShows], options);
}

/**
 * Fetch monthly previews (next month, US only)
 */
export async function fetchMonthlyPreviews(
  options: TMDbFetchOptions
): Promise<TMDbFetchResult> {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  
  const startStr = nextMonth.toISOString().split('T')[0];
  const endStr = endOfNextMonth.toISOString().split('T')[0];
  
  // Fetch movies
  const moviesUrl = `${TMDB_API_BASE}/discover/movie?api_key=${options.apiKey}&region=US&primary_release_date.gte=${startStr}&primary_release_date.lte=${endStr}&sort_by=popularity.desc&page=1`;
  
  // Fetch TV shows
  const tvUrl = `${TMDB_API_BASE}/discover/tv?api_key=${options.apiKey}&region=US&first_air_date.gte=${startStr}&first_air_date.lte=${endStr}&sort_by=popularity.desc&page=1`;
  
  const [moviesRes, tvRes] = await Promise.all([
    fetch(moviesUrl).then(r => r.json()),
    fetch(tvUrl).then(r => r.json())
  ]);
  
  const movies: TMDbMovie[] = moviesRes.results || [];
  const tvShows: TMDbTVShow[] = tvRes.results || [];
  
  return processAndRank([...movies, ...tvShows], options);
}

/**
 * Fetch anniversaries (movies/TV released exactly N years ago today)
 */
export async function fetchAnniversaries(
  options: TMDbFetchOptions,
  years: number[] = [1, 2, 3, 5, 10, 15, 20, 25]
): Promise<TMDbFetchResult> {
  const today = new Date();
  const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const allItems: (TMDbMovie | TMDbTVShow)[] = [];
  
  // Fetch for each anniversary year
  for (const year of years) {
    const anniversaryYear = today.getFullYear() - year;
    const dateStr = `${anniversaryYear}-${todayMD}`;
    
    // Fetch movies
    const moviesUrl = `${TMDB_API_BASE}/discover/movie?api_key=${options.apiKey}&region=US&primary_release_date.gte=${dateStr}&primary_release_date.lte=${dateStr}&sort_by=popularity.desc&page=1`;
    
    // Fetch TV shows
    const tvUrl = `${TMDB_API_BASE}/discover/tv?api_key=${options.apiKey}&region=US&first_air_date.gte=${dateStr}&first_air_date.lte=${dateStr}&sort_by=popularity.desc&page=1`;
    
    try {
      const [moviesRes, tvRes] = await Promise.all([
        fetch(moviesUrl).then(r => r.json()),
        fetch(tvUrl).then(r => r.json())
      ]);
      
      const movies: TMDbMovie[] = moviesRes.results || [];
      const tvShows: TMDbTVShow[] = tvRes.results || [];
      
      allItems.push(...movies, ...tvShows);
    } catch (error) {
      console.error(`Failed to fetch ${year}-year anniversaries:`, error);
    }
  }
  
  return processAndRank(allItems, options);
}

/**
 * Enrich item with additional details (cast, production companies, etc.)
 */
async function enrichItem(
  item: TMDbMovie | TMDbTVShow,
  apiKey: string
): Promise<TMDbMovie | TMDbTVShow> {
  const mediaType = 'title' in item ? 'movie' : 'tv';
  const detailsUrl = `${TMDB_API_BASE}/${mediaType}/${item.id}?api_key=${apiKey}&append_to_response=credits`;
  
  try {
    const response = await fetch(detailsUrl);
    const details = await response.json();
    
    // Merge additional details
    return {
      ...item,
      production_countries: details.production_countries,
      production_companies: details.production_companies,
      belongs_to_collection: 'belongs_to_collection' in details ? details.belongs_to_collection : undefined,
      networks: 'networks' in details ? details.networks : undefined,
      budget: 'budget' in details ? details.budget : undefined,
      revenue: 'revenue' in details ? details.revenue : undefined,
      runtime: 'runtime' in details ? details.runtime : undefined,
      number_of_seasons: 'number_of_seasons' in details ? details.number_of_seasons : undefined,
      number_of_episodes: 'number_of_episodes' in details ? details.number_of_episodes : undefined,
      type: 'type' in details ? details.type : undefined
    };
  } catch (error) {
    console.error(`Failed to enrich item ${item.id}:`, error);
    return item;
  }
}

/**
 * Process and rank items with comprehensive filtering
 */
async function processAndRank(
  items: (TMDbMovie | TMDbTVShow)[],
  options: TMDbFetchOptions
): Promise<TMDbFetchResult> {
  const { apiKey, feedType, maxItems = 5, existingPosts = [] } = options;
  
  // Enrich items with additional details (in batches)
  const enrichedItems = await Promise.all(
    items.slice(0, 50).map(item => enrichItem(item, apiKey)) // Limit to first 50 to save API calls
  );
  
  // Apply filters
  const filterResults = enrichedItems.map(item => ({
    item,
    result: applyAllFilters(item, feedType, {
      // In production, fetch trending rank from TMDb trending endpoint
      trendingRank: undefined,
      upcomingRank: undefined
    })
  }));
  
  // Track filter statistics
  const filterStats = {
    total: filterResults.length,
    passed: 0,
    failed: 0,
    reasons: {} as Record<string, number>
  };
  
  filterResults.forEach(({ result }) => {
    if (result.pass) {
      filterStats.passed++;
    } else {
      filterStats.failed++;
      result.reasons.forEach(reason => {
        filterStats.reasons[reason] = (filterStats.reasons[reason] || 0) + 1;
      });
    }
  });
  
  // Get items that passed filters
  const passedItems = filterResults
    .filter(({ result }) => result.pass)
    .map(({ item }) => item);
  
  // Calculate scores
  const scoredItems = passedItems.map(item =>
    calculateScore(item, { feedType, trendingRank: undefined, upcomingRank: undefined })
  );
  
  // Prioritize and select top N
  const topItems = prioritizeItems(scoredItems, maxItems);
  
  // Deduplicate against existing posts
  const candidates = topItems.map(scored => ({
    tmdbId: scored.item.id,
    mediaType: ('title' in scored.item ? 'movie' : 'tv') as 'movie' | 'tv',
    source: `tmdb_${feedType}` as any,
    scheduledTime: new Date().toISOString(),
    ...scored
  }));
  
  const dedupeResults = deduplicateCandidates(candidates, existingPosts);
  const finalItems = dedupeResults
    .filter(r => r.kept)
    .map(r => r.item);
  
  // Calculate confidence
  const confidence = calculateConfidence(finalItems);
  
  return {
    items: finalItems,
    filtered: filterStats,
    confidence
  };
}

/**
 * Calculate confidence based on scores
 */
function calculateConfidence(items: ScoredItem[]): number {
  if (items.length === 0) return 0;
  
  const avgScore = items.reduce((sum, item) => sum + item.score, 0) / items.length;
  const avgVoteCount = items.reduce((sum, item) => sum + item.item.vote_count, 0) / items.length;
  
  const scoreConfidence = Math.min(avgScore / 300, 1);
  const voteConfidence = Math.min(avgVoteCount / 5000, 1);
  
  return Math.round((scoreConfidence * 0.6 + voteConfidence * 0.4) * 100);
}

/**
 * Test API connection
 */
export async function testTMDbConnection(apiKey: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch(
      `${TMDB_API_BASE}/configuration?api_key=${apiKey}`
    );
    
    if (response.ok) {
      return {
        success: true,
        message: 'TMDb API connection successful'
      };
    } else {
      return {
        success: false,
        message: `TMDb API error: ${response.status} ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}