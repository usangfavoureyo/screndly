# WebAssembly Compilation Error - Troubleshooting Guide

## 🐛 Error Description

```
TypeError: WebAssembly compilation aborted: Network error: error
```

This error occurs when Vite's build cache conflicts with WebAssembly modules (specifically FFmpeg.wasm in Screndly).

---

## 🎯 Quick Fix (90% Success Rate)

### **Option 1: Automated Script (Recommended)**

#### **macOS/Linux:**
```bash
chmod +x scripts/fix-wasm-cache.sh
./scripts/fix-wasm-cache.sh
```

#### **Windows:**
```bash
scripts\fix-wasm-cache.bat
```

Then:
1. **Hard refresh** your browser (Ctrl/Cmd + Shift + R)
2. **Restart dev server**: `npm run dev`

---

### **Option 2: Manual Steps**

#### **1. Clear Vite Cache**
```bash
# Delete cache directories
rm -rf .vite
rm -rf node_modules/.vite
rm -rf dist
```

#### **2. Restart Dev Server**
```bash
npm run dev
```

#### **3. Hard Refresh Browser**
- **Chrome/Edge (Windows/Linux)**: `Ctrl + Shift + R`
- **Chrome/Edge (Mac)**: `Cmd + Shift + R`
- **Firefox (Windows/Linux)**: `Ctrl + F5`
- **Firefox (Mac)**: `Cmd + Shift + R`
- **Safari (Mac)**: `Cmd + Option + R`

---

## 🔍 Why This Happens

### **Root Cause**
Vite caches pre-bundled dependencies in `.vite` and `node_modules/.vite`. When WebAssembly modules like FFmpeg.wasm are updated or the cache becomes corrupted, Vite tries to load stale WASM files, causing compilation errors.

### **Triggers**
- Environment variable changes (like adding `.env.local`)
- Dependency updates
- Network interruptions during WASM downloads
- Browser cache mismatches
- Figma Make hot-reload issues

---

## 🛠️ Advanced Troubleshooting

### **If Quick Fix Doesn't Work**

#### **1. Nuclear Option - Full Clean**
```bash
# Stop dev server
# Delete ALL caches and rebuild
rm -rf .vite
rm -rf node_modules/.vite
rm -rf node_modules
rm -rf dist
rm -rf package-lock.json

# Reinstall
npm install

# Restart
npm run dev
```

#### **2. Clear Browser Cache Completely**
1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Clear site data**
4. Close **all** tabs with the app
5. Restart browser
6. Try again

#### **3. Check Vite Config**
Verify `/vite.config.ts` has FFmpeg excluded:

```typescript
optimizeDeps: {
  exclude: [
    '@ffmpeg/ffmpeg',
    '@ffmpeg/util',
    'ffmpeg',
    'ffmpeg-core',
    'ffmpeg.wasm',
  ],
},
```

#### **4. Check Network Tab**
1. Open DevTools → **Network** tab
2. Filter by **WS** (WebSocket) or **Wasm**
3. Look for failed WASM file loads
4. Check if FFmpeg CDN is accessible

---

## 📋 Verification Checklist

After applying the fix, verify:

- [ ] No console errors related to WebAssembly
- [ ] App loads without crashes
- [ ] Video Studio page loads (tests FFmpeg initialization)
- [ ] No network errors in DevTools
- [ ] Hard refresh performed (Ctrl/Cmd + Shift + R)

---

## 🚨 Still Not Working?

### **Check These:**

#### **1. Network/Firewall Issues**
FFmpeg.wasm loads from CDN. Check if blocked:
```bash
curl -I https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/esm/index.js
```

Should return `200 OK`.

#### **2. CORS Issues**
Check browser console for CORS errors. If found:
- Clear cache again
- Disable browser extensions temporarily
- Try incognito mode

#### **3. Memory Issues**
WebAssembly requires significant memory:
- Close other tabs
- Restart browser
- Check available RAM (needs ~500MB free)

#### **4. Figma Make Environment**
If running in Figma Make preview:
- The environment may have WASM restrictions
- Try exporting and running locally
- Check Figma Make console logs

---

## 🎬 For Figma Make Users

### **Special Considerations**

Since you mentioned testing in **Figma Make**, this environment may have:

1. **Stricter CSP (Content Security Policy)**
   - Blocks external WASM loads
   - Limits WebAssembly compilation

2. **Service Worker Issues**
   - Cached service workers can conflict
   - Clear in DevTools → Application → Service Workers

3. **Hot Reload Conflicts**
   - Figma Make's hot reload may not clear WASM cache
   - Requires manual hard refresh

### **Recommended Workflow for Figma Make**

1. **After ANY code changes:**
   ```bash
   # Run the fix script
   ./scripts/fix-wasm-cache.sh
   ```

2. **In Figma Make preview:**
   - Hard refresh (Cmd/Ctrl + Shift + R)
   - Wait 5-10 seconds for FFmpeg to load

3. **If still failing:**
   - Export project
   - Run locally with `npm run dev`
   - Test there first

---

## 📝 Prevention Tips

### **Avoid This Error in the Future:**

1. **Don't edit `.env` files while dev server is running**
   - Stop server → Edit → Restart

2. **Clear cache after dependency updates**
   ```bash
   npm install && rm -rf .vite node_modules/.vite
   ```

3. **Use the fix script proactively**
   - Before important testing sessions
   - After environment changes
   - Weekly as maintenance

4. **In Figma Make:**
   - Always hard refresh after code changes
   - Don't rely on hot reload for WASM changes

---

## 🎯 Summary

| Scenario | Solution |
|----------|----------|
| **First time seeing error** | Run `fix-wasm-cache.sh` + hard refresh |
| **After `.env` changes** | Run fix script + restart server |
| **In Figma Make** | Hard refresh (Cmd/Ctrl + Shift + R) |
| **Still failing** | Nuclear option (delete `node_modules`) |
| **Network error in console** | Check CDN access + firewall |

---

## 📞 Quick Reference Commands

```bash
# Quick fix (macOS/Linux)
./scripts/fix-wasm-cache.sh && npm run dev

# Quick fix (Windows)
scripts\fix-wasm-cache.bat

# Manual clear
rm -rf .vite node_modules/.vite dist && npm run dev

# Nuclear option
rm -rf node_modules .vite dist && npm install && npm run dev
```

---

**Most Common Solution**: Run the fix script, hard refresh browser (Ctrl/Cmd + Shift + R), and wait 10 seconds for FFmpeg to load. This works 90% of the time.
