# Architecture Decision: Option B (Always-On Backend)

**Decision Date**: December 14, 2024  
**Selected Option**: Railway Hobby ($5/mo) + Neon Free + Backblaze B2  
**Total Cost**: $5.40/month  

---

## Decision Summary

After evaluating multiple architecture options for Screndly's production deployment, we've selected **Option B: Reliable Always-On Backend** with the following stack:

```
Frontend:     Vercel Free
Backend:      Railway Hobby ($5/mo)
Database:     Neon Postgres Free
Cache:        Upstash Redis Free (optional)
Storage:      Backblaze B2 (~$0.40/mo)

Total: $5.40/month
```

---

## Options Evaluated

### Option A: Serverless-First (FREE) ❌

```
Frontend:    Vercel Free
Backend:     Vercel Serverless Functions
Cron Jobs:   GitHub Actions
Database:    Neon Postgres Free
Storage:     Backblaze B2
Cache:       Vercel KV Free
```

**Pros**:
- ✅ 100% free
- ✅ No cold starts for cron jobs
- ✅ Simple deployment

**Cons**:
- ❌ Serverless function timeout (10s on free tier)
- ❌ Limited cron (1/day on free tier)
- ❌ Complex debugging for long-running tasks
- ❌ GitHub Actions run in isolation (no shared state)

**Decision**: Rejected - Too restrictive for background automation

---

### Option B: Reliable Always-On ($5-7/mo) ✅ **SELECTED**

```
Frontend:    Vercel Free
Backend:     Railway Hobby ($5/mo)
Database:    Neon Postgres Free
Storage:     Backblaze B2
```

**Pros**:
- ✅ True 24/7 background automation
- ✅ No cold starts ever
- ✅ Reliable scheduled jobs
- ✅ Better for long-running tasks
- ✅ Predictable performance
- ✅ Only $5/month

**Cons**:
- ⚠️ Not free (but very affordable)

**Decision**: ✅ **SELECTED** - Best balance of reliability and cost

---

### Option C: Render Hobby Free ❌

```
Frontend:    Vercel Free
Backend:     Render Hobby Free
Database:    Neon Postgres Free
Storage:     Backblaze B2
```

**Pros**:
- ✅ Free backend

**Cons**:
- ❌ **Spins down after 15 min** (deal-breaker)
- ❌ **30-60s cold start** (terrible UX)
- ❌ **750 hours/month** (not enough for 24/7)
- ❌ Background automation stops when sleeping
- ❌ RSS feeds, TMDb, comments all paused

**Decision**: Rejected - Sleep behavior makes it unsuitable

---

## Why Option B?

### 1. **Screndly's Core Requirements**

Screndly **requires** reliable background automation:

```
✅ RSS Feeds        → Check every 30 minutes
✅ TMDb Posts       → Check daily, schedule posts
✅ Comment Auto     → Check every 2 hours
✅ Upload Jobs      → Process continuously
✅ WebSocket        → Real-time updates
```

**Option B meets all requirements perfectly.**

### 2. **Cost-Benefit Analysis**

For **$5/month**, you get:

- ✅ 512MB RAM, 1 vCPU (plenty for single user)
- ✅ 24/7 uptime (no sleep, ever)
- ✅ Unlimited cron jobs
- ✅ WebSocket support
- ✅ <100ms API response times
- ✅ Automatic deployments
- ✅ Built-in monitoring

**This is exceptional value** - equivalent services cost $20-50/mo elsewhere.

### 3. **Comparison to "Free" Options**

| Feature | Option A (Free) | Option B ($5) | Difference |
|---------|----------------|---------------|------------|
| **Uptime** | N/A (serverless) | 99.9% | Always available |
| **Cron Jobs** | 1/day (Vercel) | Unlimited | Full automation |
| **Cold Starts** | None (GitHub Actions) | None | Same |
| **Task Duration** | 10s limit | Unlimited | Long-running tasks OK |
| **Complexity** | High | Low | Simpler to maintain |
| **Debugging** | Difficult | Easy | Better logs |

**For $5/month, you get significantly better reliability and developer experience.**

### 4. **Render Free vs Railway Hobby**

| Feature | Render Free | Railway Hobby |
|---------|-------------|---------------|
| **Cost** | $0 | $5/mo |
| **Sleep** | ❌ Yes (15 min) | ✅ Never |
| **Cold Start** | ❌ 30-60s | ✅ None |
| **Hours/Month** | ❌ 750 (25 days) | ✅ 720 (24/7) |
| **Automation** | ❌ Stops when sleeping | ✅ Always running |

**Render Free's sleep behavior is a deal-breaker for automation apps.**

---

## Technical Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND (Vercel Free)                          │
│  • React + TypeScript + Tailwind                            │
│  • PWA with Service Worker                                  │
│  • FFmpeg.wasm (client-side)                               │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/WSS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         BACKEND API (Railway $5)                            │
│  • Node.js + Express                                        │
│  • REST API + WebSocket                                     │
│  • Cron Jobs (RSS, TMDb, Comments)                         │
│  • 512MB RAM, always on                                    │
└──────┬──────────┬──────────┬──────────────────────────────┘
       │          │          │
       ▼          ▼          ▼
   ┌────────┐ ┌──────┐ ┌──────────┐
   │ Neon   │ │Upstash│ │Backblaze│
   │Postgres│ │Redis  │ │   B2    │
   │ (Free) │ │(Free) │ │ (~$0.40)│
   └────────┘ └──────┘ └──────────┘
```

### Data Flow

```
1. User opens Screndly PWA (Vercel)
2. Frontend connects to backend API (Railway)
3. Backend queries database (Neon Postgres)
4. Backend fetches/uploads from Backblaze B2
5. Cron jobs run in background (Railway)
6. WebSocket pushes real-time updates
7. Frontend updates UI instantly
```

---

## Cost Breakdown

### Monthly Costs

| Service | Plan | Cost | Purpose |
|---------|------|------|---------|
| **Vercel** | Free | $0 | Frontend hosting |
| **Railway** | Hobby | $5 | Backend API + automation |
| **Neon** | Free | $0 | PostgreSQL database |
| **Upstash** | Free | $0 | Redis (optional) |
| **Backblaze** | PAYG | ~$0.40 | Video storage |
| **TOTAL** | | **$5.40** | |

### Annual Cost

```
$5.40/month × 12 = $64.80/year

Compared to:
- AWS similar setup: ~$50-100/month
- Heroku: $25-50/month
- DigitalOcean: $12-24/month

Option B is the most cost-effective.
```

### Usage Estimates

**Neon (0.5GB limit)**:
```
Videos metadata:    10MB
Activity logs:      25MB
RSS posts:          10MB
TMDb posts:         10MB
Other:              15MB
Total:             ~70MB (14% of limit)
```

**Backblaze B2**:
```
Storage:  50GB × $0.006 = $0.30
Download: 10GB × $0.01  = $0.10
Total:                  ~$0.40/month
```

**Railway (512MB RAM, 100GB bandwidth)**:
```
API requests:    ~10,000/month
WebSocket:       ~1,000 connections/month
Background jobs: ~2,000 runs/month
Well within limits
```

---

## Migration Path

### Phase 1: Setup (Day 1)

1. ✅ Create Railway account
2. ✅ Create Neon database
3. ✅ Set up environment variables
4. ✅ Deploy minimal backend

### Phase 2: Backend Development (Week 1)

1. Implement REST API routes
2. Add Prisma schema + migrations
3. Create cron jobs
4. Add WebSocket server
5. Write tests

### Phase 3: Frontend Migration (Week 1)

1. Update API client
2. Update WebSocket connection
3. Test all integrations
4. Deploy to Vercel

### Phase 4: Production (Week 2)

1. Monitor logs and metrics
2. Optimize performance
3. Set up alerts
4. Configure backups

---

## Performance Expectations

### API Response Times

```
Health check:      <50ms
Database query:    <100ms
File upload:       <200ms (excluding transfer)
WebSocket:         <10ms latency
```

### Reliability

```
Railway uptime:    99.9%
Neon uptime:       99.9%
Vercel uptime:     99.99%
Overall:          ~99.8% (excellent)
```

### Scalability

```
Current (single user):
- 512MB RAM
- 1 vCPU
- 100GB bandwidth

Future (if needed):
- Upgrade Railway to $20/mo (4× resources)
- Upgrade Neon to $19/mo (3GB storage)
- Total: $39/mo for significant growth
```

---

## Risk Analysis

### Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Railway downtime** | Low | High | Health checks + alerts |
| **Neon storage limit** | Low | Medium | Monitor usage, upgrade if needed |
| **Cost overrun** | Very Low | Low | Fixed $5/mo, no surprises |
| **Performance issues** | Low | Medium | Caching, optimization |

### Backup Strategy

1. **Neon automatic backups**: 7 days point-in-time recovery
2. **Manual backups**: Daily pg_dump to Backblaze
3. **Code backups**: GitHub repository
4. **Environment backups**: Documented in repo

---

## Alternative Considered

### If Budget is Absolutely $0

Use **Option A (Serverless + GitHub Actions)** with these trade-offs:

**Acceptable**:
- ✅ Frontend works perfectly
- ✅ API calls work fine
- ✅ Cron jobs via GitHub Actions

**Limitations**:
- ⚠️ Complex debugging
- ⚠️ 10s function timeout
- ⚠️ More setup complexity

**But for $5/month, Option B is significantly better.**

---

## Decision Rationale

### Why Railway over Render?

1. **$5 vs $7** - Cheaper ($24/year savings)
2. **Faster deployments** - 30-60s vs 2-3 min
3. **Better DX** - Cleaner dashboard, easier to use
4. **Same reliability** - Both 99.9% uptime

### Why Not Stay Frontend-Only?

Screndly **cannot** work as frontend-only for these features:

1. **OAuth tokens** - Must be stored securely server-side
2. **Cron jobs** - Need reliable scheduling
3. **WebSocket** - Real-time updates require persistent connection
4. **Rate limiting** - Server-side enforcement
5. **Secret management** - API keys must be hidden

**Backend is essential for production Screndly.**

---

## Conclusion

**Option B (Railway + Neon + Backblaze)** is the optimal choice for Screndly because:

1. ✅ **Reliable** - 24/7 uptime, no sleep
2. ✅ **Affordable** - Only $5.40/month
3. ✅ **Simple** - Easy setup and maintenance
4. ✅ **Scalable** - Easy to upgrade when needed
5. ✅ **Production-ready** - All features work perfectly

**This architecture will serve Screndly well for years to come.**

---

## Next Steps

1. **[Quick Start Guide](./OPTION_B_QUICK_START.md)** - Set up in 30 minutes
2. **[Railway Setup](./RAILWAY_SETUP.md)** - Detailed Railway guide
3. **[Neon Setup](./NEON_SETUP.md)** - Database configuration
4. **[Production Architecture](./PRODUCTION_ARCHITECTURE.md)** - Full architecture docs

---

**Decision Status**: ✅ **APPROVED**  
**Implementation**: Ready to begin  
**Timeline**: 1-2 weeks to full production  

Let's build! 🚀
