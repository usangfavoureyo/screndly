# ANTIGRAVITY Backend Implementation Instructions

**Document Version**: 1.0  
**Last Updated**: December 31, 2025  
**Project**: Screndly Backend (Express.js + Prisma + Railway + Neon)

---

## 🔍 PREREQUISITE: STUDY THE APPLICATION FIRST

**BEFORE implementing any backend code, you MUST:**

### Step 1: Read Core Documentation (30-45 minutes)

**Essential reading in this order:**

1. **`/README.md`** - Project overview, tech stack, folder structure
2. **`/SCRENDLY_APP_STRUCTURE.md`** - Complete app architecture
3. **`/PROJECT_STATUS.md`** - Current implementation status
4. **`/docs/ARCHITECTURE.md`** - System design and patterns
5. **`/docs/API_CONTRACT.md`** - Frontend API expectations
6. **`/IMPLEMENTATION_CHECKLIST.md`** - Backend requirements (YOUR SPEC)
7. **`/docs/OPTION_B_QUICK_START.md`** - Railway + Neon deployment

### Step 2: Understand Feature Domains (30 minutes)

**Read these to understand business logic:**

8. **`/docs/TMDB_COMPLETE_WORKFLOW.md`** - TMDb posts workflow
9. **`/docs/RSS_FEED_WORKFLOW.md`** - RSS feeds workflow  
10. **`/docs/AUTOPOST_ARCHITECTURE.md`** - Autopost scheduling system
11. **`/docs/DESIGN_STUDIO_WORKFLOW.md`** - Design Studio feature
12. **`/BOTTOM_SHEET_SYSTEM.md`** - UI patterns (bottom sheets, not dialogs)

### Step 3: Study External Integrations (20 minutes)

**Understand third-party APIs:**

13. **`/docs/META_SETUP_GUIDE.md`** - Facebook/Instagram integration
14. **`/docs/X_SETUP_GUIDE.md`** - X (Twitter) integration
15. **`/docs/GOOGLE_VIDEO_INTELLIGENCE_SHOTSTACK_INTEGRATION.md`** - Video AI
16. **`/docs/PHOTOPEA_INTEGRATION.md`** - Design editing
17. **`/docs/ffmpeg-architecture.md`** - FFmpeg video processing

### Step 4: Review Frontend Implementation (45 minutes)

**CRITICAL: Study these files to understand data structures:**

```typescript
// Context providers (state management):
/contexts/SettingsContext.tsx              // Settings interface (70+ fields)
/contexts/TMDbPostsContext.tsx            // TMDbPost interface
/contexts/RSSFeedsContext.tsx             // RSSFeed interface
/contexts/NotificationsContext.tsx        // Notification interface
/contexts/VideoStudioTemplatesContext.tsx // Template interfaces

// Zustand stores:
/store/useJobsStore.ts                    // UploadJob interface
/store/useAppStore.ts                     // Global state

// API clients (how frontend calls backend):
/lib/api/client.ts                        // Base client setup
/lib/api/settings.ts                      // Settings API calls
/lib/api/tmdb.ts                          // TMDb API calls

// Business logic utilities:
/utils/tmdbScheduler.ts                   // Post scheduling logic
/utils/tmdbCaptionGenerator.ts            // AI caption generation
/utils/rssCaptionGenerator.ts             // RSS caption generation
/utils/videoStudioCaptionGenerator.ts     // Video captions
/utils/haptics.ts                         // Haptic feedback patterns
```

### Step 5: Understand Key Design Patterns

**Pattern 1: Offline-First Architecture**
```
Frontend works standalone using localStorage
Backend ENHANCES functionality with:
  - Cross-device sync
  - Cron job automation (TMDb, RSS, comments, cleanup)
  - AI processing (OpenAI caption generation)
  - Platform API integrations (X, Facebook, Threads)
```

**Pattern 2: Bottom Sheets (NOT Dialogs)**
```
All modal UIs use bottom sheets with spring animations
DO NOT create dialog/modal components
Reference: /BOTTOM_SHEET_SYSTEM.md
```

**Pattern 3: Haptic Feedback on All Interactions**
```
Every user interaction triggers haptic feedback
Controlled by: settings.hapticsEnabled
Reference: /docs/HAPTICS_IMPLEMENTATION.md
```

**Pattern 4: Toast Notifications**
```
All API responses show toast notifications
Import: import { toast } from 'sonner@2.0.3'
Always show success/error feedback
```

**Pattern 5: Design System Constraints**
```
- Input focus: grey #292929 (NOT blue)
- Backgrounds: black (dark mode) OR white (light mode) ONLY
- NO grey backgrounds anywhere
- Buttons: text labels ONLY (no icons)
```

### Step 6: Trace Data Flow Examples

**Example: Settings Update Flow**
```typescript
1. User changes setting in UI
2. SettingsContext.updateSetting() called
3. Saves to localStorage (immediate, offline-first)
4. Calls lib/api/settings.saveSettings()
5. → YOUR BACKEND: PUT /api/settings
6. Database updated with Prisma
7. Response returned (masked API keys)
8. Toast notification: "Settings saved"
9. Haptic feedback: impact('light')
```

**Example: TMDb Post Scheduling Flow**
```typescript
1. User clicks "Schedule Post" in TMDb Feeds
2. TMDbPostsContext.schedulePost() called
3. Saves to localStorage (immediate)
4. Calls backend: POST /api/tmdb/posts
5. → YOUR BACKEND:
   - Validates 1-hour gap rule
   - Checks for duplicates (same tmdbId within 30 days)
   - Saves to database
   - Returns post with timestamps
6. Frontend updates context
7. Toast: "Post scheduled for Jan 15 at 2:00 PM"
8. Haptic feedback
```

**Example: Cron Job Flow (TMDb Refresh)**
```typescript
IMPORTANT: Each of the 4 TMDb feeds has INDEPENDENT refresh schedules:
- Today's Releases: Daily at 06:00 UTC (user-configurable)
- Weekly Releases: Every Monday at 08:00 UTC (user-configurable day/time)
- Monthly Previews: Every Monday at 09:00 UTC (user-configurable day/time)
- Anniversaries: Daily at 07:00 UTC (user-configurable)

1. Scheduled time arrives (e.g., Monday 08:00 UTC for Weekly feed)
2. YOUR BACKEND:
   - Fetches TMDb API for THAT SPECIFIC FEED ONLY
     * Today: Movies/TV releasing TODAY
     * Weekly: Next 7 days
     * Monthly: Rolling 28-day window
     * Anniversary: Milestone anniversaries (1, 2, 3, 5, 10+ years)
   - Generates AI captions using OpenAI API (feed-specific prompts)
   - Checks deduplication rules:
     * Same feed: 30-day block
     * Across feeds: 7-day minimum gap
   - Saves posts to database with scheduledTime
   - Creates notification: "Weekly Releases refreshed: 15 posts added"
3. Post Scheduler cron (every 15 min by default, user-configurable):
   - Finds highest-priority post with scheduledTime <= now
   - Verifies 3-hour minimum gap (180 minutes default, user-configurable)
   - Checks daily limit (6 posts/day/platform by default, user-configurable)
   - Checks quiet hours (midnight-7am by default, user-configurable)
   - Posts to platforms (X, Threads, Facebook)
   - Updates status to "published"
```

---

## 🚨 CRITICAL RULES - ZERO DEVIATION ALLOWED

### Rule 1: Follow Specifications Exactly
- Every endpoint in Section 3 must be implemented exactly as specified
- Every database table in Section 4 must match the schema exactly
- Every cron job in Section 5 must use the exact intervals specified
- No creative interpretation - if it's not specified, ask before implementing

### Rule 2: Use Only Approved Technology Stack
```
✅ REQUIRED STACK (NO SUBSTITUTIONS):
- Runtime: Node.js 18+
- Framework: Express.js (latest stable)
- ORM: Prisma (latest stable)
- Database: PostgreSQL (via Neon)
- Language: TypeScript
- Cron: node-cron
- Validation: Zod
- CORS: cors package
- Security: helmet

❌ DO NOT USE:
- Next.js API routes
- NestJS
- Fastify
- TypeORM
- Sequelize
- Any other frameworks/ORMs
```

### Rule 3: Match Frontend Patterns Exactly
- Study `/contexts/SettingsContext.tsx` for Settings data structure
- Study `/contexts/TMDbPostsContext.tsx` for TMDbPost data structure
- Study `/contexts/RSSFeedsContext.tsx` for RSSFeed data structure
- Study `/store/useJobsStore.ts` for UploadJob data structure
- API responses MUST match these TypeScript interfaces exactly

### Rule 4: Railway Deployment Compatibility
```json
// package.json MUST include these exact scripts:
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "migrate": "npx prisma migrate deploy",
    "postinstall": "npx prisma generate"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Rule 5: Environment Variable Security
- ALL secrets MUST be in environment variables (never hardcoded)
- Create `.env.example` with placeholder values
- Validate all required env vars on startup (fail fast if missing)
- Use `process.env.NODE_ENV` to determine production vs development

### Rule 6: Error Handling Standards
```typescript
// All API responses MUST follow this format:

// Success (200/201):
{ 
  success: true, 
  data: any 
}

// Error (400/401/403/404/500):
{ 
  success: false, 
  error: {
    code: string,        // e.g., "VALIDATION_ERROR", "NOT_FOUND"
    message: string,     // Human-readable error
    details?: any        // Optional additional context
  }
}
```

### Rule 7: No Blocking Operations
- Cron jobs MUST NOT block API routes
- Long-running tasks MUST be async (return job ID immediately)
- AI API calls MUST have timeouts
- Database queries MUST have connection pooling

### Rule 8: Code Quality Requirements
- All code MUST be TypeScript (no .js files except build output)
- All functions MUST have TypeScript types (no `any` without explicit reason)
- All endpoints MUST have input validation (use Zod)
- All async functions MUST have proper error handling (try/catch)

---

## 📚 SECTION 2: API REQUEST/RESPONSE SCHEMAS

### 2.1 Settings API

#### GET /api/settings
```typescript
// Response:
{
  success: true,
  data: {
    // API Keys (masked on backend)
    youtubeKey: string,          // "••••••••••••••••"
    openaiKey: string,
    serperKey: string,
    tmdbKey: string,
    googleVideoIntelligenceKey: string,
    shotstackKey: string,
    backblazeKeyId: string,
    backblazeApplicationKey: string,
    backblazeBucketName: string,
    backblazeVideosKeyId: string,
    backblazeVideosApplicationKey: string,
    backblazeVideosBucketName: string,
    backblazeDesignKeyId: string,
    backblazeDesignApplicationKey: string,
    backblazeDesignBucketName: string,
    photopeaApiKey: string,
    
    // Video Settings
    fetchInterval: string,       // "5" (minutes)
    regionFilter: string,        // "US" or "Global"
    advancedFilters: string,
    
    // Comment Reply Settings
    commentRepliesActive: boolean,
    totalCommentsProcessed: number,
    repliesPosted: number,
    commentErrors: number,
    commentBlacklistUsernames: string,
    commentBlacklistKeywords: string,
    commentReplyFrequency: string,
    commentThrottle: string,
    commentReplyModel: string,    // "gpt-4o-mini"
    commentReplyTemperature: number,
    commentReplyTone: string,
    commentReplyMaxLength: number,
    commentReplyPrompt: string,
    commentUseGoogleSearch: boolean,
    commentUseSerper: boolean,
    
    // Per-platform comment settings
    xCommentBlacklist: {
      active: boolean,
      usernames: string,
      keywords: string,
      noEmojiOnly: boolean,
      noLinks: boolean,
      pauseOldPosts: boolean,
      pauseAfterHours: string
    },
    threadsCommentBlacklist: { /* same structure */ },
    facebookCommentBlacklist: { /* same structure */ },
    instagramCommentBlacklist: { /* same structure */ },
    youtubeCommentBlacklist: { /* same structure */ },
    tiktokCommentBlacklist: { /* same structure */ },
    pinterestCommentBlacklist: { /* same structure */ },
    
    // RSS Settings
    rssEnabled: boolean,
    globalEnabled: boolean,
    postingInterval: string,
    rssImageCount: string,
    rssPlatforms: string[],      // ["X", "Threads", "Facebook"]
    rssFetchInterval: string,
    rssDeduplication: boolean,
    rssLogLevel: string,
    rssCaptionModel: string,
    rssCaptionTemperature: number,
    rssCaptionTone: string,
    rssCaptionMaxLength: number,
    rssCaptionPrompt: string,
    
    // TMDb Settings
    tmdbCaptionModel: string,
    tmdbCaptionTemperature: number,
    tmdbTodayPrompt: string,
    tmdbWeeklyPrompt: string,
    tmdbMonthlyPrompt: string,
    tmdbAnniversaryPrompt: string,
    
    // Video Studio Settings
    captionOpenaiModel: string,
    captionTemperature: number,
    videoStudioWebSearchEnabled: boolean,
    videoStudioWebSearchProvider: "serper" | "google",
    videoStudioWebSearchMaxResults: number,
    
    // Activity Retention
    videoStudioActivityRetention: number,  // days
    designStudioActivityRetention: number,
    tmdbActivityRetention: number,
    
    // Cleanup Settings
    cleanupEnabled: boolean,
    cleanupInterval: string,
    videoCleanupInterval: string,
    videoStorageRetention: string,       // days
    imageCleanupInterval: string,
    imageStorageRetention: string,       // days
    videoStudioCleanupInterval: string,
    videoStudioStorageRetention: string,
    
    // Appearance
    darkMode: boolean,
    hapticsEnabled: boolean,
    
    // Notifications
    emailNotifications: boolean,
    pushNotifications: boolean,
    desktopNotifications: boolean,
    
    // Timezone
    timezone: string                     // "America/New_York"
  }
}
```

#### PUT /api/settings
```typescript
// Request:
{
  // Any subset of the settings object
  // Example:
  openaiKey: "sk-...",
  tmdbCaptionModel: "gpt-4o-mini",
  cleanupEnabled: true
}

// Response:
{
  success: true,
  data: {
    // Full updated settings object (same as GET)
  }
}
```

**CRITICAL**: When saving API keys to database:
- Store full value in database
- Return masked value (e.g., "••••••••••••••••") in API responses
- Never return full API key values in GET requests

---

### 2.2 TMDb API

#### GET /api/tmdb/posts
```typescript
// Query params: ?status=scheduled (optional)

// Response:
{
  success: true,
  data: [
    {
      id: string,                    // UUID
      tmdbId: number,                // 12345
      mediaType: "movie" | "tv",
      title: string,                 // "The Dark Knight"
      year: number,                  // 2008
      releaseDate: string,           // "2008-07-18"
      caption: string,
      imageUrl: string,              // TMDb poster/backdrop URL
      imageType: "poster" | "backdrop",
      scheduledTime: string,         // ISO 8601: "2025-01-15T14:30:00Z"
      source: "tmdb_today" | "tmdb_weekly" | "tmdb_monthly" | "tmdb_anniversary",
      cast: string[],                // ["Christian Bale", "Heath Ledger"]
      popularity: number,            // 123.45
      cacheHit: boolean,
      status: "queued" | "scheduled" | "published" | "failed",
      platforms: string[],           // ["X", "Threads", "Facebook"]
      publishedTime?: string,        // ISO 8601 (if published)
      errorMessage?: string,         // (if failed)
      createdAt: string,             // ISO 8601
      updatedAt: string              // ISO 8601
    }
  ]
}
```

#### POST /api/tmdb/posts
```typescript
// Request:
{
  tmdbId: number,
  mediaType: "movie" | "tv",
  title: string,
  year: number,
  releaseDate: string,
  caption: string,
  imageUrl: string,
  imageType: "poster" | "backdrop",
  scheduledTime: string,             // ISO 8601
  source: "tmdb_today" | "tmdb_weekly" | "tmdb_monthly" | "tmdb_anniversary",
  cast: string[],
  popularity: number,
  platforms: string[]
}

// Response:
{
  success: true,
  data: {
    // Full post object with generated id, timestamps
  }
}
```

#### PUT /api/tmdb/posts/:id
```typescript
// Request:
{
  caption?: string,
  imageType?: "poster" | "backdrop",
  scheduledTime?: string,
  platforms?: string[]
}

// Response:
{
  success: true,
  data: {
    // Full updated post object
  }
}
```

#### DELETE /api/tmdb/posts/:id
```typescript
// Response:
{
  success: true,
  data: {
    message: "Post deleted successfully"
  }
}
```

#### PUT /api/tmdb/posts/:id/reschedule
```typescript
// Request:
{
  scheduledTime: string              // ISO 8601
}

// Response:
{
  success: true,
  data: {
    // Full updated post object
  }
}
```

#### PUT /api/tmdb/posts/:id/status
```typescript
// Request:
{
  status: "queued" | "scheduled" | "published" | "failed",
  publishedTime?: string,            // ISO 8601 (if published)
  errorMessage?: string              // (if failed)
}

// Response:
{
  success: true,
  data: {
    // Full updated post object
  }
}
```

#### POST /api/tmdb/refresh
```typescript
// Triggers manual TMDb feed refresh (normally runs Monday 00:00 UTC)

// Request: (empty body)

// Response:
{
  success: true,
  data: {
    message: "TMDb refresh job queued",
    jobId: string,                   // For tracking
    estimatedCompletion: string      // ISO 8601
  }
}
```

#### GET /api/tmdb/stats
```typescript
// Response:
{
  success: true,
  data: {
    totalPosts: number,
    published: number,
    scheduled: number,
    pending: number,              // queued status
    failed: number,
    cacheHitRate: number,         // 0-100 percentage
    lastRefresh: string,          // ISO 8601 of last Monday refresh
    nextRefresh: string           // ISO 8601 of next Monday 00:00 UTC
  }
}
```

---

### 2.3 RSS API

#### GET /api/rss/feeds
```typescript
// Response:
{
  success: true,
  data: [
    {
      id: string,                    // UUID
      source: string,                // "Variety" or URL
      title: string,
      description: string,
      url: string,                   // Original RSS feed URL
      imageUrl?: string,
      publishedDate: string,         // ISO 8601
      scheduledTime?: string,        // ISO 8601
      status: "pending" | "scheduled" | "published" | "failed",
      platforms?: string[],
      caption?: string,
      errorMessage?: string,
      createdAt: string,
      updatedAt: string
    }
  ]
}
```

#### POST /api/rss/feeds
```typescript
// Request:
{
  url: string,                       // RSS feed URL
  source?: string,                   // Optional custom source name
  platforms?: string[]               // Default to settings.rssPlatforms
}

// Response:
{
  success: true,
  data: {
    // Full feed object
    message: "RSS feed added and will be checked every 5 minutes"
  }
}
```

#### PUT /api/rss/feeds/:id
```typescript
// Request:
{
  caption?: string,
  scheduledTime?: string,
  platforms?: string[],
  status?: "pending" | "scheduled" | "published" | "failed"
}

// Response:
{
  success: true,
  data: {
    // Full updated feed object
  }
}
```

#### DELETE /api/rss/feeds/:id
```typescript
// Response:
{
  success: true,
  data: {
    message: "RSS feed deleted successfully"
  }
}
```

#### GET /api/rss/activity
```typescript
// Query params: ?limit=50&status=published (optional)

// Response:
{
  success: true,
  data: {
    feeds: [
      {
        id: string,
        source: string,
        title: string,
        status: string,
        publishedDate: string,
        scheduledTime?: string,
        platforms: string[],
        errorMessage?: string
      }
    ],
    stats: {
      totalFeeds: number,
      pending: number,
      scheduled: number,
      published: number,
      failed: number,
      lastCheck: string            // ISO 8601 of last RSS check
    }
  }
}
```

---

### 2.4 Comment Automation API

#### GET /api/comments
```typescript
// Get comments awaiting reply

// Query params: ?platform=X&limit=50 (optional)

// Response:
{
  success: true,
  data: [
    {
      id: string,                    // UUID
      platform: "X" | "Threads" | "Facebook",
      commentId: string,             // Platform's comment ID
      postId: string,                // Platform's post ID
      username: string,
      content: string,               // Comment text
      reply?: string,                // AI-generated reply (if exists)
      repliedAt?: string,            // ISO 8601
      createdAt: string,
      processed: boolean,            // Whether AI has processed it
      blacklisted: boolean           // Whether it matches blacklist rules
    }
  ]
}
```

#### POST /api/comments/reply
```typescript
// Request:
{
  commentId: string,                 // Our internal comment UUID
  reply: string                      // AI-generated or manual reply
}

// Response:
{
  success: true,
  data: {
    commentId: string,
    platform: string,
    repliedAt: string,               // ISO 8601
    status: "posted" | "failed",
    errorMessage?: string
  }
}
```

#### GET /api/comments/stats
```typescript
// Response:
{
  success: true,
  data: {
    totalCommentsProcessed: number,
    repliesPosted: number,
    commentErrors: number,
    averageResponseTime: number,     // seconds
    platformBreakdown: {
      X: { processed: number, replied: number, errors: number },
      Threads: { processed: number, replied: number, errors: number },
      Facebook: { processed: number, replied: number, errors: number }
    },
    recentReplies: [
      {
        id: string,
        platform: string,
        originalComment: string,
        aiReply: string,
        repliedAt: string,
        success: boolean
      }
    ]
  }
}
```

#### GET /api/comments/daily-stats
```typescript
// Last 30 days daily breakdown for charts

// Response:
{
  success: true,
  data: [
    {
      date: string,                  // "2025-01-15"
      platform: "X" | "Threads" | "Facebook",
      repliesCount: number,
      successRate: number            // 0-100
    }
  ]
}
```

#### PUT /api/comments/settings
```typescript
// Request:
{
  commentRepliesActive?: boolean,
  commentReplyFrequency?: string,
  commentBlacklistUsernames?: string,
  commentBlacklistKeywords?: string,
  // ... any other comment settings
}

// Response:
{
  success: true,
  data: {
    message: "Comment settings updated",
    settings: {
      // Updated settings object
    }
  }
}
```

---

### 2.5 Platform Integration API

#### POST /api/platforms/post
```typescript
// Universal posting endpoint for all platforms

// Request:
{
  platforms: string[],               // ["X", "Threads", "Facebook"]
  content: {
    text: string,                    // Caption/text
    imageUrl?: string,               // Optional image
    videoUrl?: string,               // Optional video
    link?: string                    // Optional link
  },
  sourceType: "tmdb" | "rss" | "video_studio" | "design_studio" | "manual",
  sourceId?: string                  // Reference to source (TMDb post ID, RSS feed ID, etc.)
}

// Response:
{
  success: true,
  data: {
    results: [
      {
        platform: "X",
        status: "posted" | "failed",
        postId?: string,             // Platform's post ID
        postUrl?: string,            // URL to post
        errorMessage?: string,
        postedAt?: string            // ISO 8601
      },
      {
        platform: "Threads",
        status: "posted" | "failed",
        // ...
      }
    ],
    summary: {
      total: number,
      posted: number,
      failed: number
    }
  }
}
```

#### GET /api/platforms/status
```typescript
// Get connection status for all platforms

// Response:
{
  success: true,
  data: {
    X: {
      connected: boolean,
      username?: string,
      lastPost?: string,             // ISO 8601
      rateLimitRemaining?: number,
      rateLimitReset?: string        // ISO 8601
    },
    Threads: {
      connected: boolean,
      // ...
    },
    Facebook: {
      connected: boolean,
      pageId?: string,
      pageName?: string,
      // ...
    }
  }
}
```

---

### 2.6 Channels API

#### GET /api/channels
```typescript
// Response:
{
  success: true,
  data: [
    {
      id: string,                    // UUID
      channelId: string,             // YouTube channel ID
      name: string,
      subscriberCount: number,
      videoCount: number,
      status: "active" | "inactive" | "error",
      lastCheck: string,             // ISO 8601
      createdAt: string
    }
  ]
}
```

#### POST /api/channels
```typescript
// Request:
{
  channelId: string,                 // YouTube channel ID or URL
  name?: string                      // Optional custom name
}

// Response:
{
  success: true,
  data: {
    // Full channel object
  }
}
```

#### DELETE /api/channels/:id
```typescript
// Response:
{
  success: true,
  data: {
    message: "Channel removed successfully"
  }
}
```

#### GET /api/channels/:id/videos
```typescript
// Get recent videos from a monitored channel

// Response:
{
  success: true,
  data: [
    {
      videoId: string,
      title: string,
      description: string,
      thumbnailUrl: string,
      publishedAt: string,           // ISO 8601
      viewCount: number,
      likeCount: number,
      commentCount: number,
      duration: string,              // ISO 8601 duration
      processed: boolean             // Whether we've processed it
    }
  ]
}
```

---

### 2.7 Upload Jobs API

#### GET /api/jobs
```typescript
// Query params: ?status=processing&limit=50 (optional)

// Response:
{
  success: true,
  data: [
    {
      id: string,                    // UUID
      fileName: string,
      fileSize: number,              // bytes
      sourceUrl?: string,
      status: "pending" | "processing" | "completed" | "failed",
      stage: "queued" | "processing" | "generating_metadata" | "encoding" | "waiting_schedule" | "uploading" | "published",
      progress: number,              // 0-100
      metadata: {
        title?: string,
        titleScore?: number,         // 0-100
        description?: string,
        descriptionWordCount?: number,
        seoScore?: number,           // 0-100
        tags?: string[],
        thumbnailUrl?: string,
        thumbnailAvailable: boolean
      },
      scheduledFor?: string,         // ISO 8601
      createdAt: string,
      updatedAt: string,
      completedAt?: string,
      error?: {
        message: string,
        cause?: string,
        stack?: string
      },
      events: [
        {
          id: string,
          timestamp: string,         // ISO 8601
          severity: "info" | "warning" | "error" | "success",
          message: string,
          details?: string
        }
      ],
      costEstimate?: number,
      backendUsed?: "google-video-intelligence" | "ffmpeg"
    }
  ]
}
```

#### GET /api/jobs/:id
```typescript
// Response:
{
  success: true,
  data: {
    // Single job object (same structure as GET /api/jobs)
  }
}
```

#### POST /api/jobs
```typescript
// Create new upload job

// Request:
{
  fileName: string,
  fileSize: number,
  sourceUrl?: string,
  scheduledFor?: string             // ISO 8601
}

// Response:
{
  success: true,
  data: {
    // Full job object with generated id
  }
}
```

#### PUT /api/jobs/:id
```typescript
// Update job (typically called by processing workers)

// Request:
{
  status?: "pending" | "processing" | "completed" | "failed",
  stage?: "queued" | "processing" | "generating_metadata" | "encoding" | "waiting_schedule" | "uploading" | "published",
  progress?: number,
  metadata?: {
    title?: string,
    description?: string,
    // ...
  },
  error?: {
    message: string,
    cause?: string
  }
}

// Response:
{
  success: true,
  data: {
    // Full updated job object
  }
}
```

#### DELETE /api/jobs/:id
```typescript
// Response:
{
  success: true,
  data: {
    message: "Job deleted successfully"
  }
}
```

#### POST /api/jobs/:id/retry
```typescript
// Retry a failed job

// Response:
{
  success: true,
  data: {
    message: "Job queued for retry",
    job: {
      // Full job object with reset status/progress
    }
  }
}
```

#### GET /api/jobs/logs
```typescript
// Get system logs (separate from job events)

// Query params: ?level=error&limit=100 (optional)

// Response:
{
  success: true,
  data: [
    {
      id: string,
      timestamp: string,             // ISO 8601
      level: "info" | "warn" | "error" | "debug",
      message: string,
      service: string,               // "api", "cron", "worker", etc.
      metadata?: any
    }
  ]
}
```

---

### 2.8 Logs & Monitoring API

#### GET /api/logs
```typescript
// Query params: ?level=error&service=cron&limit=100 (optional)

// Response:
{
  success: true,
  data: [
    {
      id: string,
      timestamp: string,             // ISO 8601
      level: "info" | "warn" | "error" | "debug",
      message: string,
      service: string,               // "api", "cron", "worker"
      metadata?: any
    }
  ]
}
```

#### GET /api/logs/errors
```typescript
// Get recent error logs only

// Response:
{
  success: true,
  data: [
    {
      id: string,
      timestamp: string,
      message: string,
      service: string,
      stack?: string,
      metadata?: any
    }
  ]
}
```

#### GET /api/notifications
```typescript
// Response:
{
  success: true,
  data: [
    {
      id: string,                    // UUID
      type: "success" | "error" | "warning" | "info",
      title: string,
      message: string,
      source: "tmdb" | "rss" | "upload" | "comment" | "system",
      actionPage?: string,           // "/tmdb" or "/rss" etc.
      read: boolean,
      createdAt: string              // ISO 8601
    }
  ]
}
```

#### POST /api/notifications
```typescript
// Request:
{
  type: "success" | "error" | "warning" | "info",
  title: string,
  message: string,
  source: "tmdb" | "rss" | "upload" | "comment" | "system",
  actionPage?: string
}

// Response:
{
  success: true,
  data: {
    // Full notification object
  }
}
```

#### PUT /api/notifications/:id
```typescript
// Request:
{
  read: boolean
}

// Response:
{
  success: true,
  data: {
    // Updated notification
  }
}
```

#### DELETE /api/notifications/:id
```typescript
// Response:
{
  success: true,
  data: {
    message: "Notification deleted successfully"
  }
}
```

#### GET /api/health
```typescript
// Health check endpoint (REQUIRED for Railway)

// Response:
{
  status: "healthy" | "degraded" | "unhealthy",
  timestamp: string,                 // ISO 8601
  services: {
    database: "connected" | "disconnected",
    redis?: "connected" | "disconnected",
    cron: "running" | "stopped"
  },
  uptime: number,                    // seconds
  version: string                    // e.g., "1.0.0"
}
```

---

## 📋 SECTION 3: COMPLETE API ENDPOINT LIST

**Total: 40 Endpoints**

### Settings (4 endpoints)
- [x] `GET /api/settings` - Get all settings
- [x] `PUT /api/settings` - Update settings
- [x] `GET /api/settings/apikeys` - Get API keys (masked)
- [x] `PUT /api/settings/apikeys` - Update API keys

### TMDb (7 endpoints)
- [x] `GET /api/tmdb/posts` - Get all posts
- [x] `POST /api/tmdb/posts` - Create post
- [x] `PUT /api/tmdb/posts/:id` - Update post
- [x] `DELETE /api/tmdb/posts/:id` - Delete post
- [x] `PUT /api/tmdb/posts/:id/reschedule` - Reschedule post
- [x] `PUT /api/tmdb/posts/:id/status` - Update status
- [x] `POST /api/tmdb/refresh` - Manual refresh
- [x] `GET /api/tmdb/stats` - Get statistics

### RSS (5 endpoints)
- [x] `GET /api/rss/feeds` - Get all feeds
- [x] `POST /api/rss/feeds` - Add feed
- [x] `PUT /api/rss/feeds/:id` - Update feed
- [x] `DELETE /api/rss/feeds/:id` - Delete feed
- [x] `GET /api/rss/activity` - Get activity log

### Comments (5 endpoints)
- [x] `GET /api/comments` - Get comments
- [x] `POST /api/comments/reply` - Post reply
- [x] `GET /api/comments/stats` - Get stats
- [x] `GET /api/comments/daily-stats` - Daily breakdown
- [x] `PUT /api/comments/settings` - Update settings

### Platforms (2 endpoints)
- [x] `POST /api/platforms/post` - Post to platforms
- [x] `GET /api/platforms/status` - Connection status

### Channels (4 endpoints)
- [x] `GET /api/channels` - Get all channels
- [x] `POST /api/channels` - Add channel
- [x] `DELETE /api/channels/:id` - Remove channel
- [x] `GET /api/channels/:id/videos` - Get channel videos

### Upload Jobs (7 endpoints)
- [x] `GET /api/jobs` - Get all jobs
- [x] `GET /api/jobs/:id` - Get specific job
- [x] `POST /api/jobs` - Create job
- [x] `PUT /api/jobs/:id` - Update job
- [x] `DELETE /api/jobs/:id` - Delete job
- [x] `POST /api/jobs/:id/retry` - Retry job
- [x] `GET /api/jobs/logs` - Get system logs

### Logs & Monitoring (6 endpoints)
- [x] `GET /api/logs` - Get logs
- [x] `GET /api/logs/errors` - Get error logs
- [x] `GET /api/notifications` - Get notifications
- [x] `POST /api/notifications` - Create notification
- [x] `PUT /api/notifications/:id` - Mark as read
- [x] `DELETE /api/notifications/:id` - Delete notification
- [x] `GET /api/health` - Health check

---

## 🗄️ SECTION 4: DATABASE SCHEMA (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// SETTINGS
// ============================================
model Setting {
  id        String   @id @default(uuid())
  key       String   @unique
  value     Json
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  @@index([key])
}

// ============================================
// TMDB POSTS
// ============================================
model TMDbPost {
  id            String   @id @default(uuid())
  tmdbId        Int
  mediaType     String   // "movie" or "tv"
  title         String
  year          Int
  releaseDate   DateTime
  caption       String   @db.Text
  imageUrl      String
  imageType     String   // "poster" or "backdrop"
  scheduledTime DateTime
  source        String   // "tmdb_today", "tmdb_weekly", "tmdb_monthly", "tmdb_anniversary"
  cast          String[] // Array of cast members
  popularity    Float
  cacheHit      Boolean  @default(false)
  status        String   // "queued", "scheduled", "published", "failed"
  platforms     String[] // ["X", "Threads", "Facebook"]
  publishedTime DateTime?
  errorMessage  String?  @db.Text
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([status])
  @@index([scheduledTime])
  @@index([source])
  @@index([tmdbId])
}

// ============================================
// RSS FEEDS
// ============================================
model RSSFeed {
  id            String   @id @default(uuid())
  source        String   // "Variety" or custom name
  title         String
  description   String   @db.Text
  url           String   // RSS feed URL
  imageUrl      String?
  publishedDate DateTime
  scheduledTime DateTime?
  status        String   // "pending", "scheduled", "published", "failed"
  platforms     String[] // ["X", "Threads", "Facebook"]
  caption       String?  @db.Text
  errorMessage  String?  @db.Text
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([status])
  @@index([source])
  @@index([scheduledTime])
}

// ============================================
// CHANNELS (YouTube monitoring)
// ============================================
model Channel {
  id              String   @id @default(uuid())
  channelId       String   @unique // YouTube channel ID
  name            String
  subscriberCount Int      @default(0)
  videoCount      Int      @default(0)
  status          String   // "active", "inactive", "error"
  lastCheck       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([channelId])
  @@index([status])
}

// ============================================
// UPLOAD JOBS
// ============================================
model UploadJob {
  id            String   @id @default(uuid())
  fileName      String
  fileSize      Int      // bytes
  sourceUrl     String?
  status        String   // "pending", "processing", "completed", "failed"
  stage         String   // "queued", "processing", "generating_metadata", etc.
  progress      Int      @default(0) // 0-100
  metadata      Json     // JobMetadata structure
  scheduledFor  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  completedAt   DateTime?
  error         Json?    // { message, cause, stack }
  events        Json[]   // Array of JobEvent objects
  costEstimate  Float?
  backendUsed   String?  // "google-video-intelligence" or "ffmpeg"

  @@index([status])
  @@index([stage])
  @@index([createdAt])
}

// ============================================
// COMMENTS
// ============================================
model Comment {
  id         String   @id @default(uuid())
  platform   String   // "X", "Threads", "Facebook"
  commentId  String   // Platform's comment ID
  postId     String   // Platform's post ID
  username   String
  content    String   @db.Text
  reply      String?  @db.Text
  repliedAt  DateTime?
  processed  Boolean  @default(false)
  blacklisted Boolean @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([platform, commentId])
  @@index([platform])
  @@index([processed])
  @@index([repliedAt])
}

// ============================================
// NOTIFICATIONS
// ============================================
model Notification {
  id         String   @id @default(uuid())
  type       String   // "success", "error", "warning", "info"
  title      String
  message    String   @db.Text
  source     String   // "tmdb", "rss", "upload", "comment", "system"
  actionPage String?  // "/tmdb", "/rss", etc.
  read       Boolean  @default(false)
  createdAt  DateTime @default(now())

  @@index([read])
  @@index([source])
  @@index([createdAt])
}

// ============================================
// LOGS
// ============================================
model Log {
  id        String   @id @default(uuid())
  timestamp DateTime @default(now())
  level     String   // "info", "warn", "error", "debug"
  message   String   @db.Text
  service   String   // "api", "cron", "worker"
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([level])
  @@index([service])
  @@index([timestamp])
}

// ============================================
// PLATFORM CONNECTIONS (Optional - for OAuth tokens)
// ============================================
model PlatformConnection {
  id           String   @id @default(uuid())
  platform     String   @unique // "X", "Threads", "Facebook"
  accessToken  String?  @db.Text
  refreshToken String?  @db.Text
  expiresAt    DateTime?
  username     String?
  userId       String?  // Platform user ID
  metadata     Json?    // Platform-specific data
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([platform])
}
```

**CRITICAL NOTES**:
1. Use `@db.Text` for long strings (captions, descriptions, errors)
2. Use `Json` type for complex nested objects (metadata, events, error objects)
3. Add indexes on frequently queried fields (status, scheduledTime, etc.)
4. Use `DateTime` for all timestamps (Prisma auto-converts to ISO 8601)
5. Use `String[]` for arrays (cast, platforms)

---

## ⏰ SECTION 5: CRON JOBS SPECIFICATION

### 5.1 TMDb Feed Refresh (4 INDEPENDENT CRON JOBS)

**IMPORTANT**: Each TMDb feed has its OWN cron job with INDEPENDENT schedules stored in database/settings.

```typescript
// File: src/cron/tmdb-today-refresh.ts
import cron from 'node-cron';

// Default: Daily at 06:00 UTC (user-configurable)
// Get schedule from: settings.tmdbTodaySchedule { day, time }
const getSchedule = () => {
  const schedule = getSettingFromDB('tmdbTodaySchedule'); // { refreshTime: '06:00' }
  const [hour, minute] = schedule.refreshTime.split(':');
  return `${minute} ${hour} * * *`; // Daily at specified time
};

cron.schedule(getSchedule(), async () => {
  try {
    console.log('[CRON] Starting Today Releases refresh...');
    
    // 1. Fetch TMDb API for TODAY'S releases only (release_date = today)
    // 2. Generate AI captions using settings.tmdbTodayPrompt + settings.tmdbCaptionModel
    // 3. Check deduplication:
    //    - Same feed: 30-day block
    //    - Across feeds: 7-day minimum gap
    // 4. Feed to autopost queue (queue handles rate limits + gaps)
    // 5. Save to database
    // 6. Create notification: "Today's Releases refreshed: X posts added"
    
    console.log('[CRON] Today Releases refresh completed');
  } catch (error) {
    console.error('[CRON] Today Releases error:', error);
  }
});
```

```typescript
// File: src/cron/tmdb-weekly-refresh.ts
import cron from 'node-cron';

// Default: Every Monday at 08:00 UTC (user-configurable day + time)
// Get schedule from: settings.tmdbWeeklySchedule { refreshDay: '1', refreshTime: '08:00' }
const getSchedule = () => {
  const schedule = getSettingFromDB('tmdbWeeklySchedule');
  const [hour, minute] = schedule.refreshTime.split(':');
  const day = schedule.refreshDay; // 0-6 (Sunday-Saturday)
  return `${minute} ${hour} * * ${day}`; // Weekly on specified day/time
};

cron.schedule(getSchedule(), async () => {
  try {
    console.log('[CRON] Starting Weekly Releases refresh...');
    
    // 1. Fetch TMDb API for NEXT 7 DAYS releases
    // 2. Generate AI captions using settings.tmdbWeeklyPrompt + settings.tmdbCaptionModel
    // 3. Check deduplication (30-day same feed, 7-day across feeds)
    // 4. Feed to autopost queue
    // 5. Save to database
    // 6. Create notification: "Weekly Releases refreshed: X posts added"
    
    console.log('[CRON] Weekly Releases refresh completed');
  } catch (error) {
    console.error('[CRON] Weekly Releases error:', error);
  }
});
```

```typescript
// File: src/cron/tmdb-monthly-refresh.ts
import cron from 'node-cron';

// Default: Every Monday at 09:00 UTC (user-configurable day + time)
// Get schedule from: settings.tmdbMonthlySchedule { refreshDay: '1', refreshTime: '09:00' }
const getSchedule = () => {
  const schedule = getSettingFromDB('tmdbMonthlySchedule');
  const [hour, minute] = schedule.refreshTime.split(':');
  const day = schedule.refreshDay;
  return `${minute} ${hour} * * ${day}`;
};

cron.schedule(getSchedule(), async () => {
  try {
    console.log('[CRON] Starting Monthly Previews refresh...');
    
    // 1. Fetch TMDb API for ROLLING 28-DAY WINDOW
    // 2. Generate AI captions using settings.tmdbMonthlyPrompt + settings.tmdbCaptionModel
    // 3. Check deduplication (30-day same feed, 7-day across feeds)
    // 4. Feed to autopost queue
    // 5. Save to database
    // 6. Create notification: "Monthly Previews refreshed: X posts added"
    
    console.log('[CRON] Monthly Previews refresh completed');
  } catch (error) {
    console.error('[CRON] Monthly Previews error:', error);
  }
});
```

```typescript
// File: src/cron/tmdb-anniversary-refresh.ts
import cron from 'node-cron';

// Default: Daily at 07:00 UTC (user-configurable)
// Get schedule from: settings.tmdbAnniversarySchedule { refreshTime: '07:00' }
const getSchedule = () => {
  const schedule = getSettingFromDB('tmdbAnniversarySchedule');
  const [hour, minute] = schedule.refreshTime.split(':');
  return `${minute} ${hour} * * *`; // Daily at specified time
};

cron.schedule(getSchedule(), async () => {
  try {
    console.log('[CRON] Starting Anniversaries refresh...');
    
    // 1. Fetch TMDb API for MILESTONE ANNIVERSARIES (1, 2, 3, 5, 10, 15, 20, 25, 30+ years)
    // 2. Generate AI captions using settings.tmdbAnniversaryPrompt + settings.tmdbCaptionModel
    // 3. Check deduplication (30-day same feed, 7-day across feeds)
    // 4. Feed to autopost queue
    // 5. Save to database
    // 6. Create notification: "Anniversaries refreshed: X posts added"
    
    console.log('[CRON] Anniversaries refresh completed');
  } catch (error) {
    console.error('[CRON] Anniversaries error:', error);
  }
});
```

**CRITICAL**:
- 4 SEPARATE cron jobs (not one combined job)
- Each reads its own schedule from settings table
- Must support dynamic schedule updates (restart cron when settings change)
- Must NOT block API requests (use async/await)
- Must use OpenAI API with feed-specific prompts:
  - settings.tmdbTodayPrompt + settings.tmdbCaptionModel
  - settings.tmdbWeeklyPrompt + settings.tmdbCaptionModel
  - settings.tmdbMonthlyPrompt + settings.tmdbCaptionModel
  - settings.tmdbAnniversaryPrompt + settings.tmdbCaptionModel
- Deduplication rules:
  - Same feed: 30-day block (no same movie/show from same feed within 30 days)
  - Across feeds: 7-day minimum gap (same movie/show can appear in different feeds if 7+ days apart)
- Posts are fed to autopost queue (queue handles 3-hour gaps, daily limits, quiet hours)

---

### 5.2 RSS Feed Check
```typescript
// File: src/cron/rss-check.ts

import cron from 'node-cron';

// Schedule: Every 5 minutes
const schedule = '*/5 * * * *';

cron.schedule(schedule, async () => {
  try {
    console.log('[CRON] Checking RSS feeds...');
    
    // 1. Get all RSS feed URLs from settings
    
    // 2. Fetch each feed (use feed parser library)
    
    // 3. For each new item:
    //    - Check if already exists (deduplication)
    //    - Generate AI caption (using settings.rssCaptionModel)
    //    - Schedule post (respecting 1-hour gap rule)
    //    - Save to database
    
    // 4. Update lastCheck timestamp
    
    console.log('[CRON] RSS check completed');
  } catch (error) {
    console.error('[CRON] RSS check error:', error);
  }
});
```

**CRITICAL**:
- Must run every 5 minutes exactly
- Must deduplicate (check URL or content hash)
- Must use OpenAI API with model from `settings.rssCaptionModel`

---

### 5.3 Comment Monitoring
```typescript
// File: src/cron/comment-monitor.ts

import cron from 'node-cron';

// Schedule: Every 1 minute
const schedule = '* * * * *';

cron.schedule(schedule, async () => {
  try {
    console.log('[CRON] Monitoring comments...');
    
    // Only run if settings.commentRepliesActive === true
    
    // 1. Fetch new comments from platforms (X, Threads, Facebook)
    
    // 2. For each comment:
    //    - Check blacklist (usernames, keywords, emoji-only, links, old posts)
    //    - Generate AI reply (using settings.commentReplyModel)
    //    - Post reply (respecting throttle settings)
    //    - Save to database
    //    - Update stats
    
    // 3. Handle rate limits gracefully
    
    console.log('[CRON] Comment monitoring completed');
  } catch (error) {
    console.error('[CRON] Comment monitor error:', error);
  }
});
```

**CRITICAL**:
- Must check `settings.commentRepliesActive` before running
- Must respect blacklist rules (per-platform settings)
- Must respect throttle settings (`commentThrottle`)
- Must handle platform rate limits

---

### 5.4 Autopost Engine (Queue-Based Post Scheduler)
```typescript
// File: src/cron/autopost-engine.ts

import cron from 'node-cron';

// Default: Every 15 minutes (user-configurable via settings.autopostTickInterval)
// Get interval from: settings.autopostTickInterval (default: 15 minutes)
const getSchedule = () => {
  const interval = getSettingFromDB('autopostTickInterval') || 15;
  return `*/${interval} * * * *`; // Every N minutes
};

cron.schedule(getSchedule(), async () => {
  try {
    console.log('[CRON] Autopost engine tick...');
    
    const now = new Date();
    
    // 1. Get highest-priority post from queue:
    //    - status = "queued"
    //    - Check rate limits:
    //      * minGapBetweenPosts: 180 minutes (3 hours) default
    //      * maxPostsPerDay: 6 per platform default
    //      * quietHours: midnight-7am default
    
    // 2. If eligible post found:
    //    - Post to platforms (X, Threads, Facebook)
    //    - Update status to "posted" or "failed"
    //    - Set postedAt timestamp
    //    - Create notification
    //    - Update lastPostTime for rate limiting
    
    // 3. Log execution
    
    console.log('[CRON] Autopost engine tick completed');
  } catch (error) {
    console.error('[CRON] Autopost engine error:', error);
  }
});
```

**CRITICAL**:
- Must respect Rate Governor configuration:
  - `minGapBetweenPosts`: Default 180 minutes (3 hours), user-configurable 30-1440
  - `maxPostsPerDay`: Default 6 per platform, user-configurable 1-50
  - `quietHoursStart`: Default 0 (midnight), user-configurable 0-23
  - `quietHoursEnd`: Default 7 (7am), user-configurable 0-23
- Must select HIGHEST PRIORITY post from queue (P1 > P2 > P3 > P4)
- Must handle platform API failures gracefully
- Must update post status atomically
- Must support dynamic interval updates (restart cron when settings change)

---

### 5.5 Cleanup Job
```typescript
// File: src/cron/cleanup.ts

import cron from 'node-cron';

// Schedule: Daily at 2:00 AM UTC
const schedule = '0 2 * * *';

cron.schedule(schedule, async () => {
  try {
    console.log('[CRON] Starting cleanup...');
    
    // Only run if settings.cleanupEnabled === true
    
    // 1. Delete old videos from Backblaze B2
    //    - Age threshold: settings.videoStorageRetention (days)
    
    // 2. Delete old images from Backblaze B2
    //    - Age threshold: settings.imageStorageRetention (days)
    
    // 3. Delete old logs
    //    - Keep last 30 days only
    
    // 4. Delete old notifications
    //    - Keep last 7 days only
    
    // 5. Delete old upload jobs
    //    - Keep last settings.videoStudioActivityRetention days
    
    // 6. Vacuum database (optimize)
    
    console.log('[CRON] Cleanup completed');
  } catch (error) {
    console.error('[CRON] Cleanup error:', error);
  }
});
```

**CRITICAL**:
- Must check `settings.cleanupEnabled` before running
- Must use retention settings for video/image cleanup
- Must batch delete (not one-by-one) for performance

---

### 5.6 Cron Job Manager
```typescript
// File: src/cron/index.ts

// TMDb feed refresh jobs (4 independent jobs)
import './tmdb-today-refresh';
import './tmdb-weekly-refresh';
import './tmdb-monthly-refresh';
import './tmdb-anniversary-refresh';

// Other cron jobs
import './rss-check';
import './comment-monitor';
import './autopost-engine';
import './cleanup';

console.log('[CRON] All 8 cron jobs initialized:');
console.log('[CRON] 1. TMDb Today Refresh: Daily at 06:00 UTC (configurable)');
console.log('[CRON] 2. TMDb Weekly Refresh: Monday at 08:00 UTC (configurable)');
console.log('[CRON] 3. TMDb Monthly Refresh: Monday at 09:00 UTC (configurable)');
console.log('[CRON] 4. TMDb Anniversary Refresh: Daily at 07:00 UTC (configurable)');
console.log('[CRON] 5. RSS Check: Every 5 minutes');
console.log('[CRON] 6. Comment Monitor: Every 1 minute');
console.log('[CRON] 7. Autopost Engine: Every 15 minutes (configurable)');
console.log('[CRON] 8. Cleanup: Daily at 2:00 AM UTC');

export default {};
```

**Import in main server**:
```typescript
// src/index.ts
import './cron'; // Initialize all 8 cron jobs
```

---

## ✅ SECTION 6: POST-GENERATION VERIFICATION CHECKLIST

### Phase 1: Code Structure Verification (30 minutes)

```bash
# 1. Verify file structure
□ screndly-backend/
  □ src/
    □ index.ts (main server)
    □ routes/
      □ settings.ts
      □ tmdb.ts
      □ rss.ts
      □ comments.ts
      □ platforms.ts
      □ channels.ts
      □ jobs.ts
      □ logs.ts
      □ health.ts
    □ cron/
      □ tmdb-refresh.ts
      □ rss-check.ts
      □ comment-monitor.ts
      □ post-scheduler.ts
      □ cleanup.ts
      □ index.ts
    □ lib/
      □ prisma.ts (Prisma client)
      □ config.ts (environment variables)
      □ logger.ts (logging utility)
      □ validators.ts (Zod schemas)
    □ middleware/
      □ errorHandler.ts
      □ validateRequest.ts
      □ cors.ts
      □ auth.ts (optional)
  □ prisma/
    □ schema.prisma
  □ package.json
  □ tsconfig.json
  □ .env.example
  □ .gitignore
  □ README.md

# 2. Verify dependencies in package.json
□ express (latest)
□ @prisma/client (latest)
□ prisma (dev dependency)
□ typescript (dev dependency)
□ tsx (dev dependency)
□ @types/node (dev dependency)
□ @types/express (dev dependency)
□ node-cron (latest)
□ @types/node-cron (dev dependency)
□ zod (latest)
□ cors (latest)
□ @types/cors (dev dependency)
□ helmet (latest)
□ dotenv (latest)

# 3. Verify scripts in package.json
□ "dev": "tsx watch src/index.ts"
□ "build": "tsc"
□ "start": "node dist/index.js"
□ "migrate": "npx prisma migrate deploy"
□ "postinstall": "npx prisma generate"

# 4. Verify engines in package.json
□ "node": ">=18.0.0"
```

---

### Phase 2: Database Schema Verification (20 minutes)

```bash
# 1. Review prisma/schema.prisma
□ Generator and datasource configured correctly
□ All 9 models present:
  □ Setting
  □ TMDbPost
  □ RSSFeed
  □ Channel
  □ UploadJob
  □ Comment
  □ Notification
  □ Log
  □ PlatformConnection (optional)
□ All indexes present on frequently queried fields
□ All relationships defined correctly
□ All field types match API schemas
□ @db.Text used for long strings
□ Json type used for complex objects
□ DateTime used for all timestamps

# 2. Verify migration readiness
□ DATABASE_URL in .env.example
□ Schema can generate without errors: `npx prisma generate`
□ Migration can be created: `npx prisma migrate dev --name init`
```

---

### Phase 3: API Endpoint Verification (60 minutes)

**Use this checklist to verify EACH endpoint:**

```bash
# Settings Endpoints
□ GET /api/settings
  □ Returns full settings object
  □ API keys are masked (••••••••)
  □ Response matches schema in Section 2.1
  
□ PUT /api/settings
  □ Accepts partial updates
  □ Validates input with Zod
  □ Saves full API keys to database
  □ Returns masked API keys in response

# TMDb Endpoints  
□ GET /api/tmdb/posts
  □ Returns array of posts
  □ Supports ?status= query param
  □ Response matches schema in Section 2.2
  
□ POST /api/tmdb/posts
  □ Validates required fields
  □ Generates UUID for id
  □ Sets createdAt/updatedAt
  □ Returns full post object
  
□ PUT /api/tmdb/posts/:id
  □ Updates specific post
  □ Validates input
  □ Returns updated post
  
□ DELETE /api/tmdb/posts/:id
  □ Deletes post
  □ Returns success message
  
□ PUT /api/tmdb/posts/:id/reschedule
  □ Updates scheduledTime
  □ Validates ISO 8601 format
  □ Returns updated post
  
□ PUT /api/tmdb/posts/:id/status
  □ Updates status field
  □ Handles publishedTime (if published)
  □ Handles errorMessage (if failed)
  
□ POST /api/tmdb/refresh
  □ Queues TMDb refresh job
  □ Returns job ID
  □ Does not block (async)
  
□ GET /api/tmdb/stats
  □ Calculates stats from database
  □ Returns correct counts
  □ Returns cache hit rate
  □ Returns next refresh time

# RSS Endpoints
□ GET /api/rss/feeds
  □ Returns array of feeds
  □ Response matches schema in Section 2.3
  
□ POST /api/rss/feeds
  □ Validates RSS URL
  □ Fetches feed to verify
  □ Returns created feed
  
□ PUT /api/rss/feeds/:id
  □ Updates feed
  □ Returns updated feed
  
□ DELETE /api/rss/feeds/:id
  □ Deletes feed
  □ Returns success message
  
□ GET /api/rss/activity
  □ Returns feeds with stats
  □ Supports ?limit= query param
  □ Supports ?status= query param

# Comment Endpoints
□ GET /api/comments
  □ Returns comments array
  □ Supports ?platform= filter
  □ Supports ?limit= query param
  
□ POST /api/comments/reply
  □ Posts reply to platform
  □ Updates database
  □ Handles errors gracefully
  
□ GET /api/comments/stats
  □ Returns all comment stats
  □ Includes platform breakdown
  □ Includes recent replies
  
□ GET /api/comments/daily-stats
  □ Returns 30-day breakdown
  □ Groups by date and platform
  □ Calculates success rate
  
□ PUT /api/comments/settings
  □ Updates comment settings
  □ Returns updated settings

# Platform Endpoints
□ POST /api/platforms/post
  □ Posts to multiple platforms
  □ Returns results per platform
  □ Handles failures gracefully
  □ Updates source record (TMDb/RSS/etc)
  
□ GET /api/platforms/status
  □ Returns connection status for all platforms
  □ Includes rate limit info
  □ Includes last post time

# Channel Endpoints
□ GET /api/channels
  □ Returns all channels
  □ Includes stats
  
□ POST /api/channels
  □ Validates channel ID
  □ Fetches channel info from YouTube API
  □ Returns created channel
  
□ DELETE /api/channels/:id
  □ Deletes channel
  □ Returns success message
  
□ GET /api/channels/:id/videos
  □ Fetches videos from YouTube API
  □ Returns video array
  □ Marks processed videos

# Upload Job Endpoints
□ GET /api/jobs
  □ Returns all jobs
  □ Supports ?status= filter
  □ Supports ?limit= query param
  □ Includes events array
  
□ GET /api/jobs/:id
  □ Returns single job
  □ Includes full event history
  
□ POST /api/jobs
  □ Creates new job
  □ Initializes metadata
  □ Returns created job
  
□ PUT /api/jobs/:id
  □ Updates job fields
  □ Appends events
  □ Updates updatedAt
  
□ DELETE /api/jobs/:id
  □ Deletes job
  □ Returns success message
  
□ POST /api/jobs/:id/retry
  □ Resets job status
  □ Clears error
  □ Resets progress
  
□ GET /api/jobs/logs
  □ Returns system logs
  □ Supports ?level= filter

# Logs & Monitoring Endpoints
□ GET /api/logs
  □ Returns logs
  □ Supports ?level= filter
  □ Supports ?service= filter
  
□ GET /api/logs/errors
  □ Returns only error logs
  □ Includes stack traces
  
□ GET /api/notifications
  □ Returns notifications
  □ Ordered by createdAt DESC
  
□ POST /api/notifications
  □ Creates notification
  □ Returns created notification
  
□ PUT /api/notifications/:id
  □ Marks as read/unread
  □ Returns updated notification
  
□ DELETE /api/notifications/:id
  □ Deletes notification
  □ Returns success message

# Health Check
□ GET /api/health
  □ Returns health status
  □ Checks database connection
  □ Checks cron job status
  □ Returns uptime
  □ Does NOT require auth
```

**Total Endpoints**: 40 (verify count matches)

---

### Phase 4: Cron Job Verification (30 minutes)

```bash
# 1. Verify all cron jobs exist
□ src/cron/tmdb-refresh.ts exists
□ src/cron/rss-check.ts exists
□ src/cron/comment-monitor.ts exists
□ src/cron/post-scheduler.ts exists
□ src/cron/cleanup.ts exists
□ src/cron/index.ts exists and imports all

# 2. Verify cron schedules
□ TMDb Refresh: '0 0 * * 1' (Monday 00:00 UTC)
□ RSS Check: '*/5 * * * *' (every 5 minutes)
□ Comment Monitor: '* * * * *' (every 1 minute)
□ Post Scheduler: '* * * * *' (every 1 minute)
□ Cleanup: '0 2 * * *' (daily 2am UTC)

# 3. Verify cron job logic
□ TMDb Refresh:
  □ Fetches from TMDb API
  □ Generates AI captions
  □ Respects 1-hour gap rule
  □ Checks for duplicates
  □ Does not block API requests
  
□ RSS Check:
  □ Fetches RSS feeds
  □ Deduplicates items
  □ Generates AI captions
  □ Respects 1-hour gap rule
  
□ Comment Monitor:
  □ Checks settings.commentRepliesActive
  □ Applies blacklist rules
  □ Generates AI replies
  □ Respects throttle settings
  □ Handles rate limits
  
□ Post Scheduler:
  □ Finds posts with scheduledTime <= now
  □ Verifies 1-hour gap rule
  □ Posts to platforms
  □ Updates status atomically
  
□ Cleanup:
  □ Checks settings.cleanupEnabled
  □ Deletes old videos from B2
  □ Deletes old images from B2
  □ Deletes old logs
  □ Uses retention settings

# 4. Verify cron initialization
□ src/index.ts imports './cron'
□ Cron jobs start on server startup
□ Console logs show all 8 jobs initialized
```

---

### Phase 5: Environment Variables Verification (15 minutes)

```bash
# 1. Verify .env.example exists with all variables
□ NODE_ENV
□ PORT
□ DATABASE_URL
□ FRONTEND_URL

# External APIs
□ TMDB_API_KEY
□ OPENAI_API_KEY
□ SERPER_API_KEY
□ YOUTUBE_API_KEY
□ GOOGLE_VIDEO_INTELLIGENCE_KEY
□ SHOTSTACK_KEY
□ PHOTOPEA_API_KEY

# Backblaze B2 (3 buckets)
□ B2_TRAILERS_KEY_ID
□ B2_TRAILERS_APPLICATION_KEY
□ B2_TRAILERS_BUCKET_NAME
□ B2_VIDEOS_KEY_ID
□ B2_VIDEOS_APPLICATION_KEY
□ B2_VIDEOS_BUCKET_NAME
□ B2_DESIGN_KEY_ID
□ B2_DESIGN_APPLICATION_KEY
□ B2_DESIGN_BUCKET_NAME

# Platform APIs
□ X_API_KEY
□ X_API_SECRET
□ THREADS_ACCESS_TOKEN
□ FACEBOOK_ACCESS_TOKEN
□ FACEBOOK_PAGE_ID

# Optional
□ REDIS_URL
□ SENTRY_DSN

# 2. Verify environment validation in src/lib/config.ts
□ Validates all required env vars on startup
□ Throws error if any are missing
□ Provides helpful error messages
□ Exports typed config object

# 3. Verify no secrets in code
□ No hardcoded API keys
□ No hardcoded database URLs
□ All secrets use process.env.*
```

---

### Phase 6: Error Handling Verification (20 minutes)

```bash
# 1. Verify global error handler exists
□ src/middleware/errorHandler.ts exists
□ Catches all unhandled errors
□ Returns standard error format:
  {
    success: false,
    error: {
      code: string,
      message: string,
      details?: any
    }
  }
□ Logs errors to database
□ Does not expose stack traces in production

# 2. Verify HTTP status codes
□ 200: Successful GET
□ 201: Successful POST (created)
□ 400: Bad request (validation error)
□ 401: Unauthorized (if using auth)
□ 403: Forbidden (if using auth)
□ 404: Not found
□ 500: Internal server error

# 3. Verify validation
□ All POST/PUT endpoints use Zod validation
□ Validation errors return 400 with details
□ Required fields are enforced
□ Type errors are caught

# 4. Verify async error handling
□ All async routes wrapped in try/catch
□ Database errors caught and logged
□ External API errors caught and handled
□ Timeout errors handled gracefully
```

---

### Phase 7: Railway Deployment Verification (15 minutes)

```bash
# 1. Verify package.json compatibility
□ "engines": { "node": ">=18.0.0" } exists
□ "build" script compiles TypeScript
□ "start" script runs compiled JS
□ "postinstall" script runs prisma generate

# 2. Verify build process
□ Run `npm run build` locally
□ Verify dist/ folder created
□ Verify no TypeScript errors
□ Verify dist/index.js exists

# 3. Verify Prisma setup
□ prisma/schema.prisma uses env("DATABASE_URL")
□ Migration command: `npx prisma migrate deploy`
□ Generate command: `npx prisma generate`

# 4. Verify health check
□ GET /health endpoint exists
□ Returns 200 status
□ Does not require authentication
□ Railway can use this for health checks

# 5. Verify CORS
□ CORS middleware configured
□ Allows FRONTEND_URL origin
□ Handles preflight requests
□ Allows credentials if needed
```

---

### Phase 8: Integration Verification (30 minutes)

```bash
# 1. Test local development
□ Copy .env.example to .env
□ Add test database URL
□ Run `npm install`
□ Run `npx prisma migrate dev`
□ Run `npm run dev`
□ Server starts without errors
□ Cron jobs initialize
□ Health check returns 200

# 2. Test database connection
□ Prisma client connects to database
□ Can query Setting model
□ Can insert test record
□ Can update test record
□ Can delete test record

# 3. Test API endpoints (use Postman/curl)
□ GET /api/health returns healthy
□ GET /api/settings returns default settings
□ PUT /api/settings updates successfully
□ POST /api/tmdb/posts creates post
□ GET /api/tmdb/posts returns posts
□ Other endpoints respond correctly

# 4. Test error handling
□ Send invalid JSON → Returns 400
□ Send missing required field → Returns 400
□ Request non-existent resource → Returns 404
□ Cause database error → Returns 500 (logged)

# 5. Test cron jobs (manually trigger)
□ TMDb refresh logic works
□ RSS check logic works
□ Post scheduler logic works
□ No blocking of API requests
```

---

### Phase 9: Code Quality Verification (20 minutes)

```bash
# 1. TypeScript compliance
□ No .js files in src/ (except compiled)
□ All functions have types
□ No implicit 'any' (unless explicitly typed)
□ No TypeScript errors: `tsc --noEmit`

# 2. Code organization
□ Routes separated by domain (tmdb, rss, etc.)
□ Shared logic in lib/ folder
□ Middleware in middleware/ folder
□ Cron jobs in cron/ folder
□ No code duplication
□ Functions are single-purpose

# 3. Logging
□ All cron jobs log start/complete
□ All errors logged to database
□ All external API calls logged
□ Production logs exclude sensitive data

# 4. Security
□ Helmet middleware configured
□ CORS properly configured
□ SQL injection prevented (Prisma ORM)
□ XSS prevention (no raw HTML rendering)
□ API keys never in responses (masked)
```

---

### Phase 10: Documentation Verification (10 minutes)

```bash
# 1. README.md exists with:
□ Project description
□ Tech stack
□ Installation instructions
□ Environment variables list
□ Development commands
□ Deployment instructions
□ API endpoint list

# 2. .env.example has:
□ All required env vars
□ Placeholder values
□ Comments explaining each var

# 3. Code comments
□ Complex logic is commented
□ Cron schedules explained
□ External API integrations documented
□ Database schema comments in Prisma
```

---

## 🎯 FINAL CHECKLIST SUMMARY

**All phases must be 100% complete before deployment:**

- [ ] Phase 1: Code Structure (30 min)
- [ ] Phase 2: Database Schema (20 min)
- [ ] Phase 3: API Endpoints (60 min) - **ALL 40 endpoints**
- [ ] Phase 4: Cron Jobs (30 min) - **ALL 8 cron jobs**
- [ ] Phase 5: Environment Variables (15 min)
- [ ] Phase 6: Error Handling (20 min)
- [ ] Phase 7: Railway Deployment (15 min)
- [ ] Phase 8: Integration Testing (30 min)
- [ ] Phase 9: Code Quality (20 min)
- [ ] Phase 10: Documentation (10 min)

**Total Verification Time**: ~4 hours

---

## 🚀 DEPLOYMENT INSTRUCTIONS

Once all verification phases are complete:

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial backend implementation"
git branch -M main
git remote add origin https://github.com/your-username/screndly-backend
git push -u origin main
```

### Step 2: Deploy to Railway
1. Go to railway.app
2. New Project → Deploy from GitHub
3. Select screndly-backend repository
4. Add environment variables (from .env.example)
5. Deploy

### Step 3: Run Database Migrations
```bash
# In Railway dashboard → Deployments → Shell
npx prisma migrate deploy
```

### Step 4: Verify Deployment
```bash
# Test health endpoint
curl https://screndly-production.up.railway.app/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "services": {
    "database": "connected",
    "cron": "running"
  },
  "uptime": 123,
  "version": "1.0.0"
}
```

### Step 5: Connect Frontend
Update frontend environment variables:
```env
VITE_API_URL=https://screndly-production.up.railway.app
```

Deploy frontend to Vercel:
```bash
git add .
git commit -m "Connect to production backend"
git push origin main
# Vercel auto-deploys
```

### Step 6: Final Verification
- [ ] Frontend can reach backend
- [ ] Settings save successfully
- [ ] TMDb posts load
- [ ] Cron jobs running (check Railway logs)
- [ ] No errors in Railway logs
- [ ] Database has data

---

## ✅ SUCCESS CRITERIA

Backend implementation is **COMPLETE** when:

1. ✅ All 40 API endpoints return correct responses
2. ✅ All 8 cron jobs running without errors
3. ✅ Database migrations successful
4. ✅ Health check returns 200 OK
5. ✅ Frontend successfully consumes all APIs
6. ✅ Zero critical errors in logs
7. ✅ Railway deployment successful
8. ✅ Production URL accessible

---

**END OF ANTIGRAVITY INSTRUCTIONS**

---

## 📦 FILES TO PROVIDE TO ANTIGRAVITY

**You MUST provide these files when executing ANTIGRAVITY:**

### Required Specification Files:
```
1. /ANTIGRAVITY_BACKEND_INSTRUCTIONS.md     (This file - complete spec)
2. /IMPLEMENTATION_CHECKLIST.md              (Backend readiness checklist)
3. /docs/OPTION_B_QUICK_START.md            (Deployment guide)
```

### Required Documentation Files:
```
4. /README.md                                (Project overview)
5. /SCRENDLY_APP_STRUCTURE.md               (App structure)
6. /PROJECT_STATUS.md                        (Current status)
7. /docs/ARCHITECTURE.md                     (System architecture)
8. /docs/API_CONTRACT.md                     (API contracts)
9. /docs/TMDB_COMPLETE_WORKFLOW.md          (TMDb workflow)
10. /docs/RSS_FEED_WORKFLOW.md              (RSS workflow)
11. /docs/AUTOPOST_ARCHITECTURE.md          (Autopost system)
12. /BOTTOM_SHEET_SYSTEM.md                 (UI patterns)
13. /docs/HAPTICS_IMPLEMENTATION.md         (Haptics system)
```

### Required Frontend Code Files (for data structures):
```
14. /contexts/SettingsContext.tsx            (Settings interface)
15. /contexts/TMDbPostsContext.tsx          (TMDbPost interface)
16. /contexts/RSSFeedsContext.tsx           (RSSFeed interface)
17. /contexts/NotificationsContext.tsx      (Notification interface)
18. /store/useJobsStore.ts                  (UploadJob interface)
19. /lib/api/client.ts                      (API client patterns)
20. /lib/api/settings.ts                    (Settings API example)
```

### Optional Reference Files (helpful but not required):
```
21. /docs/META_SETUP_GUIDE.md               (Meta integration)
22. /docs/X_SETUP_GUIDE.md                  (X integration)
23. /docs/GOOGLE_VIDEO_INTELLIGENCE_SHOTSTACK_INTEGRATION.md
24. /docs/ffmpeg-architecture.md            (FFmpeg processing)
25. /utils/tmdbScheduler.ts                 (Scheduling logic example)
```

### Command to Execute ANTIGRAVITY:

```bash
# Provide all required files above, then execute:

"Generate complete Screndly backend following ANTIGRAVITY_BACKEND_INSTRUCTIONS.md 
with ZERO deviation. All specifications are complete in the provided files. 
Execute against the complete blueprint with strict adherence to:
- All 40 API endpoints (Section 2)
- Complete Prisma schema (Section 4)
- All 8 cron jobs (Section 5)
- Complete verification checklist (Section 6)
- Railway + Neon deployment architecture (OPTION_B_QUICK_START.md)

Study the application first by reading all provided .md files and frontend code 
to understand data structures, design patterns, and business logic before generating code."
```

---

Generated backend must pass ALL 10 verification phases before deployment.
