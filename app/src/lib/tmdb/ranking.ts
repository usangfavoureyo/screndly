/**
 * TMDb Ranking & Scoring System
 * 
 * Advanced scoring algorithm for prioritizing content
 * Based on popularity, trending, genre match, studio, and hype
 */

import { TMDbMovie, TMDbTVShow, hasMajorStudio, APPROVED_GENRE_IDS_SET } from './filters';

export interface ScoredItem {
  item: TMDbMovie | TMDbTVShow;
  score: number;
  breakdown: {
    popularityScore: number;
    trendingScore: number;
    genreScore: number;
    studioBonus: number;
    voteCountPenalty: number;
    collectionBonus: number;
    hypeScore: number;
  };
  rank: number;
}

/**
 * 9. Ranking Model
 * 
 * Scoring = (weighted) popularity + trending_rank + genre_match_score + 
 *           studio_bonus - penalty_for_low_vote_count + hype_factor
 */
export function calculateScore(
  item: TMDbMovie | TMDbTVShow,
  options: {
    trendingRank?: number;
    upcomingRank?: number;
    feedType: 'today' | 'weekly' | 'monthly' | 'anniversary';
  }
): ScoredItem {
  const { trendingRank, upcomingRank, feedType } = options;
  
  // 1. Popularity Score (0-100 points)
  let popularityScore = Math.min(item.popularity * 0.5, 100);
  
  // Weight by feed type
  if (feedType === 'today') {
    popularityScore *= 1.5; // Today feeds prioritize popularity
  } else if (feedType === 'weekly') {
    popularityScore *= 1.2;
  }
  
  // 2. Trending Score (0-50 points)
  let trendingScore = 0;
  if (trendingRank) {
    // Lower rank = higher score
    trendingScore = Math.max(0, 50 - (trendingRank / 3));
  }
  if (upcomingRank) {
    const upcomingScore = Math.max(0, 50 - (upcomingRank / 5));
    trendingScore = Math.max(trendingScore, upcomingScore);
  }
  
  // 3. Genre Match Score (0-30 points)
  let genreScore = 0;
  const genreCount = item.genre_ids.filter(id => APPROVED_GENRE_IDS_SET.has(id)).length;
  genreScore = Math.min(genreCount * 10, 30);
  
  // Bonus for high-demand genres
  const highDemandGenres = [28, 16, 878, 27, 14]; // Action, Animation, Sci-Fi, Horror, Fantasy
  const hasHighDemand = item.genre_ids.some(id => highDemandGenres.includes(id));
  if (hasHighDemand) {
    genreScore += 10;
  }
  
  // 4. Studio Bonus (0-40 points)
  let studioBonus = 0;
  if (hasMajorStudio(item)) {
    studioBonus = 40;
    
    // Extra bonus for top studios
    const topStudios = ['Marvel', 'Disney', 'Warner Bros', 'Universal', 'Pixar'];
    if (item.production_companies) {
      const hasTopStudio = item.production_companies.some(company =>
        topStudios.some(studio => company.name.includes(studio))
      );
      if (hasTopStudio) {
        studioBonus += 20;
      }
    }
  }
  
  // 5. Vote Count Penalty (0 to -30 points)
  let voteCountPenalty = 0;
  if (item.vote_count < 500) {
    voteCountPenalty = -30;
  } else if (item.vote_count < 1000) {
    voteCountPenalty = -15;
  } else if (item.vote_count < 2000) {
    voteCountPenalty = -5;
  }
  
  // 6. Collection/Franchise Bonus (0-25 points)
  let collectionBonus = 0;
  if ('belongs_to_collection' in item && item.belongs_to_collection) {
    collectionBonus = 25; // Franchise member = higher priority
  }
  
  // 7. Hype Factor (0-35 points)
  let hypeScore = 0;
  
  // Based on vote average (quality indicator)
  if (item.vote_average >= 8.0) {
    hypeScore += 20;
  } else if (item.vote_average >= 7.0) {
    hypeScore += 10;
  } else if (item.vote_average >= 6.0) {
    hypeScore += 5;
  }
  
  // Based on release recency (for today/weekly)
  if (feedType === 'today' || feedType === 'weekly') {
    const releaseDate = 'release_date' in item ? item.release_date : item.first_air_date;
    if (releaseDate) {
      const daysUntilRelease = Math.floor(
        (new Date(releaseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      if (Math.abs(daysUntilRelease) <= 7) {
        hypeScore += 15; // Releasing very soon or just released
      }
    }
  }
  
  // Total Score
  const totalScore = 
    popularityScore +
    trendingScore +
    genreScore +
    studioBonus +
    voteCountPenalty +
    collectionBonus +
    hypeScore;
  
  return {
    item,
    score: Math.max(0, totalScore),
    breakdown: {
      popularityScore,
      trendingScore,
      genreScore,
      studioBonus,
      voteCountPenalty,
      collectionBonus,
      hypeScore
    },
    rank: 0 // Will be assigned after sorting
  };
}

/**
 * 11. Posting Prioritization
 * 
 * If more qualifying content exists than available posting slots:
 * Blockbuster rating > trending velocity > vote count > hype factor > 
 * collection/franchise membership
 */
export function prioritizeItems(
  scoredItems: ScoredItem[],
  maxItems: number
): ScoredItem[] {
  // Sort by total score (descending)
  const sorted = [...scoredItems].sort((a, b) => b.score - a.score);
  
  // Assign ranks
  sorted.forEach((item, index) => {
    item.rank = index + 1;
  });
  
  // Apply tie-breaking rules
  const tieBreaker = (a: ScoredItem, b: ScoredItem): number => {
    // If scores are equal, apply priority rules
    if (Math.abs(a.score - b.score) < 0.1) {
      // 1. Blockbuster rating (vote_average * vote_count)
      const aBlockbuster = a.item.vote_average * Math.log10(a.item.vote_count + 1);
      const bBlockbuster = b.item.vote_average * Math.log10(b.item.vote_count + 1);
      if (aBlockbuster !== bBlockbuster) {
        return bBlockbuster - aBlockbuster;
      }
      
      // 2. Trending velocity (higher popularity = faster trending)
      if (a.item.popularity !== b.item.popularity) {
        return b.item.popularity - a.item.popularity;
      }
      
      // 3. Vote count
      if (a.item.vote_count !== b.item.vote_count) {
        return b.item.vote_count - a.item.vote_count;
      }
      
      // 4. Hype factor (vote_average)
      if (a.item.vote_average !== b.item.vote_average) {
        return b.item.vote_average - a.item.vote_average;
      }
      
      // 5. Collection/franchise membership
      const aHasCollection = 'belongs_to_collection' in a.item && a.item.belongs_to_collection;
      const bHasCollection = 'belongs_to_collection' in b.item && b.item.belongs_to_collection;
      if (aHasCollection && !bHasCollection) return -1;
      if (!aHasCollection && bHasCollection) return 1;
    }
    
    return b.score - a.score;
  };
  
  // Final sort with tie-breaker
  const finalSorted = sorted.sort(tieBreaker);
  
  // Return top N items
  return finalSorted.slice(0, maxItems);
}

/**
 * Get blockbuster rating (for prioritization)
 */
export function getBlockbusterRating(item: TMDbMovie | TMDbTVShow): number {
  // Combine vote average and vote count (logarithmic scale for count)
  return item.vote_average * Math.log10(item.vote_count + 1);
}

/**
 * Get trending velocity (rate of popularity increase)
 */
export function getTrendingVelocity(item: TMDbMovie | TMDbTVShow): number {
  // Use popularity as proxy (in real system, track change over time)
  return item.popularity;
}

/**
 * Get hype factor
 */
export function getHypeFactor(item: TMDbMovie | TMDbTVShow): number {
  let hype = 0;
  
  // Vote average contribution
  hype += item.vote_average * 10;
  
  // Popularity contribution
  hype += Math.min(item.popularity * 0.5, 50);
  
  // Collection bonus
  if ('belongs_to_collection' in item && item.belongs_to_collection) {
    hype += 25;
  }
  
  // Major studio bonus
  if (hasMajorStudio(item)) {
    hype += 15;
  }
  
  return hype;
}

/**
 * Calculate confidence score for a set of items
 */
export function calculateConfidence(items: ScoredItem[]): number {
  if (items.length === 0) return 0;
  
  const avgScore = items.reduce((sum, item) => sum + item.score, 0) / items.length;
  const avgVoteCount = items.reduce((sum, item) => sum + item.item.vote_count, 0) / items.length;
  
  // Confidence based on score and vote count
  const scoreConfidence = Math.min(avgScore / 300, 1); // 300 = max expected score
  const voteConfidence = Math.min(avgVoteCount / 5000, 1); // 5000 = high vote count
  
  return Math.round((scoreConfidence * 0.6 + voteConfidence * 0.4) * 100);
}

/**
 * Get human-readable score breakdown
 */
export function formatScoreBreakdown(scored: ScoredItem): string {
  const { breakdown } = scored;
  
  return `
Total Score: ${scored.score.toFixed(1)}

Breakdown:
• Popularity: ${breakdown.popularityScore.toFixed(1)} pts
• Trending: ${breakdown.trendingScore.toFixed(1)} pts
• Genre Match: ${breakdown.genreScore.toFixed(1)} pts
• Studio Bonus: ${breakdown.studioBonus.toFixed(1)} pts
• Vote Count: ${breakdown.voteCountPenalty.toFixed(1)} pts
• Collection: ${breakdown.collectionBonus.toFixed(1)} pts
• Hype Factor: ${breakdown.hypeScore.toFixed(1)} pts
  `.trim();
}
