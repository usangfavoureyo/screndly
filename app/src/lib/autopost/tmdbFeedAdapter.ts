/**
 * TMDb Feed Adapter
 * 
 * Converts TMDb posts into PostCandidates and feeds them into the unified queue.
 * This is the bridge between the TMDb curation layer and the posting orchestration layer.
 * 
 * PRINCIPLE: Feeds curate eligible items. This adapter converts them to queue candidates.
 */

import { TMDbPost } from '../../contexts/TMDbPostsContext';
import { PostCandidate, postQueue, calculateUrgencyScore } from './postQueue';

/**
 * Convert TMDb post to PostCandidate
 */
export function tmdbPostToCandidate(post: TMDbPost): PostCandidate {
  const now = new Date();
  const scheduledTime = new Date(post.scheduledTime);
  
  // Calculate temporal window based on feed type
  const { earliestPostTime, latestPostTime } = calculateTemporalWindow(post);
  
  // Calculate urgency score
  const urgencyScore = calculateUrgencyScore(earliestPostTime, latestPostTime);
  
  // Get target platforms from settings
  const platforms = getTargetPlatforms(post.source);
  
  // Create deduplication key
  const dedupeKey = `tmdb_${post.tmdbId}_${post.mediaType}_${post.source}`;
  
  return {
    id: post.id,
    source: post.source,
    feedType: post.source.replace('tmdb_', '') as any,
    
    title: post.title,
    caption: post.caption,
    mediaUrl: undefined, // TMDb posts are image-based
    thumbnailUrl: post.imageUrl,
    
    earliestPostTime,
    latestPostTime,
    
    priority: 'P4', // Will be set by queue based on source
    urgencyScore,
    
    platforms,
    
    tmdbId: post.tmdbId,
    mediaType: post.mediaType,
    releaseDate: post.releaseDate,
    
    status: 'queued',
    dedupeKey,
  };
}

/**
 * Calculate posting window based on feed type
 */
function calculateTemporalWindow(post: TMDbPost): {
  earliestPostTime: Date;
  latestPostTime: Date;
} {
  const now = new Date();
  const releaseDate = new Date(post.releaseDate);
  
  switch (post.source) {
    case 'tmdb_today':
      // Can post anytime on release day
      return {
        earliestPostTime: new Date(releaseDate.setHours(6, 0, 0, 0)), // 6am on release day
        latestPostTime: new Date(releaseDate.setHours(23, 59, 59, 999)), // End of release day
      };
    
    case 'tmdb_weekly':
      // Can post 5-7 days before release
      return {
        earliestPostTime: new Date(releaseDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days before
        latestPostTime: new Date(releaseDate.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day before
      };
    
    case 'tmdb_monthly':
      // Can post anytime in the 28-day window
      return {
        earliestPostTime: now, // Can post immediately
        latestPostTime: new Date(releaseDate.getTime() - 7 * 24 * 60 * 60 * 1000), // Until weekly window starts
      };
    
    case 'tmdb_anniversary':
      // Can post on anniversary day ± 1 day
      return {
        earliestPostTime: new Date(releaseDate.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day before
        latestPostTime: new Date(releaseDate.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day after
      };
    
    default:
      // Default: post anytime in next 7 days
      return {
        earliestPostTime: now,
        latestPostTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      };
  }
}

/**
 * Get target platforms for a feed type from settings
 */
function getTargetPlatforms(source: TMDbPost['source']): string[] {
  try {
    const settings = localStorage.getItem('screndly_tmdb_settings');
    if (!settings) return ['x', 'threads']; // Default platforms
    
    const parsed = JSON.parse(settings);
    
    // Map source to platform settings key
    const platformKey = source.replace('tmdb_', '') + 'Platforms';
    const platformsConfig = parsed[platformKey];
    
    if (!platformsConfig) return ['x', 'threads'];
    
    // Extract enabled platforms
    const enabled: string[] = [];
    if (platformsConfig.x) enabled.push('x');
    if (platformsConfig.threads) enabled.push('threads');
    if (platformsConfig.facebook) enabled.push('facebook');
    if (platformsConfig.youtube) enabled.push('youtube');
    
    return enabled.length > 0 ? enabled : ['x', 'threads'];
    
  } catch (e) {
    console.error('[TMDbFeedAdapter] Failed to load platform settings:', e);
    return ['x', 'threads'];
  }
}

/**
 * Check if autopost is enabled for a feed type
 */
export function isAutopostEnabled(source: TMDbPost['source']): boolean {
  try {
    const settings = localStorage.getItem('screndly_tmdb_settings');
    if (!settings) return false;
    
    const parsed = JSON.parse(settings);
    
    // Map source to autopost toggle key
    const autopostKey = source.replace('tmdb_', '') + 'AutoPost';
    return parsed[autopostKey] === true;
    
  } catch (e) {
    console.error('[TMDbFeedAdapter] Failed to check autopost setting:', e);
    return false;
  }
}

/**
 * Feed TMDb posts into the queue (called when feed refreshes)
 * Only adds posts that have autopost enabled
 */
export function feedTMDbPostsToQueue(posts: TMDbPost[]): {
  added: number;
  skipped: number;
  skippedReasons: Record<string, number>;
} {
  const stats = {
    added: 0,
    skipped: 0,
    skippedReasons: {} as Record<string, number>,
  };
  
  posts.forEach(post => {
    // Check if autopost is enabled for this feed type
    if (!isAutopostEnabled(post.source)) {
      stats.skipped++;
      stats.skippedReasons['autopost_disabled'] = 
        (stats.skippedReasons['autopost_disabled'] || 0) + 1;
      return;
    }
    
    // Convert to candidate and add to queue
    try {
      const candidate = tmdbPostToCandidate(post);
      postQueue.addCandidate(candidate);
      stats.added++;
    } catch (e: any) {
      console.error(`[TMDbFeedAdapter] Failed to convert post ${post.id}:`, e);
      stats.skipped++;
      stats.skippedReasons['conversion_error'] = 
        (stats.skippedReasons['conversion_error'] || 0) + 1;
    }
  });
  
  console.log(`[TMDbFeedAdapter] Fed ${stats.added} posts to queue, skipped ${stats.skipped}`);
  return stats;
}

/**
 * Sync TMDb posts to queue (bulk operation)
 * Removes posts that are no longer in TMDb feed, adds new ones
 */
export function syncTMDbPostsToQueue(currentPosts: TMDbPost[]): void {
  // Get existing TMDb candidates in queue
  const existingCandidates = postQueue.getAllCandidates()
    .filter(c => c.source.startsWith('tmdb_'));
  
  // Create set of current post IDs
  const currentIds = new Set(currentPosts.map(p => p.id));
  
  // Remove candidates that are no longer in feed
  existingCandidates.forEach(candidate => {
    if (!currentIds.has(candidate.id) && candidate.status === 'queued') {
      console.log(`[TMDbFeedAdapter] Removing stale candidate: ${candidate.id}`);
      postQueue.removeCandidate(candidate.id);
    }
  });
  
  // Add new posts
  feedTMDbPostsToQueue(currentPosts);
}
