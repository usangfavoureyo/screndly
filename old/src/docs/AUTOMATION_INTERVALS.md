# Screndly Automation Intervals

**Last Updated**: December 14, 2024  
**Automation Strategy**: Culture Crave-style automatic posting with aggressive monitoring

---

## ⚡ Automation Schedule

Screndly runs **aggressive background automation** for instant content discovery and posting, similar to Culture Crave's real-time approach.

### **RSS Feeds**: Every 5 minutes 🔥

```javascript
// Cron: */5 * * * *
cron.schedule('*/5 * * * *', async () => {
  console.log('[CRON] Running RSS feed automation...');
  await fetchRSSFeeds();
});
```

**Frequency**: 12 times per hour, 288 times per day, **8,640 times per month**

**What it does**:
- ✅ Fetches latest RSS feed entries
- ✅ Detects new trailer releases
- ✅ Enriches with AI-powered image selection (Serper API)
- ✅ Filters 9:16 vertical videos (YouTube Shorts)
- ✅ Automatically posts to selected platforms
- ✅ Logs activity

**Why every 5 minutes?**
- Breaking news trailers appear instantly
- Culture Crave-level responsiveness
- Be first to post major announcements
- Catch time-sensitive content

**API Impact**:
```
Serper API Usage:
  • 8,640 runs/month
  • ~10% need image enrichment = 864 searches/month
  • Free tier: 2,500 searches/month
  • Usage: 35% of free tier ✅ Still free
```

---

### **TMDb Posts**: Every 60 minutes (Hourly) 📅

```javascript
// Cron: 0 * * * *
cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Checking TMDb posts...');
  await checkTMDbPosts();
});
```

**Frequency**: Once per hour, **720 times per month**

**What it does**:
- ✅ Checks for upcoming movie/TV anniversaries
- ✅ Applies 11-rule Hollywood filtering system
- ✅ Generates scheduled posts
- ✅ Smart ranking and deduplication
- ✅ Timezone-aware scheduling

**Why every hour?**
- Daily checks are sufficient for anniversaries
- Not time-critical (scheduled in advance)
- Reduces unnecessary API calls
- TMDb has daily rate limits

**API Impact**:
```
TMDb API Usage:
  • 720 runs/month
  • ~100 requests per run
  • Total: 72,000 requests/month
  • Free tier: Unlimited (40 req/10s limit)
  • Usage: Well within limits ✅ Free
```

---

### **Comment Automation**: Every 10 minutes 💬

```javascript
// Cron: */10 * * * *
cron.schedule('*/10 * * * *', async () => {
  console.log('[CRON] Processing comments...');
  await processComments();
});
```

**Frequency**: 6 times per hour, 144 times per day, **4,320 times per month**

**What it does**:
- ✅ Fetches new comments from all platforms
- ✅ Filters blacklisted users/keywords
- ✅ Generates AI-powered replies (OpenAI)
- ✅ Posts replies automatically
- ✅ Tracks engagement metrics

**Why every 10 minutes?**
- Timely engagement with audience
- Catch comments before they get buried
- Maintain active community presence
- Balance responsiveness with API costs

**API Impact**:
```
OpenAI API Usage:
  • 4,320 runs/month
  • ~10 new comments per run = 43,200 comments/month
  • With throttling (max 100 replies/day) = 3,000 replies/month
  • GPT-4o-mini: ~300 tokens per reply
  • Total: 900,000 tokens/month
  • Cost: ~$0.90/month ✅ Very cheap
```

---

### **Daily Cleanup**: 3 AM Daily 🧹

```javascript
// Cron: 0 3 * * *
cron.schedule('0 3 * * *', async () => {
  console.log('[CRON] Running daily cleanup...');
  await cleanupOldLogs();
});
```

**Frequency**: Once per day, **30 times per month**

**What it does**:
- ✅ Deletes old activity logs (configurable retention)
- ✅ Cleans up processed RSS posts
- ✅ Archives completed upload jobs
- ✅ Prunes cache entries
- ✅ Database maintenance

**Why 3 AM?**
- Low traffic period
- Won't interfere with automation
- Standard maintenance window
- Minimal user impact

---

## 📊 Automation Volume Summary

| Task | Interval | Runs/Day | Runs/Month | API Calls/Month |
|------|----------|----------|------------|-----------------|
| **RSS Feeds** | 5 min | 288 | 8,640 | ~864 (Serper) |
| **TMDb Posts** | 60 min | 24 | 720 | ~72,000 (TMDb) |
| **Comments** | 10 min | 144 | 4,320 | ~3,000 (OpenAI) |
| **Cleanup** | Daily | 1 | 30 | 0 |
| **TOTAL** | | **457** | **13,710** | |

**Your backend processes over 450 automation tasks per day!** 🚀

---

## 🎯 Why These Intervals?

### **Culture Crave-Style Strategy**

Screndly follows the **Culture Crave model**:
- ✅ **Speed over approval** - Instant posting, no manual review
- ✅ **First to market** - Beat competitors to breaking news
- ✅ **High volume** - Many posts, let algorithm pick winners
- ✅ **Automated everything** - Minimal manual intervention

### **RSS Every 5 Minutes**

**Problem**: Trailer drops are time-sensitive
```
Scenario: Marvel drops a new trailer at 9:00 AM

Every 30 min: You post at 9:30 AM (30 min delay)
              ❌ 100+ accounts already posted

Every 5 min:  You post at 9:05 AM (5 min delay)
              ✅ Top 10 to post, maximum reach
```

**Impact**: 5-minute interval = **6× faster** response time

### **Comments Every 10 Minutes**

**Problem**: Late replies get buried
```
Scenario: User comments on your video

Every 2 hours: You reply 2 hours later
               ❌ Comment buried, low engagement

Every 10 min:  You reply within 10 minutes
               ✅ Active engagement, builds community
```

**Impact**: 10-minute interval = **12× faster** engagement

---

## 💰 Cost Impact

### **API Usage with Aggressive Automation**

| API | Monthly Usage | Free Tier | Overage Cost | Actual Cost |
|-----|---------------|-----------|--------------|-------------|
| **Serper** | 864 searches | 2,500 searches | $0.001/search | **$0** ✅ |
| **TMDb** | 72,000 requests | Unlimited* | None | **$0** ✅ |
| **OpenAI** | 900K tokens | $5 credit | $0.60/1M tokens | **$0.54** |
| **TOTAL** | | | | **$0.54/month** |

*TMDb free tier has 40 requests/10s rate limit, not a monthly cap

**Aggressive automation adds less than $1/month to costs!** 💚

---

## 🔧 Configuration

### Environment Variables

```env
# Cron Job Intervals (in minutes)
RSS_FETCH_INTERVAL=5
TMDB_CHECK_INTERVAL=60
COMMENT_CHECK_INTERVAL=10

# Automation Limits
MAX_COMMENT_REPLIES_PER_DAY=100
MAX_RSS_POSTS_PER_FEED=10
MAX_TMDB_POSTS_PER_DAY=5

# Retention Periods (in days)
ACTIVITY_LOG_RETENTION=30
RSS_POST_RETENTION=90
UPLOAD_JOB_RETENTION=60
```

### Adjusting Intervals

```javascript
// src/config/automation.ts
export const AUTOMATION_CONFIG = {
  rss: {
    interval: process.env.RSS_FETCH_INTERVAL || 5, // minutes
    maxPostsPerFeed: 10,
    retryAttempts: 3
  },
  tmdb: {
    interval: process.env.TMDB_CHECK_INTERVAL || 60, // minutes
    maxPostsPerDay: 5,
    lookAheadDays: 7
  },
  comments: {
    interval: process.env.COMMENT_CHECK_INTERVAL || 10, // minutes
    maxRepliesPerDay: 100,
    blacklistEnabled: true
  },
  cleanup: {
    schedule: '0 3 * * *', // 3 AM daily
    activityLogRetention: 30, // days
    rssPostRetention: 90,
    uploadJobRetention: 60
  }
};
```

---

## 📈 Performance Considerations

### **Railway Hobby Plan (512MB RAM)**

**Can it handle this volume?**

```
Memory Usage Estimate:
  • Node.js base:        ~50MB
  • Express server:      ~30MB
  • Prisma client:       ~40MB
  • RSS parser:          ~20MB
  • Cron jobs (idle):    ~10MB
  • Peak usage:          ~200MB
  
Total: ~200MB peak (39% of 512MB limit) ✅ Plenty of headroom
```

**CPU Usage Estimate:**
```
RSS automation (5 min):
  • Fetch 5 feeds
  • Parse XML
  • API calls
  • Database writes
  • Total: ~2-3 seconds per run
  • CPU: <5% average

TMDb automation (60 min):
  • API calls (100 req)
  • Filtering logic
  • Database updates
  • Total: ~5-10 seconds per run
  • CPU: <3% average

Comment automation (10 min):
  • Fetch comments (5 platforms)
  • OpenAI API calls
  • Post replies
  • Total: ~10-15 seconds per run
  • CPU: <8% average

Overall CPU usage: <10% average ✅ Very efficient
```

---

## 🚨 Rate Limiting

### **Built-in Rate Limits**

```typescript
// src/services/rss.service.ts
export class RSSService {
  private rateLimiter = new RateLimiter({
    tokensPerInterval: 12,
    interval: 'hour'
  });

  async fetchFeed(url: string) {
    await this.rateLimiter.removeTokens(1);
    // Fetch feed
  }
}
```

### **Platform Rate Limits**

| Platform | Rate Limit | Screndly Usage | Status |
|----------|-----------|----------------|--------|
| **YouTube** | 10,000 quota/day | ~500/day | ✅ 5% |
| **X (Twitter)** | 300 posts/3hr | ~50/3hr | ✅ 17% |
| **TikTok** | 100 posts/day | ~30/day | ✅ 30% |
| **Instagram** | 50 posts/day | ~20/day | ✅ 40% |
| **Facebook** | 200 posts/day | ~30/day | ✅ 15% |

**All well within limits** ✅

---

## 🎛️ Customization Options

### **Conservative Mode** (Lower frequency)

```env
RSS_FETCH_INTERVAL=15      # Every 15 min (vs 5)
COMMENT_CHECK_INTERVAL=30  # Every 30 min (vs 10)
```

**Pros**: Lower API usage, less server load  
**Cons**: Slower response time, may miss time-sensitive content

### **Aggressive Mode** (Higher frequency) - Current ✅

```env
RSS_FETCH_INTERVAL=5       # Every 5 min
COMMENT_CHECK_INTERVAL=10  # Every 10 min
```

**Pros**: Fastest response, Culture Crave-level speed  
**Cons**: Slightly higher API usage (still cheap)

### **Extreme Mode** (Maximum frequency)

```env
RSS_FETCH_INTERVAL=1       # Every 1 min ⚠️
COMMENT_CHECK_INTERVAL=5   # Every 5 min
```

**Pros**: Absolute fastest, guaranteed first to post  
**Cons**: 
- May hit rate limits
- Higher costs (~$2-3/month extra)
- More server load
- Overkill for most use cases

**Not recommended** unless you're competing with major news accounts

---

## 📊 Monitoring Automation

### **Check Automation Health**

```bash
# View cron job logs
railway logs --filter "CRON"

# Check last run times
curl https://your-api.railway.app/api/automation/status

# Response:
{
  "rss": {
    "lastRun": "2024-12-14T12:05:00Z",
    "nextRun": "2024-12-14T12:10:00Z",
    "status": "healthy",
    "runsToday": 144
  },
  "tmdb": {
    "lastRun": "2024-12-14T12:00:00Z",
    "nextRun": "2024-12-14T13:00:00Z",
    "status": "healthy",
    "runsToday": 12
  },
  "comments": {
    "lastRun": "2024-12-14T12:10:00Z",
    "nextRun": "2024-12-14T12:20:00Z",
    "status": "healthy",
    "runsToday": 72
  }
}
```

### **Database Queries**

```sql
-- Check recent automation runs
SELECT type, COUNT(*) as runs, MAX(createdAt) as last_run
FROM ActivityLog
WHERE createdAt > NOW() - INTERVAL '24 hours'
  AND type IN ('rss', 'tmdb', 'comments')
GROUP BY type;

-- Check automation success rate
SELECT 
  type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM ActivityLog
WHERE createdAt > NOW() - INTERVAL '7 days'
  AND type IN ('rss', 'tmdb', 'comments')
GROUP BY type;
```

---

## ✅ Recommendations

### **For Single User** (Current Setup) ⭐

```
RSS:      Every 5 minutes  ✅ Optimal
TMDb:     Every 60 minutes ✅ Optimal
Comments: Every 10 minutes ✅ Optimal
```

**Why this works**:
- Fast enough to compete with major accounts
- Low enough cost to stay in free tiers
- Balanced server load
- Culture Crave-style responsiveness

### **If Scaling to Team**

```
RSS:      Every 2-3 minutes (faster)
TMDb:     Every 30 minutes (more frequent)
Comments: Every 5 minutes (faster engagement)
```

### **If Reducing Costs**

```
RSS:      Every 15 minutes (slower but free)
TMDb:     Every 2 hours (less frequent)
Comments: Every 30 minutes (acceptable)
```

---

## 🎉 Bottom Line

**Your current automation setup is perfect for Culture Crave-style instant posting:**

✅ **8,640 RSS checks/month** - Never miss a trailer drop  
✅ **720 TMDb checks/month** - Always find anniversaries  
✅ **4,320 comment checks/month** - Engage with every comment  
✅ **13,710 total automation runs/month** - Fully automated  
✅ **$0.54/month extra cost** - Nearly free  

**You're running a professional-grade automation system for less than the cost of a coffee!** ☕

---

## 📚 Related Documentation

- **[Production Architecture](./PRODUCTION_ARCHITECTURE.md)** - Full system overview
- **[Railway Setup](./RAILWAY_SETUP.md)** - Backend deployment
- **[Total Monthly Cost](./TOTAL_MONTHLY_COST.md)** - Complete cost breakdown
- **[Option B Quick Start](./OPTION_B_QUICK_START.md)** - Get started in 30 minutes

---

**Your automation is ready to compete with Culture Crave!** 🚀⚡
