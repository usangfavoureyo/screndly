# Backend Setup Checklist - Screndly Option B

**Goal**: Deploy backend in ~30 minutes and connect to frontend

---

## ✅ Step 1: Create Accounts (5 min)

- [ ] Sign up for [Railway](https://railway.app) with GitHub
- [ ] Sign up for [Neon](https://neon.tech) with GitHub
- [ ] *(Optional)* Sign up for [Upstash](https://upstash.com) with GitHub

---

## ✅ Step 2: Set Up Neon Database (5 min)

- [ ] Create new project: "Screndly Production"
- [ ] Select region: US East (closest to Railway)
- [ ] Copy **Pooled Connection String**:
  ```
  postgresql://user:pass@ep-xyz-pooler.neon.tech/screndly?sslmode=require
  ```
- [ ] Save it somewhere safe

---

## ✅ Step 3: Create Backend Repository (10 min)

### Option A: Minimal Express Backend

```bash
# Create project
mkdir screndly-backend && cd screndly-backend
npm init -y

# Install dependencies
npm install express cors helmet dotenv prisma @prisma/client
npm install -D typescript @types/node @types/express tsx

# Initialize TypeScript
npx tsc --init

# Initialize Prisma
npx prisma init
```

### Create Files

**`src/index.ts`**:
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import settingsRouter from './routes/settings';

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
app.use('/api', settingsRouter);

app.listen(PORT, () => {
  console.log(`🚀 Screndly backend running on port ${PORT}`);
});
```

**`src/routes/settings.ts`** - Copy from `/docs/BACKEND_INTEGRATION_COMPLETE.md`

**`prisma/schema.prisma`** - Copy from `/docs/BACKEND_INTEGRATION_COMPLETE.md`

**`package.json`** - Add scripts:
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

- [ ] Push to GitHub

---

## ✅ Step 4: Deploy to Railway (5 min)

- [ ] Go to [Railway Dashboard](https://railway.app/dashboard)
- [ ] Click "New Project" → "Deploy from GitHub repo"
- [ ] Select `screndly-backend` repository
- [ ] Railway auto-detects Node.js

---

## ✅ Step 5: Add Environment Variables (5 min)

In Railway dashboard → Variables tab:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@ep-xyz-pooler.neon.tech/screndly?sslmode=require
FRONTEND_URL=https://screndly.vercel.app
ENCRYPTION_KEY=<run: openssl rand -hex 32>
JWT_SECRET=<run: openssl rand -hex 32>
```

**Generate keys**:
```bash
openssl rand -hex 32  # For ENCRYPTION_KEY
openssl rand -hex 32  # For JWT_SECRET
```

- [ ] Variables added
- [ ] Deployment triggered automatically

---

## ✅ Step 6: Run Database Migration (3 min)

In Railway dashboard → Settings → Deploy:

**Build Command**:
```
npm install && npx prisma generate && npm run build
```

**Start Command**:
```
npm start
```

- [ ] Save settings
- [ ] Wait for deployment (~2 min)

---

## ✅ Step 7: Test Backend (2 min)

**Get your Railway URL**:
```
https://screndly-production.up.railway.app
```

**Test health endpoint**:
```bash
curl https://screndly-production.up.railway.app/health
```

**Expected response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-29T12:00:00.000Z"
}
```

- [ ] Health check works ✅

---

## ✅ Step 8: Update Frontend (3 min)

Create `.env` in frontend:

```env
VITE_API_URL=https://screndly-production.up.railway.app
VITE_WS_URL=wss://screndly-production.up.railway.app
VITE_ENABLE_BACKEND=true
```

- [ ] `.env` created
- [ ] Push to Git
- [ ] Vercel auto-deploys

---

## ✅ Step 9: Verify Integration (5 min)

1. **Open Screndly app**: https://screndly.vercel.app
2. **Go to Settings → API Keys**
3. **Enter a test API key** (e.g., TMDb key)
4. **Check browser console**: Should see `[Settings] Saved to backend successfully`
5. **Check Railway logs**: Should see `POST /api/settings 200`
6. **Refresh page**: API key should reload from backend
7. **Open DevTools → LocalStorage**: Should NOT see API keys

- [ ] Settings save to backend ✅
- [ ] Settings load from backend ✅
- [ ] LocalStorage does NOT contain API keys ✅
- [ ] Toast shows "API key saved securely" ✅

---

## 🎉 Done!

Your production architecture is now live:

```
✅ Frontend (Vercel)  → https://screndly.vercel.app
✅ Backend (Railway)  → https://screndly-production.up.railway.app
✅ Database (Neon)    → Connected and encrypted
```

**Monthly Cost**: $5.40  
**Deployment Time**: ~30 minutes  

---

## 📊 What You Get

✅ **Secure API key storage** (encrypted in database)  
✅ **No API keys in browser** (DevTools shows nothing)  
✅ **Always-on backend** (no cold starts)  
✅ **Real-time updates** (WebSocket ready)  
✅ **Automatic deployments** (push to deploy)  
✅ **Built-in monitoring** (Railway logs)  

---

## 🆘 Troubleshooting

### Backend won't deploy?
- Check Railway logs: Dashboard → Deployments → View Logs
- Verify `package.json` has correct scripts
- Ensure environment variables are set

### Settings not saving?
- Test backend: `curl https://your-backend.railway.app/health`
- Check CORS settings: `FRONTEND_URL` must match Vercel URL
- Verify `.env` in frontend has correct `VITE_API_URL`

### Still stuck?
- Check `/docs/BACKEND_INTEGRATION_COMPLETE.md` for detailed guide
- Check `/docs/OPTION_B_QUICK_START.md` for full architecture
- Check Railway documentation

---

**Next**: Add authentication, monitoring, and automation features!
