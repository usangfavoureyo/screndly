# Screndly - Quick Test Guide
**Fast reference for testing the app**

---

## 🚀 Quick Start - Run All Tests

```bash
# 1. Install dependencies
npm install

# 2. Run automated tests
npm run test -- tests/comprehensive-verification.test.tsx

# OR use the bash script
chmod +x tests/run-comprehensive-test.sh
./tests/run-comprehensive-test.sh
```

---

## ✅ Recent Bug Fixes - Quick Verification

### 1. React Imports (VideoStudioPage) ✅
```bash
# Verify in code
grep -n "import React" components/VideoStudioPage.tsx
# Should show: import React, { useState, useEffect, useRef } from 'react';
```

**Manual Check:**
1. Open app
2. Navigate to Video Studio
3. Open browser console (F12)
4. Should see NO "React is not defined" errors

---

### 2. Sonner Toast Imports ✅
```bash
# Verify consistent pattern across all files
grep -r "import { toast } from 'sonner" components/
# All should use: import { toast } from 'sonner@2.0.3'
```

**Manual Check:**
1. Navigate to Video Studio
2. Try to upload a video
3. Toast should appear
4. No import errors in console

---

### 3. Input Focus Styling (#292929) ✅
**Quick Visual Check:**

1. Navigate to Settings → API Keys
2. Click on any input field
3. **Verify:** Border changes to grey `#292929`
4. **Verify:** Subtle ring appears

**DevTools Check:**
```javascript
// 1. Focus on any input
// 2. Open DevTools → Inspect element
// 3. Check computed styles:
//    border-color: #292929 ✅
//    box-shadow: includes #292929 ✅
```

---

### 4. Dual Backblaze B2 Buckets ✅
**Quick Visual Check:**

1. Navigate to Settings → API Keys
2. Scroll to Backblaze sections
3. **Verify:** Two separate sections:
   - "Backblaze B2 General Storage" (3 fields)
   - "Backblaze B2 Videos Bucket" (3 fields)

**DevTools Check:**
```javascript
// Open Console
// Check localStorage has 6 keys:

localStorage.getItem('backblazeKeyId')              // General
localStorage.getItem('backblazeApplicationKey')     // General
localStorage.getItem('backblazeBucketName')         // General

localStorage.getItem('backblazeVideosKeyId')        // Videos
localStorage.getItem('backblazeVideosApplicationKey') // Videos
localStorage.getItem('backblazeVideosBucketName')   // Videos
```

---

## 🔍 Quick Browser Console Tests

Open browser console and run:

```javascript
// 1. Check if app is running
console.log('App loaded:', document.querySelector('nav') !== null);

// 2. Check localStorage structure
console.log('Settings keys:', Object.keys(localStorage).filter(k => 
  k.includes('backblaze') || k.includes('youtube') || k.includes('api')
));

// 3. Check for React errors (should be empty)
console.log('No React errors:', 
  !document.body.textContent.includes('React is not defined')
);

// 4. Check dual bucket setup
console.log('Dual buckets configured:', {
  general: {
    keyId: !!localStorage.getItem('backblazeKeyId'),
    appKey: !!localStorage.getItem('backblazeApplicationKey'),
    bucket: !!localStorage.getItem('backblazeBucketName')
  },
  videos: {
    keyId: !!localStorage.getItem('backblazeVideosKeyId'),
    appKey: !!localStorage.getItem('backblazeVideosApplicationKey'),
    bucket: !!localStorage.getItem('backblazeVideosBucketName')
  }
});
```

---

## 📱 Quick Mobile Test

**Test responsive design:**

1. Open DevTools (F12)
2. Click device toolbar icon
3. Select device:
   - Mobile: iPhone SE (375x667)
   - Tablet: iPad (768x1024)
   - Desktop: Responsive (1920x1080)

**Verify:**
- ✅ Layout adapts
- ✅ All buttons accessible
- ✅ No horizontal scroll
- ✅ Text readable

---

## ⌨️ Quick Keyboard Test

**Test accessibility:**

1. Click in app
2. Press `Tab` repeatedly
3. **Verify:**
   - ✅ Focus moves through elements
   - ✅ Grey focus ring visible (#292929)
   - ✅ Logical tab order
   - ✅ Can activate buttons with Enter

---

## 🎨 Quick Theme Test

**Test dark/light mode:**

1. Navigate to Settings
2. Toggle theme
3. **Verify:**
   - ✅ Theme switches instantly
   - ✅ All text readable
   - ✅ Focus styling still visible (#292929)
   - ✅ No contrast issues

---

## 📊 Quick Performance Check

```javascript
// Open DevTools → Console
// Measure page load time

performance.measure('pageLoad', 'navigationStart');
console.log('Load time:', performance.getEntriesByName('pageLoad')[0].duration, 'ms');
// Should be < 3000ms
```

---

## 🧪 SEO Caption Validation - Quick Test

**Navigate to Video Studio:**

1. Scroll to Review/Releases/Scenes section
2. Enter caption with 119 characters
   - **Should show:** "Minimum 120 characters required"
3. Enter caption with 251 characters
   - **Should show:** "Maximum 250 characters allowed"
4. Enter caption with emoji: "Test 🎬"
   - **Should show:** "Emojis not allowed in SEO captions"

---

## 🐛 Common Issues Checklist

If tests fail, check:

- [ ] `npm install` completed successfully
- [ ] All dependencies installed
- [ ] No conflicting browser extensions
- [ ] Browser cache cleared
- [ ] DevTools console shows no errors
- [ ] Running latest code version

---

## 📚 Full Documentation

For comprehensive testing:
- **Automated Tests:** `/tests/comprehensive-verification.test.tsx`
- **Manual Tests:** `/tests/VISUAL_TEST_REPORT.md`
- **Test Summary:** `/docs/reports/TEST_EXECUTION_SUMMARY.md`
- **Manual Checklist:** `/tests/MANUAL_TEST_CHECKLIST.md`

---

## ✨ Quick Pass/Fail Criteria

### ✅ PASS if:
- App loads without errors
- All navigation works
- Focus styling is grey (#292929)
- Toast notifications appear
- Dual buckets configured separately
- No console errors

### ❌ FAIL if:
- Console shows errors
- Pages don't load
- Focus styling wrong color
- Toast imports broken
- Bucket credentials mixed
- React undefined errors

---

## 🎯 Critical User Flows - 2 Minute Test

**Quick smoke test:**

1. **Load App** (0:10)
   - Open app, verify loads

2. **Navigate** (0:20)
   - Click: Dashboard → Video Studio → Settings

3. **Focus Styling** (0:15)
   - Click any input in Settings
   - Verify grey (#292929) border

4. **Dual Buckets** (0:20)
   - Settings → API Keys
   - Verify two separate Backblaze sections

5. **Toast Test** (0:15)
   - Change a setting
   - Verify toast appears

6. **Video Studio** (0:20)
   - Navigate to Video Studio
   - Verify no errors in console

7. **Theme Toggle** (0:10)
   - Toggle dark/light mode
   - Verify works

8. **Keyboard Nav** (0:10)
   - Press Tab a few times
   - Verify focus ring visible

**Total Time:** ~2 minutes  
**If all pass:** ✅ App is healthy

---

## 📞 Quick Help

**Tests not running?**
```bash
npm install
npm run test -- --help
```

**App not loading?**
```bash
npm run dev
# Then open http://localhost:5173
```

**Need to rebuild?**
```bash
npm run build
```

---

**Last Updated:** December 9, 2025  
**Version:** 1.0
