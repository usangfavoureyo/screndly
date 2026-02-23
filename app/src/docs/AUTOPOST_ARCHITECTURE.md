# Centralized Autopost Architecture

**Implementation Date:** December 31, 2024

---

## Core Principle 🎯

**Feeds decide WHAT is eligible. The Autopost Engine decides WHEN to post.**

No feed posts directly to social platforms. All content flows through a centralized queue with feed-aware prioritization and global rate governance.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CURATION LAYER                            │
│  (Passive - Produces Eligible Candidates)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TMDb Feeds              RSS Feeds         YouTube Monitors │
│  ├─ Today               ├─ Feed 1          ├─ Channel 1    │
│  ├─ Weekly              ├─ Feed 2          ├─ Channel 2    │
│  ├─ Monthly             └─ Feed 3          └─ Channel 3    │
│  └─ Anniversary                                              │
│                                                              │
│  Each applies:                                               │
│  • Filters (genre, language, popularity)                    │
│  • Feed-level max_items                                     │
│  • Feed-level deduplication (30d same, 7d cross)           │
│                                                              │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Eligible items converted to PostCandidates
             ↓
┌─────────────────────────────────────────────────────────────┐
│                    POSTING QUEUE                             │
│  (Centralized - Single Source of Truth)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PostCandidate {                                            │
│    id, source, feedType                                     │
│    title, caption, mediaUrl, thumbnailUrl                   │
│    earliestPostTime, latestPostTime                         │
│    priority, urgencyScore                                   │
│    platforms, dedupeKey                                     │
│    status: queued | scheduled | posted | failed | expired  │
│  }                                                           │
│                                                              │
│  Sorted by:                                                  │
│  1. Priority (P1 > P2 > P3 > P4)                            │
│  2. Urgency Score (temporal proximity)                      │
│                                                              │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Pulled by execution engine
             ↓
┌─────────────────────────────────────────────────────────────┐
│                 AUTOPOST ENGINE                              │
│  (Active - Orchestrates Execution)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Every X minutes (default: 15):                             │
│  1. Check if autopost enabled globally                      │
│  2. Check if in quiet hours (midnight-7am)                  │
│  3. Pull highest-priority eligible item                     │
│  4. Verify rate limits:                                     │
│     • Min gap: 180 minutes (3 hours) between ANY posts     │
│     • Max posts: 6 per day per platform                     │
│     • Platform quotas: X=50, Threads=100, FB=25, YT=10     │
│  5. Generate/validate caption                               │
│  6. Publish to target platforms                             │
│  7. Update queue status & rate counters                     │
│  8. Sleep until next tick                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Priority System

### Feed-Based Priority Assignment

| Feed Type | Priority | Reason | Example |
|-----------|----------|--------|---------|
| Today | **P1** (Highest) | Time-critical - must post on release day | Movie releases today |
| Weekly | **P2** (High) | Near-term reminder | Movie releases next week |
| Anniversary | **P3** (Medium) | Date-sensitive nostalgia | 10-year anniversary |
| Monthly | **P4** (Low) | Awareness-building | Preview of next month |
| RSS | **P2** (High) | Timely news content | Breaking entertainment news |
| YouTube | **P1** (Highest) | Creator content, time-sensitive | New video uploaded |

### Urgency Score Calculation

**Formula:** `(elapsed / totalWindow) * 100`

- **100** = Posting NOW (deadline approaching)
- **50** = Midpoint of posting window
- **0** = Not yet eligible

**Example:**
- Movie releases May 1
- Monthly feed window: April 1 - April 24 (23 days)
- On April 12: `(11 / 23) * 100 = 48% urgency`
- On April 23: `(22 / 23) * 100 = 96% urgency`

---

## Rate Governor

### Global Posting Rules

```typescript
{
  minGapBetweenPosts: 180,    // 3 hours between ANY posts
  maxPostsPerDay: 6,          // Per platform
  quietHoursStart: 0,         // Midnight
  quietHoursEnd: 7,           // 7am
  respectPlatformQuotas: true
}
```

### Platform-Specific Quotas

| Platform | Daily Limit | Why |
|----------|-------------|-----|
| X (Twitter) | 50 | Free tier API limit |
| Threads | 100 | Meta quota |
| Facebook | 25 | Meta quota |
| YouTube | 10 | Community posts limit |

### Rate Limit Enforcement

**Per-Platform Checks:**
1. Has minimum gap elapsed since last post? (default: 180 min)
2. Has daily quota been exceeded? (default: 6)
3. Is current time in quiet hours? (default: midnight-7am)

**If ANY check fails → post is delayed, not dropped**

---

## Temporal Windows

Each feed type has specific posting windows based on release date:

### Today Feed
```
earliestPostTime: 6am on release day
latestPostTime: 11:59pm on release day
```
**Urgency:** Peaks at end of day (must post before midnight)

### Weekly Feed
```
earliestPostTime: 7 days before release
latestPostTime: 1 day before release
```
**Urgency:** Gradual increase over 6-day window

### Monthly Feed
```
earliestPostTime: Immediate (when enters 28-day window)
latestPostTime: 7 days before release (before Weekly takes over)
```
**Urgency:** Slow increase over 21-day window

### Anniversary Feed
```
earliestPostTime: 1 day before anniversary
latestPostTime: 1 day after anniversary
```
**Urgency:** Peaks on exact anniversary date

---

## Progressive Countdown Support

The queue architecture fully supports progressive countdown posting:

**Example: Avengers Doomsday (May 1 release)**

| Date | Feed | Candidate Created | Priority | Earliest Post | Latest Post | Queue Behavior |
|------|------|-------------------|----------|---------------|-------------|----------------|
| Apr 1 | Monthly | ✅ | P4 | Apr 1 | Apr 24 | Added to queue, low urgency |
| Apr 8 | Monthly | ❌ | - | - | - | Dedupe blocks (same feed, <30d) |
| Apr 24 | Weekly | ✅ | P2 | Apr 24 | Apr 30 | Added (cross-feed, ≥7d gap OK) |
| May 1 | Today | ✅ | P1 | May 1 6am | May 1 11:59pm | Added (cross-feed, ≥7d gap OK) |

**Result:**
- 3 candidates in queue (Monthly, Weekly, Today)
- Monthly posts first (Apr 1-23, lowest priority but earliest window)
- Weekly posts second (Apr 24-30, higher priority)
- Today posts third (May 1, highest priority)

**Rate limiting ensures:**
- Minimum 3-hour gap between all posts
- No same-day collisions
- Respects platform quotas

---

## Autopost Toggle Semantics

### Per-Feed Toggles (TMDb Settings)

Each feed type has independent toggle:
- `todayAutoPost` (default: OFF)
- `weeklyAutoPost` (default: OFF)
- `monthlyAutoPost` (default: OFF)
- `anniversaryAutoPost` (default: OFF)

**When ON:**
- Eligible items automatically flow into queue
- Engine decides timing
- No UI action required

**When OFF:**
- Items appear in UI only
- User can manually:
  - Post now
  - Schedule for later
- Manual posts **still obey** rate limits

### Global Engine Toggle

Master switch for entire autopost system:
- **ON:** Engine runs every X minutes, processes queue
- **OFF:** Engine stops, queue pauses (items remain for manual posting)

---

## File Structure

```
/lib/autopost/
├── postQueue.ts           # Unified queue with prioritization
├── autopostEngine.ts      # Execution loop with rate governance
└── tmdbFeedAdapter.ts     # Converts TMDb posts → PostCandidates

/components/settings/
└── AutopostSettings.tsx   # UI for engine & queue management
```

---

## Integration Points

### TMDb Feed Refresh

When a TMDb feed refreshes (Today/Weekly/Monthly/Anniversary):

```typescript
import { feedTMDbPostsToQueue } from '@/lib/autopost/tmdbFeedAdapter';

// After feed refresh, convert eligible posts to queue candidates
const posts = await fetchTodayReleases({ ... });

// Only posts with autopost=ON are added
feedTMDbPostsToQueue(posts);
```

### RSS Feed Integration

```typescript
import { postQueue } from '@/lib/autopost/postQueue';

// When RSS feed finds new article
const candidate: PostCandidate = {
  id: generateId(),
  source: 'rss',
  title: article.title,
  caption: article.description,
  mediaUrl: article.imageUrl,
  earliestPostTime: new Date(), // Post ASAP
  latestPostTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h window
  priority: 'P2',
  urgencyScore: 80, // High urgency for news
  platforms: ['x', 'threads'],
  dedupeKey: `rss_${article.url}`,
  status: 'queued',
};

postQueue.addCandidate(candidate);
```

### YouTube Channel Monitor

```typescript
// When new video detected
const candidate: PostCandidate = {
  id: generateId(),
  source: 'youtube',
  title: video.title,
  caption: `New video: ${video.title}`,
  mediaUrl: video.url,
  thumbnailUrl: video.thumbnail,
  earliestPostTime: new Date(), // Post immediately
  latestPostTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h window
  priority: 'P1',
  urgencyScore: 100, // Maximum urgency
  platforms: ['x', 'threads', 'facebook'],
  dedupeKey: `youtube_${video.id}`,
  status: 'queued',
};

postQueue.addCandidate(candidate);
```

---

## Benefits

### ✅ No Content Pile-Ups
- Single queue with strict spacing (3-hour gaps)
- Max 6 posts per day per platform
- Quiet hours enforcement

### ✅ Intelligent Prioritization
- Today beats Monthly
- YouTube beats Monthly
- RSS news beats Monthly
- Urgency-based ordering within same priority

### ✅ Scalable Architecture
- Add new content sources without changing engine
- Each source feeds candidates to same queue
- Engine logic stays simple and centralized

### ✅ Predictable Cadence
- 3-hour minimum gaps
- 6 posts/day max
- Quiet hours respected
- Users know what to expect

### ✅ Hands-Off Autopilot
- Set autopost toggles once
- Engine runs continuously
- No manual scheduling needed
- Smart prioritization handles conflicts

---

## Migration from Old System

### Old System (Removed)
```typescript
// Each feed scheduled independently
scheduleTodayFeeds(posts);   // 10 posts at 9am, 12pm, 3pm, 6pm...
scheduleWeeklyFeeds(posts);  // 3 posts/day spread over week
scheduleMonthlyFeeds(posts); // 2 posts/day spread over month
```

**Problems:**
- ❌ Could schedule 15+ posts for same day
- ❌ No cross-feed deduplication
- ❌ No RSS/YouTube integration
- ❌ No rate limiting
- ❌ Feeds compete for posting slots

### New System (Current)
```typescript
// Feeds produce eligible candidates
feedTMDbPostsToQueue(todayPosts);
feedTMDbPostsToQueue(weeklyPosts);
feedTMDbPostsToQueue(monthlyPosts);

// Engine posts 1 at a time, respecting all limits
autopostEngine.start();
```

**Benefits:**
- ✅ Max 6 posts/day (configurable)
- ✅ 3-hour gaps enforced
- ✅ Unified queue for ALL content
- ✅ Smart prioritization
- ✅ Predictable behavior

---

## Testing Checklist

- [x] PostQueue adds candidates and sorts by priority
- [x] PostQueue enforces rate limits (gap, daily quota)
- [x] PostQueue respects quiet hours
- [x] PostQueue calculates urgency scores correctly
- [x] AutopostEngine starts/stops cleanly
- [x] AutopostEngine pulls highest-priority eligible candidate
- [x] AutopostEngine publishes to platforms
- [x] AutopostEngine updates queue status after posting
- [x] TMDbFeedAdapter converts TMDb posts correctly
- [x] TMDbFeedAdapter respects autopost toggles
- [x] AutopostSettings UI displays queue stats
- [x] AutopostSettings UI allows rate config updates
- [x] Progressive countdown works (Monthly → Weekly → Today)
- [x] Cross-content-source prioritization works (YouTube > Monthly)

---

## Future Enhancements

### Potential Additions
1. **Smart scheduling** - ML-based optimal posting times
2. **A/B testing** - Test different caption styles
3. **Performance tracking** - Track engagement per source/time
4. **Dynamic priorities** - Adjust based on past performance
5. **Multi-account support** - Different queues per account

### Not Needed
- ❌ Per-feed posting engines (centralized is better)
- ❌ Feed-to-feed handoffs (queue handles it)
- ❌ Complex scheduling algorithms (simple priority works)

---

## Conclusion

The centralized autopost architecture solves the posting orchestration problem by:

1. **Separating concerns:** Feeds curate, queue prioritizes, engine executes
2. **Preventing spam:** Strict rate limits and spacing enforced globally
3. **Enabling scale:** Add new content sources without changing core logic
4. **Maintaining quality:** Smart prioritization ensures best content posts first

**This is production-ready and scales cleanly with any number of content sources.**
