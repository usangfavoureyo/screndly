# Neon Postgres Setup Guide for Screndly

**Platform**: Neon Serverless Postgres  
**Plan**: Free Tier (0.5GB storage, 191.9 hours compute/month)  
**Purpose**: Primary database for Screndly  
**Last Updated**: December 14, 2024

---

## Why Neon?

- ✅ **Serverless Postgres** - auto-scaling, pay per use
- ✅ **Generous free tier** - 0.5GB storage (plenty for single user)
- ✅ **Branching** - dev/staging/prod database branches
- ✅ **Connection pooling** - built-in, no extra configuration
- ✅ **Point-in-time recovery** - 7 days backup retention
- ✅ **PostgreSQL 15+** - latest features
- ✅ **Auto-suspend** - saves compute when inactive
- ✅ **Fast cold starts** - ~1 second to wake up

---

## Step 1: Create Neon Account

1. Go to [neon.tech](https://neon.tech)
2. Click **"Sign Up"**
3. Sign in with **GitHub** (recommended)
4. Authorize Neon to access your account

---

## Step 2: Create Your First Project

1. Click **"Create Project"**
2. Configure project:

```
Project Name:    Screndly Production
Database Name:   screndly
Region:         US East (Ohio) - us-east-2
                (or closest to your Railway backend)
Postgres Ver:   15 (latest)
```

3. Click **"Create Project"**

### You'll Get:

```
✅ Project ID:          ep-xyz123...
✅ Database Name:       screndly
✅ Connection String:   postgresql://user:pass@ep-xyz.aws.neon.tech/screndly
✅ Pooled Connection:   postgresql://user:pass@ep-xyz-pooler.aws.neon.tech/screndly
```

---

## Step 3: Get Connection String

### Connection String Format

Neon provides **two** connection strings:

#### 1. Direct Connection (Low-level access)

```
postgresql://alex:AbC123...@ep-cool-darkness-123456.us-east-2.aws.neon.tech/screndly?sslmode=require
```

**Use for:**
- Database migrations
- Admin tasks
- pg_dump backups

#### 2. Pooled Connection (Recommended for Apps) ⭐

```
postgresql://alex:AbC123...@ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech/screndly?sslmode=require
```

**Use for:**
- Application connections
- Prisma
- Production workloads

**Why pooled?**
- Handles connection limits automatically
- Better performance under load
- No "too many connections" errors

---

## Step 4: Configure Connection Pooling

Neon provides **PgBouncer** pooling by default:

### Pooling Mode: Transaction

```
Max Connections:  100 (per database)
Pooling Mode:    Transaction pooling
Auto-suspend:    5 minutes of inactivity
```

### For Prisma

Use the **pooled connection string**:

```env
# .env
DATABASE_URL="postgresql://user:pass@ep-xyz-pooler.aws.neon.tech/screndly?sslmode=require&pgbouncer=true"
```

Add to `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // For connection pooling compatibility
  relationMode = "prisma"
}
```

---

## Step 5: Create Database Schema with Prisma

### Initialize Prisma

```bash
cd backend
npm install prisma @prisma/client
npx prisma init
```

### Configure Prisma Schema

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ========================================
// CORE MODELS
// ========================================

model Video {
  id              String   @id @default(cuid())
  title           String
  description     String?
  thumbnailUrl    String?
  videoUrl        String
  platform        String   // youtube, tiktok, x, instagram, facebook
  platformId      String?  @unique
  status          String   @default("pending") // pending, processing, uploaded, failed
  duration        Int?     // in seconds
  aspectRatio     String?  // 16:9, 9:16, 1:1
  fileSize        Int?     // in bytes
  metadata        Json?    // Platform-specific metadata
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  publishedAt     DateTime?
  
  @@index([platform])
  @@index([status])
  @@index([createdAt])
  @@index([publishedAt])
}

// ========================================
// RSS FEEDS
// ========================================

model RSSFeed {
  id              String   @id @default(cuid())
  name            String
  url             String   @unique
  enabled         Boolean  @default(true)
  lastFetchedAt   DateTime?
  lastError       String?
  fetchInterval   Int      @default(30) // minutes
  autoPost        Boolean  @default(false)
  platforms       String[] // Platforms to post to
  metadata        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  posts           RSSPost[]
  
  @@index([enabled])
  @@index([lastFetchedAt])
}

model RSSPost {
  id              String   @id @default(cuid())
  feedId          String
  title           String
  content         String?  @db.Text
  link            String   @unique
  imageUrl        String?
  publishedAt     DateTime
  processed       Boolean  @default(false)
  posted          Boolean  @default(false)
  postedAt        DateTime?
  errorMessage    String?
  metadata        Json?
  createdAt       DateTime @default(now())
  
  feed            RSSFeed  @relation(fields: [feedId], references: [id], onDelete: Cascade)
  
  @@index([feedId])
  @@index([processed])
  @@index([posted])
  @@index([publishedAt])
}

// ========================================
// TMDB INTEGRATION
// ========================================

model TMDbPost {
  id              String   @id @default(cuid())
  tmdbId          Int      @unique
  title           String
  originalTitle   String?
  type            String   // movie, tv
  releaseDate     DateTime
  anniversary     Int?     // 10, 15, 20, 25, etc.
  overview        String?  @db.Text
  posterPath      String?
  backdropPath    String?
  popularity      Float?
  voteAverage     Float?
  voteCount       Int?
  genres          String[] // Array of genre names
  status          String   @default("pending") // pending, scheduled, posted, skipped
  scheduledAt     DateTime?
  postedAt        DateTime?
  platforms       String[] // Platforms to post to
  errorMessage    String?
  metadata        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([tmdbId])
  @@index([type])
  @@index([status])
  @@index([scheduledAt])
  @@index([releaseDate])
}

// ========================================
// VIDEO STUDIO
// ========================================

model VideoStudioTemplate {
  id              String   @id @default(cuid())
  name            String
  description     String?
  captionStyle    Json     // Caption styling configuration
  sceneConfig     Json     // Scene configuration
  audioConfig     Json?    // Audio configuration
  isDefault       Boolean  @default(false)
  metadata        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  jobs            VideoStudioJob[]
  
  @@index([isDefault])
}

model VideoStudioJob {
  id              String   @id @default(cuid())
  templateId      String?
  title           String
  status          String   @default("queued") // queued, processing, rendering, completed, failed
  progress        Int      @default(0) // 0-100
  outputUrl       String?
  errorMessage    String?
  renderConfig    Json     // Complete render configuration
  metadata        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  completedAt     DateTime?
  
  template        VideoStudioTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)
  
  @@index([status])
  @@index([createdAt])
}

// ========================================
// UPLOAD MANAGER
// ========================================

model UploadJob {
  id              String   @id @default(cuid())
  fileName        String
  fileSize        Int      // bytes
  fileUrl         String?  // Backblaze URL after upload
  stage           String   @default("queued") // queued, processing, metadata, encoding, waiting, uploading, published
  progress        Int      @default(0) // 0-100
  platform        String   // youtube, tiktok, x, instagram, facebook
  platformId      String?  // ID from platform after upload
  metadata        Json?    // Platform-specific metadata
  errorMessage    String?
  retryCount      Int      @default(0)
  maxRetries      Int      @default(3)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  startedAt       DateTime?
  completedAt     DateTime?
  
  events          UploadEvent[]
  
  @@index([stage])
  @@index([platform])
  @@index([createdAt])
}

model UploadEvent {
  id              String   @id @default(cuid())
  jobId           String
  stage           String
  severity        String   // info, warning, error, success
  message         String   @db.Text
  metadata        Json?
  timestamp       DateTime @default(now())
  
  job             UploadJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  
  @@index([jobId])
  @@index([timestamp])
}

// ========================================
// ACTIVITY LOGS
// ========================================

model ActivityLog {
  id              String   @id @default(cuid())
  type            String   // upload, rss, tmdb, videostudio, system
  action          String   // created, updated, deleted, posted, failed
  status          String   // success, error, pending, info
  title           String
  message         String?  @db.Text
  userId          String?  // For multi-user support (future)
  metadata        Json?
  createdAt       DateTime @default(now())
  
  @@index([type])
  @@index([status])
  @@index([createdAt])
  @@index([userId])
}

// ========================================
// SETTINGS & CONFIGURATION
// ========================================

model Settings {
  id              String   @id @default(cuid())
  key             String   @unique
  value           Json
  description     String?
  category        String?  // general, api, automation, notifications
  updatedAt       DateTime @updatedAt
  
  @@index([category])
}

// ========================================
// PLATFORM CONNECTIONS
// ========================================

model PlatformConnection {
  id              String   @id @default(cuid())
  platform        String   @unique // youtube, tiktok, x, instagram, facebook
  connected       Boolean  @default(false)
  accessToken     String?  @db.Text
  refreshToken    String?  @db.Text
  expiresAt       DateTime?
  accountId       String?
  accountName     String?
  accountAvatar   String?
  scopes          String[] // OAuth scopes
  metadata        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  lastUsedAt      DateTime?
  
  @@index([platform])
  @@index([connected])
}

// ========================================
// COMMENT AUTOMATION
// ========================================

model CommentJob {
  id              String   @id @default(cuid())
  platform        String   // youtube, tiktok, x, instagram, facebook
  platformPostId  String
  commentId       String?  @unique
  commentText     String   @db.Text
  authorName      String
  authorId        String
  replied         Boolean  @default(false)
  replyText       String?  @db.Text
  blacklisted     Boolean  @default(false)
  processedAt     DateTime?
  repliedAt       DateTime?
  metadata        Json?
  createdAt       DateTime @default(now())
  
  @@index([platform])
  @@index([replied])
  @@index([processedAt])
}

// ========================================
// NOTIFICATION SYSTEM
// ========================================

model Notification {
  id              String   @id @default(cuid())
  type            String   // success, error, info, warning
  source          String   // upload, rss, tmdb, videostudio, system
  title           String
  message         String   @db.Text
  actionUrl       String?
  read            Boolean  @default(false)
  metadata        Json?
  createdAt       DateTime @default(now())
  readAt          DateTime?
  
  @@index([read])
  @@index([source])
  @@index([createdAt])
}
```

### Create Initial Migration

```bash
# Create migration
npx prisma migrate dev --name init

# This will:
# 1. Create migration files in prisma/migrations/
# 2. Apply migration to your Neon database
# 3. Generate Prisma Client
```

---

## Step 6: Seed Initial Data (Optional)

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Default settings
  await prisma.settings.createMany({
    data: [
      {
        key: 'theme',
        value: { mode: 'dark' },
        category: 'general',
        description: 'UI theme preference'
      },
      {
        key: 'notifications',
        value: { enabled: true, sound: true },
        category: 'general',
        description: 'Notification preferences'
      },
      {
        key: 'rss_fetch_interval',
        value: { minutes: 30 },
        category: 'automation',
        description: 'RSS feed fetch interval'
      },
      {
        key: 'tmdb_check_interval',
        value: { minutes: 60 },
        category: 'automation',
        description: 'TMDb check interval'
      }
    ]
  });

  console.log('✅ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Run seed:

```bash
npx prisma db seed
```

---

## Step 7: Configure Database Branching

Neon allows you to create **database branches** (like Git branches):

### Create Development Branch

1. Go to Neon dashboard
2. Click your project
3. Click **"Branches"** tab
4. Click **"Create Branch"**

```
Branch Name:    development
Parent Branch:  main
Description:    Development database
```

### Use in Development

```env
# .env.development
DATABASE_URL="postgresql://user:pass@ep-dev-xyz-pooler.neon.tech/screndly?sslmode=require"
```

### Workflow

```
main branch       → Production database
development       → Development/testing
feature-xxx       → Feature-specific testing
```

---

## Step 8: Configure Backups

### Neon Automatic Backups (Free Tier)

- **Point-in-time recovery**: 7 days retention
- **Automatic daily backups**: Enabled by default
- **Recovery**: Restore to any point in the last 7 days

### Manual Backup

```bash
# Using pg_dump (requires PostgreSQL client)
pg_dump "postgresql://user:pass@ep-xyz.neon.tech/screndly?sslmode=require" > backup.sql

# Restore
psql "postgresql://user:pass@ep-xyz.neon.tech/screndly?sslmode=require" < backup.sql
```

### Automated Backup Script

```typescript
// scripts/backup-database.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function backupDatabase() {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `backup-${timestamp}.sql`;
  
  try {
    await execAsync(`pg_dump "${process.env.DATABASE_URL}" > ${filename}`);
    console.log(`✅ Backup created: ${filename}`);
    
    // Upload to Backblaze
    await execAsync(`b2 upload-file screndly-backups ${filename} ${filename}`);
    console.log(`✅ Backup uploaded to Backblaze`);
  } catch (error) {
    console.error('❌ Backup failed:', error);
  }
}

backupDatabase();
```

Schedule with cron in your backend:

```typescript
import cron from 'node-cron';

// Daily backup at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('[CRON] Running database backup...');
  await backupDatabase();
});
```

---

## Step 9: Monitor Database Usage

### Neon Dashboard Metrics

View in Neon dashboard → **Monitoring**:

- **Storage Usage**: 0.5GB limit on free tier
- **Compute Usage**: 191.9 hours/month limit
- **Active Time**: Database active hours
- **Connections**: Active connection count

### Estimated Usage (Screndly Single User)

```
Storage:
- Videos metadata:     ~10KB × 1,000 = 10MB
- Activity logs:       ~5KB × 5,000 = 25MB
- RSS posts:          ~10KB × 1,000 = 10MB
- TMDb posts:         ~20KB × 500 = 10MB
- Upload jobs:        ~15KB × 500 = 7.5MB
- Other tables:       ~5MB
Total:                ~70MB (14% of 0.5GB limit)

Compute:
- Auto-suspend after 5 min inactivity
- ~2-3 hours active per day = 60-90 hours/month
- Well within 191.9 hours limit
```

### Set Up Alerts

1. Go to **Settings** → **Usage Limits**
2. Enable email alerts:
   - Storage: Alert at 80% (400MB)
   - Compute: Alert at 80% (153 hours)

---

## Step 10: Optimize Performance

### 1. Add Indexes

Already included in schema, but verify:

```sql
-- Check existing indexes
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public';
```

### 2. Connection Pooling in Prisma

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 3. Query Optimization

```typescript
// ✅ Good - select only needed fields
const videos = await prisma.video.findMany({
  select: {
    id: true,
    title: true,
    thumbnailUrl: true,
    createdAt: true
  },
  orderBy: { createdAt: 'desc' },
  take: 20
});

// ❌ Bad - fetches all fields
const videos = await prisma.video.findMany();
```

### 4. Pagination

```typescript
// Cursor-based pagination (efficient)
async function getVideos(cursor?: string, limit = 20) {
  return await prisma.video.findMany({
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' }
  });
}
```

---

## Environment Variables

Add to Railway (or your backend):

```env
# Neon Postgres (Pooled Connection - Recommended)
DATABASE_URL="postgresql://user:password@ep-xyz-pooler.us-east-2.aws.neon.tech/screndly?sslmode=require&pgbouncer=true"

# Direct Connection (for migrations only)
DIRECT_DATABASE_URL="postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/screndly?sslmode=require"

# Shadow Database (for Prisma migrations in development)
SHADOW_DATABASE_URL="postgresql://user:password@ep-dev-xyz.us-east-2.aws.neon.tech/screndly_shadow?sslmode=require"
```

---

## Troubleshooting

### Issue: Too Many Connections

**Solution**: Use pooled connection string (ends with `-pooler`)

```env
DATABASE_URL="postgresql://...@ep-xyz-pooler.neon.tech/screndly"
```

### Issue: Slow Queries

**Solution**: Add missing indexes

```typescript
// Check slow queries
await prisma.$queryRaw`
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
`;
```

### Issue: Connection Timeout

**Solution**: Increase timeout in Prisma

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  pool_timeout = 10
  connect_timeout = 10
}
```

### Issue: Migration Failed

**Solution**: Use direct connection for migrations

```bash
DATABASE_URL="postgresql://...@ep-xyz.neon.tech/screndly" \
  npx prisma migrate deploy
```

---

## Prisma Studio (Database GUI)

View and edit data visually:

```bash
# Start Prisma Studio
npx prisma studio

# Opens at http://localhost:5555
```

Features:
- Browse all tables
- Edit records
- Run queries
- Export data

---

## Cost Management

### Free Tier Limits

```
Storage:           0.5GB
Compute:          191.9 hours/month (always free)
Projects:         1
Branches:         10
```

### Upgrade to Pro ($19/month)

When you need:
- More than 0.5GB storage (up to 3GB on Pro)
- More compute hours
- More projects
- Priority support

---

## Security Best Practices

### 1. Use SSL Mode

Always include `sslmode=require`:

```
postgresql://...?sslmode=require
```

### 2. Rotate Passwords

1. Go to Neon dashboard
2. Click **Settings** → **Reset Password**
3. Update Railway environment variables

### 3. Restrict IP Access (Optional)

Neon Free doesn't support IP allowlisting, but Pro does.

### 4. Use Environment Variables

Never hardcode credentials:

```typescript
// ❌ Bad
const url = "postgresql://user:pass@...";

// ✅ Good
const url = process.env.DATABASE_URL;
```

---

## Next Steps

1. ✅ Neon database is set up
2. ✅ Prisma schema created
3. ✅ Migrations applied
4. **[API Implementation](./API_IMPLEMENTATION.md)** - Build REST API using Prisma
5. **[Setup Upstash Redis](./UPSTASH_SETUP.md)** - Optional caching layer

---

**Your Neon Postgres database is ready for production!** 🐘
