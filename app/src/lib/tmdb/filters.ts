/**
 * TMDb Filtering System
 * 
 * US-focused, high-popularity Hollywood content filtering
 * Rejects low-profile, indie, regional, and non-genre content
 */

export interface TMDbMovie {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  origin_country?: string[];
  production_companies?: Array<{ id: number; name: string }>;
  belongs_to_collection?: { id: number; name: string } | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  adult: boolean;
  video: boolean;
  budget?: number;
  revenue?: number;
  runtime?: number;
}

export interface TMDbTVShow {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  origin_country?: string[];
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  networks?: Array<{ id: number; name: string }>;
  production_companies?: Array<{ id: number; name: string }>;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  type?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
}

// APPROVED GENRES (ID mapping from TMDb API)
export const APPROVED_GENRE_IDS = {
  // Movies
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  27: 'Horror',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  53: 'Thriller',
  
  // TV
  10759: 'Action & Adventure',
  10762: 'Kids',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap', // Will be rejected by type filter
  10767: 'Talk', // Will be rejected by type filter
  10768: 'War & Politics'
};

export const APPROVED_GENRE_IDS_SET = new Set([
  28, 12, 16, 35, 18, 10751, 14, 27, 9648, 10749, 878, 53, // Movies
  10759, 10762, 10765, 10768 // TV (excluding soap/talk)
]);

// REJECTED GENRES
export const REJECTED_GENRE_IDS = new Set([
  99, // Documentary
  37, // Western
  36, // History
  10752, // War (standalone)
  10402, // Music
  10770, // TV Movie
]);

// REJECTED TV TYPES
export const REJECTED_TV_TYPES = new Set([
  'Reality',
  'Talk Show',
  'News',
  'Documentary',
  'Miniseries', // Unless high popularity
  'Scripted', // Check case-by-case
]);

// MAJOR STUDIOS & DISTRIBUTORS (prioritized)
export const MAJOR_STUDIOS = [
  'Warner Bros',
  'Walt Disney',
  'Disney',
  'Marvel Studios',
  'Marvel',
  'DC Entertainment',
  'DC Films',
  'Universal Pictures',
  'Paramount Pictures',
  'Paramount',
  'Netflix',
  'Amazon Studios',
  'Amazon',
  'Prime Video',
  'HBO',
  'HBO Max',
  'Apple TV+',
  'Apple',
  'Hulu',
  'Sony Pictures',
  'Columbia Pictures',
  '20th Century Studios',
  '20th Century Fox',
  'Lionsgate',
  'MGM',
  'DreamWorks',
  'Pixar',
  'Lucasfilm',
  'A24', // Exception: quality indie
  'Searchlight',
  'Focus Features',
  'New Line Cinema',
  'Legendary',
  'Blumhouse'
];

// REJECTED KEYWORDS (in title or overview)
export const REJECTED_KEYWORDS = [
  'documentary',
  'docuseries',
  'behind the scenes',
  'making of',
  'indie',
  'festival',
  'student film',
  'short film',
  'stage recording',
  'broadway',
  'live recording',
  'concert',
  'stand-up',
  'sports',
  'wrestling',
  'ufc',
  'nba',
  'nfl',
  'reality',
  'competition',
  'gameshow',
  'cooking show',
  'talent show',
  'dating show',
  'telenovela',
  'soap opera',
  'direct-to-video',
  'straight to video',
  'fan film',
  'fan-made',
  'unofficial',
  'parody'
];

/**
 * 1. Region Filter - US Only
 */
export function isUSContent(item: TMDbMovie | TMDbTVShow): boolean {
  // Check production_countries
  if (item.production_countries && item.production_countries.length > 0) {
    const hasUS = item.production_countries.some(
      country => country.iso_3166_1 === 'US'
    );
    if (hasUS) return true;
  }
  
  // Check origin_country
  if (item.origin_country && item.origin_country.length > 0) {
    const hasUS = item.origin_country.includes('US') || item.origin_country.includes('USA');
    if (hasUS) return true;
  }
  
  return false;
}

/**
 * 2. Popularity Threshold
 */
export function meetsPopularityThreshold(
  item: TMDbMovie | TMDbTVShow,
  feedType: 'today' | 'weekly' | 'monthly' | 'anniversary'
): boolean {
  const { popularity, vote_count } = item;
  
  // Minimum popularity by feed type
  if (feedType === 'today' || feedType === 'weekly') {
    if (popularity < 25) return false;
  } else if (feedType === 'monthly') {
    if (popularity < 40) return false;
  } else if (feedType === 'anniversary') {
    if (popularity < 25) return false;
  }
  
  // Vote count requirement (if already released)
  const releaseDate = 'release_date' in item ? item.release_date : item.first_air_date;
  const isReleased = releaseDate && new Date(releaseDate) <= new Date();
  
  if (isReleased && vote_count < 300) {
    return false;
  }
  
  return true;
}

/**
 * 3. Genre Filter
 */
export function hasApprovedGenres(item: TMDbMovie | TMDbTVShow): boolean {
  const { genre_ids } = item;
  
  if (!genre_ids || genre_ids.length === 0) return false;
  
  // Check if any genre is rejected
  const hasRejectedGenre = genre_ids.some(id => REJECTED_GENRE_IDS.has(id));
  if (hasRejectedGenre) return false;
  
  // Check if at least one genre is approved
  const hasApprovedGenre = genre_ids.some(id => APPROVED_GENRE_IDS_SET.has(id));
  if (!hasApprovedGenre) return false;
  
  return true;
}

/**
 * 4. Studio / Distributor Validation
 */
export function hasMajorStudio(item: TMDbMovie | TMDbTVShow): boolean {
  // Check production_companies
  if (item.production_companies && item.production_companies.length > 0) {
    const hasMajor = item.production_companies.some(company =>
      MAJOR_STUDIOS.some(studio => 
        company.name.toLowerCase().includes(studio.toLowerCase())
      )
    );
    if (hasMajor) return true;
  }
  
  // Check networks (TV shows)
  if ('networks' in item && item.networks && item.networks.length > 0) {
    const hasMajor = item.networks.some(network =>
      MAJOR_STUDIOS.some(studio => 
        network.name.toLowerCase().includes(studio.toLowerCase())
      )
    );
    if (hasMajor) return true;
  }
  
  // Check belongs_to_collection (Movies)
  if ('belongs_to_collection' in item && item.belongs_to_collection) {
    return true; // Part of a collection = franchise = prioritized
  }
  
  return false;
}

/**
 * 5. Poster Quality Requirement
 */
export function hasSufficientImageQuality(item: TMDbMovie | TMDbTVShow): boolean {
  // Must have poster
  if (!item.poster_path) return false;
  
  // TMDb poster paths are high quality by default (w500, w780, original)
  // We assume original is >= 1000px width
  // If we had actual image dimensions, we'd check:
  // poster_width >= 1000 && backdrop_width >= 1280
  
  // For now, just check that both exist
  return item.poster_path !== null && item.backdrop_path !== null;
}

/**
 * 6. Title Eligibility Rules
 */
export function isEligibleTitle(item: TMDbMovie | TMDbTVShow): boolean {
  const title = 'title' in item ? item.title : item.name;
  const overview = item.overview || '';
  
  const combined = `${title} ${overview}`.toLowerCase();
  
  // Check for rejected keywords
  const hasRejectedKeyword = REJECTED_KEYWORDS.some(keyword =>
    combined.includes(keyword)
  );
  
  if (hasRejectedKeyword) return false;
  
  // TV Show specific checks
  if ('type' in item) {
    const tvType = item.type || '';
    if (REJECTED_TV_TYPES.has(tvType)) return false;
  }
  
  // Movie specific checks
  if ('video' in item && item.video === true) {
    // Likely a straight-to-video release
    return false;
  }
  
  // Check runtime (movies)
  if ('runtime' in item && item.runtime) {
    if (item.runtime < 60) return false; // Too short (likely a short film)
  }
  
  // Check number of episodes (TV)
  if ('number_of_episodes' in item && item.number_of_episodes) {
    if (item.number_of_episodes < 3) return false; // Too short (miniseries/pilot)
  }
  
  return true;
}

/**
 * 7. Trending Confirmation Layer
 */
export function meetsTrendingThreshold(
  item: TMDbMovie | TMDbTVShow,
  feedType: 'today' | 'weekly' | 'monthly' | 'anniversary',
  trendingRank?: number,
  upcomingRank?: number
): boolean {
  if (feedType === 'today' || feedType === 'weekly') {
    // Accept if trending/week ranking <= 150 OR upcoming ranking <= 250
    if (trendingRank && trendingRank <= 150) return true;
    if (upcomingRank && upcomingRank <= 250) return true;
    
    // If no ranking data, use popularity as proxy
    if (!trendingRank && !upcomingRank) {
      return item.popularity >= 50; // Higher bar without ranking
    }
    
    return false;
  }
  
  if (feedType === 'monthly') {
    // Accept if ranking <= 300 across upcoming API
    if (upcomingRank && upcomingRank <= 300) return true;
    
    // Fallback to popularity
    if (!upcomingRank) {
      return item.popularity >= 60;
    }
    
    return false;
  }
  
  if (feedType === 'anniversary') {
    // Anniversary items must have been popular/notable
    return item.vote_count >= 1000 && item.vote_average >= 6.5;
  }
  
  return false;
}

/**
 * 8. Anniversary Feed Smart Rules
 */
export function isEligibleAnniversary(item: TMDbMovie | TMDbTVShow): boolean {
  // Must pass all standard filters
  if (!isUSContent(item)) return false;
  if (!hasApprovedGenres(item)) return false;
  if (!isEligibleTitle(item)) return false;
  
  // Anniversary-specific rules
  if (item.vote_count < 1000) return false; // Must be well-known
  if (item.vote_average < 6.5) return false; // Must be well-received
  
  // Check if it was a major release (budget for movies)
  if ('budget' in item && item.budget && item.budget < 10000000) {
    // Low budget (<$10M) - likely indie
    return false;
  }
  
  return true;
}

/**
 * Master Filter - Apply All Rules
 */
export function applyAllFilters(
  item: TMDbMovie | TMDbTVShow,
  feedType: 'today' | 'weekly' | 'monthly' | 'anniversary',
  options: {
    trendingRank?: number;
    upcomingRank?: number;
  } = {}
): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  // 1. Region Filter
  if (!isUSContent(item)) {
    reasons.push('Not US content');
    return { pass: false, reasons };
  }
  
  // 2. Popularity Threshold
  if (!meetsPopularityThreshold(item, feedType)) {
    reasons.push(`Popularity ${item.popularity} below threshold for ${feedType}`);
    return { pass: false, reasons };
  }
  
  // 3. Genre Filter
  if (!hasApprovedGenres(item)) {
    reasons.push('Genre not approved or rejected genre present');
    return { pass: false, reasons };
  }
  
  // 4. Studio / Distributor (not required but gives bonus)
  const hasMajor = hasMajorStudio(item);
  if (!hasMajor && item.popularity < 50) {
    reasons.push('Not major studio and popularity < 50');
    return { pass: false, reasons };
  }
  
  // 5. Poster Quality
  if (!hasSufficientImageQuality(item)) {
    reasons.push('Insufficient image quality (missing poster or backdrop)');
    return { pass: false, reasons };
  }
  
  // 6. Title Eligibility
  if (!isEligibleTitle(item)) {
    reasons.push('Title contains rejected keywords or type');
    return { pass: false, reasons };
  }
  
  // 7. Trending Confirmation
  if (!meetsTrendingThreshold(item, feedType, options.trendingRank, options.upcomingRank)) {
    reasons.push('Does not meet trending threshold');
    return { pass: false, reasons };
  }
  
  // 8. Anniversary-specific rules
  if (feedType === 'anniversary') {
    if (!isEligibleAnniversary(item)) {
      reasons.push('Does not meet anniversary eligibility');
      return { pass: false, reasons };
    }
  }
  
  reasons.push('Passed all filters ✓');
  return { pass: true, reasons };
}
