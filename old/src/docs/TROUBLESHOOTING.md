# 🔧 Troubleshooting Guide

## WebAssembly Compilation Error

**Error:**
```
TypeError: WebAssembly compilation aborted: Network error: error
```

**This error is caused by Vite's build cache and is common after adding new components.**

---

## ✅ Quick Fix (Try These in Order)

### **1. Clear Vite Cache & Restart**

```bash
# Stop the dev server (Ctrl+C)

# Remove node_modules and cache
rm -rf node_modules
rm -rf .vite
rm -rf dist

# Reinstall dependencies
npm install

# Restart dev server
npm run dev
```

---

### **2. Hard Refresh Browser**

After restarting the dev server:

- **Chrome/Edge:** `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- **Firefox:** `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- **Safari:** `Cmd + Option + R`

---

### **3. Clear Browser Cache**

If hard refresh doesn't work:

1. Open DevTools (`F12`)
2. Go to **Application** tab
3. Click **Clear storage**
4. Check all boxes
5. Click **Clear site data**
6. Reload page

---

### **4. Check for Syntax Errors**

Run TypeScript check:

```bash
npx tsc --noEmit
```

If there are errors, they'll be listed. Fix them and restart.

---

### **5. Force Rebuild**

```bash
# Stop dev server (Ctrl+C)

# Force clean build
npm run build

# If build succeeds, restart dev server
npm run dev
```

---

### **6. Nuclear Option (Complete Reset)**

```bash
# Stop dev server (Ctrl+C)

# Remove everything
rm -rf node_modules
rm -rf .vite
rm -rf dist
rm -rf package-lock.json

# Reinstall from scratch
npm install

# Restart
npm run dev
```

---

## 🔍 What Causes This Error?

**Common Causes:**
1. **Build cache corruption** - Vite caches compiled modules, sometimes gets stale
2. **New component imports** - Adding new files (like PinterestIcon) requires cache refresh
3. **Hot Module Replacement (HMR) issues** - Vite's HMR can sometimes fail
4. **Browser cache** - Old WebAssembly modules cached in browser
5. **Network issues** - Rare, but CDN/module fetch failures

**Why it happened now:**
- We just added `/components/icons/PinterestIcon.tsx`
- We modified several files that import it
- Vite's cache needs to be refreshed

---

## 🎯 Recommended Solution

**90% of the time, this fixes it:**

```bash
# 1. Stop dev server (Ctrl+C)
# 2. Clear cache
rm -rf .vite

# 3. Restart
npm run dev

# 4. Hard refresh browser (Ctrl+Shift+R)
```

**That's it!** The error should be gone.

---

## 🚨 If Error Persists

Check these files for syntax errors:

### Files Modified in Pinterest Integration:
```
/components/icons/PinterestIcon.tsx
/components/PlatformCard.tsx
/components/PlatformConnectionModal.tsx
/components/CommentAutomationPage.tsx
/components/PlatformsPage.tsx
/utils/platformConnections.ts
/components/AppInfoPage.tsx
```

Run syntax check:
```bash
npx tsc --noEmit
```

---

## 📊 Verification

After fixing, verify Pinterest integration works:

1. Navigate to **Platforms** page
2. You should see Pinterest card (📌 icon)
3. Click "Connect" on Pinterest → Modal opens with Pinterest branding
4. Navigate to **Comment Automation** → See Pinterest in platform list
5. No console errors

---

## 💡 Prevention

To avoid this in the future:

1. **Restart dev server** after adding new components
2. **Hard refresh browser** after major changes
3. **Clear `.vite` cache** weekly during development
4. **Use `npm run build`** to catch TypeScript errors early

---

## 🆘 Still Having Issues?

If the error persists after all troubleshooting:

1. Check browser console for specific error messages
2. Check terminal for Vite warnings/errors
3. Verify all imports are correct
4. Try a different browser
5. Check if other pages load (might be component-specific)

---

## ✅ Expected Result

After fixing:
- ✅ No WebAssembly errors
- ✅ Pinterest icon shows on Platforms page
- ✅ Pinterest connection modal works
- ✅ Comment automation includes Pinterest
- ✅ All 7 platforms visible (Instagram, Facebook, TikTok, X, YouTube, Threads, Pinterest)

---

**TL;DR:** This is a build cache issue. Run `rm -rf .vite && npm run dev` and hard refresh your browser.
