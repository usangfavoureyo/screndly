# Environment Variables Setup Guide

Complete environment variable configuration for Screndly frontend and backend.

---

## 🎨 Frontend Environment Variables (Vercel)

Add these to your Vercel project settings:

```env
# Backend API URL (Railway)
VITE_API_URL=https://screndly-production.up.railway.app

# Optional: WebSocket URL (if using real-time features)
VITE_WS_URL=wss://screndly-production.up.railway.app
```

**How to add:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `VITE_API_URL` with your Railway backend URL
3. Redeploy your app

---

## 🚂 Backend Environment Variables (Railway)

Add these to your Railway service:

### **Required Variables**

```env
# Node Environment
NODE_ENV=production

# Server Port (Railway provides this automatically)
PORT=${{ PORT }}

# Database (Neon Postgres - use POOLED connection string)
DATABASE_URL=postgresql://user:password@ep-xxx-pooler.neon.tech/screndly?sslmode=require

# Encryption Key (for encrypting API keys in database)
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=<your_64_character_hex_string_here>

# CORS Configuration
FRONTEND_URL=https://screndly.vercel.app
```

### **Optional Variables**

```env
# Upstash Redis (optional caching layer)
REDIS_URL=https://your-redis.upstash.io
REDIS_TOKEN=your_upstash_token

# Cron Job Intervals (optional)
RSS_FETCH_INTERVAL=5
TMDB_CHECK_INTERVAL=60
COMMENT_CHECK_INTERVAL=10
```

---

## 🔐 Generate Encryption Key

The encryption key is used to encrypt API keys in the database.

**Generate a secure 32-byte (64-character) hex string:**

```bash
# On Mac/Linux
openssl rand -hex 32

# Output example:
# a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Copy the output and set as `ENCRYPTION_KEY` in Railway.**

---

## 📊 Complete Railway Environment Variables Example

```env
# ============================================================================
# REQUIRED - RAILWAY
# ============================================================================

NODE_ENV=production
PORT=${{ PORT }}

# ============================================================================
# REQUIRED - DATABASE (NEON POSTGRES)
# ============================================================================

DATABASE_URL=postgresql://neondb_owner:AbCdEf123456@ep-cool-star-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require

# ============================================================================
# REQUIRED - ENCRYPTION
# ============================================================================

ENCRYPTION_KEY=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# ============================================================================
# REQUIRED - CORS
# ============================================================================

FRONTEND_URL=https://screndly.vercel.app

# ============================================================================
# OPTIONAL - REDIS CACHING
# ============================================================================

REDIS_URL=https://able-crab-12345.upstash.io
REDIS_TOKEN=AbCdEf123456==

# ============================================================================
# OPTIONAL - CRON INTERVALS
# ============================================================================

RSS_FETCH_INTERVAL=5
TMDB_CHECK_INTERVAL=60
COMMENT_CHECK_INTERVAL=10
```

---

## 🎯 Where to Add Railway Environment Variables

### **Method 1: Railway Dashboard (Recommended)**

1. Go to [railway.app](https://railway.app)
2. Select your project
3. Click on your service
4. Go to **"Variables"** tab
5. Click **"New Variable"**
6. Add each variable one by one
7. Railway will automatically redeploy

### **Method 2: Railway CLI**

```bash
# Login to Railway
railway login

# Link to your project
railway link

# Add variables
railway variables set NODE_ENV=production
railway variables set DATABASE_URL="postgresql://..."
railway variables set ENCRYPTION_KEY="a1b2c3d4..."
railway variables set FRONTEND_URL="https://screndly.vercel.app"
```

---

## 🗄️ Neon Postgres Connection Strings

When you create a Neon database, you get two connection strings:

### **1. Pooled Connection (Use this for Railway)**
```
postgresql://user:pass@ep-xxx-pooler.neon.tech/screndly?sslmode=require
```
- ✅ **Use for production** (Railway)
- ✅ Better for serverless/high-traffic
- ✅ Handles connection pooling automatically

### **2. Direct Connection (Use for migrations)**
```
postgresql://user:pass@ep-xxx.neon.tech/screndly?sslmode=require
```
- ✅ **Use for database migrations** (Prisma)
- ✅ Use for one-time admin tasks

**How to find:**
1. Go to [neon.tech](https://neon.tech)
2. Select your project
3. Go to **"Connection Details"**
4. Copy the **Pooled connection string**

---

## ✅ Verification Checklist

### **Frontend (Vercel)**
- [ ] `VITE_API_URL` is set to your Railway backend URL
- [ ] Vercel app redeployed after adding variable
- [ ] Can access `/health` endpoint: `https://screndly.vercel.app` → calls → `https://your-railway-app.up.railway.app/health`

### **Backend (Railway)**
- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` is set (Neon **pooled** connection string)
- [ ] `ENCRYPTION_KEY` is set (64-character hex string)
- [ ] `FRONTEND_URL` is set to your Vercel URL
- [ ] Railway service deployed successfully
- [ ] Health endpoint accessible: `https://your-railway-app.up.railway.app/health`

---

## 🧪 Test Your Setup

### **1. Test Health Endpoint**
```bash
curl https://your-railway-app.up.railway.app/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-30T12:00:00.000Z",
  "database": "connected",
  "uptime": 123
}
```

### **2. Test Settings Save (from frontend)**
```javascript
// Open browser console on your Vercel app
await fetch('https://your-railway-app.up.railway.app/api/settings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tmdbKey: 'test_key_12345'
  })
});
```

**Expected response:**
```json
{
  "success": true,
  "message": "Settings saved successfully"
}
```

### **3. Test Settings Load (from frontend)**
```javascript
// Open browser console on your Vercel app
const response = await fetch('https://your-railway-app.up.railway.app/api/settings');
const data = await response.json();
console.log(data); // Should show masked key: { tmdbKey: "test****2345" }
```

---

## 🚨 Common Issues

### **Issue: "Cannot connect to backend"**
**Solution:**
- ✅ Verify `VITE_API_URL` is set in Vercel
- ✅ Verify Railway service is deployed and running
- ✅ Check CORS: `FRONTEND_URL` in Railway matches Vercel URL

### **Issue: "Database connection failed"**
**Solution:**
- ✅ Verify `DATABASE_URL` is the **pooled** connection string
- ✅ Check Neon database is active and not paused
- ✅ Test connection from Railway logs

### **Issue: "Encryption failed"**
**Solution:**
- ✅ Verify `ENCRYPTION_KEY` is exactly 64 characters
- ✅ Regenerate key: `openssl rand -hex 32`
- ✅ Update in Railway variables

---

## 📚 Next Steps

1. ✅ Set up environment variables (above)
2. ✅ Deploy backend to Railway - [Railway Setup](/docs/RAILWAY_SETUP.md)
3. ✅ Implement backend routes - [Backend API Contract](/docs/BACKEND_API_CONTRACT.md)
4. ✅ Test all endpoints - [Option A Implementation](/docs/OPTION_A_IMPLEMENTATION_COMPLETE.md)
5. ✅ Go live! 🚀

---

**Need help?** Check:
- [Option B Quick Start](/docs/OPTION_B_QUICK_START.md) - 30-minute setup guide
- [Railway Setup](/docs/RAILWAY_SETUP.md) - Detailed Railway configuration
- [Neon Setup](/docs/NEON_SETUP.md) - Database configuration
