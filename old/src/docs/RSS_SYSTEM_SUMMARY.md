# 📡 RSS FEED SYSTEM - QUICK SUMMARY

---

## ✅ **YES, IT'S AN AUTOMATIC SCHEDULING SYSTEM**

Like Culture Crave: **Set it and forget it.**

---

## 🎯 **HOW IT WORKS (SIMPLE VERSION)**

### **User Actions (One Time):**

1. Go to **Feeds** → **RSS Feeds** page
2. Click **"+ Add RSS Feed"**
3. Configure:
   - Feed URL (e.g., `https://variety.com/feed/`)
   - Polling interval (how often to check: 5-30 minutes)
   - Filters (required/blocked keywords)
   - Platforms (X, Threads, Facebook, Pinterest)
   - **Toggle Auto-Post: ✅ ON**
4. Save

**That's it. Walk away.**

---

### **Background Actions (Automatic):**

```
Every 5 minutes:
├─ rssFeedScheduler checks all enabled feeds
├─ For feeds due for polling:
│   ├─ Fetch RSS XML
│   ├─ Parse entries
│   ├─ Apply filters (required/blocked keywords)
│   ├─ Check deduplication (skip if seen before)
│   ├─ Enrich with images (Serper API)
│   ├─ Generate captions (GPT API)
│   └─ Add to postQueue (priority: P2)
│
└─ autopostEngine checks if 3 hours passed
    ├─ If yes:
    │   ├─ Get highest-priority item from queue
    │   ├─ Post to all enabled platforms
    │   └─ Mark as posted
    └─ If no: Wait
```

**Users never touch it again.**

---

## 📊 **EXAMPLE SCENARIO**

### **User Setup (10:00 AM):**
```
User adds feed: "Variety - Film News"
├─ URL: https://variety.com/feed/
├─ Polling interval: 10 minutes
├─ Filter: Required keywords = "trailer" OR "teaser"
├─ Platforms: X, Threads
└─ Auto-Post: ✅ Enabled
```

### **Background Process (Automatic):**
```
10:10 AM - Scheduler polls Variety
           ├─ Found 2 new items
           ├─ Both pass filters
           ├─ Enriched with images
           ├─ Generated captions
           └─ Added to queue (priority: P2)

10:15 AM - Engine posts item 1
           ├─ Posted to X ✅
           ├─ Posted to Threads ✅
           └─ Marked as posted

1:15 PM  - Engine posts item 2 (3 hours later)
           ├─ Posted to X ✅
           ├─ Posted to Threads ✅
           └─ Marked as posted
```

**User did NOTHING after 10:00 AM. System handled everything.**

---

## 🔄 **WHERE IS EVERYTHING?**

### **UI (User Controls):**
- **Location:** Feeds → RSS Feeds page (`/components/RSSPage.tsx`)
- **Purpose:** Add/edit feed sources, set filters, toggle auto-post
- **Storage:** `localStorage.getItem('screndly_rss_feeds')`

### **Scheduler (Background Worker):**
- **Location:** `/lib/autopost/rssFeedScheduler.ts`
- **Purpose:** Poll feeds, filter items, enrich, generate captions, queue
- **Auto-starts:** When app loads (if enabled)
- **Polling frequency:** Every 5 minutes (global), per-feed intervals respected

### **Queue (Centralized Storage):**
- **Location:** `/lib/autopost/postQueue.ts`
- **Purpose:** Store all eligible items from all sources (RSS, TMDb, YouTube)
- **Priority order:** P1 (Today/YouTube) > P2 (RSS/Weekly) > P3 (Anniversary) > P4 (Monthly)

### **Engine (Posting Worker):**
- **Location:** `/lib/autopost/autopostEngine.ts`
- **Purpose:** Post one item every 3 hours from queue
- **Auto-starts:** When app loads (if enabled)
- **Rate limit:** 3 hours between ANY posts (global)

---

## 🎯 **KEY POINTS**

| Question | Answer |
|----------|--------|
| **Is it automatic?** | ✅ YES - Polls feeds automatically, posts automatically |
| **Do users need to approve posts?** | ❌ NO - Auto-post = hands-off (if toggle is ON) |
| **Can users still post manually?** | ✅ YES - Turn auto-post OFF for manual mode |
| **How often does it check feeds?** | Every N minutes (configurable per feed, default: 10 min) |
| **How often does it post?** | One post every 3 hours (global rate limit) |
| **Can multiple feeds post at once?** | ❌ NO - All items go to ONE queue, posted one-by-one |
| **What if 10 items are detected?** | Queued, then posted one every 3 hours (30 hours total) |
| **Can users change platforms later?** | ✅ YES - Edit feed config, applies to new items |
| **How does deduplication work?** | Items are marked as "processed" in localStorage |
| **What if RSS feed is down?** | Scheduler logs error, tries again next poll |

---

## 📝 **CONFIGURATION CHECKLIST**

### **Per-Feed Settings (RSS Page UI):**
- ✅ Feed name
- ✅ RSS URL
- ✅ Polling interval (5-30 minutes)
- ✅ Image count (1-3 or random)
- ✅ Dedupe days (7-90 days)
- ✅ Filter scope (title, body, title_or_body, title_and_body)
- ✅ Required keywords (all must match)
- ✅ Blocked keywords (none can match)
- ✅ Platforms (X, Threads, Facebook, Pinterest)
- ✅ Auto-post toggle (ON = automatic, OFF = manual)
- ✅ Serper priority (ON = use Serper for images first)
- ✅ Rehost images (ON = download and rehost images)

### **Global Settings:**
- ✅ RSS caption template (Settings → RSS Feeds → Caption Settings)
- ✅ Scheduler enabled/disabled (`rssFeedScheduler.updateConfig({ enabled: true })`)
- ✅ Autopost engine enabled/disabled (`autopostEngine.updateConfig({ enabled: true })`)
- ✅ Global posting interval (default: 3 hours, configurable in `postQueue`)

---

## 🚀 **FINAL ANSWER**

### **Is this an automatic scheduling system?**
**✅ YES.**

### **How does the RSS feed page work now?**
**The RSS page is a configuration dashboard. Users add feed sources, set filters, and enable auto-post. The background scheduler polls feeds automatically, filters items, enriches them, generates captions, and queues them for posting. The posting engine then posts one item every 3 hours without any manual intervention.**

### **Do users need to do anything after setup?**
**❌ NO. It's "set it and forget it" like Culture Crave.**

---

**🎉 The RSS system is now a fully automatic, production-ready posting scheduler.**
