# 📰 RSS Feed Workflow Documentation

**Last Updated:** December 2, 2024  
**Version:** 2.1.0

---

## Overview

Screndly's **RSS Feed news section** is an automated content ingestion and multi-platform publishing system that monitors entertainment news RSS feeds (Variety, The Hollywood Reporter, Deadline, IndieWire, etc.) and automatically posts relevant movie/TV news to social media platforms.

This is **separate from YouTube RSS polling for trailers** and focuses specifically on **text-based news articles** from entertainment journalism sources.

---

## 🎯 What It Does

The RSS Feed workflow:

1. **Monitors** entertainment news RSS feeds (Variety, THR, Deadline, etc.)
2. **Filters** articles based on keywords (trailer, teaser, announcement, etc.)
3. **Enriches** content with images from Serper API (Google Image Search)
4. **Generates** platform-optimized captions using AI
5. **Queues** approved items for scheduled posting
6. **Publishes** to multiple social platforms (X, Threads, Facebook)

**Use Case:** Automatically share entertainment news articles about trailers, movie announcements, casting news, box office results, etc.

---

## 🔄 Complete Workflow

### **Stage 1: Feed Configuration**

```
User Action: Add RSS Feed
   ↓
Configure Feed Settings:
   • Feed URL (e.g., https://variety.com/feed/)
   • Name (e.g., "Variety - Film News")
   • Polling Interval (5, 10, 15, 30 minutes)
   • Image Count (1, 2, 3, or random)
   • Deduplication Days (30 days default)
   ↓
Configure Filters:
   • Scope: title / body / title_or_body / title_and_body
   • Required Keywords: ["trailer", "teaser", "announces"]
   • Blocked Keywords: ["leak", "spoiler"]
   • Match Type: contains / exact
   • Case Sensitive: yes / no
   ↓
Configure Platforms:
   • X (Twitter): enabled/disabled
   • Threads: enabled/disabled
   • Facebook: enabled/disabled
   • Instagram: enabled/disabled (future)
   ↓
Advanced Settings:
   • Serper Priority: use Serper API for images
   • Rehost Images: download and rehost on your CDN
   • Auto-Post: automatically publish or require manual approval
   ↓
Save Feed → Feed Added to Monitoring
```

---

### **Stage 2: Feed Polling & Detection**

```
┌────────────────────────────────────────┐
│ Automated Feed Polling Service         │
│ (Runs every X minutes per feed)        │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Fetch RSS Feed XML                     │
│ GET https://variety.com/feed/          │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Parse RSS Items (XML → JSON)           │
│ Extract:                               │
│ • Title                                │
│ • Link                                 │
│ • Publication Date                     │
│ • Description/Body                     │
│ • Author                               │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Apply Keyword Filters                  │
│ ✓ Check Required Keywords              │
│ ✗ Check Blocked Keywords               │
│ ✓ Check Scope (title/body)             │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Deduplication Check                    │
│ • Check if URL already posted          │
│ • Check if title matches (fuzzy)       │
│ • Skip if posted within X days         │
└──────────────┬─────────────────────────┘
               ↓
         New Item Detected!
               ↓
      Move to Stage 3: Enrichment
```

**Example RSS Item Detected:**
```json
{
  "title": "Dune: Part Three Confirmed by Warner Bros.",
  "link": "https://variety.com/2024/film/news/dune-part-three-confirmed",
  "pubDate": "2024-12-02T10:30:00Z",
  "description": "Warner Bros. has officially confirmed that Dune: Part Three is in development...",
  "source": "Variety"
}
```

---

### **Stage 3: Content Enrichment**

```
┌────────────────────────────────────────┐
│ New RSS Item Detected                  │
│ Status: queued                         │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Serper API Image Search                │
│ (Google Image Search via API)          │
│                                        │
│ Query: "Dune Part Three movie poster"  │
│ + Article title keywords               │
│                                        │
│ Returns:                               │
│ • Image URL                            │
│ • Image dimensions                     │
│ • Context/reason for match             │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Image Selection Logic                  │
│                                        │
│ IF imageCount = "1": Select 1 image    │
│ IF imageCount = "2": Select 2 images   │
│ IF imageCount = "3": Select 3 images   │
│ IF imageCount = "random": Random 1-3   │
│                                        │
│ Priority:                              │
│ 1. Official posters                    │
│ 2. High-res promotional images         │
│ 3. Scene stills                        │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Optional: Rehost Images                │
│ (If rehostImages = true)               │
│                                        │
│ Download image → Upload to CDN         │
│ → Replace URL with CDN URL             │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ AI Caption Generation                  │
│ (GPT-4o-mini / GPT-4)                  │
│                                        │
│ Input:                                 │
│ • Article title                        │
│ • Article snippet                      │
│ • Platform requirements                │
│                                        │
│ Output:                                │
│ • X: 280 chars max                     │
│ • Threads: 500 chars max               │
│ • Facebook: 300 words                  │
│                                        │
│ Style: Engaging, emoji-rich, hashtags  │
└──────────────┬─────────────────────────┘
               ↓
      Status: enriched
               ↓
      Move to Stage 4: Captioning
```

**Example Enriched Item:**
```json
{
  "title": "Dune: Part Three Confirmed by Warner Bros.",
  "link": "https://variety.com/...",
  "snippet": "Warner Bros. has officially confirmed...",
  "images": [
    {
      "url": "https://cdn.example.com/dune-poster.jpg",
      "reason": "Official poster match"
    },
    {
      "url": "https://cdn.example.com/dune-scene.jpg",
      "reason": "Scene imagery"
    }
  ],
  "status": "enriched"
}
```

---

### **Stage 4: Caption Generation & Approval**

```
┌────────────────────────────────────────┐
│ Enriched Item Ready                    │
│ Status: enriched                       │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Generate Platform-Specific Captions    │
│ (OpenAI GPT-4o-mini)                   │
│                                        │
│ Prompt Template:                       │
│ "Create engaging social media caption  │
│  for [platform] based on this article: │
│  Title: [title]                        │
│  Content: [snippet]                    │
│  Style: [platform-specific style]"     │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Caption Examples Generated:            │
│                                        │
│ X (Twitter):                           │
│ "BREAKING: Dune: Part Three confirmed! │
│  🏜️ Denis Villeneuve returns to        │
│  complete the epic trilogy. The spice  │
│  must flow... #Dune #DunePartThree"    │
│ (147 chars)                            │
│                                        │
│ Threads:                               │
│ "Warner Bros. just made it official—   │
│  Dune: Part Three is happening! 🎬     │
│  Denis Villeneuve returns to direct    │
│  the final chapter. Production details │
│  coming soon. #Dune #Movies"           │
│ (178 chars)                            │
│                                        │
│ Facebook:                              │
│ "🎉 BREAKING NEWS: Dune: Part Three    │
│  Officially Greenlit!                  │
│                                        │
│  Following the massive success of Part │
│  Two, Warner Bros. has confirmed that  │
│  Denis Villeneuve will return to       │
│  complete his epic sci-fi trilogy...   │
│  [full caption]"                       │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ User Review (If autoPost = false)      │
│                                        │
│ Queue Widget Shows:                    │
│ • Feed name                            │
│ • Article title                        │
│ • Generated captions                   │
│ • Selected images (preview)            │
│ • Status: captioned                    │
│                                        │
│ Actions:                               │
│ • Edit Caption                         │
│ • Change Images                        │
│ • Approve → Schedule                   │
│ • Reject → Delete                      │
└──────────────┬─────────────────────────┘
               ↓
         IF Approved:
               ↓
      Status: captioned
               ↓
      Move to Stage 5: Scheduling
```

---

### **Stage 5: Scheduling & Queue Management**

```
┌────────────────────────────────────────┐
│ Item Approved for Publishing           │
│ Status: captioned                      │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Posting Interval Logic                 │
│                                        │
│ Global Posting Interval: 10 minutes    │
│ (configurable: 5/10/15/30 min)         │
│                                        │
│ Check last published time:             │
│ Last post: 10:00 AM                    │
│ Current time: 10:08 AM                 │
│ Next available slot: 10:10 AM          │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Calculate Scheduled Time               │
│                                        │
│ IF queue is empty:                     │
│   Schedule immediately                 │
│                                        │
│ IF queue has items:                    │
│   Last item scheduled: 10:10 AM        │
│   Add interval (10 min)                │
│   New scheduled time: 10:20 AM         │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Add to Publishing Queue                │
│                                        │
│ Queue Position: #3                     │
│ Scheduled Time: 10:20 AM               │
│ Status: queued                         │
│ Platforms: X, Threads                  │
└──────────────┬─────────────────────────┘
               ↓
      Wait for Scheduled Time
               ↓
      Move to Stage 6: Publishing
```

**Queue Example:**
```
┌─────────────────────────────────────────────────────┐
│ RSS Publishing Queue                                │
├─────────────────────────────────────────────────────┤
│ #1 | 10:10 AM | Gladiator II Box Office | queued   │
│ #2 | 10:15 AM | Marvel Phase 6 News | queued       │
│ #3 | 10:20 AM | Dune Part Three | queued            │
│ #4 | 10:25 AM | Avatar 3 Release Date | queued      │
└─────────────────────────────────────────────────────┘
```

---

### **Stage 6: Multi-Platform Publishing**

```
┌────────────────────────────────────────┐
│ Scheduled Time Reached                 │
│ Current Time: 10:20 AM                 │
│ Status: queued → publishing            │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Parallel Platform Publishing           │
│ (Publish to all enabled platforms)     │
└──────────────┬─────────────────────────┘
               ↓
      ┌────────┴────────┬────────┬────────┐
      ↓                 ↓        ↓        ↓
┌──────────┐    ┌──────────┐ ┌──────────┐
│ X API    │    │ Threads  │ │ Facebook │
│          │    │ API      │ │ API      │
│ POST /   │    │ POST /   │ │ POST /   │
│ tweets   │    │ threads  │ │ posts    │
└────┬─────┘    └────┬─────┘ └────┬─────┘
     ↓               ↓            ↓
┌────────────────────────────────────────┐
│ Platform API Calls                     │
│                                        │
│ X (Twitter API v2):                    │
│ POST /2/tweets                         │
│ Body: {                                │
│   "text": "BREAKING: Dune Part Three   │
│            confirmed! 🏜️...",          │
│   "media": { "media_ids": ["123"] }    │
│ }                                      │
│                                        │
│ Threads API:                           │
│ POST /me/threads                       │
│ Body: {                                │
│   "text": "Warner Bros. just made...", │
│   "media_type": "IMAGE",               │
│   "image_url": "https://..."           │
│ }                                      │
│                                        │
│ Facebook Graph API:                    │
│ POST /me/feed                          │
│ Body: {                                │
│   "message": "🎉 BREAKING NEWS...",    │
│   "link": "https://variety.com/..."    │
│ }                                      │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Response Handling                      │
│                                        │
│ IF all platforms succeed:              │
│   Status: published                    │
│   Log success with post IDs            │
│                                        │
│ IF any platform fails:                 │
│   Status: failed (partial)             │
│   Log error message                    │
│   Retry logic (3 attempts)             │
│                                        │
│ IF all platforms fail:                 │
│   Status: failed                       │
│   Add to error queue                   │
└──────────────┬─────────────────────────┘
               ↓
      Status: published
               ↓
      Move to Stage 7: Logging
```

---

### **Stage 7: Activity Logging & Monitoring**

```
┌────────────────────────────────────────┐
│ Publishing Complete                    │
│ Status: published                      │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Create Activity Log Entry              │
│                                        │
│ Log Data:                              │
│ • Timestamp: 2024-12-02 10:20:15       │
│ • Feed: Variety                        │
│ • Title: Dune: Part Three Confirmed    │
│ • Platforms: [X, Threads]              │
│ • Status: published                    │
│ • Post IDs: {                          │
│     x: "1234567890",                   │
│     threads: "9876543210"              │
│   }                                    │
│ • Engagement: 0 (initial)              │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Update Dashboard Stats                 │
│                                        │
│ • Total Feeds: 4                       │
│ • Active Feeds: 3                      │
│ • Published Today: +1 (now 5)          │
│ • Errors: 0                            │
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Send Notification                      │
│                                        │
│ Desktop Notification:                  │
│ "✅ Published: Dune: Part Three        │
│  Confirmed to X, Threads"              │
│                                        │
│ Toast Notification (in-app):           │
│ "Successfully published to 2 platforms"│
└──────────────┬─────────────────────────┘
               ↓
┌────────────────────────────────────────┐
│ Deduplication Record                   │
│                                        │
│ Store in database:                     │
│ • Article URL                          │
│ • Published Date                       │
│ • Platforms                            │
│ • TTL: 30 days (configurable)          │
│                                        │
│ Purpose: Prevent re-posting same news  │
└──────────────┬─────────────────────────┘
```

**Activity Log Example:**
```
┌──────────────────────────────────────────────────────────┐
│ RSS Activity Log                                         │
├──────────────────────────────────────────────────────────┤
│ ✅ 10:20 AM | Variety | Dune Part Three | X, Threads    │
│ ✅ 10:15 AM | THR | Marvel Phase 6 | X, Threads, FB     │
│ ❌ 10:10 AM | Deadline | Nolan Film | Failed (API error)│
│ ✅ 10:00 AM | IndieWire | Sundance | X, Threads         │
└──────────────────────────────────────────────────────────┘
```

---

## 📱 User Interface Components

### **1. RSS Page** (`/rss`)

**Stats Cards:**
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total Feeds │   Active    │  Published  │   Errors    │
│      4      │      3      │   Today: 5  │      0      │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Global Controls:**
```
┌──────────────────────────────────────────────────────┐
│ [Add Feed]  Global RSS: [ON]  Interval: [10 min]    │
│             Deduplication: [ON]                      │
└──────────────────────────────────────────────────────┘
```

**Feed Cards Grid:**
```
┌───────────────────────┐ ┌───────────────────────┐
│ Variety - Film News   │ │ The Hollywood Reporter│
│ variety.com           │ │ hollywoodreporter.com │
│                       │ │                       │
│ Status: Active 🟢     │ │ Status: Active 🟢     │
│ Interval: 10 min      │ │ Interval: 15 min      │
│ Last run: 2 min ago   │ │ Last run: 5 min ago   │
│ Next: 8 min           │ │ Next: 10 min          │
│                       │ │                       │
│ Platforms:            │ │ Platforms:            │
│ [X] [Threads] [ ]FB   │ │ [X] [ ] [Facebook]    │
│                       │ │                       │
│ [Edit] [Test] [Run]   │ │ [Edit] [Test] [Run]   │
└───────────────────────┘ └───────────────────────┘
```

### **2. Feed Editor** (Modal)

```
┌──────────────────────────────────────────────────┐
│ Edit Feed: Variety - Film News              [×] │
├──────────────────────────────────────────────────┤
│                                                  │
│ Basic Settings                                   │
│ ├─ Feed Name: [Variety - Film News          ]   │
│ ├─ Feed URL:  [https://variety.com/feed/    ]   │
│ ├─ Interval:  [10 minutes ▼]                    │
│ ├─ Images:    [2 ▼]                             │
│ └─ Dedupe:    [30 days ▼]                       │
│                                                  │
│ Filters                                          │
│ ├─ Scope: [Title or Body ▼]                     │
│ │                                                │
│ ├─ Required Keywords:                           │
│ │  • [trailer     ] [contains ▼] [ ] Case ✓    │
│ │  • [teaser      ] [contains ▼] [ ] Case ✓    │
│ │  • [announces   ] [contains ▼] [ ] Case ✓    │
│ │  [+ Add Keyword]                              │
│ │                                                │
│ └─ Blocked Keywords:                            │
│    • [leak        ] [contains ▼] [ ] Case ✓    │
│    • [spoiler     ] [contains ▼] [ ] Case ✓    │
│    [+ Add Keyword]                              │
│                                                  │
│ Platform Settings                                │
│ ├─ X (Twitter):  [ON]  Images: [2 ▼]           │
│ ├─ Threads:      [ON]  Images: [2 ▼]           │
│ ├─ Facebook:     [OFF] Images: [1 ▼]           │
│ └─ Instagram:    [OFF] Images: [1 ▼]           │
│                                                  │
│ Advanced                                         │
│ ├─ Serper Priority:  [ON]                       │
│ ├─ Rehost Images:    [OFF]                      │
│ └─ Auto-Post:        [ON]                       │
│                                                  │
│              [Cancel]  [Save Feed]               │
└──────────────────────────────────────────────────┘
```

### **3. Feed Preview** (Modal)

```
┌──────────────────────────────────────────────────┐
│ Feed Preview: Latest Item                   [×] │
├──────────────────────────────────────────────────┤
│                                                  │
│ Title:                                           │
│ Dune: Part Three Confirmed by Warner Bros.      │
│                                                  │
│ Link:                                            │
│ https://variety.com/2024/film/news/dune-part-... │
│                                                  │
│ Published: 2 hours ago                           │
│                                                  │
│ Snippet:                                         │
│ Warner Bros. has officially confirmed that Dune: │
│ Part Three is in development, with Denis         │
│ Villeneuve returning to direct...                │
│                                                  │
│ ┌──────────────────┐ ┌──────────────────┐       │
│ │ Image 1          │ │ Image 2          │       │
│ │ [Poster match]   │ │ [Scene imagery]  │       │
│ └──────────────────┘ └──────────────────┘       │
│                                                  │
│ Generated Caption:                               │
│ ┌────────────────────────────────────────────┐  │
│ │ BREAKING: Warner Bros. confirms Dune: Part │  │
│ │ Three is officially happening! 🎬          │  │
│ │                                            │  │
│ │ Denis Villeneuve returns to complete the   │  │
│ │ epic trilogy. Production details coming    │  │
│ │ soon. #Dune #DunePartThree #Movies         │  │
│ │                                            │  │
│ │ 147/280 characters                         │  │
│ └────────────────────────────────────────────┘  │
│                                                  │
│              [Run Pipeline Test]                 │
└──────────────────────────────────────────────────┘
```

### **4. RSS Activity Page** (`/rss-activity`)

```
┌──────────────────────────────────────────────────┐
│ RSS Activity                                     │
│ All automated RSS feed publishing activity       │
├──────────────────────────────────────────────────┤
│                                                  │
│ Filter: [All Status ▼] [All Feeds ▼] [Search  ]│
│                                                  │
│ ┌──────────────────────────────────────────────┐│
│ │ ✅ Published • 10:20 AM • 2 min ago          ││
│ │ Variety                                      ││
│ │ Dune: Part Three Confirmed by Warner Bros.   ││
│ │ [X] [Threads]                                ││
│ │ ← Swipe to delete                            ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ ┌──────────────────────────────────────────────┐│
│ │ ✅ Published • 10:15 AM • 7 min ago          ││
│ │ The Hollywood Reporter                       ││
│ │ Marvel Announces New Phase 6 Projects        ││
│ │ [X] [Threads] [Facebook]                     ││
│ │ ← Swipe to delete                            ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ ┌──────────────────────────────────────────────┐│
│ │ ❌ Failed • 10:10 AM • 12 min ago            ││
│ │ IndieWire                                    ││
│ │ Sundance 2025 Lineup Revealed                ││
│ │ Error: Failed to fetch images from Serper    ││
│ │ [Retry]                                      ││
│ │ ← Swipe to delete                            ││
│ └──────────────────────────────────────────────┘│
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 🔧 Configuration Settings

### **Settings → RSS** (`/settings-rss`)

```
┌──────────────────────────────────────────────────┐
│ RSS Settings                                     │
├──────────────────────────────────────────────────┤
│                                                  │
│ Global Settings                                  │
│ ├─ Enable RSS Posting:     [ON]                 │
│ ├─ Default Posting Interval: [10 minutes ▼]     │
│ ├─ Default Image Count:    [2 ▼]                │
│ └─ Deduplication Window:   [30 days ▼]          │
│                                                  │
│ Serper API (Image Search)                        │
│ ├─ API Key:  [••••••••••••••••••••••] [Test]   │
│ ├─ Priority: [ON] (Use Serper first)            │
│ └─ Fallback: [Use RSS feed images]              │
│                                                  │
│ Image Processing                                 │
│ ├─ Rehost Images:        [OFF]                  │
│ ├─ CDN URL:              [https://cdn....]      │
│ ├─ Max Image Size:       [2MB ▼]                │
│ └─ Supported Formats:    [JPG, PNG, WEBP]       │
│                                                  │
│ Caption Generation                               │
│ ├─ AI Model:             [GPT-4o-mini ▼]        │
│ ├─ Caption Style:        [Engaging ▼]           │
│ ├─ Include Hashtags:     [ON]                   │
│ ├─ Max Hashtags:         [3 ▼]                  │
│ └─ Include Emojis:       [ON]                   │
│                                                  │
│ Publishing                                       │
│ ├─ Auto-Post by Default: [ON]                   │
│ ├─ Require Approval:     [OFF]                  │
│ ├─ Retry Failed Posts:   [ON] (3 attempts)      │
│ └─ Retry Delay:          [5 minutes ▼]          │
│                                                  │
│                      [Save Settings]             │
└──────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Architecture

```
┌───────────────────────────────────────────────────┐
│                  User Interface                   │
│  RSSPage → FeedEditor → FeedPreview → Activity   │
└────────────────┬──────────────────────────────────┘
                 ↓
┌───────────────────────────────────────────────────┐
│                 RSSFeedsContext                   │
│  (React Context for State Management)             │
│  • feeds[]                                        │
│  • addFeed()                                      │
│  • updateFeed()                                   │
│  • scheduleFeed()                                 │
│  • updateFeedStatus()                             │
└────────────────┬──────────────────────────────────┘
                 ↓
┌───────────────────────────────────────────────────┐
│              Backend API Services                 │
│  (Would be implemented on server)                 │
│                                                   │
│  /api/rss/feeds                                   │
│  • GET    - List all feeds                        │
│  • POST   - Create new feed                       │
│  • PUT    - Update feed                           │
│  • DELETE - Remove feed                           │
│                                                   │
│  /api/rss/poll                                    │
│  • POST   - Manually trigger feed poll            │
│                                                   │
│  /api/rss/enrich                                  │
│  • POST   - Enrich item with images/caption       │
│                                                   │
│  /api/rss/publish                                 │
│  • POST   - Publish item to platforms             │
│                                                   │
│  /api/rss/queue                                   │
│  • GET    - Get queued items                      │
│                                                   │
│  /api/rss/activity                                │
│  • GET    - Get activity log                      │
└────────────────┬──────────────────────────────────┘
                 ↓
┌───────────────────────────────────────────────────┐
│             External Services                     │
│                                                   │
│  • Serper API (Google Image Search)               │
│  • OpenAI API (Caption generation)                │
│  • X API (Twitter posting)                        │
│  • Threads API (Instagram Threads)                │
│  • Facebook Graph API (Facebook posts)            │
└───────────────────────────────────────────────────┘
```

---

## 🎯 Key Differences from YouTube RSS

| Feature | YouTube RSS (Trailers) | News RSS (Articles) |
|---------|------------------------|---------------------|
| **Source** | YouTube channel RSS feeds | News site RSS feeds |
| **Content Type** | Video files (MP4) | Text articles + images |
| **Detection** | 16:9 video format, trailer keywords | Article keywords filtering |
| **Enrichment** | Download video, generate thumbnails | Fetch images via Serper API |
| **Processing** | Video encoding, format conversion | Image selection, caption generation |
| **Publishing** | Upload video to 7 platforms | Post text + images to platforms |
| **Use Case** | Share movie/TV trailers | Share entertainment news articles |

---

## 🚀 Future Enhancements

- [ ] Instagram support (Carousel posts)
- [ ] LinkedIn support (Professional networks)
- [ ] Bluesky support (Decentralized social)
- [ ] Advanced sentiment analysis (Positive/negative news filtering)
- [ ] Engagement tracking (Likes, retweets, comments)
- [ ] A/B testing for captions
- [ ] Scheduled post optimization (Best time to post AI)
- [ ] Multi-language support
- [ ] Video attachment support (for video news)
- [ ] Thread/Tweet storm creation (Long articles)

---

## 📚 Related Documentation

- [README.md](/README.md) - Project overview
- [CHANGELOG.md](/CHANGELOG.md) - Version history
- [YOUTUBE_RSS_16x9_FILTERING.md](/docs/YOUTUBE_RSS_16x9_FILTERING.md) - YouTube trailer workflow
- [ARCHITECTURE.md](/docs/ARCHITECTURE.md) - System architecture
- [SERPER_IMAGE_DETECTION.md](/docs/SERPER_IMAGE_DETECTION.md) - Serper API image search system

---

## ✅ Summary

The **RSS Feed workflow** in Screndly is a **fully automated content ingestion and multi-platform publishing system** that:

1. **Monitors** entertainment news RSS feeds (Variety, THR, Deadline)
2. **Filters** articles based on configurable keywords
3. **Enriches** with AI-selected images from Serper API
4. **Generates** platform-optimized captions using GPT-4
5. **Schedules** posts at configurable intervals
6. **Publishes** to X, Threads, Facebook simultaneously
7. **Logs** all activity with success/failure tracking

**Result:** Automated entertainment news sharing that saves hours of manual posting while maintaining consistent, high-quality social media presence across multiple platforms! 📰✨

---

**Questions?** Review `/components/RSSPage.tsx`, `/contexts/RSSFeedsContext.tsx`, and `/components/rss/FeedCard.tsx` for implementation details.