/**
 * TMDb Deduplication System
 * 
 * Feed-aware deduplication with progressive countdown support:
 * - Within same feed: 30-day block
 * - Across different feeds: 7-day minimum gap
 * - Allows Monthly → Weekly → Today progression
 */

import { TMDbPost } from '../../contexts/TMDbPostsContext';

/**
 * Duplicate Prevention Rules:
 * 
 * A. Within the same feed:
 *    - Block reposting the same movie for 30 days
 * 
 * B. Across different feeds:
 *    - Allow reposting after minimum 7-day gap
 *    - Enables Monthly → Weekly → Today progression
 * 
 * Explicitly Allowed:
 *    - Monthly post → Weekly post (≥7 days later)
 *    - Weekly post → Today post (≥7 days later)
 * 
 * Explicitly Blocked:
 *    - Monthly + Weekly on same day
 *    - Same movie twice in Weekly within 30 days
 *    - Same movie twice in Monthly within 30 days
 */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  conflictingPost?: TMDbPost;
  daysSinceLastPost?: number;
}

/**
 * Check if a title was posted recently (feed-aware)
 */
export function isDuplicateTitle(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  proposedFeedType: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary',
  existingPosts: TMDbPost[],
  windowDays: number = 30
): DuplicateCheckResult {
  const now = Date.now();
  
  // Find posts for this title
  const matchingPosts = existingPosts.filter(
    post => post.tmdbId === tmdbId && post.mediaType === mediaType
  );
  
  if (matchingPosts.length === 0) {
    return { isDuplicate: false };
  }
  
  // Check each matching post
  for (const post of matchingPosts) {
    const postTime = new Date(post.scheduledTime).getTime();
    const daysSince = Math.floor((now - postTime) / (24 * 60 * 60 * 1000));
    
    // Skip if post is in the future
    if (postTime > now) continue;
    
    // Feed-aware deduplication logic
    const isSameFeed = post.source === proposedFeedType;
    
    if (isSameFeed) {
      // Within same feed: 30-day block
      const sameFeedWindowMs = 30 * 24 * 60 * 60 * 1000;
      if (now - postTime < sameFeedWindowMs) {
        return {
          isDuplicate: true,
          reason: `Posted in ${post.source} ${daysSince} days ago (same feed, 30-day block)`,
          conflictingPost: post,
          daysSinceLastPost: daysSince
        };
      }
    } else {
      // Across different feeds: 7-day minimum gap
      const crossFeedWindowMs = 7 * 24 * 60 * 60 * 1000;
      if (now - postTime < crossFeedWindowMs) {
        return {
          isDuplicate: true,
          reason: `Posted in ${post.source} ${daysSince} days ago (cross-feed, 7-day gap required)`,
          conflictingPost: post,
          daysSinceLastPost: daysSince
        };
      }
    }
  }
  
  return { isDuplicate: false };
}

/**
 * Check anniversary-specific rules
 * 
 * Anniversary posts cannot override Today/Weekly/Monthly posts 
 * for the same title within 60 days
 */
export function canPostAnniversary(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  existingPosts: TMDbPost[]
): DuplicateCheckResult {
  const now = Date.now();
  const windowMs = 60 * 24 * 60 * 60 * 1000; // 60 days
  
  // Find recent non-anniversary posts for this title
  const recentPosts = existingPosts.filter(
    post =>
      post.tmdbId === tmdbId &&
      post.mediaType === mediaType &&
      post.source !== 'tmdb_anniversary' &&
      now - new Date(post.scheduledTime).getTime() < windowMs
  );
  
  if (recentPosts.length > 0) {
    const mostRecent = recentPosts[0];
    const daysSince = Math.floor(
      (now - new Date(mostRecent.scheduledTime).getTime()) / (24 * 60 * 60 * 1000)
    );
    
    return {
      isDuplicate: true,
      reason: `Cannot post anniversary: ${mostRecent.source} post exists from ${daysSince} days ago (60-day block)`,
      conflictingPost: mostRecent,
      daysSinceLastPost: daysSince
    };
  }
  
  return { isDuplicate: false };
}

/**
 * Deduplicate a list of candidate posts
 */
export function deduplicateCandidates(
  candidates: Array<{
    tmdbId: number;
    mediaType: 'movie' | 'tv';
    source: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary';
    scheduledTime: string;
    [key: string]: any;
  }>,
  existingPosts: TMDbPost[]
): Array<{
  item: any;
  kept: boolean;
  reason: string;
}> {
  const results: Array<{ item: any; kept: boolean; reason: string }> = [];
  const seen = new Map<string, any>(); // Track tmdbId_mediaType
  
  for (const candidate of candidates) {
    const key = `${candidate.tmdbId}_${candidate.mediaType}`;
    
    // Check if already seen in current batch
    if (seen.has(key)) {
      results.push({
        item: candidate,
        kept: false,
        reason: 'Duplicate in current batch (earlier occurrence kept)'
      });
      continue;
    }
    
    // Check against existing posts
    const windowDays = candidate.source === 'tmdb_anniversary' ? 60 : 30;
    const duplicateCheck = isDuplicateTitle(
      candidate.tmdbId,
      candidate.mediaType,
      candidate.source,
      existingPosts,
      windowDays
    );
    
    if (duplicateCheck.isDuplicate) {
      results.push({
        item: candidate,
        kept: false,
        reason: duplicateCheck.reason || 'Duplicate found'
      });
      continue;
    }
    
    // Anniversary-specific check
    if (candidate.source === 'tmdb_anniversary') {
      const anniversaryCheck = canPostAnniversary(
        candidate.tmdbId,
        candidate.mediaType,
        existingPosts
      );
      
      if (anniversaryCheck.isDuplicate) {
        results.push({
          item: candidate,
          kept: false,
          reason: anniversaryCheck.reason || 'Anniversary blocked by recent post'
        });
        continue;
      }
    }
    
    // Keep this candidate
    seen.set(key, candidate);
    results.push({
      item: candidate,
      kept: true,
      reason: 'Passed deduplication checks'
    });
  }
  
  return results;
}

/**
 * Get time until a title can be posted again
 */
export function getTimeUntilNextPost(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  existingPosts: TMDbPost[],
  windowDays: number = 30
): { canPost: boolean; daysRemaining?: number } {
  const matchingPosts = existingPosts.filter(
    post => post.tmdbId === tmdbId && post.mediaType === mediaType
  );
  
  if (matchingPosts.length === 0) {
    return { canPost: true };
  }
  
  // Find most recent post
  const mostRecent = matchingPosts.reduce((latest, post) => {
    const postTime = new Date(post.scheduledTime).getTime();
    const latestTime = new Date(latest.scheduledTime).getTime();
    return postTime > latestTime ? post : latest;
  });
  
  const postTime = new Date(mostRecent.scheduledTime).getTime();
  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const timeElapsed = now - postTime;
  
  if (timeElapsed >= windowMs) {
    return { canPost: true };
  }
  
  const daysRemaining = Math.ceil((windowMs - timeElapsed) / (24 * 60 * 60 * 1000));
  
  return {
    canPost: false,
    daysRemaining
  };
}

/**
 * Get deduplication statistics
 */
export function getDeduplicationStats(
  candidates: any[],
  existingPosts: TMDbPost[]
): {
  total: number;
  kept: number;
  removed: number;
  removalReasons: Record<string, number>;
} {
  const results = deduplicateCandidates(candidates, existingPosts);
  
  const stats = {
    total: results.length,
    kept: results.filter(r => r.kept).length,
    removed: results.filter(r => !r.kept).length,
    removalReasons: {} as Record<string, number>
  };
  
  // Count removal reasons
  results.forEach(result => {
    if (!result.kept) {
      const reason = result.reason.split(':')[0]; // Get first part of reason
      stats.removalReasons[reason] = (stats.removalReasons[reason] || 0) + 1;
    }
  });
  
  return stats;
}

/**
 * Clean up old posts (optional utility)
 */
export function cleanupOldPosts(
  posts: TMDbPost[],
  retentionDays: number = 90
): TMDbPost[] {
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  
  return posts.filter(post => {
    const postTime = new Date(post.scheduledTime).getTime();
    return postTime >= cutoffTime;
  });
}