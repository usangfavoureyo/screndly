# ⚡ Quick Fix: WebAssembly Error

## 🎯 The Error
```
TypeError: WebAssembly compilation aborted: Network error: error
```

## 🔧 The Solution (Choose One)

### **Option 1: NPM Command (Fastest)**
```bash
npm run fix-cache && npm run dev
```

Then **hard refresh** your browser:
- **Mac**: `Cmd + Shift + R`
- **Windows/Linux**: `Ctrl + Shift + R`

---

### **Option 2: Run Script**

#### **macOS/Linux:**
```bash
chmod +x scripts/fix-wasm-cache.sh
./scripts/fix-wasm-cache.sh
npm run dev
```

#### **Windows:**
```bash
scripts\fix-wasm-cache.bat
npm run dev
```

Then **hard refresh** browser.

---

### **Option 3: Manual (If Scripts Fail)**
```bash
# Delete cache folders
rm -rf .vite
rm -rf node_modules/.vite
rm -rf dist

# Restart dev server
npm run dev
```

Then **hard refresh** browser.

---

## 📋 Quick Checklist

After running fix:
- [ ] Dev server restarted
- [ ] Browser hard refreshed (Ctrl/Cmd + Shift + R)
- [ ] Waited 10 seconds for app to load
- [ ] Console shows no WebAssembly errors

---

## 🚨 Still Not Working?

Read full troubleshooting guide:
→ `/docs/WASM_ERROR_TROUBLESHOOTING.md`

Or try nuclear option:
```bash
rm -rf node_modules .vite dist
npm install
npm run dev
```

---

## 💡 Why This Happens

Vite caches compiled code. When you add `.env.local` or make environment changes, the cache becomes stale. This script clears it.

**Prevention**: Run `npm run fix-cache` after:
- Adding/editing `.env` files
- Updating dependencies
- Seeing any WASM errors

---

**Most Common Fix**: `npm run fix-cache && npm run dev` + hard refresh browser ✨
