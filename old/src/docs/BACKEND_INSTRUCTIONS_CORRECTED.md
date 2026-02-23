# Backend Instructions Corrected ✅

**Date**: December 31, 2025  
**Critical Corrections**: TMDb Cron Jobs, Autopost Engine, Rate Limiting

---

## 🚨 Critical Corrections Made

### 1. TMDb Feed Refresh Structure (MAJOR CHANGE)

**❌ INCORRECT (Previous Documentation):**
- Single cron job running Monday 00:00 UTC
- Combined refresh for all 4 feeds
- Fixed schedule

**✅ CORRECTED (Actual Implementation):**
- **4 INDEPENDENT cron jobs** with separate schedules
- Each feed has user-configurable refresh day/time
- Settings stored in database

**4 TMDb Cron Jobs:**
```typescript
1. Today's Releases
   - Default: Daily at 06:00 UTC
   - User-configurable: time only (always daily)
   - Setting: settings.tmdbTodaySchedule { refreshTime }
   
2. Weekly Releases
   - Default: Every Monday at 08:00 UTC
   - User-configurable: day + time
   - Setting: settings.tmdbWeeklySchedule { refreshDay, refreshTime }
   
3. Monthly Previews
   - Default: Every Monday at 09:00 UTC
   - User-configurable: day + time
   - Setting: settings.tmdbMonthlySchedule { refreshDay, refreshTime }
   
4. Anniversaries
   - Default: Daily at 07:00 UTC
   - User-configurable: time only (always daily)
   - Setting: settings.tmdbAnniversarySchedule { refreshTime }
```

### 2. Post Scheduler → Autopost Engine (MAJOR CHANGE)

**❌ INCORRECT (Previous Documentation):**
- Name: "Post Scheduler"
- Interval: Every 1 minute
- Logic: Check all scheduled posts, verify 1-hour gap, post immediately

**✅ CORRECTED (Actual Implementation):**
- Name: **"Autopost Engine"** (queue-based system)
- Default Interval: Every **15 minutes** (user-configurable)
- Setting: `settings.autopostTickInterval` (5-1440 minutes)
- Logic: 
  1. Get highest-priority post from queue
  2. Check rate governor limits
  3. Post if eligible
  4. Respect global rate limits

### 3. Rate Governor Configuration (NEW SYSTEM)

**✅ NEW RATE LIMITING SYSTEM:**

```typescript
Rate Governor Settings (stored in database):
{
  minGapBetweenPosts: 180,      // 3 hours default (30-1440 min)
  maxPostsPerDay: 6,             // per platform (1-50)
  quietHoursStart: 0,            // midnight (0-23)
  quietHoursEnd: 7               // 7am (0-23)
}
```

**Rules:**
- **3-hour minimum gap** between ANY posts (not 1-hour)
- **6 posts/day maximum** per platform
- **No posting during quiet hours** (midnight-7am default)
- All settings user-configurable in UI

### 4. TMDb Deduplication Rules (CLARIFIED)

**✅ CORRECT DEDUPLICATION LOGIC:**

```typescript
Same Feed (e.g., Weekly → Weekly):
- 30-day block (no same movie/show within 30 days)

Across Feeds (e.g., Monthly → Weekly → Today):
- 7-day minimum gap (same movie/show can appear if 7+ days apart)
- This allows "progressive countdown" pattern:
  * Monthly preview (28 days before)
  * Weekly preview (7 days before)
  * Today announcement (release day)
```

---

## 📊 Corrected Cron Job Count

**Previous Documentation**: 5-6 cron jobs
**Actual Implementation**: **8 cron jobs**

1. **TMDb Today Refresh** - Daily 06:00 UTC (configurable)
2. **TMDb Weekly Refresh** - Monday 08:00 UTC (configurable)
3. **TMDb Monthly Refresh** - Monday 09:00 UTC (configurable)
4. **TMDb Anniversary Refresh** - Daily 07:00 UTC (configurable)
5. **RSS Feed Check** - Every 5 minutes
6. **Comment Monitor** - Every 1 minute
7. **Autopost Engine** - Every 15 minutes (configurable)
8. **Cleanup Job** - Daily 2:00 AM UTC

---

## 🔧 Files Updated

### 1. ANTIGRAVITY_BACKEND_INSTRUCTIONS.md
**Added:**
- New section at beginning: "PREREQUISITE: STUDY THE APPLICATION FIRST"
  - 6 steps to understand the app before generating code
  - Reading order for 25+ documentation files
  - Frontend code review guide
  - Design pattern explanations
  - Data flow examples

**Corrected:**
- Section 5.1: Split into 4 separate TMDb cron jobs with individual schedules
- Section 5.4: Renamed to "Autopost Engine" with queue-based logic
- Added Rate Governor configuration details
- Updated cron job count from 5 to 8
- Corrected all gap intervals (3 hours, not 1 hour)
- Added user-configurable settings references

**Added at End:**
- Complete file list for ANTIGRAVITY (25 required files)
- Execution command with study instructions

### 2. IMPLEMENTATION_CHECKLIST.md
**Corrected:**
- Section 5.3: Expanded from 5 items to 8 cron jobs
- Section 6.3: Updated count from 5 to 8 cron jobs
- Section 14 Phase 3: Expanded automation tasks from 6 to 10 items
- Section 15: Updated success criteria from 6 to 8 cron jobs

### 3. Documentation Cleanup
**Deleted 32 outdated files:**
- Temporary fix documentation (12 files)
- Old audit reports (6 files)
- Redundant implementation docs (4 files)
- Migration documentation (3 files)
- Redundant test reports (5 files)
- Vague/outdated files (2 files)

**Retained 27 core files:**
- Project overview (5 files)
- Backend documentation (4 files)
- Architecture (2 files)
- Performance (5 files)
- Testing (4 files)
- Deployment (4 files)
- Status reports (3 files)

---

## ✅ Verification Checklist

**Before using ANTIGRAVITY, verify these corrections:**

- [x] TMDb has 4 separate cron jobs (not 1 combined job)
- [x] Each TMDb feed has configurable schedule in settings
- [x] Autopost engine runs every 15 minutes (not 1 minute)
- [x] Autopost engine is queue-based (not direct post scheduler)
- [x] Rate governor enforces 3-hour gaps (not 1 hour)
- [x] Daily post limit is 6 per platform (configurable)
- [x] Quiet hours are midnight-7am (configurable)
- [x] TMDb deduplication: 30-day same feed, 7-day across feeds
- [x] Total cron jobs: 8 (not 5 or 6)
- [x] All settings are user-configurable via UI

---

## 🎯 Key Takeaways for ANTIGRAVITY

1. **Read the actual app code** before generating backend
2. **Each TMDb feed is independent** - don't combine them
3. **Autopost engine uses priority queue** - not simple scheduler
4. **Rate limiting is comprehensive** - gaps, daily limits, quiet hours
5. **All schedules are configurable** - read from settings table
6. **Support dynamic cron updates** - restart when settings change

---

## 📚 Next Steps

1. **Review corrected ANTIGRAVITY_BACKEND_INSTRUCTIONS.md** (complete)
2. **Review corrected IMPLEMENTATION_CHECKLIST.md** (complete)
3. **Gather all 25 required files for ANTIGRAVITY**
4. **Execute ANTIGRAVITY with study-first instruction**
5. **Verify generated code against actual frontend implementation**

**Status**: Documentation now accurately reflects current app implementation ✅
