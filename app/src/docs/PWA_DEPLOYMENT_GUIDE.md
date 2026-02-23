# PWA Deployment Guide for Screndly

## Overview

Screndly is now configured as a Progressive Web App (PWA). This guide explains how to deploy it with full PWA functionality.

## Current Status

✅ **Working in Development:**
- Install prompts (Chrome/Edge only in development)
- Push notifications
- Cache clearing
- Network status detection
- PWA settings UI

⏳ **Requires Production Deployment:**
- Service Worker (offline support)
- Full caching strategy
- Background sync
- Share target API

## Why Service Worker Doesn't Work in Figma Make

The Service Worker fails to register because:
1. **MIME Type Issue:** Files in `/public/` are served as `text/html` instead of `application/javascript`
2. **Security Requirements:** Service Workers require proper HTTPS and correct MIME types
3. **Development Environment:** Figma Make is a preview environment, not a production server

## Deployment Options

### Option 1: Static Site Hosting (Recommended)

Deploy to any static hosting service that properly serves file types:

#### **Vercel (Easiest)**
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Export your Screndly code from Figma Make

# 3. Create package.json if not exists
{
  "name": "screndly",
  "version": "1.0.0",
  "scripts": {
    "build": "vite build",
    "preview": "vite preview"
  }
}

# 4. Deploy
vercel

# 5. Service Worker will work automatically!
```

#### **Netlify**
```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Export your code

# 3. Create netlify.toml
[build]
  publish = "dist"
  command = "npm run build"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Content-Type = "application/javascript"

# 4. Deploy
netlify deploy --prod
```

#### **GitHub Pages**
```bash
# 1. Push code to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main

# 2. Enable GitHub Pages in repo settings

# 3. Add .github/workflows/deploy.yml
name: Deploy PWA
on:
  push:
    branches: [ main ]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Option 2: Custom Server

If you need a backend, deploy with proper MIME types:

#### **Express.js Example**
```javascript
const express = require('express');
const path = require('path');
const app = express();

// Serve static files with correct MIME types
app.use(express.static('dist', {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('/sw.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    if (filePath.endsWith('/manifest.json')) {
      res.setHeader('Content-Type', 'application/json');
    }
  }
}));

app.listen(3000, () => {
  console.log('Screndly running on http://localhost:3000');
});
```

## Files You Need

When deploying, ensure these files are in the correct locations:

### Required Files:
```
/
├── public/
│   ├── sw.js              (Service Worker)
│   ├── manifest.json      (PWA Manifest)
│   └── icons/             (App Icons - need to create)
│       ├── icon-72x72.png
│       ├── icon-96x96.png
│       ├── icon-128x128.png
│       ├── icon-144x144.png
│       ├── icon-152x152.png
│       ├── icon-192x192.png
│       ├── icon-384x384.png
│       ├── icon-512x512.png
│       ├── icon-maskable-192x192.png
│       └── icon-maskable-512x512.png
└── index.html             (Must link manifest)
```

### Update index.html

Add these tags to your `<head>` section:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Screndly - Screen Render Automation</title>
  
  <!-- PWA Meta Tags -->
  <meta name="description" content="Automation dashboard for movie/TV trailer downloading, posting, and engagement">
  <meta name="theme-color" content="#ec1e24">
  <link rel="manifest" href="/manifest.json">
  
  <!-- Apple Touch Icon -->
  <link rel="apple-touch-icon" href="/icons/icon-192x192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Screndly">
  
  <!-- Microsoft -->
  <meta name="msapplication-TileImage" content="/icons/icon-144x144.png">
  <meta name="msapplication-TileColor" content="#000000">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

## Creating App Icons

You need to create app icons in various sizes. Use these tools:

### Option A: Online Generator
1. Go to https://realfavicongenerator.net/
2. Upload your Screndly logo (minimum 512x512px)
3. Configure for PWA
4. Download and extract to `/public/icons/`

### Option B: ImageMagick (Command Line)
```bash
# Start with a 1024x1024 PNG logo
convert logo.png -resize 72x72 icon-72x72.png
convert logo.png -resize 96x96 icon-96x96.png
convert logo.png -resize 128x128 icon-128x128.png
convert logo.png -resize 144x144 icon-144x144.png
convert logo.png -resize 152x152 icon-152x152.png
convert logo.png -resize 192x192 icon-192x192.png
convert logo.png -resize 384x384 icon-384x384.png
convert logo.png -resize 512x512 icon-512x512.png
```

### Maskable Icons
For maskable icons (Android adaptive icons), add 20% padding:
```bash
convert logo.png -resize 80% -gravity center -extent 192x192 icon-maskable-192x192.png
convert logo.png -resize 80% -gravity center -extent 512x512 icon-maskable-512x512.png
```

## Testing Your PWA

### 1. Chrome DevTools
```
1. Open Chrome DevTools (F12)
2. Go to "Application" tab
3. Check:
   - Manifest: Should show all details
   - Service Workers: Should be registered
   - Cache Storage: Should show cached files
```

### 2. Lighthouse Audit
```
1. Open Chrome DevTools
2. Go to "Lighthouse" tab
3. Select "Progressive Web App"
4. Run audit
5. Aim for 100% PWA score
```

### 3. Mobile Testing
```
1. Deploy to production URL
2. Open in Chrome on Android or Safari on iOS
3. Look for "Install App" or "Add to Home Screen" prompt
4. Install and test
```

## PWA Checklist

Before deploying, ensure:

- [ ] Service Worker file (`sw.js`) served with correct MIME type
- [ ] Manifest file (`manifest.json`) is valid
- [ ] All icon sizes generated and in `/public/icons/`
- [ ] HTTPS enabled (required for PWA)
- [ ] Meta tags in `index.html`
- [ ] Service Worker registered in production
- [ ] Lighthouse PWA score > 90%

## Common Issues

### Issue: Service Worker Not Registering
**Solution:** Check browser console for MIME type errors. Ensure `sw.js` is served as `application/javascript`.

### Issue: Install Prompt Not Showing
**Solution:** 
- Must be HTTPS
- User must interact with page first
- Can't have dismissed prompt recently
- Must meet PWA criteria (manifest, service worker, etc.)

### Issue: Icons Not Showing
**Solution:** Check icon paths in `manifest.json` match actual file locations. Ensure icons are PNG format.

### Issue: Offline Mode Not Working
**Solution:** Service Worker must be registered. Test by:
1. Open app in production
2. Open DevTools > Application > Service Workers
3. Check "Offline" checkbox
4. Reload page - should still work

## Push Notifications Setup

To enable push notifications, you need VAPID keys:

```bash
# 1. Generate VAPID keys
npm install -g web-push
web-push generate-vapid-keys

# 2. Update /utils/pwa.ts
# Replace 'YOUR_VAPID_PUBLIC_KEY' with your public key

# 3. Store private key securely on your server
# Use it to send push notifications from backend
```

## Next Steps

1. **Export Code:** Download your Screndly code from Figma Make
2. **Create Icons:** Generate all required icon sizes
3. **Deploy:** Choose a hosting provider and deploy
4. **Test:** Run Lighthouse audit and mobile testing
5. **Submit:** (Optional) Submit to app stores via PWABuilder.com

## Resources

- [PWA Builder](https://www.pwabuilder.com/) - Package PWA for app stores
- [Workbox](https://developers.google.com/web/tools/workbox) - Advanced caching strategies
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest) - MDN docs
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) - MDN docs

## Support

If you need help deploying Screndly as a PWA, check the resources above or review the code in:
- `/utils/pwa.ts` - PWA utilities
- `/public/sw.js` - Service Worker
- `/public/manifest.json` - App manifest
- `/components/settings/PWASettings.tsx` - Settings UI

---

**Note:** The PWA features are fully implemented in the code and will work automatically once deployed to a proper hosting environment with HTTPS and correct MIME types.
