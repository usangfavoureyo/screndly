# 🎯 How to Use Screndly Authentication

> **Simple guide: No signup, no email, just one password**

---

## 📖 Read This First!

### **This is NOT traditional email/password authentication**

**Traditional auth (like Gmail, Facebook):**
- ❌ Create account with email + password
- ❌ Verify email
- ❌ "Forgot password" sends email reset link
- ❌ User database with all accounts

**Screndly auth (what you have):**
- ✅ Admin sets ONE password in environment variable
- ✅ Anyone with that password can login
- ✅ No email, no signup, no user accounts
- ✅ No database needed

**It's like:** The password to your phone lock screen. One password, protects everything.

---

## 🚀 Getting Started (3 Steps)

### **Step 1: Set Your Password**

Create a file called `.env.local` in your project folder:

```bash
# Generate a random secret
JWT_SECRET=Kx9mP2nQ7rS8tU5vW6xY1zA3bC4dE7fG9hJ0kL2mN5o=

# Choose your login password (this is what you'll type to login)
APP_PASSWORD=MySecurePassword123!
```

**Where to get `JWT_SECRET`?**
```bash
# Run this in terminal:
openssl rand -base64 32

# Copy the output
```

**What is `APP_PASSWORD`?**
- This is YOUR password to login
- Choose anything you want (e.g., `Screndly2025!`)
- Use 12+ characters with letters, numbers, symbols

---

### **Step 2: Install & Run**

```bash
npm install
npm run dev
```

---

### **Step 3: Login**

1. Open http://localhost:5173
2. You'll see the Screndly login screen
3. **Enter the password** you set in `APP_PASSWORD`
4. Click "Sign in"
5. ✅ **You're in!** Logged in for 7 days

**That's it!** No email, no signup, just password.

---

## ❓ Your Questions Answered

### **Q: How do I sign up?**

**A: You don't!** There's no signup process.

**Instead:**
1. You (the admin) set the password in `.env.local`
2. That's it! Now you can login with that password

**Example:**
```bash
# In .env.local
APP_PASSWORD=Screndly2025!

# Now login with: Screndly2025!
```

---

### **Q: Do I need an email?**

**A: No!** No email required.

**Your login screen:**
- ~~Email field~~ (removed)
- ✅ Password field (enter your `APP_PASSWORD`)
- ✅ "Keep me signed in" checkbox
- ✅ Sign in button

**Just enter your password and you're in.**

---

### **Q: What happens when I forget the password?**

**A: Just check `.env.local` file!**

Since you're the admin, the password is right there:

```bash
# Check your password
cat .env.local

# You'll see:
# APP_PASSWORD=MySecurePassword123!
```

**Or change it:**
```bash
# Edit .env.local
APP_PASSWORD=NewPassword456!

# Restart server
npm run dev

# Login with new password
```

---

### **Q: How long am I logged in?**

**A: 7 days**

**Timeline:**
- Day 1: Login with password → Logged in
- Day 2-7: Auto-login (no password needed)
- Day 8: Session expired → Enter password again

**"Keep me signed in" checkbox:**
- Currently just for show (all sessions are 7 days)
- Can be customized later if needed

---

### **Q: What if I enter wrong password?**

**A: You get 5 attempts:**

```
Attempt 1: ❌ "Invalid password (4 attempts remaining)"
Attempt 2: ❌ "Invalid password (3 attempts remaining)"
Attempt 3: ❌ "Invalid password (2 attempts remaining)" + ⚠️ WARNING
Attempt 4: ❌ "Invalid password (1 attempt remaining)" + ⚠️ WARNING
Attempt 5: 🚫 LOCKED for 15 minutes
```

**After 5 wrong attempts:**
- Wait 15 minutes
- OR restart dev server: `npm run dev` (dev only)

---

### **Q: Can I share the password with someone?**

**A: Yes!** Since it's a single-password system:

- ✅ Anyone with the password can login
- ✅ Great for team members
- ✅ Just share `APP_PASSWORD` with them

**Security tip:** Use a strong password and only share with trusted people.

---

### **Q: How do I logout?**

**A: Go to Settings → Account → Logout**

Or use this in your code:
```typescript
import { logout } from './lib/auth';

// Call logout
logout(); // Clears token and reloads page
```

---

## 🖥️ Production Deployment

### **Vercel Setup:**

1. **Add environment variables in Vercel:**
   - Go to Vercel Dashboard
   - Settings → Environment Variables
   - Add `JWT_SECRET` (from your `.env.local`)
   - Add `APP_PASSWORD` (from your `.env.local`)

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Redeploy after adding variables:**
   - Deployments → Redeploy

4. **Test:**
   - Visit your Vercel URL
   - Login with `APP_PASSWORD`

---

## 🔒 Security Explained

### **Is this secure?**

**YES!** Despite being simple, it's very secure:

✅ **Password validated server-side** (not in browser code)  
✅ **JWT tokens** (cryptographically signed, can't be faked)  
✅ **Rate limiting** (5 attempts max, prevents hacking)  
✅ **Sessions expire** (7 days, then re-login)  
✅ **HTTPS in production** (Vercel enforces SSL)  

### **What's protected:**

- ✅ Entire app (all pages)
- ✅ All features
- ✅ All data
- ✅ All settings

### **What's NOT protected:**

- ⚠️ If someone knows your password, they can login (that's by design)
- ⚠️ For multi-user with individual accounts, you'd need a different system

---

## 🎨 What Changed in Your App

### **Your LoginPage.tsx:**

**Before:**
```typescript
// Had email + password fields
// Mock login (no real validation)
```

**After:**
```typescript
// Only password field (no email)
// Real server-side validation
// JWT token storage
// Rate limiting warnings
// Error handling with toasts
```

**Everything else stayed the same:**
- ✅ Your Screndly logo
- ✅ Dark mode support
- ✅ Haptic feedback
- ✅ Show/hide password button
- ✅ "Keep me signed in" checkbox
- ✅ Terms/Privacy/Disclaimer links

---

## 📋 Complete Example

### **Setup (.env.local):**

```bash
JWT_SECRET=Kx9mP2nQ7rS8tU5vW6xY1zA3bC4dE7fG9hJ0kL2mN5o=
APP_PASSWORD=Screndly2025!SecurePass
```

### **Login Process:**

```
1. Visit http://localhost:5173
2. See Screndly login screen
3. Password field shows: "Enter your password"
4. Type: Screndly2025!SecurePass
5. Click "Sign in"
6. ✅ "Welcome to Screndly!" toast appears
7. Redirected to dashboard
8. Token stored (valid for 7 days)
```

### **Next Time:**

```
1. Visit http://localhost:5173
2. "Verifying authentication..." (2 seconds)
3. ✅ Auto-login! Straight to dashboard
4. No password needed
```

---

## 🛠️ Customization

### **Change Session Duration:**

```typescript
// Edit /api/auth/login.ts
const JWT_EXPIRY = '7d'; // Change to '1d', '30d', '12h', etc.
```

### **Change Rate Limit:**

```typescript
// Edit /api/auth/login.ts
const MAX_ATTEMPTS = 5; // Change to 3, 10, etc.
const LOCKOUT_DURATION = 15 * 60 * 1000; // Change to 5min, 30min, etc.
```

### **Change Password:**

```bash
# Local: Edit .env.local
APP_PASSWORD=NewPassword

# Production: Vercel Dashboard → Env Variables → Edit APP_PASSWORD
```

---

## 📚 Full Documentation

- **Quick Start:** `/docs/AUTH_QUICK_START.md` (5-minute setup)
- **FAQ:** `/docs/AUTH_FAQ.md` (All your questions)
- **Setup Guide:** `/docs/AUTHENTICATION_SETUP.md` (Detailed setup)
- **Architecture:** `/docs/AUTH_ARCHITECTURE.md` (Technical details)
- **Implementation:** `/docs/SECURE_AUTH_IMPLEMENTATION.md` (For developers)

---

## ✅ Summary

**What You Need to Know:**

1. **No signup** - Set password in `.env.local`
2. **No email** - Just password field
3. **One password** - For everyone (perfect for single user)
4. **7 days** - Session length, then re-login
5. **5 attempts** - Rate limit, then 15-min lockout
6. **Very secure** - Server validation, JWT tokens, HTTPS

**Quick Start:**
```bash
# 1. Create .env.local with password
# 2. npm install
# 3. npm run dev
# 4. Login with your password
```

**That's it!** 🎉

---

**Still confused?** Read `/docs/AUTH_FAQ.md` - it answers EVERY question in detail.

**Ready to start?** Run `npm run dev` and login with your `APP_PASSWORD`! 🚀
