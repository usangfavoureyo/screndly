# Railway Setup Guide for Screndly

**Platform**: Railway Hobby Plan ($5/month)  
**Purpose**: Always-on backend API with background automation  
**Last Updated**: December 14, 2024

---

## Why Railway?

- ✅ **$5/month flat rate** (cheapest always-on option)
- ✅ **No sleep** - runs 24/7
- ✅ **Zero config** - automatic deployments
- ✅ **Fast deployments** - 30-60 seconds
- ✅ **WebSocket support** - for real-time features
- ✅ **Automatic HTTPS** - free SSL certificates
- ✅ **GitHub integration** - deploy on push
- ✅ **Environment variables** - secure configuration
- ✅ **Logs & monitoring** - built-in observability

---

## Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click **"Start a New Project"**
3. Sign in with **GitHub** (recommended for auto-deployments)
4. Authorize Railway to access your repositories

---

## Step 2: Create New Project

### Option A: Deploy from GitHub (Recommended)

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your Screndly backend repository
4. Railway will automatically detect your project type

### Option B: Start from Template

1. Click **"New Project"**
2. Select **"Deploy from template"**
3. Choose **"Blank Template"**
4. We'll configure it manually

---

## Step 3: Configure Build Settings

Railway auto-detects most settings, but verify:

### Detected Settings (Auto-configured)

```yaml
Runtime:        Node.js 18+
Build Command:  npm install && npm run build
Start Command:  npm start
Port:          3000 (auto-detected from process.env.PORT)
```

### Manual Configuration (if needed)

1. Click on your service
2. Go to **Settings** tab
3. Scroll to **Deploy**

**Build Command:**
```bash
npm install && npx prisma generate && npm run build
```

**Start Command:**
```bash
npx prisma migrate deploy && npm start
```

**Root Directory:** (if backend is in subdirectory)
```
backend/
```

---

## Step 4: Environment Variables

1. Click on your service
2. Go to **Variables** tab
3. Click **"New Variable"** for each:

### Required Variables

```env
# Node Environment
NODE_ENV=production

# Server
PORT=${{ PORT }}  # Railway provides this automatically

# API Security
API_KEY=generate_a_secure_random_string_here

# Database (Neon Postgres)
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/screndly?sslmode=require

# Backblaze B2
B2_KEY_ID=your_b2_key_id
B2_APPLICATION_KEY=your_b2_application_key
B2_BUCKET_NAME=screndly-trailers
B2_VIDEOS_BUCKET_NAME=screndly-videos

# External APIs
TMDB_API_KEY=your_tmdb_api_key
OPENAI_API_KEY=your_openai_api_key
SERPER_API_KEY=your_serper_api_key

# YouTube OAuth
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
YOUTUBE_REDIRECT_URI=https://your-frontend.vercel.app/auth/youtube/callback

# X (Twitter) OAuth
X_CLIENT_ID=your_x_client_id
X_CLIENT_SECRET=your_x_client_secret

# TikTok OAuth
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret

# Meta (Facebook/Instagram) OAuth
META_CLIENT_ID=your_meta_client_id
META_CLIENT_SECRET=your_meta_client_secret

# Redis (Upstash) - Optional
REDIS_URL=https://your-redis.upstash.io
REDIS_TOKEN=your_upstash_token

# Cron Jobs
RSS_FETCH_INTERVAL=5 # minutes
TMDB_CHECK_INTERVAL=60 # minutes
COMMENT_CHECK_INTERVAL=10 # minutes

# CORS Configuration
FRONTEND_URL=https://screndly.vercel.app
```

### Pro Tip: Use Railway's Variable Groups

Create variable groups for different environments:

1. **Production** - Live environment
2. **Staging** - Testing environment
3. **Development** - Local development

---

## Step 5: Configure Domain (Optional)

### Railway Provides a Free Domain

```
https://your-app.up.railway.app
```

### Custom Domain (Optional)

1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"** (free Railway domain)
3. Or add your **Custom Domain**:
   - Domain: `api.screndly.com`
   - Railway provides SSL automatically

**DNS Configuration:**
```
Type:   CNAME
Name:   api.screndly.com
Value:  your-app.up.railway.app
TTL:    Auto
```

---

## Step 6: Configure Health Checks

1. Go to **Settings** → **Health Check**
2. Enable health checks
3. Configure:

```yaml
Health Check Path:      /health
Health Check Interval:  60 seconds
Health Check Timeout:   10 seconds
Restart Policy:         On Failure
```

### Create Health Check Endpoint

```typescript
// src/api/routes/health.ts
import { Router } from 'express';
import { prisma } from '../database/client';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

export default router;
```

---

## Step 7: Deploy Your Backend

### Automatic Deployment (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "feat: initial backend setup"
   git push origin main
   ```

2. **Railway Automatically:**
   - Detects the push
   - Builds your app
   - Runs migrations
   - Deploys with zero downtime
   - Shows logs in real-time

### Manual Deployment

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Link Project:**
   ```bash
   railway link
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

---

## Step 8: Monitor Deployment

### View Logs

1. Click on your service
2. Go to **Deployments** tab
3. Click on the latest deployment
4. View real-time logs

**Example Logs:**
```
[Build] Installing dependencies...
[Build] Running prisma generate...
[Build] Building TypeScript...
[Deploy] Running migrations...
[Deploy] Starting server...
[Server] 🚀 Server running on port 3000
[Server] ✅ Database connected
[Server] ✅ Cron jobs initialized
```

### Check Deployment Status

```
✅ Building...     (1/4)
✅ Deploying...    (2/4)
✅ Starting...     (3/4)
✅ Healthy         (4/4)
```

---

## Step 9: Test Your Backend

### Get Your Backend URL

```
https://screndly-production.up.railway.app
```

### Test Endpoints

```bash
# Health check
curl https://your-app.up.railway.app/health

# Test API (with authentication)
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-app.up.railway.app/api/videos

# WebSocket test
wscat -c wss://your-app.up.railway.app
```

### Expected Response (Health Check)

```json
{
  "status": "healthy",
  "timestamp": "2024-12-14T12:00:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

---

## Step 10: Configure Monitoring

### Built-in Metrics

Railway provides automatic metrics:

1. Go to **Metrics** tab
2. View:
   - **CPU Usage**
   - **Memory Usage**
   - **Network Traffic**
   - **Request Count**
   - **Response Time**

### Set Up Alerts (Recommended)

1. Go to **Settings** → **Notifications**
2. Add your email
3. Configure alerts for:
   - Deployment failures
   - Service crashes
   - High resource usage

---

## Railway CLI Commands

```bash
# Login
railway login

# Link to project
railway link

# Deploy
railway up

# View logs
railway logs

# Open in browser
railway open

# SSH into container (if needed)
railway shell

# Run command in container
railway run npm run migrate

# List environment variables
railway variables

# Add environment variable
railway variables set KEY=value

# Check status
railway status
```

---

## Upgrading from Hobby Plan

### When to Upgrade

Upgrade to **Pro Plan ($20/month)** when:
- ⚠️ Exceeding 512MB RAM consistently
- ⚠️ Need more than 1 service
- ⚠️ Need priority support
- ⚠️ Need advanced metrics

### Pro Plan Benefits

```
RAM:        Up to 32GB
vCPU:       Up to 32 cores
Storage:    100GB
Bandwidth:  Unlimited
Services:   Unlimited
Priority:   Support included
```

---

## Cost Breakdown

### Hobby Plan - $5/month

```
Base:       $5/month flat rate
Overage:    None (no usage charges)
Total:      $5/month guaranteed
```

### Usage Included

```
✅ 512MB RAM
✅ 1GB disk
✅ 100GB bandwidth
✅ Unlimited deploys
✅ Unlimited users
✅ Always on (no sleep)
```

---

## Troubleshooting

### Issue: Build Failing

**Solution:**
```bash
# Check build logs in Railway dashboard
# Common fixes:

# 1. Missing dependencies
npm install --save missing-package

# 2. TypeScript errors
npm run build  # Fix locally first

# 3. Prisma not generating
# Add to build command:
npm install && npx prisma generate && npm run build
```

### Issue: Migration Failing

**Solution:**
```bash
# Check DATABASE_URL is correct
# Verify Neon Postgres connection string

# Run migrations manually:
railway run npx prisma migrate deploy
```

### Issue: Service Crashing

**Solution:**
1. Check logs: `railway logs`
2. Common causes:
   - Missing environment variables
   - Database connection issues
   - Port binding errors (use `process.env.PORT`)

### Issue: High Memory Usage

**Solution:**
```typescript
// Add memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory:', Math.round(usage.heapUsed / 1024 / 1024), 'MB');
  
  // Force garbage collection if available
  if (global.gc && usage.heapUsed > 400 * 1024 * 1024) {
    global.gc();
  }
}, 60000);
```

### Issue: Slow Response Times

**Solution:**
1. Add database connection pooling
2. Enable caching (Redis)
3. Optimize database queries
4. Add indexes to frequently queried fields

---

## Security Best Practices

### 1. Secure Environment Variables

```bash
# Generate secure API key
openssl rand -hex 32

# Store in Railway (never in code)
railway variables set API_KEY=generated_key_here
```

### 2. Enable CORS

```typescript
// src/index.ts
import cors from 'cors';

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

### 3. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 4. Helmet for Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: false, // Configure as needed
  crossOriginEmbedderPolicy: false
}));
```

---

## Backup Strategy

### Automatic Backups (Railway)

Railway doesn't provide automatic backups, use:

### Option 1: Neon Automatic Backups

Neon provides:
- Point-in-time recovery (7 days free tier)
- Daily backups (configurable)

### Option 2: Manual Backup Script

```bash
# Create backup script
#!/bin/bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Upload to Backblaze
b2 upload-file screndly-backups backup-$(date +%Y%m%d).sql
```

Schedule with cron:
```typescript
// In your backend
cron.schedule('0 2 * * *', async () => {
  // Run backup script or use pg_dump programmatically
  console.log('Running database backup...');
});
```

---

## Performance Optimization

### 1. Database Connection Pooling

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
  
  // Connection pooling
  pool_size = 10
  connection_limit = 10
}
```

### 2. Caching with Redis

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN
});

// Cache API responses
async function getCachedData(key: string, fetchFn: () => Promise<any>) {
  const cached = await redis.get(key);
  if (cached) return cached;
  
  const data = await fetchFn();
  await redis.setex(key, 300, data); // 5 min cache
  return data;
}
```

### 3. Optimize Logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Use logger instead of console.log
logger.info('Server started');
logger.error('Error occurred', { error });
```

---

## Next Steps

1. ✅ Railway backend is running
2. **[Setup Neon Database](./NEON_SETUP.md)** - Configure PostgreSQL
3. **[Setup Upstash Redis](./UPSTASH_SETUP.md)** - Optional caching layer
4. **[API Implementation](./API_IMPLEMENTATION.md)** - Build REST API
5. **[Frontend Migration](./FRONTEND_MIGRATION.md)** - Connect frontend to backend

---

**Your Railway backend is now live and running 24/7!** 🚂