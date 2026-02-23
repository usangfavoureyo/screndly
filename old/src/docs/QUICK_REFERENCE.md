# 🚀 Quick Reference - Backend Integration

**Use this as your quick lookup guide**

---

## 📋 30-Second Overview

✅ Frontend updated to send API keys to backend  
✅ Backend code ready in `/docs/BACKEND_IMPLEMENTATION_REFERENCE.md`  
✅ Deployment guide in `/BACKEND_SETUP_CHECKLIST.md`  
✅ Total cost: **$5.40/month**  
✅ Setup time: **~30 minutes**  

---

## 🔗 Essential Links

| Resource | File Path |
|----------|-----------|
| **Quick Start Guide** | `/BACKEND_SETUP_CHECKLIST.md` |
| **Complete Backend Code** | `/docs/BACKEND_IMPLEMENTATION_REFERENCE.md` |
| **Integration Details** | `/docs/BACKEND_INTEGRATION_COMPLETE.md` |
| **Architecture Overview** | `/docs/OPTION_B_QUICK_START.md` |

---

## 🛠️ Quick Commands

### **Generate Encryption Key**
```bash
openssl rand -hex 32
```

### **Test Backend Health**
```bash
curl https://your-backend.railway.app/health
```

### **Test Settings API**
```bash
curl -X POST https://your-backend.railway.app/api/settings \
  -H "Content-Type: application/json" \
  -d '{"tmdbKey": "test123"}'
```

---

## 🔐 Security Checklist

- [ ] API keys encrypted in database (AES-256)
- [ ] HTTPS only (no HTTP)
- [ ] CORS restricted to your domain
- [ ] No API keys in localStorage
- [ ] Environment variables secure

---

## 🌐 Environment Variables

### **Frontend** (`.env`)
```env
VITE_API_URL=https://your-backend.railway.app
VITE_ENABLE_BACKEND=true
```

### **Backend** (Railway)
```env
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=<openssl rand -hex 32>
FRONTEND_URL=https://screndly.vercel.app
```

---

## 📊 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Backend health check |
| GET | `/api/settings` | Fetch API keys |
| POST | `/api/settings` | Save API keys |
| DELETE | `/api/settings` | Clear settings |

---

## 💰 Monthly Costs

| Service | Cost |
|---------|------|
| Vercel | $0 |
| Railway | $5 |
| Neon | $0 |
| Backblaze | ~$0.40 |
| **Total** | **$5.40** |

---

## ⏱️ Deployment Timeline

1. **Create accounts** (5 min)
2. **Setup database** (5 min)
3. **Deploy backend** (10 min)
4. **Configure env vars** (5 min)
5. **Test integration** (5 min)

**Total**: ~30 minutes

---

## 🆘 Quick Troubleshooting

### Backend won't start?
→ Check Railway logs  
→ Verify `DATABASE_URL` is set  
→ Run `npx prisma generate`

### Settings not saving?
→ Check `VITE_API_URL` in frontend  
→ Test `/health` endpoint  
→ Verify CORS settings

### API keys visible in browser?
→ Clear localStorage  
→ Refresh page  
→ Re-enter API keys

---

## 📱 Contact

Need help? Check these docs:
1. `/BACKEND_SETUP_CHECKLIST.md`
2. `/docs/BACKEND_INTEGRATION_COMPLETE.md`
3. `/docs/BACKEND_IMPLEMENTATION_REFERENCE.md`

---

**Last Updated**: December 29, 2024  
**Status**: ✅ Ready for Deployment
