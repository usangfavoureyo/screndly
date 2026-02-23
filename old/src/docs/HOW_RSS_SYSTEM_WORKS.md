# 📡 HOW THE RSS FEED SYSTEM WORKS NOW

**Date:** 2025-01-02  
**Status:** ✅ EVENT-DRIVEN AUTOMATIC POSTING SYSTEM (LIKE IFTTT/CULTURE CRAVE)

---

## ✅ YES, THIS IS AN EVENT-DRIVEN AUTOMATIC POSTING SYSTEM

The RSS Feed system is now a **fully automatic, hands-off event-driven posting system** that posts immediately when new content is detected (like IFTTT triggers), similar to Culture Crave's instant posting approach.

**KEY CHANGE:** Converted from **queue-based interval posting** to **event-driven immediate posting** to eliminate rate limit bottlenecks and enable Culture Crave-style instant news sharing.

---

## 🔄 HOW IT WORKS (ARCHITECTURE)

### **TWO SEPARATE PARTS:**

```
┌─────────────────────────────────────────────────────────────┐
│  PART 1: RSS PAGE UI (Manual Feed Management)              │
│  /components/RSSPage.tsx                                    │
│                                                             │
│  User Actions:                                              │
│  ├─ Add/edit RSS feed sources                               │
│  ├─ Set polling interval (5-30 minutes per feed)            │
│  ├─ Configure filters (required/blocked keywords)           │
│  ├─ Toggle autopost on/off                                  │
│  ├─ Select platforms (X, Threads, Facebook, Pinterest)      │
│  └─ Configure caption settings                              │
│                                                             │
│  Feeds are stored in:                                       │
│  └─ localStorage.getItem('screndly_rss_feeds')              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Feeds config saved
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PART 2: RSS SCHEDULER (Automatic Polling & Queueing)      │
│  /lib/autopost/rssFeedScheduler.ts                         │
│                                                             │
│  Automatic Actions (Background Process):                   │
│  ├─ Loads feeds from localStorage every N minutes           │
│  ├─ Polls each enabled feed at its polling interval         │
│  ├─ Fetches RSS XML and parses entries                      │
│  ├─ Applies filters (required/blocked keywords)             │
│  ├─ Checks deduplication (dedupeDays)                       │
│  ├─ Enriches items with images (Serper API)                 │
│  ├─ Generates captions (GPT API)                            │
│  └─ Adds eligible items to postQueue                        │
│                                                             │
│  Auto-starts on page load:                                  │
│  └─ rssFeedScheduler.start() (if enabled)                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Items queued with priority P2
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PART 3: POSTING WORKER (EVENT-DRIVEN OR INTERVAL)         │
│  /lib/autopost/rssFeedScheduler.ts + postQueue.ts         │
│                                                             │
│  ✨ NEW: Event-Driven Mode (Default):                      │
│  ├─ Posts IMMEDIATELY when new content is detected         │
│  ├─ Respects rate limits (minimum gap, daily quotas)       │
│  ├─ Falls back to queue if rate limit is reached           │
│  └─ Like IFTTT triggers - instant posting                  │
│                                                             │
│  Alternative: Interval Mode (Legacy):                       │
│  ├─ Posts at fixed intervals (e.g., every 10 minutes)      │
│  ├─ Processes queue in batches                             │
│  └─ Slower but more controlled                             │
│                                                             │
│  Rate Limits (apply to both modes):                        │
│  ├─ Minimum Gap: 10 min between posts (configurable)       │
│  ├─ Daily Quotas per platform:                             │
│  │   ├─ X: 50/day                                          │
│  │   ├─ Threads: 100/day                                   │
│  │   ├─ Facebook: 25/day                                   │
│  │   └─ Pinterest: 100/day                                 │
│  ├─ Quiet Hours: 12 AM - 7 AM (configurable)               │
│  └─ Global RSS Posting: ON/OFF master switch               │
└─────────────────────────────────────────────────────────────┘
```

---

## 👤 WHAT THE USER SEES (UI SIDE)

### **RSS Page (`/components/RSSPage.tsx`)**

The RSS page is the **feed configuration dashboard**. Users can:

#### **1. View All Feed Sources:**
```
┌─────────────────────────────────────────────────────┐
│  📰 Variety - Film News                             │
│  🟢 Active • Last processed: 2 min ago              │
│  ⏰ Next run: 8 min                                 │
│  📡 Polling every 10 minutes                        │
│  ✅ Auto-post enabled                               │
│  Platforms: X, Threads                              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  📰 The Hollywood Reporter                          │
│  🟢 Active • Last processed: 5 min ago              │
│  ⏰ Next run: 10 min                                │
│  📡 Polling every 15 minutes                        │
│  ✅ Auto-post enabled                               │
│  Platforms: X, Facebook                             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  📰 Deadline - Movies                               │
│  ⏸️ Paused • Last processed: 1 hour ago             │
│  📡 Polling every 10 minutes (when enabled)         │
│  ❌ Auto-post disabled                              │
│  Platforms: Threads                                 │
└─────────────────────────────────────────────────────┘
```

#### **2. Add New Feed:**
```
Click "+ Add RSS Feed" button

┌──────────────────────────────────────────────────┐
│  Add RSS Feed                                    │
│                                                  │
│  Feed Name: [Variety - Film News]                │
│  RSS URL:   [https://variety.com/feed/]          │
│                                                  │
│  Polling Interval:  [10] minutes                 │
│  Image Count:       [2 images]                   │
│  Dedupe Days:       [30] days                    │
│                                                  │
│  Filters:                                        │
│  ├─ Scope: [Title or Body ▼]                     │
│  ├─ Required Keywords:                           │
│  │   • "trailer" (contains, case-insensitive)    │
│  │   • "teaser" (contains, case-insensitive)     │
│  └─ Blocked Keywords:                            │
│      • "leak" (contains, case-insensitive)       │
│                                                  │
│  Platforms:                                      │
│  ☑ X (Twitter)                                   │
│  ☑ Threads                                       │
│  ☐ Facebook                                      │
│  ☐ Pinterest                                     │
│                                                  │
│  ☑ Enable Auto-Post                             │
│  ☑ Use Serper for image enrichment               │
│  ☐ Rehost images                                 │
│                                                  │
│  [Cancel]  [Save Feed]                           │
└──────────────────────────────────────────────────┘
```

#### **3. Edit Existing Feed:**
Click on any feed card → Opens same editor with existing values

#### **4. Toggle Auto-Post:**
Each feed card has a switch:
```
☑ Auto-Post Enabled  → Items will be queued automatically
☐ Auto-Post Disabled → Items will NOT be queued (manual only)
```

#### **5. View Queue Status:**
The page shows a queue section (currently mock data):
```
Recently Queued Items:
┌──────────────────────────────────────────────────┐
│  ✅ Published • 2 min ago                        │
│  Dune: Part Three - Official Announcement        │
│  From: Variety • Posted to: X, Threads           │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  📝 Captioned • 5 min ago                        │
│  Marvel Announces New Phase 6 Projects           │
│  From: The Hollywood Reporter                    │
└──────────────────────────────────────────────────┘
```

---

## ⚙️ WHAT HAPPENS IN THE BACKGROUND (AUTOMATIC)

### **Step 1: Polling (Every N Minutes)**

The `rssFeedScheduler` runs in the background:

```javascript
// Auto-starts when app loads
if (rssFeedScheduler.getStatus().config.enabled) {
  rssFeedScheduler.start();
}

// Polls every 5 minutes globally (checks which feeds need polling)
setInterval(() => {
  rssFeedScheduler.pollAll();
}, 5 * 60 * 1000);
```

### **Step 2: For Each Feed (If Due for Polling):**

```
1. Load feed config from localStorage
   └─ Check if feed.enabled === true
   └─ Check if feed.pollingInterval has elapsed

2. Fetch RSS XML from feed.url
   └─ Example: https://variety.com/feed/

3. Parse RSS entries
   └─ Extract: title, description, url, publishedDate, content

4. Apply filters (each entry)
   ├─ Required keywords: Must contain ALL active keywords
   │   Example: "trailer" AND "teaser"
   └─ Blocked keywords: Must NOT contain ANY active keywords
       Example: NOT "leak"

5. Check deduplication
   ├─ Has this item been processed before?
   ├─ Is it older than dedupeDays?
   └─ Skip if duplicate

6. Enrich with images (if serperPriority = true)
   ├─ Call Serper API to find images
   └─ Download N images (based on imageCount setting)

7. Generate caption
   ├─ Load RSS caption settings from localStorage
   ├─ Call GPT API with caption template
   └─ Get generated caption

8. Convert to PostCandidate
   {
     id: 'rss-variety-1234567890',
     source: 'rss',
     priority: 'P2',
     title: 'Dune: Part Three - Official Announcement',
     caption: '🎬 BREAKING: Dune Part 3 announced! 🏜️ #Dune',
     thumbnailUrl: 'https://images.example.com/dune3.jpg',
     platforms: ['x', 'threads'],
     earliestPostTime: now,
     latestPostTime: now + 24 hours,
     status: 'queued',
     dedupeKey: 'rss_feed-1_rss-variety-1234567890'
   }

9. Add to postQueue
   postQueue.addCandidate(candidate);
   
10. Mark item as processed
    Save to localStorage to prevent re-processing
```

### **Step 3: Posting (Every 15 Minutes)**

The `autopostEngine` runs continuously:

```
Every 15 minutes:
  1. Check if autopost is enabled globally
  2. Check if 3 hours have passed since last post
  3. If yes:
     ├─ Get next eligible candidate from queue
     │   (Priority order: P1 > P2 > P3 > P4, then urgency)
     ├─ Post to all enabled platforms
     ├─ Mark as 'posted'
     └─ Wait 3 hours before next post
  4. If no:
     └─ Wait until next tick
```

---

## 📊 EXAMPLE TIMELINE

### **User Actions:**
```
10:00 AM - User adds "Variety" feed
           └─ Polling interval: 10 minutes
           └─ Auto-post: ✅ Enabled
           └─ Platforms: X, Threads

10:01 AM - User adds "Hollywood Reporter" feed
           └─ Polling interval: 15 minutes
           └─ Auto-post: ✅ Enabled
           └─ Platforms: X, Facebook
```

### **Background Actions (Automatic):**
```
10:05 AM - rssFeedScheduler.pollAll() runs
           ├─ Poll Variety (5 min since last = YES)
           │   ├─ Fetch RSS → 3 new entries
           │   ├─ Apply filters → 2 pass
           │   ├─ Enrich with images → Done
           │   ├─ Generate captions → Done
           │   └─ Queue 2 items (P2 priority)
           │
           └─ Poll Hollywood Reporter (5 min since last = YES)
               ├─ Fetch RSS → 1 new entry
               ├─ Apply filters → 1 passes
               ├─ Enrich with images → Done
               ├─ Generate caption → Done
               └─ Queue 1 item (P2 priority)

10:10 AM - rssFeedScheduler.pollAll() runs
           ├─ Poll Variety (5 min since last = NO, needs 10 min)
           └─ Poll Hollywood Reporter (5 min since last = NO, needs 15 min)

10:15 AM - autopostEngine.tick() runs
           ├─ Last post: 7:00 AM (3+ hours ago) ✅
           ├─ Get next candidate: Variety Item 1 (P2, urgency: 95)
           ├─ Post to X ✅
           ├─ Post to Threads ✅
           └─ Mark as posted

10:15 AM - rssFeedScheduler.pollAll() runs
           ├─ Poll Variety (10 min since last = YES)
           │   └─ No new items
           └─ Poll Hollywood Reporter (10 min since last = NO, needs 15 min)

1:15 PM  - autopostEngine.tick() runs (3 hours later)
           ├─ Last post: 10:15 AM (3 hours ago) ✅
           ├─ Get next candidate: Variety Item 2 (P2, urgency: 90)
           ├─ Post to X ✅
           ├─ Post to Threads ✅
           └─ Mark as posted

4:15 PM  - autopostEngine.tick() runs (3 hours later)
           ├─ Get next candidate: Hollywood Reporter Item 1 (P2, urgency: 85)
           ├─ Post to X ✅
           ├─ Post to Facebook ✅
           └─ Mark as posted
```

**Result:** User configured 2 feeds at 10:00 AM. System automatically detected 3 items and posted them at 10:15 AM, 1:15 PM, and 4:15 PM without any manual intervention.

---

## 🎯 KEY DIFFERENCES FROM BEFORE

| Before | Now |
|--------|-----|
| ❌ Static mock data | ✅ Real polling scheduler |
| ❌ No automatic detection | ✅ Polls feeds every N minutes |
| ❌ No queue system | ✅ Centralized postQueue |
| ❌ Manual posting only | ✅ Automatic posting with autoPost toggle |
| ❌ No rate limiting | ✅ Global 3-hour posting interval |
| ❌ No deduplication | ✅ Deduplication via dedupeDays |
| ❌ No filtering | ✅ Required/blocked keyword filters |
| ❌ No enrichment | ✅ Serper image enrichment |
| ❌ No caption generation | ✅ GPT caption generation |

---

## 🔧 CONFIGURATION LOCATIONS

### **Feed Configuration:**
- **Where:** RSS Page UI (`/components/RSSPage.tsx`)
- **Stored:** `localStorage.getItem('screndly_rss_feeds')`
- **Schema:**
  ```typescript
  {
    id: 'feed-1',
    name: 'Variety - Film News',
    url: 'https://variety.com/feed/',
    enabled: true,
    pollingInterval: 10, // minutes
    imageCount: '2',
    dedupeDays: 30,
    filters: {
      scope: 'title_or_body',
      required: [...],
      blocked: [...],
    },
    platformsEnabled: { x: true, threads: true, facebook: false, pinterest: false },
    autoPost: true,
    serperPriority: true,
    rehostImages: false,
  }
  ```

### **Scheduler Configuration:**
- **Where:** `rssFeedScheduler` internal config
- **Stored:** `localStorage.getItem('screndly_rss_scheduler_config')`
- **Schema:**
  ```typescript
  {
    enabled: true,
    globalPollingInterval: 5, // minutes
    autoFeedToQueue: true,
  }
  ```

### **Queue Configuration:**
- **Where:** `postQueue` internal config
- **Stored:** `localStorage.getItem('screndly_post_queue')`
- **Contains:** All queued items from all sources (RSS, TMDb, YouTube)

### **Engine Configuration:**
- **Where:** `autopostEngine` internal config
- **Stored:** `localStorage.getItem('screndly_autopost_engine_config')`
- **Schema:**
  ```typescript
  {
    enabled: true,
    tickInterval: 15, // minutes
    dryRun: false,
  }
  ```

---

## ✅ SUMMARY: HOW THE RSS PAGE WORKS NOW

### **What Users Do:**
1. **Add RSS feed sources** (URL, name, polling interval)
2. **Configure filters** (required/blocked keywords)
3. **Enable auto-post** (toggle per feed)
4. **Select platforms** (X, Threads, Facebook, Pinterest)
5. **Set caption preferences** (in RSS settings)
6. **Walk away** ← THE KEY DIFFERENCE

### **What Happens Automatically:**
1. **Scheduler polls feeds** every N minutes
2. **Filters detect** eligible items
3. **Images are enriched** via Serper
4. **Captions are generated** via GPT
5. **Items are queued** with P2 priority
6. **Engine posts** one item every 3 hours
7. **No manual intervention needed**

### **It's Like Culture Crave:**
- ✅ Set it and forget it
- ✅ Automatic detection
- ✅ Automatic posting
- ✅ Rate limiting prevents spam
- ✅ Deduplication prevents duplicates
- ✅ Filtering ensures quality
- ✅ Multi-platform support

---

## 🚀 THE RSS PAGE IS NOW A "SET IT AND FORGET IT" DASHBOARD

**Users configure feeds once. The system does the rest automatically.**

---

## 🆕 NEW: EVENT-DRIVEN POSTING SYSTEM (JANUARY 2, 2025)

### **What Changed:**

**BEFORE (Queue-Based):**
```
New article detected → Add to queue → Wait for interval (10 min) → Post
```

**AFTER (Event-Driven):**
```
New article detected → Post IMMEDIATELY (if rate limits allow) → Or queue if busy
```

### **Why Event-Driven?**

1. **Faster Posting** - No waiting for queue intervals
2. **Culture Crave Style** - Instant news sharing like @culturecrave
3. **Better Rate Limit Management** - Checks before posting, not after
4. **IFTTT-Like Triggers** - Acts like automation triggers (immediate response)

### **How It Works:**

```typescript
// In rssFeedScheduler.ts
const eventDrivenEnabled = this.isEventDrivenPostingEnabled();
if (eventDrivenEnabled) {
  console.log('Event-driven mode: Attempting immediate post');
  await this.attemptImmediatePost(candidate);
}
// If not enabled OR rate limit reached, item stays in queue for interval processing
```

### **Settings Control:**

**Location:** RSS Feeds page (main controls)

1. **Global RSS Posting** (Master switch)
   - ON = RSS system processes articles
   - OFF = RSS system paused (no processing at all)

2. **Event-Driven Posting** (Posting strategy)
   - ON = Post immediately when detected (default)
   - OFF = Post at intervals (legacy queue-based mode)

3. **Minimum Gap Between Posts** (Rate control)
   - Default: 10 minutes
   - Range: 5-60 minutes
   - Applies to BOTH modes

**Location:** Settings → RSS Feeds Settings

4. **Daily Quotas** (Platform-specific limits)
   - X: 50/day
   - Threads: 100/day
   - Facebook: 25/day
   - Pinterest: 100/day

5. **Quiet Hours** (Time restrictions)
   - Start: 12 AM (default)
   - End: 7 AM (default)
   - No posting during quiet hours

### **Posting Decision Flow:**

```
New article detected
│
├─ Is Global RSS Posting ON?
│  ├─ NO → ❌ Skip (don't process)
│  └─ YES → Continue
│
├─ Process article (caption, images, etc.)
├─ Add to queue
│
└─ Is Event-Driven Posting ON?
   ├─ YES → Attempt immediate post
   │  ├─ Check minimum gap (10 min default)
   │  ├─ Check daily quota (X: 50/day, etc.)
   │  ├─ Check quiet hours (12 AM - 7 AM)
   │  ├─ If ALL pass → ✅ POST NOW
   │  └─ If ANY fail → Queue for later
   │
   └─ NO → Queue for interval (10 min tick)
```

### **Example Timeline (Event-Driven Mode):**

```
12:00 PM - New article: "Dune 3 Announced!"
12:00 PM - ✅ POSTED IMMEDIATELY to X, Threads
           (Rate limits: OK, Quota: 1/50, Not quiet hours)

12:05 PM - New article: "Marvel Phase 6 Lineup"
12:05 PM - ❌ QUEUED (minimum gap: 5 min since last post)
12:10 PM - ✅ POSTED (minimum gap met)

12:15 PM - New article: "Avatar 3 Trailer"
12:15 PM - ❌ QUEUED (minimum gap: 5 min since last post)
12:20 PM - ✅ POSTED

1:00 AM  - New article: "Spider-Man 4 Details"
1:00 AM  - ❌ QUEUED (quiet hours: 12 AM - 7 AM)
7:00 AM  - ✅ POSTED (quiet hours ended)
```

### **Example Timeline (Interval Mode - Legacy):**

```
12:00 PM - New article: "Dune 3 Announced!"
12:00 PM - Queued
12:10 PM - ✅ POSTED (next queue tick)

12:05 PM - New article: "Marvel Phase 6 Lineup"
12:05 PM - Queued
12:20 PM - ✅ POSTED (next queue tick)
```

### **Rate Limit Protection:**

Even in event-driven mode, all rate limits are enforced:

| Limit Type | Default | Purpose |
|------------|---------|---------|
| Minimum Gap | 10 min | Prevent rapid-fire spam |
| Daily Quotas | X: 50, Threads: 100, FB: 25, Pinterest: 100 | Platform API limits |
| Quiet Hours | 12 AM - 7 AM | Respect audience sleep schedules |
| Global RSS | ON/OFF | Master kill switch |

### **Pinterest Integration:**

**NEW:** Pinterest requires a different publishing structure:

| Platform | Publishing Model |
|----------|------------------|
| X, Threads, Facebook | Single caption field |
| Pinterest | Title + Description + Link + Board |

**Pinterest Settings (RSS Feeds Settings):**
- Pinterest Title Generation Prompt (100 chars, SEO-optimized)
- Pinterest Description Generation Prompt (500 chars, front-loaded hooks)
- Default Pinterest Board (board selection dropdown)
- Link Strategy (Article URL / Screen Render / Custom)

**Caption Generation:**
- Standard platforms use: `rssCaptionPrompt`
- Pinterest uses: `rssPinterestTitlePrompt` + `rssPinterestDescriptionPrompt`

This ensures Pinterest pins are optimized for Pinterest's search algorithm (title front-loading, SEO keywords) while other platforms get social media-style captions (hooks, hashtags, emojis).

---

## 📊 DASHBOARD INTEGRATION (JANUARY 2, 2025)

### **Dashboard Stat Cards Now Pull Real Data:**

**Before:** Mock/placeholder data
**After:** Real-time data from localStorage

**Data Sources:**

| Stat Card | Data Source | localStorage Key |
|-----------|-------------|------------------|
| Total Posts | TMDb + RSS + YouTube activity | `screndly_tmdb_activity`, `screndly_rss_activity`, `screndly_youtube_activity` |
| Scheduled Posts | Post queue candidates | `screndly_post_queue` |
| Draft Videos | Video Studio templates | `screndly_video_templates` |
| Active Feeds | TMDb + RSS + YouTube feeds | `screndly_tmdb_feeds`, `screndly_rss_feeds`, `screndly_youtube_channels` |

**Example:**
```typescript
// Before (mock)
const totalPosts = 1234;

// After (real)
const tmdbActivity = JSON.parse(localStorage.getItem('screndly_tmdb_activity') || '[]');
const rssActivity = JSON.parse(localStorage.getItem('screndly_rss_activity') || '[]');
const youtubeActivity = JSON.parse(localStorage.getItem('screndly_youtube_activity') || '[]');
const totalPosts = tmdbActivity.length + rssActivity.length + youtubeActivity.length;
```

This makes the Dashboard a true **real-time monitoring hub** for all autopost activity across all sources.

---

## ✅ CURRENT STATUS SUMMARY (JANUARY 2, 2025)

### **✨ Production-Ready Features:**

1. ✅ **Event-Driven Posting** - IFTTT-style instant posting (like Culture Crave)
2. ✅ **Pinterest Integration** - Platform-specific publishing architecture
3. ✅ **Daily Quotas** - Platform-specific rate limiting (X: 50, Threads: 100, FB: 25, Pinterest: 100)
4. ✅ **Quiet Hours** - Time-based posting restrictions (12 AM - 7 AM default)
5. ✅ **Global RSS Posting** - Master kill switch for all RSS processing
6. ✅ **Dashboard Stats** - Real-time data from localStorage (no more mocks)
7. ✅ **RSS Feeds Settings** - Centralized configuration (Daily Quotas, Quiet Hours, Caption Generation, Pinterest)
8. ✅ **Multi-Platform Support** - X, Threads, Facebook, Pinterest
9. ✅ **Auto-Caption Generation** - Platform-aware (standard vs. Pinterest)
10. ✅ **Deduplication** - 30-day default window
11. ✅ **Keyword Filtering** - Required/blocked keyword rules
12. ✅ **Image Enrichment** - Serper API integration
13. ✅ **Rate Limit Protection** - Minimum gap + daily quotas + quiet hours

### **🎯 Architecture Highlights:**

- **Separation of Concerns**: UI configuration → Background polling → Event-driven posting
- **Fail-Safe Defaults**: Event-driven ON, Global RSS ON, Deduplication ON
- **Platform-Specific Logic**: Pinterest gets separate caption architecture
- **Culture Crave-Style**: Instant posting with intelligent rate limiting
- **IFTTT-Like Triggers**: New content detected = immediate action (if allowed)

### **📈 Next Evolution:**

The RSS system is now a **production-grade, event-driven autoposter** capable of:
- Breaking news (instant posts)
- Multi-platform publishing (4 platforms)
- Intelligent rate limiting (3-layer protection)
- Platform-optimized content (Pinterest vs. social media)
- Zero manual intervention (set it and forget it)

**It's ready for Culture Crave-level instant news posting! 🚀**