# Deployment Guide for Screndly

**Last Updated**: December 30, 2024

This guide covers deploying Screndly to various hosting platforms with PWA support.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Build Configuration](#build-configuration)
3. [Deployment Platforms](#deployment-platforms)
   - [Netlify](#netlify-recommended)
   - [Vercel](#vercel)
   - [GitHub Pages](#github-pages)
   - [Render](#render)
   - [AWS S3 + CloudFront](#aws-s3--cloudfront)
4. [Environment Variables](#environment-variables)
5. [PWA Configuration](#pwa-configuration)
6. [Post-Deployment](#post-deployment)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before deploying, ensure:

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No linting errors (`npm run lint`)
- [ ] Environment variables configured
- [ ] Service worker configured correctly
- [ ] Manifest.json has correct URLs
- [ ] Icons generated for all sizes
- [ ] Meta tags configured for SEO
- [ ] Analytics configured (if needed)
- [ ] Error tracking configured (if needed)

---

## Build Configuration

### Build Command

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Preview Build Locally

```bash
npm run preview
```

Test the production build locally at `http://localhost:4173`

### Build Output

```
dist/
├── index.html
├── manifest.json
├── sw.js
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── [other chunks]
├── icons/
│   └── [all PWA icons]
└── screenshots/
    └── [PWA screenshots]
```

---

## Deployment Platforms

### Netlify (Recommended)

**Best for**: Fast deployment, automatic HTTPS, custom domains, free tier

#### Deploy via UI

1. **Push to GitHub**:
   ```bash
   git push origin main
   ```

2. **Connect to Netlify**:
   - Go to [Netlify](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Configure build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
     - **Node version**: 18.x

3. **Deploy**:
   - Click "Deploy site"
   - Wait for build to complete
   - Your site is live!

#### Deploy via CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize project
netlify init

# Deploy
netlify deploy --prod
```

#### Netlify Configuration

Create `netlify.toml` in root:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  
[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/manifest.json"
  [headers.values]
    Content-Type = "application/manifest+json"
    Cache-Control = "public, max-age=86400"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "no-referrer"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

---

### Vercel

**Best for**: Next-level DX, instant deployments, edge functions

#### Deploy via UI

1. **Push to GitHub**:
   ```bash
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [Vercel](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure:
     - **Framework Preset**: Vite
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`

3. **Deploy**:
   - Click "Deploy"
   - Your site is live!

#### Deploy via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

#### Vercel Configuration

Create `vercel.json` in root:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/manifest+json"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=86400"
        }
      ]
    },
    {
      "source": "/(.*).js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*).css",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

### GitHub Pages

**Best for**: Free hosting for public repos, simple setup

#### Setup GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v3
```

#### Configure GitHub Pages

1. Go to repository Settings → Pages
2. Source: GitHub Actions
3. Push to main branch
4. Your site will be at `https://[username].github.io/[repo]`

#### Update Vite Config for Base Path

```typescript
// vite.config.ts
export default defineConfig({
  base: '/screndly/', // Replace with your repo name
  // ... rest of config
});
```

---

### Render

**Best for**: Simple deployment, automatic SSL, free tier

#### Deploy via UI

1. **Push to GitHub**:
   ```bash
   git push origin main
   ```

2. **Create Web Service**:
   - Go to [Render](https://render.com)
   - Click "New +" → "Static Site"
   - Connect your GitHub repository
   - Configure:
     - **Build Command**: `npm run build`
     - **Publish Directory**: `dist`

3. **Deploy**:
   - Click "Create Static Site"
   - Your site is live!

#### Render Configuration

Create `render.yaml` in root:

```yaml
services:
  - type: web
    name: screndly
    env: static
    buildCommand: npm run build
    staticPublishPath: dist
    headers:
      - path: /*
        name: X-Frame-Options
        value: DENY
      - path: /*
        name: X-Content-Type-Options
        value: nosniff
      - path: /sw.js
        name: Cache-Control
        value: public, max-age=0, must-revalidate
      - path: /manifest.json
        name: Cache-Control
        value: public, max-age=86400
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

---

### AWS S3 + CloudFront

**Best for**: Enterprise deployments, full control, scalability

#### 1. Create S3 Bucket

```bash
aws s3 mb s3://screndly-app --region us-east-1
```

#### 2. Configure Bucket for Static Website

```bash
aws s3 website s3://screndly-app --index-document index.html --error-document index.html
```

#### 3. Upload Build

```bash
npm run build
aws s3 sync dist/ s3://screndly-app --delete
```

#### 4. Create CloudFront Distribution

```bash
aws cloudfront create-distribution \
  --origin-domain-name screndly-app.s3-website-us-east-1.amazonaws.com \
  --default-root-object index.html
```

#### 5. Configure Cache Behavior

- **Service Worker** (`/sw.js`): No cache
- **Manifest** (`/manifest.json`): 24 hours
- **Assets** (`/assets/*`): 1 year
- **HTML** (`/index.html`): No cache

#### Automated Deployment Script

Create `deploy-aws.sh`:

```bash
#!/bin/bash
set -e

echo "Building application..."
npm run build

echo "Uploading to S3..."
aws s3 sync dist/ s3://screndly-app --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" \
  --exclude "sw.js" \
  --exclude "manifest.json"

# Upload special files with specific cache control
aws s3 cp dist/index.html s3://screndly-app/index.html \
  --cache-control "public, max-age=0, must-revalidate"

aws s3 cp dist/sw.js s3://screndly-app/sw.js \
  --cache-control "public, max-age=0, must-revalidate"

aws s3 cp dist/manifest.json s3://screndly-app/manifest.json \
  --cache-control "public, max-age=86400"

echo "Creating CloudFront invalidation..."
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"

echo "Deployment complete!"
```

---

## Environment Variables

### Development (`.env.development`)

```env
# API Configuration
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# Feature Flags
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_PWA=true
VITE_ENABLE_ANALYTICS=false

# Debug
VITE_DEBUG_MODE=true
```

### Production (`.env.production`)

```env
# API Configuration
VITE_API_URL=https://api.screndly.com
VITE_WS_URL=wss://api.screndly.com

# Feature Flags
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_PWA=true
VITE_ENABLE_ANALYTICS=true

# Analytics
VITE_GA_ID=G-XXXXXXXXXX

# Debug
VITE_DEBUG_MODE=false
```

### Setting Environment Variables

**Netlify**:
- Go to Site settings → Build & deploy → Environment
- Add variables with `VITE_` prefix

**Vercel**:
- Go to Project settings → Environment Variables
- Add variables with `VITE_` prefix

**GitHub Actions**:
```yaml
env:
  VITE_API_URL: ${{ secrets.API_URL }}
```

---

## PWA Configuration

### Manifest.json

Ensure `/public/manifest.json` has correct URLs:

```json
{
  "name": "Screndly - Screen Render Automation",
  "short_name": "Screndly",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#ec1e24",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Service Worker

Service worker is in `/public/sw.js` and includes:
- Core asset caching
- Runtime caching strategies
- Cache expiration
- Background sync support

### PWA Icons

Generate icons for all required sizes:

```bash
# Required sizes
72×72, 96×96, 128×128, 144×144, 152×152, 192×192, 384×384, 512×512

# Maskable icons
192×192, 512×512
```

Use tools like:
- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)

---

## Post-Deployment

### 1. Test PWA Features

```bash
# Open Chrome DevTools
# Application tab → Manifest
# Check manifest loads correctly

# Application tab → Service Workers
# Verify service worker is registered

# Lighthouse audit
npm run lighthouse
```

### 2. Test Installation

1. **Desktop**:
   - Chrome: Click install button in address bar
   - Edge: Same as Chrome
   - Safari: Not supported

2. **Mobile**:
   - Android Chrome: "Add to Home Screen"
   - iOS Safari: Share → "Add to Home Screen"

### 3. Test Offline Functionality

1. Open app
2. Open DevTools → Network
3. Check "Offline" checkbox
4. Reload page
5. Verify UI loads from cache

### 4. Test Push Notifications

1. Grant notification permission
2. Trigger a test notification
3. Verify notification appears

### 5. Verify Custom Domain (if applicable)

```bash
# DNS propagation check
nslookup screndly.com

# SSL certificate check
openssl s_client -connect screndly.com:443
```

---

## Monitoring & Maintenance

### Performance Monitoring

**Google Analytics 4**:
```typescript
// Add to index.html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

**Sentry (Error Tracking)**:
```typescript
// Add to App.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 1.0,
});
```

### Uptime Monitoring

- [UptimeRobot](https://uptimerobot.com)
- [Pingdom](https://www.pingdom.com)
- [StatusCake](https://www.statuscake.com)

### Logs

**Netlify**: Netlify Dashboard → Functions → Logs

**Vercel**: Vercel Dashboard → Deployments → Logs

**Render**: Render Dashboard → Logs

### Updates

1. **Service Worker Updates**:
   - Increment `CACHE_NAME` in `sw.js`
   - Users will auto-update on next visit

2. **Application Updates**:
   - Push to main branch
   - CI/CD auto-deploys
   - Service worker handles cache invalidation

---

## Troubleshooting

### Issue: Service Worker Not Registering

**Solution**:
```javascript
// Check service worker registration in console
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Registered service workers:', registrations);
});
```

### Issue: Manifest Not Loading

**Solution**:
- Check `<link rel="manifest" href="/manifest.json">` in HTML
- Verify manifest.json is in public directory
- Check network tab for 404 errors

### Issue: Icons Not Showing

**Solution**:
- Verify all icon paths in manifest.json
- Ensure icons exist in `/public/icons/`
- Check icon sizes match manifest

### Issue: App Not Installing

**Solution**:
- Run Lighthouse audit
- Check PWA criteria:
  - [ ] HTTPS enabled
  - [ ] Service worker registered
  - [ ] Manifest with icons
  - [ ] Responsive design
  - [ ] Offline fallback

### Issue: Offline Mode Not Working

**Solution**:
- Check service worker cache strategy
- Verify core assets are cached
- Test in DevTools offline mode
- Clear cache and retry

### Issue: Push Notifications Not Working

**Solution**:
- Verify notification permission granted
- Check VAPID keys configured
- Test in supported browser (Chrome, Firefox)
- Check service worker message handler

---

## CI/CD Examples

### GitHub Actions (Complete)

```yaml
name: Deploy Screndly

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: './dist'
          production-branch: main
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Deploy from GitHub Actions"
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

---

## Security Best Practices

### Content Security Policy

Add to `index.html`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.screndly.com wss://api.screndly.com;
">
```

### Security Headers

Configure in hosting platform:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## Performance Optimization

### Bundle Analysis

```bash
# Analyze bundle size
npm run build -- --mode production
npx vite-bundle-visualizer
```

### Lazy Loading

All pages are lazy-loaded in `/components/AppContent.tsx`:

```typescript
const VideoStudioPage = lazy(() => import('./VideoStudioPage'));
```

### Code Splitting

Vite automatically code-splits by route and dynamic imports.

### Image Optimization

- Use WebP format
- Provide multiple sizes
- Lazy load below-the-fold images
- Use `loading="lazy"` attribute

---

## Rollback Procedure

### Netlify/Vercel

1. Go to Deployments
2. Find previous successful deployment
3. Click "Publish deploy"

### GitHub Pages

```bash
git revert HEAD
git push origin main
```

### AWS S3

```bash
# Restore from backup
aws s3 sync s3://screndly-app-backup/ s3://screndly-app/
```

---

## Additional Resources

- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [PWA Builder](https://www.pwabuilder.com/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)

---

**Happy Deploying!** 🚀