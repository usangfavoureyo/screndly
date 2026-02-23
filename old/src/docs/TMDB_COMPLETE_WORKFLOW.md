# 🎬 TMDb Feeds Complete System & Workflow

**The Movie Database (TMDb) automated content discovery and posting system**

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [The 4 Feed Types](#the-4-feed-types)
3. [Complete Workflow (Step-by-Step)](#complete-workflow-step-by-step)
4. [Scheduling Algorithm](#scheduling-algorithm)
5. [Smart Features](#smart-features)
6. [Implementation Details](#implementation-details)
7. [User Controls](#user-controls)
8. [Configuration Guide](#configuration-guide)

---

## 🎯 System Overview

The TMDb Feeds system **automatically discovers, schedules, and posts** movie and TV show content to social media platforms based on release dates and anniversaries.

### **Purpose**
Automate engagement content for Screen Render's social media accounts with:
- Daily release announcements
- Weekly preview content
- Monthly upcoming releases
- Milestone anniversary celebrations

### **Platform Support**
✅ **X (Twitter)** - Real-time engagement  
✅ **Threads** - Community building  
✅ **Facebook** - Broader reach  

❌ Instagram, YouTube, TikTok - Excluded from TMDb auto-posting

---

## 🎬 The 4 Feed Types

### **1. Today's Releases** 🎬

**What it does:**  
Posts movies and TV shows releasing **TODAY** (on the current date)

**Example:**
```
🎬 Gladiator II arrives in theaters TODAY! ⚔️

Starring Paul Mescal, Denzel Washington, and Pedro Pascal

#GladiatorII #NowInTheaters
```

**Scheduling:**
- **Frequency:** 3 hours apart
- **Volume:** Top 5 movies + Top 5 TV shows (max 10/day)
- **Timing:** Spread from 9 AM - 9 PM
- **Schedule Example:**
  ```
  9:00 AM  - Movie: Wicked
  12:00 PM - TV: The Penguin (Season Finale)
  3:00 PM  - Movie: Gladiator II
  6:00 PM  - TV: Blue Eye Samurai S2
  9:00 PM  - Movie: Moana 2
  ```

**Auto-Post Settings:**
- Toggle: `todayAutoPost`
- Platforms: X, Threads, Facebook (individually selectable)

---

### **2. Weekly Releases** 📅

**What it does:**  
Preview of movies/TV shows releasing in the **next 7 days**

**Example:**
```
📅 Coming this week: Wicked

The untold story of the witches of Oz arrives Friday!

Starring Cynthia Erivo & Ariana Grande

#Wicked #ComingSoon
```

**Scheduling:**
- **Frequency:** 2-3 posts per day
- **Volume Adjustment:**
  - 10+ feeds → 3 posts/day
  - 5-9 feeds → 2 posts/day
  - <5 feeds → 2 posts/day (minimum)
- **Distribution:** Spread across multiple days
- **Timing:** 8 AM - 11 PM optimal hours

**Schedule Example (10 feeds):**
```
Day 1:
  10:00 AM - Wicked (Movie)
  2:00 PM  - Skeleton Crew (TV)
  7:00 PM  - Mufasa: The Lion King (Movie)

Day 2:
  10:00 AM - Nosferatu (Movie)
  2:00 PM  - The Residence (TV)
  7:00 PM  - A Complete Unknown (Movie)
```

**Auto-Post Settings:**
- Toggle: `weeklyAutoPost`
- Platforms: X, Threads, Facebook

---

### **3. Monthly Previews** 🗓️

**What it does:**  
Look-ahead at major releases coming **next month**

**Example:**
```
🗓️ December Preview: Avatar: Fire and Ash

James Cameron returns with the highly anticipated sequel

Mark your calendar for December 20, 2024

#Avatar3 #ComingInDecember
```

**Scheduling:**
- **Frequency:** 1-3 posts per day
- **Volume Adjustment:**
  - 15+ feeds → 3 posts/day
  - 8-14 feeds → 2 posts/day
  - <8 feeds → 1 post/day
- **Distribution:** Shuffled throughout the month
- **Timing:** Strategic high-engagement hours

**Schedule Example (15 feeds):**
```
November 1:
  12:00 PM - December Preview: Wicked Part 2
  4:00 PM  - December Preview: Kraven the Hunter
  8:00 PM  - December Preview: Sonic 3

November 2:
  12:00 PM - December Preview: Mufasa
  4:00 PM  - December Preview: Nosferatu
  8:00 PM  - December Preview: A Complete Unknown
```

**Auto-Post Settings:**
- Toggle: `monthlyAutoPost`
- Platforms: X, Threads, Facebook

---

### **4. Anniversaries** 🎂

**What it does:**  
Celebrates **milestone anniversaries** of iconic movies/TV shows

**Milestones Tracked:**
- 1 year, 2 years, 3 years
- 5 years, 10 years, 15 years
- 20 years, 25 years

**Example:**
```
🎂 25 years ago today, The Matrix changed cinema forever

"What is the Matrix?" became a cultural phenomenon

Happy Anniversary to this groundbreaking sci-fi masterpiece

#TheMatrix25
```

**Scheduling:**
- **Frequency:** 2-3 posts per day
- **Volume Adjustment:**
  - 6+ feeds → 3 posts/day
  - 3-5 feeds → 2 posts/day
  - <3 feeds → 2 posts/day
- **Timing:** Only posts for exact anniversary dates
- **Distribution:** Spread throughout the day

**Schedule Example (6 anniversaries on Nov 17):**
```
9:00 AM  - 25th Anniversary: The Matrix (1999)
1:00 PM  - 10th Anniversary: Interstellar (2014)
5:00 PM  - 5th Anniversary: Avengers: Endgame (2019)
```

**Auto-Post Settings:**
- Toggle: `anniversaryAutoPost`
- Platforms: X, Threads, Facebook
- Configurable Years: Select which milestones to track

---

## 🔄 Complete Workflow (Step-by-Step)

### **Phase 1: Discovery & Fetching**

```
Step 1: TMDb API Poll (Scheduled)
  ├─ Query: Releases for today
  ├─ Query: Releases for next 7 days
  ├─ Query: Releases for next month
  └─ Query: Anniversaries for today
  ↓

Step 2: Data Enrichment
  ├─ Fetch movie/TV details from TMDb
  ├─ Get cast information (top 3 actors)
  ├─ Get poster & backdrop images
  ├─ Get popularity score
  └─ Get release date & year
  ↓

Step 3: Filtering & Ranking
  ├─ Filter by popularity (top N)
  ├─ Filter by quality (has poster + valid data)
  ├─ Sort by popularity score
  └─ Deduplicate (30-day window)
```

---

### **Phase 2: Caption Generation**

```
Step 4: Cache Check
  ├─ Check if caption exists in cache
  ├─ If cached (< 30 days old) → Use cached caption ✓
  └─ If not cached → Generate new caption
  ↓

Step 5: AI Caption Generation (if not cached)
  ├─ Model: GPT-3.5 Turbo / GPT-4 / GPT-4 Turbo
  ├─ Input: Title, release date, cast, context
  ├─ Output: Optimized caption (max 200 chars)
  └─ Store in cache for 30 days
  ↓

Step 6: Caption Structure
  Example for "Today" feed:
  "🎬 [Title] arrives in theaters TODAY! [emoji]
  
   Starring [Actor 1], [Actor 2], and [Actor 3]
   
   #[Title] #NowInTheaters"
   
  Example for "Anniversary" feed:
  "🎂 [X] years ago today, [Title] changed cinema forever
  
   [Context about impact]
   
   Happy Anniversary to this [descriptor] masterpiece
   
   #[Title][X]"
```

---

### **Phase 3: Scheduling**

```
Step 7: Smart Scheduling Algorithm
  ├─ Detect feed type (today/weekly/monthly/anniversary)
  ├─ Calculate optimal posting times
  ├─ Apply volume limits (e.g., 10 max for today)
  ├─ Ensure 1-hour minimum gap between ALL posts
  └─ Resolve conflicts across feed types
  ↓

Step 8: Conflict Resolution
  Example scenario:
  - Today feed scheduled at 12:00 PM
  - Weekly feed wants 12:00 PM
  → System auto-shifts weekly to 1:00 PM
  ↓

Step 9: Deduplication Check
  ├─ Check if movie/TV was posted in last 30 days
  ├─ If duplicate → Skip this feed
  └─ If unique → Proceed to scheduling
```

---

### **Phase 4: Publishing**

```
Step 10: Queue Creation
  ├─ Status: "queued" → "scheduled"
  ├─ Store in TMDbPostsContext
  ├─ Save to localStorage
  └─ Display on TMDb Feeds page
  ↓

Step 11: Publication (When scheduled time arrives)
  ├─ Check platform connections (X, Threads, Facebook)
  ├─ Format content per platform:
  │   ├─ X: Caption + Image (16:9 or poster)
  │   ├─ Threads: Caption + Image
  │   └─ Facebook: Caption + Image
  ├─ Post to selected platforms
  └─ Update status: "scheduled" → "published"
  ↓

Step 12: Success/Failure Tracking
  ├─ If success: Mark as "published", record timestamp
  ├─ If failure: Mark as "failed", record error message
  └─ Show in TMDb Activity page
```

---

## 🧠 Scheduling Algorithm

### **Algorithm Location**
`/utils/tmdbScheduler.ts`

### **Key Functions**

```typescript
// Schedule today's releases (3-hour spacing)
scheduleTodayFeeds(feeds, startTime)
  → Returns array of scheduled posts with timestamps

// Schedule weekly releases (2-3 per day)
scheduleWeeklyFeeds(feeds, days)
  → Distributes feeds across multiple days

// Schedule monthly previews (1-3 per day)
scheduleMonthlyFeeds(feeds, days)
  → Shuffles feeds throughout the month

// Schedule anniversaries (2-3 per day)
scheduleAnniversaryFeeds(feeds)
  → Only posts on exact anniversary dates

// Master coordinator
scheduleAllFeeds(today, weekly, monthly, anniversaries)
  → Ensures 60-min gaps, deduplicates, resolves conflicts

// Deduplication
deduplicateFeeds(allFeeds, window)
  → Removes duplicates within N-day window
```

---

### **Spacing Logic**

#### **Today Feeds (3-hour spacing)**
```javascript
const baseTime = 9; // 9 AM start
const spacing = 3;   // 3 hours

feeds.forEach((feed, index) => {
  const hour = baseTime + (index * spacing);
  feed.scheduledTime = `${hour}:00`;
});

Result:
  Feed 1: 9:00 AM
  Feed 2: 12:00 PM
  Feed 3: 3:00 PM
  Feed 4: 6:00 PM
  Feed 5: 9:00 PM
```

#### **Weekly Feeds (2-3 per day distribution)**
```javascript
const postsPerDay = feeds.length >= 10 ? 3 : 2;
const days = Math.ceil(feeds.length / postsPerDay);

// Example: 10 feeds → 3/day → 4 days
Day 1: 10 AM, 2 PM, 7 PM
Day 2: 10 AM, 2 PM, 7 PM
Day 3: 10 AM, 2 PM, 7 PM
Day 4: 10 AM
```

#### **Minimum Gap Enforcement (60 minutes)**
```javascript
function enforceMinimumGap(scheduledPosts) {
  const sortedPosts = scheduledPosts.sort(byTime);
  
  for (let i = 1; i < sortedPosts.length; i++) {
    const prevTime = sortedPosts[i - 1].scheduledTime;
    const currTime = sortedPosts[i].scheduledTime;
    
    const gap = currTime - prevTime; // in minutes
    
    if (gap < 60) {
      // Shift current post forward by (60 - gap) minutes
      sortedPosts[i].scheduledTime += (60 - gap);
    }
  }
}
```

---

## ✨ Smart Features

### **1. Cache System** 💾

**Purpose:** Avoid redundant API calls and improve performance

**What's Cached:**
- **Discovery Data:** 12 hours
- **Cast & Credits:** 30 days
- **AI-Generated Captions:** 30 days

**Visual Indicator:**
- Green "Cached" badge shown on reused content

**Example:**
```
Movie: Gladiator II
├─ First fetch: Full API call + AI generation
├─ Cache stored: 30 days
└─ Subsequent use: Instant retrieval (no API costs!)
```

---

### **2. Deduplication** 🚫

**Purpose:** Prevent redundant posts of the same movie/TV show

**Logic:**
```
Same movie posted within 30 days?
├─ Yes → Skip this feed
└─ No  → Proceed with scheduling
```

**Example:**
```
Nov 1:  Post "Wicked" (Today feed)
Nov 10: Skip "Wicked" (Weekly feed) ← Duplicate!
Dec 2:  Post "Wicked" (Monthly feed) ✓ 30+ days passed
```

**Settings:**
- `dedupeWindow`: Configurable (default: 30 days)
- Tracked by TMDb ID for accuracy

---

### **3. Conflict Resolution** ⚔️

**Purpose:** Prevent posts from overlapping across feed types

**Algorithm:**
```
1. Collect all scheduled posts from all feed types
2. Sort by scheduled time
3. Check gaps between consecutive posts
4. If gap < 60 minutes:
   - Shift later post forward by (60 - gap) minutes
5. Maintain chronological order
```

**Example Scenario:**
```
Initial schedule:
  12:00 PM - Today: Wicked
  12:15 PM - Weekly: Moana 2  ← Conflict! (15 min gap)
  
After conflict resolution:
  12:00 PM - Today: Wicked
  1:00 PM  - Weekly: Moana 2  ✓ Shifted +45 min
```

---

### **4. Optimal Time Distribution** ⏰

**Waking Hours Coverage:**
- **Start:** 8:00 AM
- **End:** 11:00 PM
- **Peak Times:** 10 AM, 2 PM, 7 PM

**Distribution Strategy:**
- Even spacing throughout the day
- Avoid clustering (all posts at 9 AM)
- Consider engagement patterns (lunch, evening)

**Example (10 feeds):**
```
Poor distribution:
  9 AM, 9:30 AM, 10 AM, 10:30 AM... ← Clustered!

Good distribution:
  10 AM, 2 PM, 7 PM, 10 AM (next day), 2 PM (next day)... ✓
```

---

### **5. Volume Adjustment** 📊

**Purpose:** Adapt posting frequency based on available content

**Today Feeds:**
```
Volume: Top 5 movies + Top 5 TV shows (max 10)
Spacing: 3 hours
```

**Weekly Feeds:**
```
10+ feeds → 3 posts/day
5-9 feeds → 2 posts/day
<5 feeds  → 2 posts/day (minimum)
```

**Monthly Feeds:**
```
15+ feeds → 3 posts/day
8-14 feeds → 2 posts/day
<8 feeds   → 1 post/day
```

**Anniversaries:**
```
6+ feeds → 3 posts/day
3-5 feeds → 2 posts/day
<3 feeds  → 2 posts/day
```

---

## 🛠️ Implementation Details

### **Data Structure**

```typescript
interface TMDbPost {
  // Identifiers
  id: string;                  // Unique post ID
  tmdbId: number;              // TMDb movie/TV ID
  
  // Content
  mediaType: 'movie' | 'tv';
  title: string;
  year: number;
  releaseDate: string;         // YYYY-MM-DD
  caption: string;             // AI-generated caption
  imageUrl: string;            // Poster or backdrop URL
  imageType: 'poster' | 'backdrop';
  
  // Scheduling
  scheduledTime: string;       // ISO 8601 timestamp
  source: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary';
  
  // Metadata
  cast: string[];              // Top 3 actors
  popularity: number;          // TMDb popularity score
  cacheHit: boolean;           // Was caption cached?
  
  // Status
  status: 'queued' | 'scheduled' | 'published' | 'failed';
  platforms?: string[];        // ['X', 'Threads', 'Facebook']
  publishedTime?: string;      // When was it published?
  errorMessage?: string;       // If failed, why?
}
```

---

### **Context State Management**

**Location:** `/contexts/TMDbPostsContext.tsx`

**Methods:**
```typescript
// Add a new post to the schedule
schedulePost(post: TMDbPost)

// Reschedule an existing post
reschedulePost(postId: string, newScheduledTime: string)

// Update post status (queued → scheduled → published/failed)
updatePostStatus(postId: string, status, publishedTime?, errorMessage?)

// Update any post field
updatePost(postId: string, updates: Partial<TMDbPost>)

// Delete a post
deletePost(postId: string)

// Get posts by status
getPostsByStatus(status: 'queued' | 'scheduled' | 'published' | 'failed')
```

**Persistence:**
- All posts saved to `localStorage` (`screndlyTMDbPosts`)
- Survives page refreshes
- Syncs across tabs

---

### **UI Components**

#### **1. TMDb Feeds Page** (`/components/TMDbFeedsPage.tsx`)
- Displays **queued** and **scheduled** posts
- Filter tabs: All, Today, Weekly, Monthly, Anniversaries
- Stats panel with counts
- Refresh button

#### **2. TMDb Feed Card** (`/components/tmdb/TMDbFeedCard.tsx`)
- Individual feed display
- Actions: Edit Caption, Regenerate, Change Image, Reschedule, Delete
- Platform badges
- Cache indicator
- Haptic feedback on interactions

#### **3. TMDb Activity Page** (`/components/TMDbActivityPage.tsx`)
- Displays **published** and **failed** posts
- Filter: All, Failures, Published, Pending, Scheduled
- Swipe-to-delete functionality
- Retry failed posts
- Detailed error messages

#### **4. TMDb Stats Panel** (`/components/tmdb/TMDbStatsPanel.tsx`)
- Quick overview: Total, Today, Weekly, Monthly, Anniversaries
- Click to filter by feed type
- Visual counts with icons

---

## 🎮 User Controls

### **Per-Feed Actions**

Each feed card supports:

**1. Edit Caption** ✏️
```
- Click "Edit Caption" button
- Modal opens with caption editor
- Max 200 characters
- Live character count
- Save changes
```

**2. Regenerate Caption** 🔄
```
- Click "Regenerate" button
- AI generates new caption
- Uses fresh GPT API call
- Updates cache
- Toast notification on success
```

**3. Change Image** 🖼️
```
- Click "Change Image" dropdown
- Toggle: Poster ↔ Backdrop
- Updates imageUrl and imageType
- Instant visual update
```

**4. Reschedule** 📅
```
- Click "Reschedule" button
- Date/time picker opens
- Select new timestamp
- Validates minimum gap
- Updates schedule
```

**5. Delete** 🗑️
```
- Click "Delete" button
- Confirmation dialog
- Removes from schedule
- Toast notification
- Haptic feedback
```

---

### **Global Actions**

**Refresh**
```
- Refreshes feed data from TMDb API
- Re-fetches today/weekly/monthly/anniversary
- Updates existing posts
- Adds new releases
```

**View Activity**
```
- Navigate to TMDb Activity page
- See published & failed posts
- Review error logs
- Retry failed posts
```

**Filter by Type**
```
- All Feeds (default)
- Today (releases today)
- Weekly (next 7 days)
- Monthly (next month)
- Anniversaries (milestones)
```

---

## ⚙️ Configuration Guide

### **Settings Location**
Settings → TMDb Feeds → Auto-Post Configuration

### **Feed Type Toggles**

```typescript
{
  enableToday: boolean,       // Enable Today's Releases
  enableWeekly: boolean,      // Enable Weekly Releases
  enableMonthly: boolean,     // Enable Monthly Previews
  enableAnniversaries: boolean // Enable Anniversaries
}
```

---

### **Auto-Post Toggles**

```typescript
{
  todayAutoPost: boolean,      // Auto-post Today feeds
  weeklyAutoPost: boolean,     // Auto-post Weekly feeds
  monthlyAutoPost: boolean,    // Auto-post Monthly feeds
  anniversaryAutoPost: boolean // Auto-post Anniversary feeds
}
```

---

### **Platform Selection (Per Feed Type)**

```typescript
{
  todayPlatforms: {
    x: boolean,          // Post Today feeds to X
    threads: boolean,    // Post Today feeds to Threads
    facebook: boolean    // Post Today feeds to Facebook
  },
  
  weeklyPlatforms: {
    x: boolean,
    threads: boolean,
    facebook: boolean
  },
  
  monthlyPlatforms: {
    x: boolean,
    threads: boolean,
    facebook: boolean
  },
  
  anniversaryPlatforms: {
    x: boolean,
    threads: boolean,
    facebook: boolean
  }
}
```

---

### **Anniversary Configuration**

```typescript
{
  anniversaryYears: string[]  // ['1', '2', '3', '5', '10', '15', '20', '25']
}
```

**Example:**
```
Selected: [1, 5, 10, 25]
→ Only posts for 1st, 5th, 10th, and 25th anniversaries
```

---

### **Other Settings**

```typescript
{
  dedupeWindow: string,    // Days (default: 30)
  timezone: string,        // 'Africa/Lagos', 'America/New_York', etc.
  captionMaxLength: number, // Max characters (default: 200)
  includeCast: boolean,    // Include actor names in captions
  includeReleaseDate: boolean, // Include release date
  rehostImages: boolean    // Rehost to S3 CDN
}
```

---

## 📊 Example Complete Scenario

### **Scenario: November 17, 2024**

**Step 1: Discovery**
```
TMDb API fetches:
├─ Today: Gladiator II, Wicked, Moana 2
├─ Weekly: Red One, Wicked, Sonic 3
├─ Monthly: December: Mufasa, Kraven, Nosferatu
└─ Anniversaries: The Matrix (25 years), Interstellar (10 years)
```

**Step 2: Filtering & Deduplication**
```
Before dedupe: 10 feeds
After dedupe:  8 feeds (Wicked appears in Today + Weekly → Keep Today only)
```

**Step 3: Caption Generation**
```
Gladiator II (Today):
  Cache check: No cache ❌
  AI generate: "🎬 Gladiator II arrives in theaters TODAY! ⚔️\n\nStarring Paul Mescal, Denzel Washington, and Pedro Pascal\n\n#GladiatorII #NowInTheaters"
  Cache stored: 30 days ✓

The Matrix (Anniversary):
  Cache check: Found! (from last year) ✓
  Use cached: "🎂 25 years ago today, The Matrix changed cinema forever..."
```

**Step 4: Scheduling**
```
Today feeds (3-hour spacing):
  9:00 AM  - Gladiator II
  12:00 PM - Wicked
  3:00 PM  - Moana 2

Weekly feeds (2/day):
  10:00 AM (Nov 18) - Red One
  2:00 PM (Nov 18)  - Sonic 3

Monthly feeds (3/day):
  12:00 PM (Nov 17) - Mufasa
  4:00 PM (Nov 17)  - Kraven
  8:00 PM (Nov 17)  - Nosferatu

Anniversary feeds:
  1:00 PM  - The Matrix (25 years)
  5:00 PM  - Interstellar (10 years)
```

**Step 5: Conflict Resolution**
```
Initial conflicts:
  12:00 PM - Wicked (Today)
  12:00 PM - Mufasa (Monthly) ← Conflict!

After resolution:
  12:00 PM - Wicked (Today)
  1:00 PM  - Mufasa (Monthly) ✓ Shifted +60 min
  1:00 PM  - The Matrix (Anniversary) ← New conflict!
  2:00 PM  - The Matrix (Anniversary) ✓ Shifted +60 min
```

**Step 6: Final Schedule (Nov 17)**
```
9:00 AM  - Gladiator II (Today) → X, Threads, Facebook
10:00 AM - Red One (Weekly) → X, Threads
12:00 PM - Wicked (Today) → X, Threads, Facebook
1:00 PM  - Mufasa (Monthly) → X, Facebook
2:00 PM  - The Matrix (Anniversary) → X, Threads, Facebook
3:00 PM  - Moana 2 (Today) → X, Threads, Facebook
4:00 PM  - Kraven (Monthly) → X
5:00 PM  - Interstellar (Anniversary) → X, Threads, Facebook
8:00 PM  - Nosferatu (Monthly) → X, Facebook
```

**Step 7: Publication**
```
9:00 AM arrives:
  ├─ Post to X: ✓ Success
  ├─ Post to Threads: ✓ Success
  └─ Post to Facebook: ✓ Success
  
Status updated: "scheduled" → "published"
Timestamp recorded: "2024-11-17T09:00:00Z"
Moved to Activity page ✓
```

---

## 🎯 Best Practices

### **Content Strategy**

1. **Enable multiple feed types** for diverse content mix
2. **Select relevant platforms** for your audience
3. **Monitor engagement** and adjust settings accordingly
4. **Use AI regeneration** for optimal captions

### **Scheduling Strategy**

1. **Today feeds** - Maximum engagement, use all platforms
2. **Weekly feeds** - Build anticipation, consistent posting
3. **Monthly feeds** - Long-term planning, strategic placement
4. **Anniversaries** - Nostalgia marketing, select key milestones

### **Platform Strategy**

- **X (Twitter)** - Real-time engagement, all feed types
- **Threads** - Community building, conversational content
- **Facebook** - Broader reach, visual content

---

## 🚀 Future Enhancements

### **Planned Features**

- [ ] A/B testing for caption styles
- [ ] Engagement analytics per feed type
- [ ] Custom time slots per feed type
- [ ] Seasonal scheduling adjustments
- [ ] Multi-language caption generation
- [ ] Video trailer integration
- [ ] Cross-platform performance comparison

---

## 📚 Related Documentation

- **[TMDB_AUTO_POSTING.md](/docs/TMDB_AUTO_POSTING.md)** - Auto-posting scheduling details
- **[RSS_FEED_WORKFLOW.md](/docs/RSS_FEED_WORKFLOW.md)** - RSS feed automation
- **[ARCHITECTURE.md](/docs/ARCHITECTURE.md)** - System architecture

---

## 🆘 Support

**For issues or questions:**
1. Check TMDb settings in Settings panel
2. Verify platform connections
3. Review scheduled posts in TMDb Feeds page
4. Monitor Logs page for errors

**Settings Location:** Settings → TMDb Feeds → Auto-Post Configuration

---

**System Status:** ✅ Fully Operational  
**Last Updated:** December 2, 2024  
**Version:** 2.1.0
