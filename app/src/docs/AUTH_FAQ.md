# 🔐 Authentication FAQ - Your Questions Answered

## ❓ Common Questions

---

### **Q: How do I use the auth? Do I sign up with my email?**

**A: No signup needed!** This is a **single-password system**, not email/password.

**Here's how it works:**

1. **You (the admin) set ONE password** in environment variables
2. **Anyone with that password** can access the app
3. **No email, no signup, no user accounts** - just one password

Think of it like **your phone's lock screen** - one password protects everything.

---

### **Q: How do I sign up?**

**A: There is NO signup!** 

This is a **private, single-user app**. You don't "sign up" - you **configure the password** once:

```bash
# In .env.local
APP_PASSWORD=MySecurePassword123!
```

That's it! Now you can login with that password.

---

### **Q: Do I have to put an email and password?**

**A: No email needed!** Only password.

**What you see on the login screen:**
- ~~Email field~~ (removed)
- ✅ Password field only
- ✅ "Keep me signed in" checkbox
- ✅ Sign in button

**What you enter:**
- Just the password you set in `APP_PASSWORD`

---

### **Q: What happens when I forget the password?**

**A: You reset it yourself!** Since you control the password (it's in your environment variables), you can change it anytime.

#### **For Local Development:**
```bash
# 1. Edit .env.local
APP_PASSWORD=MyNewPassword456!

# 2. Restart dev server
npm run dev

# 3. Login with new password
```

#### **For Production (Vercel):**
```bash
# 1. Vercel Dashboard → Settings → Environment Variables
# 2. Click "APP_PASSWORD" → Edit
# 3. Enter new password → Save
# 4. Click "Redeploy" (required!)
# 5. Login with new password
```

**There's no "Forgot Password" email** because you're the admin - you can change it directly!

---

### **Q: How does this integrate with my existing LoginPage?**

**A: I've already integrated it!** ✅

**What I changed:**
1. ✅ Removed the email field (only password now)
2. ✅ Added secure API integration (`login()` from `/lib/auth.ts`)
3. ✅ Added rate limiting warnings (shows when 2 attempts left)
4. ✅ Added loading state ("Signing in..." button text)
5. ✅ Added error handling (toasts for wrong password)
6. ✅ Kept all your existing styling (dark mode, haptics, logos)

**Your login page now:**
- ✅ Calls server-side API to validate password
- ✅ Stores JWT token on success
- ✅ Shows rate limit warnings
- ✅ Handles all error scenarios
- ✅ Looks exactly the same (your branding intact!)

---

## 📋 Complete Setup Guide

### **Step 1: Generate JWT Secret**

```bash
# Run this command
openssl rand -base64 32

# You'll get something like:
# Kx9mP2nQ7rS8tU5vW6xY1zA3bC4dE7fG9hJ0kL2mN5o=
```

### **Step 2: Create Environment File**

Create a file called `.env.local` in your project root:

```bash
# .env.local
JWT_SECRET=Kx9mP2nQ7rS8tU5vW6xY1zA3bC4dE7fG9hJ0kL2mN5o=
APP_PASSWORD=Screndly2025!MySecurePassword
```

**Important:**
- `JWT_SECRET` - Copy the output from Step 1
- `APP_PASSWORD` - Choose your own password (this is what you'll enter to login)

### **Step 3: Install Dependencies**

```bash
npm install
```

### **Step 4: Start Dev Server**

```bash
npm run dev
```

### **Step 5: Test Login**

1. Visit http://localhost:5173
2. You'll see your Screndly login screen
3. Enter the password you set in `APP_PASSWORD`
4. Click "Sign in"
5. You're in! 🎉

---

## 🎯 How Login Works (Step-by-Step)

### **First Time Login:**

```
1. User visits app
   ↓
2. Sees your branded login screen
   ↓
3. Enters password (the one from APP_PASSWORD)
   ↓
4. Clicks "Sign in"
   ↓
5. Password sent to /api/auth/login (secure server function)
   ↓
6. Server checks: password === APP_PASSWORD?
   ↓
7. If YES:
   - Generate JWT token
   - Return token to browser
   - Store in localStorage
   - Show success toast
   - Login to app (lasts 7 days)
   ↓
8. If NO:
   - Show error toast
   - Clear password field
   - Decrement remaining attempts
   - Show warning if <3 attempts left
```

### **Returning User (within 7 days):**

```
1. User visits app
   ↓
2. AuthProvider checks localStorage for token
   ↓
3. Token found! Send to /api/auth/verify
   ↓
4. Server verifies JWT signature & expiry
   ↓
5. If valid:
   - Auto-login (no password needed)
   - Straight to app
   ↓
6. If expired:
   - Back to login screen
   - Enter password again
```

---

## 🔒 Security Explained (Simple Terms)

### **What happens when you login:**

```
Browser                 Vercel Server
   |                         |
   | "password123"          |
   |----------------------->|
   |                         |
   |    Check password      |
   |    Generate JWT        |
   |    (cryptographic)     |
   |                         |
   | JWT token "abc..."     |
   |<-----------------------|
   |                         |
   | Store in localStorage  |
   |                         |
```

### **What's a JWT token?**

It's like a **signed receipt** that proves you logged in:

```
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Contains:
- Who: "screndly app"
- When: "logged in at 2PM"
- Expires: "valid until next week"
- Signature: "cryptographically signed by server"
```

**Why it's secure:**
- ✅ Can't be faked (signature is cryptographic)
- ✅ Expires automatically (7 days)
- ✅ Server-side validation (can't bypass with DevTools)
- ✅ Password never stored in browser (only token)

---

## 🛡️ Rate Limiting Explained

### **What is rate limiting?**

It **stops hackers from guessing your password** by trying thousands of combinations.

### **How it works:**

```
Attempt 1: Wrong password → "Invalid password (4 attempts remaining)"
Attempt 2: Wrong password → "Invalid password (3 attempts remaining)"
Attempt 3: Wrong password → "Invalid password (2 attempts remaining)"
          ⚠️ WARNING shows: "2 attempts remaining before lockout"
Attempt 4: Wrong password → "Invalid password (1 attempt remaining)"
          ⚠️ WARNING shows: "1 attempt remaining before lockout"
Attempt 5: Wrong password → 🚫 LOCKED FOR 15 MINUTES
```

### **What happens during lockout:**

- ❌ Can't login (even with correct password)
- ❌ Shows: "Too many login attempts. Try again in 15 minutes."
- ✅ Wait 15 minutes → Reset back to 5 attempts
- ✅ OR restart dev server (for development only)

---

## 📱 User Experience Examples

### **Scenario 1: First Day**
1. Open Screndly
2. See login screen
3. Enter password: `Screndly2025!`
4. ✅ "Welcome to Screndly!" toast
5. App opens

### **Scenario 2: Next Day**
1. Open Screndly
2. "Verifying authentication..." (2 seconds)
3. ✅ Auto-login! Straight to dashboard
4. No password needed

### **Scenario 3: Forgot Password**
1. Try to login, password doesn't work
2. You realize you forgot it
3. Open `.env.local` → Check `APP_PASSWORD`
4. Try again → Works!

**OR if you want to change it:**
1. Edit `.env.local` → `APP_PASSWORD=NewPassword`
2. Restart: `npm run dev`
3. Login with new password

### **Scenario 4: After 8 Days**
1. Open Screndly
2. "Verifying authentication..."
3. ❌ "Token expired" (been 8 days)
4. Back to login screen
5. Enter password again → Works for another 7 days

### **Scenario 5: Too Many Wrong Attempts**
1. Enter wrong password 5 times
2. ⚠️ After attempt 3: Warning shows
3. 🚫 After attempt 5: Locked for 15 minutes
4. ☕ Wait 15 minutes
5. Try again → Works

---

## 🆚 Comparison: Email/Password vs Single Password

### **Traditional Auth (Email/Password):**
```
Users:
- admin@screndly.com → password123
- user2@screndly.com → password456
- user3@screndly.com → password789

Database:
- Users table with emails & password hashes
- Signup flow (create account)
- Forgot password flow (email reset link)
- Email verification
```

### **Your Auth (Single Password):**
```
Users:
- Anyone with the password → MySecurePassword123!

Environment Variable:
- APP_PASSWORD=MySecurePassword123!

No database:
- No signup (password set by admin)
- No forgot password email (admin resets)
- No email verification (no emails!)
```

**Why this is perfect for you:**
- ✅ Single user app (just you)
- ✅ Private deployment (not public)
- ✅ Simpler setup (no user database)
- ✅ Still super secure (JWT, rate limiting, server validation)

---

## 🔧 Configuration Examples

### **Example 1: Strong Password**
```bash
# .env.local
APP_PASSWORD=Screndly2025!MyVerySecurePassword#789
```

### **Example 2: Simple Password (not recommended)**
```bash
# .env.local
APP_PASSWORD=password123
```
⚠️ **Use a strong password!** At least 12 characters with letters, numbers, symbols.

### **Example 3: Easy to Remember**
```bash
# .env.local
APP_PASSWORD=ScreenRender@2025!
```
✅ Good! Company name + year + special chars

---

## 🚀 Production Deployment

### **Vercel Setup:**

1. **Push to GitHub:**
```bash
git add .
git commit -m "Add authentication"
git push
```

2. **Deploy to Vercel:**
```bash
vercel --prod
```

3. **Add Environment Variables:**
- Go to Vercel Dashboard
- Click your project
- Settings → Environment Variables
- Add `JWT_SECRET` (your generated secret)
- Add `APP_PASSWORD` (your login password)
- Select "Production, Preview, Development"
- Click Save

4. **Redeploy:**
- Deployments tab
- Click "Redeploy" button
- Wait for deployment to finish

5. **Test:**
- Visit your Vercel URL
- Login with your `APP_PASSWORD`
- ✅ You're in!

---

## 🐛 Troubleshooting

### **Problem: "Server configuration error"**
**Cause:** Missing `JWT_SECRET` or `APP_PASSWORD`  
**Fix:**
```bash
# Check .env.local exists and has both variables
cat .env.local

# Should see:
# JWT_SECRET=...
# APP_PASSWORD=...
```

### **Problem: "Invalid password" (but I know it's correct)**
**Cause:** Typo in `.env.local` or need to restart server  
**Fix:**
```bash
# 1. Check .env.local
cat .env.local

# 2. Restart dev server
npm run dev

# 3. Try again
```

### **Problem: "Too many login attempts"**
**Cause:** 5 failed attempts  
**Fix:**
```bash
# Option 1: Wait 15 minutes

# Option 2: Restart dev server (resets rate limit)
npm run dev
```

### **Problem: Login works locally but not production**
**Cause:** Environment variables not in Vercel  
**Fix:**
1. Vercel Dashboard → Settings → Environment Variables
2. Add `JWT_SECRET` and `APP_PASSWORD`
3. Click "Redeploy" (very important!)

---

## ✅ Summary

### **What You Need to Know:**

1. **No signup** - You set the password in environment variables
2. **No email** - Just password field on login screen
3. **Forgot password?** - Edit `.env.local` or Vercel env vars
4. **How long logged in?** - 7 days, then re-enter password
5. **How many attempts?** - 5 attempts, then 15-minute lockout
6. **Is it secure?** - Yes! Server-side validation, JWT tokens, rate limiting
7. **Already integrated** - Your existing LoginPage.tsx now works with secure auth

### **Quick Start (Copy/Paste):**

```bash
# 1. Generate secret
openssl rand -base64 32

# 2. Create .env.local
cat > .env.local << EOF
JWT_SECRET=PASTE_SECRET_HERE
APP_PASSWORD=YourPassword123!
EOF

# 3. Install & run
npm install
npm run dev

# 4. Login at http://localhost:5173
# Enter password: YourPassword123!
```

---

## 📚 Next Steps

1. ✅ **Read this FAQ** (you're here!)
2. ✅ **Set up .env.local** (5 minutes)
3. ✅ **Test login locally** (1 minute)
4. ✅ **Deploy to Vercel** (10 minutes)
5. ✅ **Add Account settings to navigation** (optional)

**Questions?** Check `/docs/AUTHENTICATION_SETUP.md` for more details.

**Ready to go!** Your auth is production-ready. 🚀
