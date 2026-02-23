# Architecture Diagram - Secure API Key Storage

## 🏗️ Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           USER                                   │
│                  (Opens Screndly PWA)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FRONTEND (Vercel - Free)                        │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  React App + TypeScript + Tailwind CSS                │     │
│  │  - Settings Page (user enters API keys)               │     │
│  │  - SettingsContext (manages state)                    │     │
│  │  - Settings API Client (/lib/api/settings.ts)        │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                  │
│  Non-Sensitive Settings (localStorage):                         │
│  ✅ darkMode, hapticsEnabled, timezone                          │
│  ✅ RSS settings, cleanup settings                              │
│                                                                  │
│  Sensitive Settings (NEVER stored):                             │
│  ❌ API keys (sent to backend immediately)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS/POST
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND API (Railway - $5/month)                   │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  Express.js Server                                     │     │
│  │  - /health (health check)                             │     │
│  │  - /api/settings (GET/POST/DELETE)                    │     │
│  │  - Encryption/Decryption (AES-256)                    │     │
│  │  - CORS protection                                    │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                  │
│  Encryption Process:                                             │
│  1. Receive plain text API key                                  │
│  2. Generate random IV (16 bytes)                              │
│  3. Encrypt with AES-256-CBC                                    │
│  4. Store: IV + encrypted text                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ SQL (encrypted)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           DATABASE (Neon PostgreSQL - Free)                     │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  Settings Table                                        │     │
│  │  ┌──────────────────────────────────────────────┐    │     │
│  │  │ id              | cuid123                     │    │     │
│  │  │ userId          | default                     │    │     │
│  │  │ youtubeKey      | a4f2:3e9d... (ENCRYPTED)   │    │     │
│  │  │ openaiKey       | 7b3a:f2c1... (ENCRYPTED)   │    │     │
│  │  │ tmdbKey         | 9d2f:4a8b... (ENCRYPTED)   │    │     │
│  │  │ photopeaApiKey  | 2c5e:8f1d... (ENCRYPTED)   │    │     │
│  │  │ createdAt       | 2024-12-29T12:00:00Z       │    │     │
│  │  │ updatedAt       | 2024-12-29T12:00:00Z       │    │     │
│  │  └──────────────────────────────────────────────┘    │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                  │
│  Security Features:                                              │
│  ✅ All API keys encrypted at rest                              │
│  ✅ Unique IV per field                                         │
│  ✅ TLS encryption in transit                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow - Saving API Keys

```
┌──────────────┐
│  1. USER     │  Enters API key in Settings page
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  2. FRONTEND (SettingsContext)                          │
│  - Detects API key change                               │
│  - Calls: saveSettings({ tmdbKey: "abc123" })          │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  3. SETTINGS API CLIENT (/lib/api/settings.ts)         │
│  - Identifies sensitive setting                         │
│  - Sends: POST /api/settings                           │
│  - Body: { "tmdbKey": "abc123" }                       │
│  - Header: Authorization: Bearer {token}               │
└──────┬───────────────────────────────────────────────────┘
       │ HTTPS
       ▼
┌──────────────────────────────────────────────────────────┐
│  4. BACKEND (/api/settings route)                       │
│  - Receives plain text                                  │
│  - Calls: encrypt("abc123")                            │
│  - Result: "2c5e:8f1d..."                              │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  5. ENCRYPTION LAYER                                     │
│  - Generate random IV (16 bytes)                        │
│  - Encrypt with AES-256-CBC                             │
│  - Return: IV + encrypted text                          │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  6. DATABASE (Prisma ORM)                               │
│  - Upsert settings record                               │
│  - Store encrypted value                                │
│  - Never stores plain text                              │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  7. RESPONSE TO FRONTEND                                 │
│  - { success: true }                                    │
│  - Toast: "API key saved securely" ✅                   │
└──────────────────────────────────────────────────────────┘
```

---

## 🔓 Data Flow - Loading API Keys

```
┌──────────────┐
│  1. USER     │  Opens Screndly app
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  2. FRONTEND (SettingsContext)                          │
│  - On mount: calls fetchSettings()                      │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  3. SETTINGS API CLIENT                                  │
│  - Sends: GET /api/settings                             │
│  - Header: Authorization: Bearer {token}               │
└──────┬───────────────────────────────────────────────────┘
       │ HTTPS
       ▼
┌──────────────────────────────────────────────────────────┐
│  4. BACKEND (/api/settings route)                       │
│  - Fetch settings from database                         │
│  - Receives encrypted values                            │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  5. DECRYPTION LAYER                                     │
│  - For each field: decrypt("2c5e:8f1d...")             │
│  - Return plain text: "abc123"                          │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  6. RESPONSE TO FRONTEND                                 │
│  - { success: true, data: { tmdbKey: "abc123" } }      │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  7. FRONTEND (SettingsContext)                          │
│  - Merges backend settings with localStorage           │
│  - Updates React state                                  │
│  - Settings page displays values                        │
└──────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Layers

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: Transport Security (HTTPS/TLS)                │
│  ✅ All data encrypted in transit                       │
│  ✅ Certificate-based authentication                    │
│  ✅ Man-in-the-middle protection                        │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 2: Application Security (CORS + Auth)            │
│  ✅ CORS restricts to frontend domain only              │
│  ✅ Bearer token authentication (optional)              │
│  ✅ Request validation & sanitization                   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 3: Encryption at Rest (AES-256-CBC)              │
│  ✅ All API keys encrypted before storage               │
│  ✅ Unique IV per encrypted value                       │
│  ✅ Encryption key stored in backend only               │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 4: Database Security (Neon PostgreSQL)           │
│  ✅ Connection pooling with TLS                         │
│  ✅ Automatic backups                                   │
│  ✅ Row-level security ready                            │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 5: Infrastructure Security (Railway)             │
│  ✅ Automatic SSL certificates                          │
│  ✅ Environment variable encryption                     │
│  ✅ Network isolation                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Comparison: Before vs After

### **BEFORE (Insecure)**

```
┌─────────────┐
│   FRONTEND  │
│  ┌────────┐ │
│  │Settings│ │
│  │Context │ │
│  └───┬────┘ │
│      │      │
│      ▼      │
│  ┌────────────────┐
│  │ localStorage   │ ⚠️ API keys visible in DevTools
│  │ {              │
│  │   tmdbKey: "abc123",    ← EXPOSED
│  │   openaiKey: "sk-...",  ← EXPOSED
│  │   youtubeKey: "AIza..." ← EXPOSED
│  │ }              │
│  └────────────────┘
└─────────────┘

❌ Anyone with DevTools can steal API keys
❌ XSS vulnerabilities expose keys
❌ No encryption
❌ No audit trail
```

### **AFTER (Secure)**

```
┌─────────────┐                  ┌──────────┐                ┌──────────┐
│   FRONTEND  │                  │  BACKEND │                │ DATABASE │
│  ┌────────┐ │                  │          │                │          │
│  │Settings│ │  POST /api      │ Encrypt  │    SQL        │ Encrypted│
│  │Context │ ├─────────────────►│ AES-256 ├───────────────►│ Values   │
│  └───┬────┘ │  { tmdbKey }    │          │  (encrypted)  │          │
│      │      │                  │          │                │          │
│      ▼      │                  └──────────┘                └──────────┘
│  ┌────────────────┐
│  │ localStorage   │ ✅ Only non-sensitive data
│  │ {              │
│  │   darkMode: true,
│  │   timezone: "UTC"
│  │ }              │
│  └────────────────┘
└─────────────┘

✅ API keys never in browser
✅ Encrypted at rest (AES-256)
✅ Encrypted in transit (HTTPS)
✅ Audit trail in database
```

---

## 💡 Key Takeaways

1. **Frontend**: Never stores sensitive data
2. **Backend**: Encrypts before storing
3. **Database**: Only sees encrypted values
4. **User**: No change in UX (same Settings page)
5. **Security**: Production-grade encryption

---

## 🎯 Next Step

Deploy your backend following:  
**`/BACKEND_SETUP_CHECKLIST.md`** → 30-minute guide

Good luck! 🚀
