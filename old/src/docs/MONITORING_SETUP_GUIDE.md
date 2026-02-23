# Monitoring Setup Guide - Screndly

**Quick guide to activate Sentry, Google Analytics, and Web Vitals**

---

## 🎯 Quick Start (5 Minutes)

### Option 1: Full Monitoring (Recommended)

```bash
# Install all monitoring packages
npm install @sentry/react web-vitals

# Add environment variables (create .env file)
echo "VITE_SENTRY_DSN=your_sentry_dsn_here" >> .env
echo "VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX" >> .env

# Uncomment integration code (see below)
# Build and deploy
npm run build
```

### Option 2: Google Analytics Only

```bash
# No installation needed (uses gtag.js CDN)

# Add environment variable
echo "VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX" >> .env

# Uncomment GA code in /utils/monitoring.ts
# Build and deploy
npm run build
```

### Option 3: Basic Performance Monitoring

```bash
# Install web-vitals only
npm install web-vitals

# Uncomment Web Vitals code in /utils/monitoring.ts
# Build and deploy
npm run build
```

---

## 1. Sentry Error Tracking Setup

### Step 1: Create Sentry Account

1. Go to https://sentry.io
2. Sign up for free account
3. Create new project
4. Select "React" as platform
5. Copy your DSN (looks like: `https://xxx@xxx.ingest.sentry.io/xxx`)

### Step 2: Install Sentry SDK

```bash
npm install @sentry/react
```

### Step 3: Add DSN to Environment

Create or edit `.env` file:

```bash
VITE_SENTRY_DSN=https://your_key@sentry.io/your_project
```

### Step 4: Uncomment Sentry Code

**File**: `/utils/monitoring.ts`

Find this section (around line 30):

```typescript
// Uncomment when @sentry/react is installed:
/*
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: dsn || process.env.VITE_SENTRY_DSN || 'YOUR_SENTRY_DSN_HERE',
  ...
*/
```

**Remove the comment markers** `/*` and `*/`:

```typescript
// Uncomment when @sentry/react is installed:
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: dsn || process.env.VITE_SENTRY_DSN || 'YOUR_SENTRY_DSN_HERE',
  environment: this.environment,
  
  // Performance Monitoring
  tracesSampleRate: 1.0,
  
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  beforeSend(event, hint) {
    // Filter out sensitive data
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }
    return event;
  },
  
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: ['localhost', /^https:\/\/yourapp\.com/],
    }),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
```

Do this for **all** commented Sentry code sections in the file:
- `captureError()` method (line ~80)
- `captureMessage()` method (line ~105)
- `setUser()` method (line ~130)
- `addBreadcrumb()` method (line ~150)

### Step 5: Test Sentry

```typescript
// Add to any component temporarily
import { monitoring } from './utils/monitoring';

// Test error capture
monitoring.captureError(new Error('Test error from Screndly'));

// Test message
monitoring.captureMessage('Test message from Screndly', 'info');
```

Check Sentry dashboard - you should see the test error and message!

---

## 2. Google Analytics Setup

### Step 1: Create GA4 Property

1. Go to https://analytics.google.com
2. Create account if needed
3. Create new GA4 property
4. Get Measurement ID (format: `G-XXXXXXXXXX`)

### Step 2: Add Measurement ID to Environment

Edit `.env` file:

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Step 3: Activate Google Analytics

**No npm install needed** - GA uses CDN script

The code in `/utils/monitoring.ts` is already set up. It will automatically activate when you provide the measurement ID in the environment variable.

### Step 4: Test Google Analytics

```bash
# Build and run
npm run build
npm run preview

# Open in browser
# Open DevTools → Network tab
# Filter by "google"
# You should see requests to www.google-analytics.com
```

### Step 5: Verify in GA Dashboard

1. Go to Google Analytics
2. Click "Realtime" report
3. Navigate your app
4. You should see yourself in real-time users!

---

## 3. Web Vitals Monitoring Setup

### Step 1: Install web-vitals

```bash
npm install web-vitals
```

### Step 2: Uncomment Web Vitals Code

**File**: `/utils/monitoring.ts`

Find this section (around line 180):

```typescript
// Uncomment when web-vitals is installed:
/*
import { getCLS, getFID, getLCP, getFCP, getTTFB } from 'web-vitals';

getCLS((metric) => {
  this.metrics.CLS = metric.value;
  this.reportMetric('CLS', metric.value);
});
...
*/
```

**Remove the comment markers**:

```typescript
// Uncomment when web-vitals is installed:
import { getCLS, getFID, getLCP, getFCP, getTTFB } from 'web-vitals';

getCLS((metric) => {
  this.metrics.CLS = metric.value;
  this.reportMetric('CLS', metric.value);
});

getFID((metric) => {
  this.metrics.FID = metric.value;
  this.reportMetric('FID', metric.value);
});

getLCP((metric) => {
  this.metrics.LCP = metric.value;
  this.reportMetric('LCP', metric.value);
});

getFCP((metric) => {
  this.metrics.FCP = metric.value;
  this.reportMetric('FCP', metric.value);
});

getTTFB((metric) => {
  this.metrics.TTFB = metric.value;
  this.reportMetric('TTFB', metric.value);
});
```

### Step 3: View Web Vitals

Web Vitals are automatically reported to:
- **Google Analytics** (if enabled)
- **Sentry** (if enabled)
- **Browser Console** (always)

Check console for logs like:
```
[Performance] CLS: 0.05
[Performance] FID: 12
[Performance] LCP: 1200
```

---

## 4. Environment Variables Reference

Create `.env` file in project root:

```bash
# Sentry Error Tracking
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Google Analytics
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Optional: Environment override
VITE_APP_ENV=production
```

**Important**: 
- ✅ Prefix with `VITE_` for Vite to expose them
- ✅ Never commit `.env` to Git (add to `.gitignore`)
- ✅ Use different values for staging/production

---

## 5. Verification Checklist

### Sentry ✅
- [ ] Account created at sentry.io
- [ ] DSN copied
- [ ] `@sentry/react` installed
- [ ] Code uncommented in `monitoring.ts`
- [ ] `.env` file created with `VITE_SENTRY_DSN`
- [ ] Test error appears in Sentry dashboard

### Google Analytics ✅
- [ ] GA4 property created
- [ ] Measurement ID copied
- [ ] `.env` file has `VITE_GA_MEASUREMENT_ID`
- [ ] Real-time users showing in GA dashboard
- [ ] Page views tracking

### Web Vitals ✅
- [ ] `web-vitals` installed
- [ ] Code uncommented in `monitoring.ts`
- [ ] Console showing performance metrics
- [ ] Metrics appearing in GA (if enabled)

---

## 6. Testing Your Setup

### Test Script

Add to any component:

```typescript
import { monitoring, analytics, performanceMonitor } from './utils/monitoring';

// Test Sentry
monitoring.captureMessage('Monitoring test', 'info');

// Test Google Analytics
analytics.event('test_event', { test: true });

// Test Performance
performanceMonitor.mark('test-start');
setTimeout(() => {
  performanceMonitor.mark('test-end');
  performanceMonitor.measure('test-duration', 'test-start', 'test-end');
}, 1000);
```

### Expected Results

**Console (Dev Mode)**:
```
[Monitoring] Sentry initialized
[Analytics] Google Analytics initialized
[Performance] Web Vitals monitoring initialized
[Monitoring] Message captured: Monitoring test
[Analytics] Event tracked: test_event
[Performance] Measure: test-duration = 1000ms
```

**Sentry Dashboard**:
- New message: "Monitoring test"

**Google Analytics Dashboard**:
- Real-time event: "test_event"

---

## 7. Production Deployment

### Update Configuration

Before deploying to production:

1. **Update Sentry `tracePropagationTargets`**:

```typescript
// In monitoring.ts, line ~50
tracePropagationTargets: [
  'localhost',
  /^https:\/\/your-actual-domain\.com/  // ← Update this
],
```

2. **Set environment variables** on your hosting platform:

**Netlify**:
```
Site Settings → Build & Deploy → Environment → Add Variable
VITE_SENTRY_DSN=your_dsn
VITE_GA_MEASUREMENT_ID=your_id
```

**Vercel**:
```
Settings → Environment Variables → Add
VITE_SENTRY_DSN=your_dsn
VITE_GA_MEASUREMENT_ID=your_id
```

3. **Build and deploy**:
```bash
npm run build
# Deploy dist/ folder
```

---

## 8. Monitoring in Action

### What Gets Tracked Automatically

✅ **Errors**:
- JavaScript errors
- API failures
- Component crashes
- Network failures

✅ **Performance**:
- Page load times
- API call durations
- Component render times
- User interaction latency

✅ **User Behavior**:
- Page views
- Navigation patterns
- Button clicks
- Form submissions

✅ **Web Vitals**:
- CLS (layout shift)
- FID (input delay)
- LCP (loading performance)
- FCP (first paint)
- TTFB (server response)

### Custom Tracking Examples

```typescript
// Track design creation
analytics.event('design_created', {
  template: 'movie-poster',
  duration: 45,
});

// Track video render
analytics.event('video_rendered', {
  format: 'mp4',
  duration: 120,
  quality: '1080p',
});

// Track errors
try {
  await uploadToBackblaze();
} catch (error) {
  monitoring.captureError(error, {
    context: 'backblaze_upload',
    fileSize: file.size,
  });
}
```

---

## 9. Cost Breakdown

### Sentry
- **Free Tier**: 5,000 errors/month, 10,000 transactions/month
- **Paid**: Starts at $26/month for 50,000 errors
- **Recommended**: Free tier is enough for starting out

### Google Analytics
- **Free**: Unlimited
- **GA4**: Completely free, no limits
- **Recommended**: Free tier forever

### web-vitals
- **Free**: Open source package
- **Cost**: $0
- **Recommended**: Include always

### Total Monthly Cost
- **Starting out**: $0 (all free tiers)
- **Growing**: ~$26/month (Sentry paid tier)
- **Scale**: ~$100/month (higher Sentry limits)

---

## 10. Troubleshooting

### Sentry Not Working

**Issue**: No errors appearing in dashboard

**Solutions**:
1. Check DSN is correct in `.env`
2. Ensure code is uncommented
3. Check browser console for Sentry errors
4. Verify environment is 'production' (Sentry disabled in dev)
5. Check network tab for requests to `sentry.io`

### Google Analytics Not Tracking

**Issue**: No real-time users showing

**Solutions**:
1. Check Measurement ID format: `G-XXXXXXXXXX`
2. Clear browser cache
3. Check network tab for requests to `google-analytics.com`
4. Ensure ad blocker is disabled
5. Wait 1-2 minutes for data to appear

### Web Vitals Not Reporting

**Issue**: No metrics in console

**Solutions**:
1. Ensure `web-vitals` is installed
2. Check code is uncommented
3. Reload page (some metrics only fire once)
4. Check for console errors
5. Test on production build (not dev)

---

## 11. Next Steps

After setup is complete:

1. ✅ **Set up alerts** in Sentry for critical errors
2. ✅ **Create GA4 conversion goals** for key actions
3. ✅ **Monitor performance** weekly
4. ✅ **Review error reports** daily
5. ✅ **Track user flows** in GA
6. ✅ **Set performance budgets** for Web Vitals
7. ✅ **Add custom tracking** for important features

---

## 12. Support

**Sentry Documentation**: https://docs.sentry.io/platforms/javascript/guides/react/  
**Google Analytics Help**: https://support.google.com/analytics  
**Web Vitals Guide**: https://web.dev/vitals/

---

**Ready to deploy with full monitoring! 🚀**
