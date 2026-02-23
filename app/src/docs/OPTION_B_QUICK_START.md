# Option B: Quick Start Guide

**Always-On Backend Architecture ($5.40/month)**

This guide gets you from zero to production in ~30 minutes.

---

## 📋 Checklist

- [ ] Railway account created
- [ ] Neon Postgres database created
- [ ] Backend repository set up
- [ ] Environment variables configured
- [ ] Frontend updated with API URLs
- [ ] First deployment successful

---

## 🚀 Step-by-Step Setup (30 minutes)

### **Step 1: Create Accounts** (5 minutes)

1. **Railway**: [railway.app](https://railway.app)
   - Sign in with GitHub
   - No credit card required for first project

2. **Neon**: [neon.tech](https://neon.tech)
   - Sign in with GitHub
   - 100% free tier (no card needed)

3. **Upstash** (Optional): [upstash.com](https://upstash.com)
   - Sign in with GitHub
   - Free tier for Redis

---

### **Step 2: Set Up Neon Database** (5 minutes)

1. Create project in Neon dashboard:
   ```
   Name:     Screndly Production
   Region:   US East (closest to Railway)
   ```

2. Copy connection strings:
   ```env
   # Pooled (for app)
   postgresql://user:pass@ep-xyz-pooler.neon.tech/screndly?sslmode=require
   
   # Direct (for migrations)
   postgresql://user:pass@ep-xyz.neon.tech/screndly?sslmode=require
   ```

3. **Save these** - you'll need them for Railway

**✅ Database ready!**

---

### **Step 3: Create Backend Repository** (10 minutes)

#### Option A: Use Starter Template (Recommended)

```bash
# Clone starter template (if available)
git clone https://github.com/your-org/screndly-backend-template
cd screndly-backend-template

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Neon connection string
```

#### Option B: Create from Scratch

```bash
# Create new project
mkdir screndly-backend
cd screndly-backend
npm init -y

# Install dependencies
npm install express cors helmet dotenv prisma @prisma/client
npm install -D typescript @types/node @types/express tsx

# Initialize TypeScript
npx tsc --init

# Initialize Prisma
npx prisma init
```

**Minimal Backend Structure:**

```
screndly-backend/
├── src/
│   ├── index.ts          # Main server file
│   ├── routes/           # API routes
│   │   ├── health.ts
│   │   └── api.ts
│   └── lib/
│       └── prisma.ts     # Prisma client
├── prisma/
│   └── schema.prisma     # Database schema
├── package.json
├── tsconfig.json
└── .env
```

**src/index.ts** (minimal):

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

**package.json** scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "migrate": "npx prisma migrate deploy"
  }
}
```

Push to GitHub:

```bash
git init
git add .
git commit -m "Initial backend setup"
git branch -M main
git remote add origin https://github.com/your-username/screndly-backend
git push -u origin main
```

**✅ Backend repository ready!**

---

### **Step 4: Deploy to Railway** (5 minutes)

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose `screndly-backend` repository
5. Railway auto-detects Node.js and configures build

**Configure Build Settings** (if needed):

```
Build Command:   npm install && npx prisma generate && npm run build
Start Command:   npm start
```

**✅ Backend deploying!**

---

### **Step 5: Add Environment Variables to Railway** (5 minutes)

In Railway dashboard → Variables tab:

```env
# Node
NODE_ENV=production

# Database (Neon - use POOLED connection)
DATABASE_URL=postgresql://user:pass@ep-xyz-pooler.neon.tech/screndly?sslmode=require

# CORS
FRONTEND_URL=https://screndly.vercel.app

# API Security (generate random string)
API_KEY=your_secure_random_string_here

# Backblaze B2
B2_KEY_ID=your_b2_key_id
B2_APPLICATION_KEY=your_b2_app_key
B2_BUCKET_NAME=screndly-trailers
B2_VIDEOS_BUCKET_NAME=screndly-videos

# External APIs (add as needed)
TMDB_API_KEY=your_tmdb_key
OPENAI_API_KEY=your_openai_key
```

**Generate secure API key:**

```bash
openssl rand -hex 32
```

**✅ Variables configured!**

---

### **Step 6: Verify Deployment** (2 minutes)

1. Wait for Railway deployment to finish (~1-2 min)
2. Get your backend URL:
   ```
   https://screndly-production.up.railway.app
   ```

3. Test health endpoint:
   ```bash
   curl https://screndly-production.up.railway.app/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "timestamp": "2024-12-14T12:00:00.000Z"
   }
   ```

**✅ Backend live!**

---

### **Step 7: Update Frontend** (3 minutes)

Update frontend environment variables:

```env
# .env.production (in frontend repo)
VITE_API_URL=https://screndly-production.up.railway.app
VITE_WS_URL=wss://screndly-production.up.railway.app
```

Update API client:

```typescript
// frontend/src/lib/api/client.ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function apiRequest(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  
  return response.json();
}
```

Deploy frontend:

```bash
git add .
git commit -m "Update API URLs"
git push origin main
# Vercel auto-deploys
```

**✅ Frontend connected!**

---

## 🎉 You're Done!

Your production architecture is now live:

```
Frontend (Vercel)    → https://screndly.vercel.app
Backend (Railway)    → https://screndly-production.up.railway.app
Database (Neon)      → Connected and ready
```

---

## 💰 Cost Breakdown

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Vercel (Frontend) | Free | $0 |
| Railway (Backend) | Hobby | $5 |
| Neon (Database) | Free | $0 |
| Backblaze B2 | Pay-as-you-go | ~$0.40 |
| **TOTAL** | | **$5.40** |

---

## 📊 What You Get

✅ **Always-on backend** (no sleep, no cold starts)  
✅ **Reliable automation** (RSS feeds, TMDb, comments run 24/7)  
✅ **Fast API responses** (<100ms)  
✅ **WebSocket support** (real-time updates)  
✅ **Automatic deployments** (push to deploy)  
✅ **Built-in monitoring** (Railway logs + metrics)  
✅ **Scalable** (upgrade when you need more resources)  

---

## 🔧 Next Steps

### Immediate

1. **Add Prisma schema** - Define your database models
2. **Create migrations** - Set up database tables
3. **Implement API routes** - Build REST endpoints
4. **Add cron jobs** - Schedule automation tasks
5. **Test thoroughly** - Verify all features work

### Soon

1. **Set up monitoring** - Add error tracking (Sentry)
2. **Configure alerts** - Email notifications for failures
3. **Add backups** - Automated database backups
4. **Performance tuning** - Optimize queries and caching

---

## 📚 Detailed Guides

- **[Production Architecture](./PRODUCTION_ARCHITECTURE.md)** - Full architecture overview
- **[Railway Setup](./RAILWAY_SETUP.md)** - Detailed Railway configuration
- **[Neon Setup](./NEON_SETUP.md)** - Comprehensive database guide
- **[API Implementation](./API_IMPLEMENTATION.md)** - Build your REST API (coming soon)

---

## 🆘 Troubleshooting

### Backend not deploying?

1. Check Railway logs: Dashboard → Deployments → View Logs
2. Verify `package.json` has correct scripts
3. Ensure environment variables are set

### Database connection error?

1. Verify `DATABASE_URL` in Railway variables
2. Use **pooled** connection string (ends with `-pooler`)
3. Check Neon dashboard for connection status

### Frontend can't reach backend?

1. Verify `VITE_API_URL` matches Railway URL
2. Check CORS settings in backend
3. Test API health endpoint directly

### Still stuck?

Check the detailed guides linked above or Railway's excellent documentation.

---

**Welcome to production with Option B!** 🚀

Your Screndly backend is now running 24/7, ready to automate all your trailer management needs.
