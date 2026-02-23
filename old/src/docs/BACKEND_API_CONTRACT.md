# Backend API Contract - Complete Implementation Guide

This document defines the complete API contract between the Screndly frontend and Railway backend.

---

## 🏗️ Architecture Overview

```
Frontend (Vercel PWA)
    ↓
Railway Backend (Node.js + Express)
    ↓
Neon Postgres (Encrypted API Keys)
    ↓
External APIs (OpenAI, TMDb, Serper, etc.)
```

**Security Model:**
- ✅ API keys stored encrypted in Neon Postgres
- ✅ Frontend never sees raw API keys
- ✅ Backend decrypts and uses keys server-side
- ✅ Frontend only calls backend proxy endpoints

---

## 📋 Required Backend Endpoints

### **1. Settings Management**

#### `GET /api/settings`
Fetch user settings (API keys returned masked)

**Request:**
```http
GET /api/settings HTTP/1.1
Authorization: Bearer {optional_token}
```

**Response:**
```json
{
  "openaiKey": "sk-****1234",
  "tmdbKey": "****5678",
  "serperKey": "****9012",
  "googleVideoIntelligenceKey": "****3456",
  "shotstackKey": "****7890",
  "videoGoogleSearchApiKey": "****1234",
  "videoGoogleSearchCx": "****5678"
}
```

#### `POST /api/settings`
Save/update settings (encrypts API keys)

**Request:**
```json
{
  "openaiKey": "sk-proj-abc123...",
  "tmdbKey": "abc123def456...",
  "serperKey": "xyz789...",
  "googleVideoIntelligenceKey": "AIzaSy...",
  "shotstackKey": "abc123...",
  "videoGoogleSearchApiKey": "AIzaSy...",
  "videoGoogleSearchCx": "012345..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings saved successfully"
}
```

#### `DELETE /api/settings`
Delete all user settings

**Request:**
```http
DELETE /api/settings HTTP/1.1
```

**Response:**
```json
{
  "success": true,
  "message": "Settings deleted"
}
```

---

### **2. OpenAI API Proxy**

#### `POST /api/openai/chat/completions`
Generate chat completion using stored OpenAI key

**Request:**
```json
{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Generate a caption for this post..."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 500
}
```

**Backend Implementation:**
```typescript
// Backend retrieves encrypted OpenAI key from database
const settings = await prisma.settings.findUnique({ where: { userId: 'default' } });
const apiKey = decrypt(settings.openaiKey);

// Call OpenAI API
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(req.body)
});

const data = await response.json();
res.json(data);
```

**Response:** Standard OpenAI API response

---

### **3. TMDb API Proxy**

#### `GET /api/tmdb/discover/movie`
Discover movies using stored TMDb key

**Request:**
```http
GET /api/tmdb/discover/movie?sort_by=popularity.desc&page=1
```

**Backend Implementation:**
```typescript
const settings = await prisma.settings.findUnique({ where: { userId: 'default' } });
const apiKey = decrypt(settings.tmdbKey);

const response = await fetch(
  `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&${queryString}`
);

const data = await response.json();
res.json(data);
```

#### `GET /api/tmdb/discover/tv`
Discover TV shows

#### `GET /api/tmdb/movie/:id`
Get movie details

#### `GET /api/tmdb/tv/:id`
Get TV show details

#### `GET /api/tmdb/search/movie`
Search movies

#### `GET /api/tmdb/search/tv`
Search TV shows

---

### **4. Serper API Proxy**

#### `POST /api/serper/search`
Perform web search using stored Serper key

**Request:**
```json
{
  "q": "latest movie news",
  "num": 10
}
```

**Backend Implementation:**
```typescript
const settings = await prisma.settings.findUnique({ where: { userId: 'default' } });
const apiKey = decrypt(settings.serperKey);

const response = await fetch('https://google.serper.dev/search', {
  method: 'POST',
  headers: {
    'X-API-KEY': apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(req.body)
});

const data = await response.json();
res.json(data);
```

#### `POST /api/serper/images`
Search images

**Request:**
```json
{
  "q": "movie poster",
  "num": 10
}
```

---

### **5. Google Video Intelligence API Proxy**

#### `POST /api/google-video-intelligence/annotate`
Analyze video using Google Video Intelligence

**Request:**
```json
{
  "inputUri": "gs://bucket/video.mp4",
  "features": ["LABEL_DETECTION", "SHOT_CHANGE_DETECTION"]
}
```

**Backend Implementation:**
```typescript
const settings = await prisma.settings.findUnique({ where: { userId: 'default' } });
const apiKey = decrypt(settings.googleVideoIntelligenceKey);

const response = await fetch(
  `https://videointelligence.googleapis.com/v1/videos:annotate?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body)
  }
);

const data = await response.json();
res.json(data);
```

---

### **6. Shotstack API Proxy**

#### `POST /api/shotstack/render`
Submit render job using Shotstack

**Request:**
```json
{
  "timeline": {
    "soundtrack": {},
    "tracks": []
  },
  "output": {
    "format": "mp4",
    "resolution": "1080"
  }
}
```

**Backend Implementation:**
```typescript
const settings = await prisma.settings.findUnique({ where: { userId: 'default' } });
const apiKey = decrypt(settings.shotstackKey);

const response = await fetch('https://api.shotstack.io/v1/render', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(req.body)
});

const data = await response.json();
res.json(data);
```

#### `GET /api/shotstack/render/:id`
Get render status

---

### **7. Google Custom Search API Proxy**

#### `GET /api/google-search`
Perform custom search using stored Google Search API key

**Request:**
```http
GET /api/google-search?q=movie+news&cx=012345...&num=10
```

**Backend Implementation:**
```typescript
const settings = await prisma.settings.findUnique({ where: { userId: 'default' } });
const apiKey = decrypt(settings.videoGoogleSearchApiKey);
const cx = settings.videoGoogleSearchCx; // CX stored plain text, not sensitive

const response = await fetch(
  `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${query}&num=${num}`
);

const data = await response.json();
res.json(data);
```

---

### **8. Health Check**

#### `GET /health`
Check backend health

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-14T12:00:00.000Z",
  "database": "connected",
  "uptime": 3600,
  "memory": {
    "rss": 50331648,
    "heapTotal": 20971520,
    "heapUsed": 15728640
  }
}
```

---

## 🔐 Security Implementation

### **Encryption Helper**

```typescript
// Backend: src/lib/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 64-char hex string
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  if (!text) return '';
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  if (!text) return '';
  
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function maskKey(encryptedKey: string): string {
  // Decrypt to get original key
  const key = decrypt(encryptedKey);
  
  // Mask for frontend display
  if (key.length > 8) {
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
  }
  return '••••••••••••••••';
}
```

---

## 🗄️ Database Schema

```prisma
// Backend: prisma/schema.prisma

model Settings {
  id        String   @id @default(cuid())
  userId    String   @unique @default("default")
  
  // Encrypted API Keys
  openaiKey                  String? @db.Text
  serperKey                  String? @db.Text
  tmdbKey                    String? @db.Text
  googleVideoIntelligenceKey String? @db.Text
  shotstackKey               String? @db.Text
  videoGoogleSearchApiKey    String? @db.Text
  
  // Non-sensitive (can be plain text)
  videoGoogleSearchCx        String? @db.Text
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId])
}
```

---

## 🚀 Environment Variables (Railway)

```env
# Node Environment
NODE_ENV=production
PORT=${{ PORT }}

# Database (Neon Postgres)
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.neon.tech/screndly?sslmode=require

# Encryption (Generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_64_character_hex_string_here

# CORS
FRONTEND_URL=https://screndly.vercel.app

# Optional: For multi-user apps
API_KEY=your_api_key_for_frontend_auth
```

---

## 📝 Complete Backend Route Example

```typescript
// Backend: src/routes/api.ts

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { encrypt, decrypt, maskKey } from '../lib/encryption';

const router = Router();

// ============================================================================
// SETTINGS ENDPOINTS
// ============================================================================

router.get('/api/settings', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: 'default' }
    });
    
    if (!settings) {
      return res.json({});
    }
    
    // Return masked keys for display
    const masked = {
      openaiKey: settings.openaiKey ? maskKey(settings.openaiKey) : null,
      tmdbKey: settings.tmdbKey ? maskKey(settings.tmdbKey) : null,
      serperKey: settings.serperKey ? maskKey(settings.serperKey) : null,
      googleVideoIntelligenceKey: settings.googleVideoIntelligenceKey 
        ? maskKey(settings.googleVideoIntelligenceKey) 
        : null,
      shotstackKey: settings.shotstackKey ? maskKey(settings.shotstackKey) : null,
      videoGoogleSearchApiKey: settings.videoGoogleSearchApiKey 
        ? maskKey(settings.videoGoogleSearchApiKey) 
        : null,
      videoGoogleSearchCx: settings.videoGoogleSearchCx, // Not sensitive
    };
    
    res.json(masked);
  } catch (error) {
    console.error('[Settings] Error fetching:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.post('/api/settings', async (req, res) => {
  try {
    const updates: any = {};
    
    // Encrypt sensitive keys
    if (req.body.openaiKey) updates.openaiKey = encrypt(req.body.openaiKey);
    if (req.body.tmdbKey) updates.tmdbKey = encrypt(req.body.tmdbKey);
    if (req.body.serperKey) updates.serperKey = encrypt(req.body.serperKey);
    if (req.body.googleVideoIntelligenceKey) 
      updates.googleVideoIntelligenceKey = encrypt(req.body.googleVideoIntelligenceKey);
    if (req.body.shotstackKey) updates.shotstackKey = encrypt(req.body.shotstackKey);
    if (req.body.videoGoogleSearchApiKey) 
      updates.videoGoogleSearchApiKey = encrypt(req.body.videoGoogleSearchApiKey);
    
    // Non-sensitive fields
    if (req.body.videoGoogleSearchCx) 
      updates.videoGoogleSearchCx = req.body.videoGoogleSearchCx;
    
    await prisma.settings.upsert({
      where: { userId: 'default' },
      update: updates,
      create: { userId: 'default', ...updates }
    });
    
    res.json({ success: true, message: 'Settings saved' });
  } catch (error) {
    console.error('[Settings] Error saving:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

router.delete('/api/settings', async (req, res) => {
  try {
    await prisma.settings.delete({
      where: { userId: 'default' }
    });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true }); // OK if doesn't exist
  }
});

// ============================================================================
// OPENAI PROXY
// ============================================================================

router.post('/api/openai/chat/completions', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: 'default' }
    });
    
    if (!settings?.openaiKey) {
      return res.status(400).json({ error: 'OpenAI API key not configured' });
    }
    
    const apiKey = decrypt(settings.openaiKey);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('[OpenAI] Error:', error);
    res.status(500).json({ error: 'OpenAI API call failed' });
  }
});

// ============================================================================
// TMDB PROXY
// ============================================================================

router.get('/api/tmdb/*', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: 'default' }
    });
    
    if (!settings?.tmdbKey) {
      return res.status(400).json({ error: 'TMDb API key not configured' });
    }
    
    const apiKey = decrypt(settings.tmdbKey);
    const tmdbPath = req.params[0]; // Everything after /api/tmdb/
    const queryParams = new URLSearchParams(req.query as any);
    queryParams.set('api_key', apiKey);
    
    const response = await fetch(
      `https://api.themoviedb.org/3/${tmdbPath}?${queryParams.toString()}`
    );
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[TMDb] Error:', error);
    res.status(500).json({ error: 'TMDb API call failed' });
  }
});

// ============================================================================
// SERPER PROXY
// ============================================================================

router.post('/api/serper/search', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: 'default' }
    });
    
    if (!settings?.serperKey) {
      return res.status(400).json({ error: 'Serper API key not configured' });
    }
    
    const apiKey = decrypt(settings.serperKey);
    
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Serper] Error:', error);
    res.status(500).json({ error: 'Serper API call failed' });
  }
});

router.post('/api/serper/images', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: 'default' }
    });
    
    if (!settings?.serperKey) {
      return res.status(400).json({ error: 'Serper API key not configured' });
    }
    
    const apiKey = decrypt(settings.serperKey);
    
    const response = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Serper] Error:', error);
    res.status(500).json({ error: 'Serper images API call failed' });
  }
});

// ============================================================================
// GOOGLE VIDEO INTELLIGENCE PROXY
// ============================================================================

router.post('/api/google-video-intelligence/annotate', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: 'default' }
    });
    
    if (!settings?.googleVideoIntelligenceKey) {
      return res.status(400).json({ 
        error: 'Google Video Intelligence API key not configured' 
      });
    }
    
    const apiKey = decrypt(settings.googleVideoIntelligenceKey);
    
    const response = await fetch(
      `https://videointelligence.googleapis.com/v1/videos:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      }
    );
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Google Video Intelligence] Error:', error);
    res.status(500).json({ error: 'Google Video Intelligence API call failed' });
  }
});

// ============================================================================
// SHOTSTACK PROXY
// ============================================================================

router.post('/api/shotstack/render', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: 'default' }
    });
    
    if (!settings?.shotstackKey) {
      return res.status(400).json({ error: 'Shotstack API key not configured' });
    }
    
    const apiKey = decrypt(settings.shotstackKey);
    
    const response = await fetch('https://api.shotstack.io/v1/render', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Shotstack] Error:', error);
    res.status(500).json({ error: 'Shotstack API call failed' });
  }
});

router.get('/api/shotstack/render/:id', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: 'default' }
    });
    
    if (!settings?.shotstackKey) {
      return res.status(400).json({ error: 'Shotstack API key not configured' });
    }
    
    const apiKey = decrypt(settings.shotstackKey);
    
    const response = await fetch(
      `https://api.shotstack.io/v1/render/${req.params.id}`,
      {
        headers: { 'x-api-key': apiKey }
      }
    );
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Shotstack] Error:', error);
    res.status(500).json({ error: 'Shotstack status check failed' });
  }
});

// ============================================================================
// GOOGLE CUSTOM SEARCH PROXY
// ============================================================================

router.get('/api/google-search', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: 'default' }
    });
    
    if (!settings?.videoGoogleSearchApiKey) {
      return res.status(400).json({ 
        error: 'Google Search API key not configured' 
      });
    }
    
    const apiKey = decrypt(settings.videoGoogleSearchApiKey);
    const cx = settings.videoGoogleSearchCx;
    const { q, num = 10 } = req.query;
    
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${q}&num=${num}`
    );
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Google Search] Error:', error);
    res.status(500).json({ error: 'Google Search API call failed' });
  }
});

export default router;
```

---

## 🎯 Frontend API Client Usage

The frontend already has the correct structure. No changes needed to API calls!

```typescript
// Frontend: lib/api/openai.ts
// Already calling /api/openai/chat/completions
const response = await apiClient.post('/api/openai/chat/completions', request);
```

```typescript
// Frontend: lib/api/tmdb.ts
// Already calling /api/tmdb/*
const response = await apiClient.get('/api/tmdb/discover/movie?sort_by=popularity.desc');
```

---

## ✅ Migration Checklist

### Backend Setup
- [ ] Deploy Railway backend
- [ ] Connect Neon Postgres database
- [ ] Generate encryption key: `openssl rand -hex 32`
- [ ] Add encryption key to Railway environment variables
- [ ] Implement settings endpoints
- [ ] Implement API proxy endpoints
- [ ] Test health endpoint

### Frontend Updates
- [ ] Set `VITE_API_URL` environment variable in Vercel
- [ ] Verify apiClient base URL points to Railway
- [ ] Test settings save/load flow
- [ ] Test all API proxy endpoints
- [ ] Remove any direct external API calls

### Testing
- [ ] Save API keys through frontend settings
- [ ] Verify keys are encrypted in Neon database
- [ ] Test OpenAI caption generation
- [ ] Test TMDb movie discovery
- [ ] Test Serper web search
- [ ] Test Google Custom Search
- [ ] Verify no API keys in browser localStorage

---

**🚀 With this implementation, all API keys are secure in your backend!**
