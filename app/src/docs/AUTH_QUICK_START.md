# ⚡ Authentication Quick Start Guide

> **5 minutes to production-ready authentication**

---

## 🎯 What You're Building

A **single-password authentication system** where:
- ✅ You set ONE password in environment variables
- ✅ Anyone with that password can access the app
- ✅ No signup, no email, no user database
- ✅ Sessions last 7 days
- ✅ Rate limiting prevents brute force attacks

**Perfect for:** Private, single-user apps like Screndly

---

## 📋 Quick Setup (5 Steps)

### **Step 1: Generate JWT Secret (30 seconds)**

Open terminal and run:

```bash
openssl rand -base64 32
```

**You'll get something like:**
```
Kx9mP2nQ7rS8tU5vW6xY1zA3bC4dE7fG9hJ0kL2mN5o=
```

**Copy this!** You'll need it in the next step.

---

### **Step 2: Create .env.local File (1 minute)**

Create a file called `.env.local` in your project root:

```bash
# Paste your JWT secret from Step 1
JWT_SECRET=Kx9mP2nQ7rS8tU5vW6xY1zA3bC4dE7fG9hJ0kL2mN5o=

# Choose your login password (this is what you'll type to login)
APP_PASSWORD=MySecurePassword123!
```

**Tips:**
- Use a strong password (12+ characters)
- Mix letters, numbers, symbols
- Example: `Screndly2025!SecurePass`

---

### **Step 3: Install Dependencies (1 minute)**

```bash
npm install
```

This installs `jsonwebtoken` and other required packages.

---

### **Step 4: Start Dev Server (10 seconds)**

```bash
npm run dev
```

Wait for:
```
  ➜  Local:   http://localhost:5173/
```

---

### **Step 5: Test Login (30 seconds)**

1. Open http://localhost:5173
2. You'll see the Screndly login screen
3. Enter the password from `APP_PASSWORD` (e.g., `MySecurePassword123!`)
4. Click "Sign in"
5. ✅ **Success!** You're logged in for 7 days

---

## 🎉 You're Done!

**What just happened:**
1. ✅ Password validated server-side (secure!)
2. ✅ JWT token generated and stored
3. ✅ You're logged in for 7 days
4. ✅ Rate limiting active (5 attempts max)

**Next visit:**
- Won't need to login again (auto-login for 7 days)
- After 7 days, enter password again

---

## 🚀 Deploy to Production (10 minutes)

### **Step 1: Push to GitHub**

```bash
git add .
git commit -m "Add authentication"
git push
```

### **Step 2: Deploy to Vercel**

```bash
vercel --prod
```

### **Step 3: Add Environment Variables**

1. Go to https://vercel.com/dashboard
2. Click your project
3. Click **Settings** → **Environment Variables**
4. Click **Add New**

**Add these 2 variables:**

| Key | Value | Environment |
|-----|-------|-------------|
| `JWT_SECRET` | `Kx9m...` (from .env.local) | ✅ All |
| `APP_PASSWORD` | `MySecurePassword123!` | ✅ All |

5. Click **Save**

### **Step 4: Redeploy**

⚠️ **IMPORTANT:** You MUST redeploy after adding env variables!

1. Click **Deployments** tab
2. Click the **"..."** menu on latest deployment
3. Click **Redeploy**
4. Wait for deployment to finish

### **Step 5: Test Production**

1. Visit your Vercel URL (e.g., `screndly.vercel.app`)
2. Enter your `APP_PASSWORD`
3. ✅ **You're in!**

---

## 📱 How It Works (Simple Explanation)

### **Login Flow:**

```
You enter password
      ↓
Sent to Vercel server (secure)
      ↓
Server checks: password === APP_PASSWORD?
      ↓
✅ YES → Generate JWT token → Store in browser → Login for 7 days
❌ NO  → Show error → Try again (5 attempts max)
```

### **Return Visit (within 7 days):**

```
Open app
      ↓
Check for JWT token in browser
      ↓
Token found → Verify with server
      ↓
✅ Valid → Auto-login (no password needed)
❌ Expired → Back to login screen
```

---

## 🔒 Security Features

✅ **Server-side validation** - Password never in client code  
✅ **JWT tokens** - Cryptographically signed, can't be faked  
✅ **Rate limiting** - 5 attempts → 15-minute lockout  
✅ **Session expiry** - Tokens expire after 7 days  
✅ **Timing-safe** - Prevents timing attack exploits  
✅ **HTTPS** - Vercel enforces SSL in production  

---

## 🆘 Common Issues

### **"Server configuration error" on login**

**Problem:** Environment variables not set  
**Fix:**
```bash
# Check .env.local exists
cat .env.local

# Should show:
# JWT_SECRET=...
# APP_PASSWORD=...
```

---

### **"Invalid password" (but I know it's correct)**

**Problem:** Typo in password or need to restart  
**Fix:**
```bash
# 1. Double-check .env.local
cat .env.local

# 2. Restart dev server
npm run dev
```

---

### **"Too many login attempts"**

**Problem:** Tried wrong password 5 times  
**Fix:**
```bash
# Option 1: Wait 15 minutes

# Option 2: Restart dev server (dev only)
npm run dev
```

---

### **Works locally but not on Vercel**

**Problem:** Environment variables not deployed  
**Fix:**
1. Vercel Dashboard → Settings → Environment Variables
2. Add `JWT_SECRET` and `APP_PASSWORD`
3. **Click "Redeploy"** ⚠️ (don't skip this!)

---

## ❓ FAQ

### **Q: Do I need to create an account?**
**A:** No! You set the password in `.env.local`. No signup needed.

### **Q: What if I forget the password?**
**A:** Edit `.env.local` (local) or Vercel environment variables (production). You're the admin!

### **Q: Do I need an email?**
**A:** No! Just password. No email field, no email verification.

### **Q: How long am I logged in?**
**A:** 7 days. After that, enter password again.

### **Q: Can I add more users?**
**A:** Currently it's one password for everyone. For multiple users, see `/docs/AUTH_FAQ.md` for migration options.

---

## 📚 Additional Resources

- **Full FAQ:** `/docs/AUTH_FAQ.md`
- **Setup Guide:** `/docs/AUTHENTICATION_SETUP.md`
- **Technical Details:** `/docs/SECURE_AUTH_IMPLEMENTATION.md`
- **Architecture:** `/docs/AUTH_ARCHITECTURE.md`

---

## ✅ Checklist

Before deploying to production:

- [ ] Generated `JWT_SECRET` with `openssl rand -base64 32`
- [ ] Created `.env.local` with `JWT_SECRET` and `APP_PASSWORD`
- [ ] Tested login locally (works!)
- [ ] Committed changes to git
- [ ] Deployed to Vercel
- [ ] Added environment variables in Vercel Dashboard
- [ ] Redeployed after adding env variables
- [ ] Tested login on production URL (works!)
- [ ] Saved password somewhere safe (password manager)

---

## 🎯 Summary

**You now have:**
- ✅ Production-ready authentication
- ✅ Server-side password validation
- ✅ JWT tokens with 7-day expiry
- ✅ Rate limiting (5 attempts)
- ✅ Your existing login page (upgraded!)
- ✅ Zero-cost deployment on Vercel

**Time to complete:** 5 minutes local + 10 minutes production = **15 minutes total**

**Cost:** $0/month (Vercel free tier)

**Security level:** Enterprise-grade 🔐

---

**Ready to login!** 🚀

Just run:
```bash
npm run dev
```

Then visit http://localhost:5173 and enter your `APP_PASSWORD`.

**That's it!** You're authenticated. 🎉
