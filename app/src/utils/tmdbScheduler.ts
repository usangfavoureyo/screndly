/**
 * Smart TMDb Auto-Posting Scheduler
 * 
 * Schedules TMDb feeds with intelligent spacing to prevent overlap
 * and ensure optimal posting times throughout the day.
 */

interface TMDbFeed {
  id: string;
  source: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary';
  scheduledTime?: string;
  tmdbId: number;
  title: string;
}

interface SchedulingConfig {
  today: {
    hoursApart: number; // 3 hours apart
    postsPerDay: number; // Based on number of feeds (top 5 movies + top 5 TV = 10 max)
  };
  weekly: {
    postsPerDay: number; // 2-3 per day depending on amount
  };
  monthly: {
    postsPerDay: number; // 1-3 per day depending on amount
  };
  anniversary: {
    postsPerDay: number; // 2-3 per day depending on amount
  };
  minGapMinutes: number; // Minimum 60 minutes between ANY posts
}

const DEFAULT_CONFIG: SchedulingConfig = {
  today: {
    hoursApart: 3,
    postsPerDay: 10, // 5 movies + 5 TV shows
  },
  weekly: {
    postsPerDay: 3, // 2-3 per day
  },
  monthly: {
    postsPerDay: 2, // 1-3 per day
  },
  anniversary: {
    postsPerDay: 3, // 2-3 per day
  },
  minGapMinutes: 60, // 1 hour minimum between posts
};

/**
 * Get optimal posting times for a given day
 * Spreads posts throughout waking hours (8 AM - 11 PM)
 */
function getOptimalPostingTimes(count: number, baseDate: Date): Date[] {
  const times: Date[] = [];
  const startHour = 8; // 8 AM
  const endHour = 23; // 11 PM
  const totalHours = endHour - startHour;

  if (count === 0) return times;
  if (count === 1) {
    // Single post at 12 PM (noon)
    const time = new Date(baseDate);
    time.setHours(12, 0, 0, 0);
    return [time];
  }

  // Distribute posts evenly throughout the day
  const interval = totalHours / (count + 1);

  for (let i = 1; i <= count; i++) {
    const time = new Date(baseDate);
    const hour = startHour + Math.floor(interval * i);
    const minute = Math.floor((interval * i % 1) * 60);
    time.setHours(hour, minute, 0, 0);
    times.push(time);
  }

  return times;
}

/**
 * Check if two posts are too close together (less than minimum gap)
 */
function areTooClose(time1: Date, time2: Date, minGapMinutes: number): boolean {
  const diffMs = Math.abs(time1.getTime() - time2.getTime());
  const diffMinutes = diffMs / (1000 * 60);
  return diffMinutes < minGapMinutes;
}

/**
 * Adjust time to avoid conflicts with existing scheduled posts
 */
function adjustTimeForConflicts(
  proposedTime: Date,
  existingTimes: Date[],
  minGapMinutes: number
): Date {
  let adjustedTime = new Date(proposedTime);
  let hasConflict = true;
  let attempts = 0;
  const maxAttempts = 20;

  while (hasConflict && attempts < maxAttempts) {
    hasConflict = false;
    
    for (const existingTime of existingTimes) {
      if (areTooClose(adjustedTime, existingTime, minGapMinutes)) {
        hasConflict = true;
        // Move forward by minGapMinutes
        adjustedTime = new Date(adjustedTime.getTime() + minGapMinutes * 60 * 1000);
        break;
      }
    }
    
    attempts++;
  }

  return adjustedTime;
}

/**
 * Schedule TODAY feeds
 * Posts 3 hours apart, all on the same day
 */
export function scheduleTodayFeeds(feeds: TMDbFeed[], baseDate: Date = new Date()): TMDbFeed[] {
  if (feeds.length === 0) return [];

  const config = DEFAULT_CONFIG;
  const scheduled: TMDbFeed[] = [];
  const startTime = new Date(baseDate);
  startTime.setHours(9, 0, 0, 0); // Start at 9 AM

  feeds.forEach((feed, index) => {
    const scheduledTime = new Date(startTime);
    scheduledTime.setHours(startTime.getHours() + (index * config.today.hoursApart));
    
    scheduled.push({
      ...feed,
      scheduledTime: scheduledTime.toISOString(),
    });
  });

  return scheduled;
}

/**
 * Schedule WEEKLY feeds
 * 2-3 posts per day spread across multiple days
 */
export function scheduleWeeklyFeeds(feeds: TMDbFeed[], baseDate: Date = new Date()): TMDbFeed[] {
  if (feeds.length === 0) return [];

  const config = DEFAULT_CONFIG;
  const scheduled: TMDbFeed[] = [];
  
  // Determine posts per day based on total count
  let postsPerDay = 2;
  if (feeds.length >= 10) postsPerDay = 3;
  else if (feeds.length >= 5) postsPerDay = 2;
  else postsPerDay = Math.min(feeds.length, 2);

  const daysNeeded = Math.ceil(feeds.length / postsPerDay);
  
  let feedIndex = 0;
  for (let day = 0; day < daysNeeded && feedIndex < feeds.length; day++) {
    const dayDate = new Date(baseDate);
    dayDate.setDate(baseDate.getDate() + day);
    
    const feedsForDay = feeds.slice(feedIndex, feedIndex + postsPerDay);
    const times = getOptimalPostingTimes(feedsForDay.length, dayDate);
    
    feedsForDay.forEach((feed, i) => {
      scheduled.push({
        ...feed,
        scheduledTime: times[i].toISOString(),
      });
    });
    
    feedIndex += postsPerDay;
  }

  return scheduled;
}

/**
 * Schedule MONTHLY feeds
 * 1-3 posts per day spread across multiple days
 */
export function scheduleMonthlyFeeds(feeds: TMDbFeed[], baseDate: Date = new Date()): TMDbFeed[] {
  if (feeds.length === 0) return [];

  const scheduled: TMDbFeed[] = [];
  
  // Determine posts per day based on total count
  let postsPerDay = 1;
  if (feeds.length >= 15) postsPerDay = 3;
  else if (feeds.length >= 8) postsPerDay = 2;
  else postsPerDay = 1;

  const daysNeeded = Math.ceil(feeds.length / postsPerDay);
  
  let feedIndex = 0;
  for (let day = 0; day < daysNeeded && feedIndex < feeds.length; day++) {
    const dayDate = new Date(baseDate);
    dayDate.setDate(baseDate.getDate() + day);
    
    const feedsForDay = feeds.slice(feedIndex, feedIndex + postsPerDay);
    const times = getOptimalPostingTimes(feedsForDay.length, dayDate);
    
    feedsForDay.forEach((feed, i) => {
      scheduled.push({
        ...feed,
        scheduledTime: times[i].toISOString(),
      });
    });
    
    feedIndex += postsPerDay;
  }

  return scheduled;
}

/**
 * Schedule ANNIVERSARY feeds
 * 2-3 posts per day, spread throughout the day
 * Only posts for items that have anniversaries on that specific day
 */
export function scheduleAnniversaryFeeds(feeds: TMDbFeed[], baseDate: Date = new Date()): TMDbFeed[] {
  if (feeds.length === 0) return [];

  const scheduled: TMDbFeed[] = [];
  
  // Determine posts per day based on total count
  let postsPerDay = 2;
  if (feeds.length >= 6) postsPerDay = 3;
  else if (feeds.length >= 3) postsPerDay = 2;
  else postsPerDay = Math.min(feeds.length, 2);

  const daysNeeded = Math.ceil(feeds.length / postsPerDay);
  
  let feedIndex = 0;
  for (let day = 0; day < daysNeeded && feedIndex < feeds.length; day++) {
    const dayDate = new Date(baseDate);
    dayDate.setDate(baseDate.getDate() + day);
    
    const feedsForDay = feeds.slice(feedIndex, feedIndex + postsPerDay);
    const times = getOptimalPostingTimes(feedsForDay.length, dayDate);
    
    feedsForDay.forEach((feed, i) => {
      scheduled.push({
        ...feed,
        scheduledTime: times[i].toISOString(),
      });
    });
    
    feedIndex += postsPerDay;
  }

  return scheduled;
}

/**
 * Master scheduler that combines all feed types and ensures no conflicts
 * Ensures minimum 1-hour gap between ANY posts regardless of type
 */
export function scheduleAllFeeds(feeds: {
  today: TMDbFeed[];
  weekly: TMDbFeed[];
  monthly: TMDbFeed[];
  anniversary: TMDbFeed[];
}): TMDbFeed[] {
  const baseDate = new Date();
  
  // Schedule each type independently
  const todayScheduled = scheduleTodayFeeds(feeds.today, baseDate);
  const weeklyScheduled = scheduleWeeklyFeeds(feeds.weekly, baseDate);
  const monthlyScheduled = scheduleMonthlyFeeds(feeds.monthly, baseDate);
  const anniversaryScheduled = scheduleAnniversaryFeeds(feeds.anniversary, baseDate);
  
  // Combine all scheduled feeds
  const allScheduled = [
    ...todayScheduled,
    ...weeklyScheduled,
    ...monthlyScheduled,
    ...anniversaryScheduled,
  ];
  
  // Sort by scheduled time
  allScheduled.sort((a, b) => {
    const timeA = new Date(a.scheduledTime!).getTime();
    const timeB = new Date(b.scheduledTime!).getTime();
    return timeA - timeB;
  });
  
  // Adjust for conflicts (ensure 60-minute minimum gaps)
  const adjustedSchedule: TMDbFeed[] = [];
  const usedTimes: Date[] = [];
  
  for (const feed of allScheduled) {
    const proposedTime = new Date(feed.scheduledTime!);
    const adjustedTime = adjustTimeForConflicts(
      proposedTime,
      usedTimes,
      DEFAULT_CONFIG.minGapMinutes
    );
    
    adjustedSchedule.push({
      ...feed,
      scheduledTime: adjustedTime.toISOString(),
    });
    
    usedTimes.push(adjustedTime);
  }
  
  return adjustedSchedule;
}

/**
 * Prevent duplicate feeds (same TMDb ID) from being scheduled close together
 */
export function deduplicateFeeds(feeds: TMDbFeed[], windowDays: number = 30): TMDbFeed[] {
  const seen = new Map<number, Date>();
  const deduplicated: TMDbFeed[] = [];
  
  // Sort by scheduled time
  const sorted = [...feeds].sort((a, b) => {
    const timeA = new Date(a.scheduledTime!).getTime();
    const timeB = new Date(b.scheduledTime!).getTime();
    return timeA - timeB;
  });
  
  for (const feed of sorted) {
    const lastSeen = seen.get(feed.tmdbId);
    
    if (lastSeen) {
      const scheduledTime = new Date(feed.scheduledTime!);
      const daysDiff = Math.abs(scheduledTime.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < windowDays) {
        // Skip this feed - it's a duplicate within the window
        continue;
      }
    }
    
    deduplicated.push(feed);
    seen.set(feed.tmdbId, new Date(feed.scheduledTime!));
  }
  
  return deduplicated;
}

/**
 * Get human-readable schedule summary
 */
export function getScheduleSummary(feeds: TMDbFeed[]): string {
  if (feeds.length === 0) return 'No feeds scheduled';
  
  const bySource = {
    today: feeds.filter(f => f.source === 'tmdb_today').length,
    weekly: feeds.filter(f => f.source === 'tmdb_weekly').length,
    monthly: feeds.filter(f => f.source === 'tmdb_monthly').length,
    anniversary: feeds.filter(f => f.source === 'tmdb_anniversary').length,
  };
  
  const parts: string[] = [];
  if (bySource.today > 0) parts.push(`${bySource.today} Today`);
  if (bySource.weekly > 0) parts.push(`${bySource.weekly} Weekly`);
  if (bySource.monthly > 0) parts.push(`${bySource.monthly} Monthly`);
  if (bySource.anniversary > 0) parts.push(`${bySource.anniversary} Anniversary`);
  
  return `${feeds.length} total feeds: ${parts.join(', ')}`;
}
