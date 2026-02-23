# TMDb Auto-Posting Scheduling System

## Overview

Screndly's TMDb auto-posting system intelligently schedules movie and TV show content across multiple feed types with granular control and smart spacing to maximize engagement while preventing post overlap.

## Feed Types & Scheduling Rules

### 🎬 Today's Releases
**Purpose:** Daily posts for movies and TV shows releasing on the current day

**Scheduling Strategy:**
- **Frequency:** Posts 3 hours apart
- **Volume:** Up to 10 posts per day (Top 5 movies + Top 5 TV shows)
- **Timing:** Spread throughout the day starting at 9 AM
- **Example Schedule:**
  - 9:00 AM - Movie 1
  - 12:00 PM - TV Show 1
  - 3:00 PM - Movie 2
  - 6:00 PM - TV Show 2
  - 9:00 PM - Movie 3

**Auto-Post Settings:**
- Platforms: X (Twitter), Threads, Facebook
- Toggle: `todayAutoPost` in TMDb settings

---

### 📅 Weekly Releases
**Purpose:** Preview of upcoming releases for the next 7 days

**Scheduling Strategy:**
- **Frequency:** 2-3 posts per day
- **Volume Adjustment:**
  - 10+ feeds: 3 posts/day
  - 5-9 feeds: 2 posts/day
  - <5 feeds: Min 2 posts/day
- **Distribution:** Spread across multiple days
- **Timing:** Optimal posting times throughout waking hours (8 AM - 11 PM)

**Example Schedule (10 feeds):**
- Day 1: 10:00 AM, 2:00 PM, 7:00 PM
- Day 2: 10:00 AM, 2:00 PM, 7:00 PM
- Day 3: 10:00 AM, 2:00 PM, 7:00 PM
- Day 4: 10:00 AM

**Auto-Post Settings:**
- Platforms: X (Twitter), Threads, Facebook
- Toggle: `weeklyAutoPost` in TMDb settings

---

### 🗓️ Monthly Previews
**Purpose:** Look-ahead at major releases coming next month

**Scheduling Strategy:**
- **Frequency:** 1-3 posts per day
- **Volume Adjustment:**
  - 15+ feeds: 3 posts/day
  - 8-14 feeds: 2 posts/day
  - <8 feeds: 1 post/day
- **Distribution:** Shuffled across multiple days throughout the month
- **Timing:** Strategic placement during high-engagement hours

**Example Schedule (15 feeds):**
- Day 1: 12:00 PM, 4:00 PM, 8:00 PM
- Day 2: 12:00 PM, 4:00 PM, 8:00 PM
- Day 3: 12:00 PM, 4:00 PM, 8:00 PM
- And so on...

**Auto-Post Settings:**
- Platforms: X (Twitter), Threads, Facebook
- Toggle: `monthlyAutoPost` in TMDb settings

---

### 🎂 Anniversaries
**Purpose:** Celebrate milestone anniversaries (1, 2, 3, 5, 10, 15, 20, 25 years)

**Scheduling Strategy:**
- **Frequency:** 2-3 posts per day
- **Volume Adjustment:**
  - 6+ feeds: 3 posts/day
  - 3-5 feeds: 2 posts/day
  - <3 feeds: Min 2 posts/day
- **Timing:** Only posts for movies/TV shows with anniversaries on that specific day
- **Distribution:** Spread throughout the day to maintain engagement

**Example Schedule (6 feeds for one day):**
- 9:00 AM - 25th Anniversary: The Matrix
- 1:00 PM - 10th Anniversary: Interstellar
- 5:00 PM - 5th Anniversary: Dune

**Auto-Post Settings:**
- Platforms: X (Twitter), Threads, Facebook
- Toggle: `anniversaryAutoPost` in TMDb settings
- Configurable Years: Select which anniversaries to track (1y, 2y, 3y, 5y, 10y, 15y, 20y, 25y)

---

## Smart Scheduling Features

### ⏱️ Minimum Gap Enforcement
- **1-hour minimum** between ANY posts, regardless of feed type
- Prevents audience fatigue and platform spam detection
- Automatically adjusts conflicting times

### 🔄 Conflict Resolution
When posts from different feed types would overlap:
1. System detects time conflicts
2. Automatically shifts later post by 60+ minutes
3. Maintains chronological order
4. Ensures no two posts are closer than 1 hour

### 🚫 Deduplication
- Same movie/TV show won't post within 30-day window
- Prevents redundant content
- Tracks by TMDb ID for accuracy

### 📊 Optimal Time Distribution
Posts are spread throughout waking hours:
- **Start:** 8:00 AM
- **End:** 11:00 PM
- **Algorithm:** Even distribution with peak engagement consideration

---

## Implementation Details

### Scheduling Algorithm
Located in `/utils/tmdbScheduler.ts`

**Key Functions:**
- `scheduleTodayFeeds()` - 3-hour spacing for today's releases
- `scheduleWeeklyFeeds()` - 2-3 per day distribution
- `scheduleMonthlyFeeds()` - 1-3 per day shuffle
- `scheduleAnniversaryFeeds()` - 2-3 per day milestone posts
- `scheduleAllFeeds()` - Master coordinator ensuring 60-min gaps
- `deduplicateFeeds()` - Prevents duplicate posts within 30 days

### Settings Configuration
All auto-post settings stored in localStorage:
```typescript
{
  // Feed Type Toggles
  enableToday: boolean,
  enableWeekly: boolean,
  enableMonthly: boolean,
  enableAnniversaries: boolean,
  
  // Auto-Post Toggles
  todayAutoPost: boolean,
  weeklyAutoPost: boolean,
  monthlyAutoPost: boolean,
  anniversaryAutoPost: boolean,
  
  // Platform Selection (per feed type)
  todayPlatforms: { x: boolean, threads: boolean, facebook: boolean },
  weeklyPlatforms: { x: boolean, threads: boolean, facebook: boolean },
  monthlyPlatforms: { x: boolean, threads: boolean, facebook: boolean },
  anniversaryPlatforms: { x: boolean, threads: boolean, facebook: boolean },
  
  // Other Settings
  anniversaryYears: string[], // ['1', '2', '3', '5', '10', '15', '20', '25']
  dedupeWindow: string, // Days (default: 30)
  timezone: string, // 'Africa/Lagos', 'America/New_York', etc.
}
```

---

## Platform Support

### Supported Platforms
✅ **X (Twitter)** - Text + Image posts
✅ **Threads** - Text + Image posts  
✅ **Facebook** - Text + Image posts

### Removed Platforms
❌ Instagram - Removed from TMDb auto-posting
❌ YouTube - Removed from TMDb auto-posting
❌ TikTok - Removed from TMDb auto-posting

---

## User Controls

### Feed Management Actions
Each feed card supports:
- ✏️ **Edit Caption** - Customize post text (max 200 chars)
- 🔄 **Regenerate Caption** - AI-powered caption generation
- 🖼️ **Change Image** - Switch between Poster/Backdrop
- 📅 **Reschedule** - Manually adjust posting time
- 🗑️ **Delete** - Remove feed from schedule

All actions include:
- Haptic feedback
- Toast notifications
- Immediate UI updates
- Local state persistence

---

## Best Practices

### Content Strategy
1. **Enable multiple feed types** for diverse content mix
2. **Select relevant platforms** for your audience
3. **Monitor engagement** and adjust settings accordingly
4. **Use AI regeneration** for optimal captions

### Scheduling Strategy
1. **Today feeds** - Maximum engagement, use all platforms
2. **Weekly feeds** - Build anticipation, consistent posting
3. **Monthly feeds** - Long-term planning, strategic placement
4. **Anniversaries** - Nostalgia marketing, select key milestones

### Platform Strategy
- **X (Twitter)** - Real-time engagement, all feed types
- **Threads** - Community building, conversational content
- **Facebook** - Broader reach, visual content

---

## Technical Notes

### Cache System
- **Discovery Cache:** 12 hours (configurable)
- **Credits Cache:** 30 days (configurable)
- **Caption Cache:** 30 days (configurable)
- Green "Cached" badge shown on reused content

### AI Caption Generation
- Model: GPT-3.5 Turbo / GPT-4 / GPT-4 Turbo
- Max length: 200 characters (configurable)
- Includes cast names (optional)
- Includes release date (optional)

### Image Management
- **Poster:** Vertical format, better for mobile
- **Backdrop:** Horizontal format, better for desktop
- **Rehost to S3:** Optional for reliability
- **Source:** TMDb high-quality images

---

## Future Enhancements

### Planned Features
- [ ] A/B testing for caption styles
- [ ] Engagement analytics per feed type
- [ ] Custom time slots per feed type
- [ ] Seasonal scheduling adjustments
- [ ] Multi-language caption generation
- [ ] Video trailer integration
- [ ] Cross-platform performance comparison

---

## Support

For issues or questions about TMDb auto-posting:
1. Check TMDb settings in Settings panel
2. Verify platform connections
3. Review scheduled posts in TMDb Feeds page
4. Monitor Logs page for errors

**Settings Location:** Settings → TMDb Feeds → Auto-Post Configuration
