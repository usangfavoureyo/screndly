# X (Twitter) Setup Guide for Screndly

Complete guide for setting up X integration with video upload support.

## Prerequisites

- An X (Twitter) account
- Access to X Developer Portal
- Basic understanding of OAuth 2.0
- X API access tier (Free, Basic, Pro, or Enterprise)

---

## Part 1: Create X Developer Account & App

### Step 1: Apply for Developer Access

1. Go to [X Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Click **"Sign up"** or **"Apply"**
3. Select your use case: **"Building tools for myself or my company"**
4. Complete the application form:
   - **What's your name?**: Your name
   - **What country do you live in?**: Your country
   - **What's your use case?**: Automated content posting for movie trailers
   - **Will you make X content available to government entities?**: No
5. Agree to terms and submit
6. Verify your email address

### Step 2: Create Project and App

1. In the Developer Portal, click **"Create Project"**
2. Enter project details:
   - **Project Name**: Screndly
   - **Use Case**: Publish and curate posts
   - **Project Description**: Automated movie trailer posting system
3. Click **"Next"**
4. Create an App:
   - **App Name**: Screndly Production (or your choice)
   - **Environment**: Production
5. Save your **API Key** and **API Secret** (you'll need these!)

### Step 3: Configure App Settings

1. Go to your App settings
2. Click **"Keys and tokens"** tab
3. Save the following:
   - **API Key** (Client ID)
   - **API Key Secret** (Client Secret)
   - **Bearer Token** (optional)

4. Click **"User authentication settings"** → **"Set up"**
5. Configure OAuth 2.0:
   - **App permissions**: ✅ Read and write
   - **Type of App**: Web App
   - **Callback URI**: `http://localhost:3000/auth/x/callback`
   - **Website URL**: Your website
6. Click **"Save"**

7. Generate **OAuth 2.0 Client ID** (if not auto-generated):
   - This is your `X_CLIENT_ID`
   - Save the **Client Secret** (this is `X_CLIENT_SECRET`)

---

## Part 2: Configure Environment Variables

### Development (.env)

```bash
# X (Twitter) API Configuration
X_CLIENT_ID=your_oauth2_client_id_here
X_CLIENT_SECRET=your_oauth2_client_secret_here
X_REDIRECT_URI=http://localhost:3000/auth/x/callback

# Encryption (same as Meta, or generate new)
ENCRYPTION_SECRET=your_secure_random_string_here

# Test Mode (optional)
X_TEST_MODE=false
```

### Production

```bash
X_CLIENT_ID=production_client_id
X_CLIENT_SECRET=production_client_secret
X_REDIRECT_URI=https://yourdomain.com/auth/x/callback
ENCRYPTION_SECRET=production_encryption_secret
NODE_ENV=production
```

**⚠️ Security Warning:**
- NEVER commit `.env` files to version control
- Use different secrets for dev/staging/production
- Store production secrets in a secrets manager (AWS Secrets Manager, etc.)

---

## Part 3: X API Tiers & Rate Limits

### Free Tier
- **Cost**: $0/month
- **Daily Tweets**: 50
- **Monthly Tweets**: 1,500
- **Video Duration**: Up to 2:20 (140 seconds)
- **Video Size**: Max 512 MB
- **Best For**: Testing and personal use

### Basic Tier
- **Cost**: $100/month
- **Daily Tweets**: 3,000
- **Monthly Tweets**: 50,000
- **Video Duration**: Up to 2:20 (140 seconds)
- **Video Size**: Max 512 MB
- **Best For**: Small businesses

### Pro Tier
- **Cost**: $5,000/month
- **Daily Tweets**: 10,000
- **Monthly Tweets**: 300,000
- **Video Duration**: Up to 10 minutes (600 seconds)
- **Video Size**: Max 512 MB
- **Frame Rate**: Up to 60 fps
- **Best For**: Professional use, media companies

### Enterprise Tier
- **Cost**: Custom pricing
- **Daily Tweets**: 100,000
- **Monthly Tweets**: 3,000,000
- **Video Duration**: Up to 10 minutes
- **Video Size**: Max 512 MB
- **Best For**: Large enterprises
- **Support**: Dedicated account team

> **Select Your Tier in Screndly Settings**  
> Go to Settings → X → Account Tier to configure rate limits

---

## Part 4: Video Requirements

### Technical Specifications

| Requirement | Value |
|-------------|-------|
| **Format** | MP4, MOV |
| **Codec** | H.264 (High Profile, Level 4.2) |
| **Max File Size** | 512 MB |
| **Aspect Ratio** | 1:3 to 3:1 (16:9 or 1:1 recommended) |
| **Min Resolution** | 32x32 |
| **Max Resolution** | 1920x1200 |
| **Frame Rate** | 30 fps (Free/Basic), 60 fps (Pro/Enterprise) |
| **Max Bitrate** | 25 Mbps |
| **Audio** | AAC-LC, 128 kbps |

### Recommended Settings

**Standard Quality (720p)**:
```bash
ffmpeg -i input.mp4 \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease" \
  -c:v libx264 -profile:v high -level 4.2 \
  -preset slow -crf 23 \
  -maxrate 10M -bufsize 2M \
  -r 30 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  output.mp4
```

**High Quality (1080p)**:
```bash
ffmpeg -i input.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease" \
  -c:v libx264 -profile:v high -level 4.2 \
  -preset slow -crf 23 \
  -maxrate 25M -bufsize 2M \
  -r 30 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  output.mp4
```

**For Pro/Enterprise (60 fps)**:
```bash
ffmpeg -i input.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease" \
  -c:v libx264 -profile:v high -level 4.2 \
  -preset slow -crf 23 \
  -maxrate 25M -bufsize 2M \
  -r 60 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  output.mp4
```

---

## Part 5: Configure Screndly

### Step 1: Connect X Account

1. Log in to Screndly dashboard
2. Go to **Settings**
3. Find **X (Twitter)** section
4. Click **"Connect X"**
5. Authorize Screndly to post on your behalf
6. You'll be redirected back to Settings

### Step 2: Select Account Tier

1. In X settings, select your **Account Tier**:
   - Free
   - Basic
   - Pro
   - Enterprise
2. This ensures correct rate limit enforcement
3. Screndly will automatically enforce your tier's limits

### Step 3: Test Publishing

1. Scroll to **"Test Publish"** section
2. Enter tweet text (max 280 characters)
3. (Optional) Enter video URL
4. Click **"Test Publish"**
5. Watch the logs in real-time
6. Verify tweet appears on your X profile

---

## Part 6: Chunked Upload Process

X uses a 3-phase chunked upload for videos:

### Phase 1: INIT
```http
POST https://upload.twitter.com/1.1/media/upload.json
Content-Type: multipart/form-data

command=INIT
total_bytes=52428800
media_type=video/mp4
media_category=tweet_video
```

**Response**:
```json
{
  "media_id_string": "1234567890",
  "expires_after_secs": 86400
}
```

### Phase 2: APPEND
```http
POST https://upload.twitter.com/1.1/media/upload.json
Content-Type: multipart/form-data

command=APPEND
media_id=1234567890
segment_index=0
media=<binary_chunk>
```

Repeat for all chunks (5 MB per chunk)

### Phase 3: FINALIZE
```http
POST https://upload.twitter.com/1.1/media/upload.json
Content-Type: multipart/form-data

command=FINALIZE
media_id=1234567890
```

**Response**:
```json
{
  "media_id_string": "1234567890",
  "size": 52428800,
  "expires_after_secs": 86400,
  "processing_info": {
    "state": "pending",
    "check_after_secs": 5
  }
}
```

### Phase 4: STATUS (if processing)
```http
GET https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=1234567890
```

**Poll until**:
```json
{
  "processing_info": {
    "state": "succeeded",
    "progress_percent": 100
  }
}
```

---

## Part 7: Troubleshooting

### "Invalid OAuth token" (Code 89)
**Solution:**
- Re-authenticate in Screndly Settings
- Check token hasn't expired
- Verify OAuth 2.0 is enabled in X Developer Portal

### "Rate limit exceeded" (Code 88)
**Solution:**
- Check quota usage in Screndly dashboard
- Wait for daily/monthly reset
- Consider upgrading to higher tier
- Spread posts throughout the day

### "Media cannot be processed" (Code 324)
**Solution:**
- Check video meets technical requirements
- Ensure video is under 512 MB
- Verify codec is H.264
- Try re-encoding with recommended ffmpeg command

### "Video too long"
**Solution:**
- Free/Basic: Trim to 2:20 (140 seconds)
- Pro/Enterprise: Trim to 10 minutes (600 seconds)
- Use ffmpeg: `ffmpeg -i input.mp4 -t 140 -c copy output.mp4`

### "Upload timeout"
**Solution:**
- Check internet connection
- Try smaller video file
- Verify video isn't corrupted
- Check Screndly logs for specific error

### "Processing status pending"
**Solution:**
- Wait for X to process video
- Screndly automatically polls every 5 seconds
- Processing usually takes 30 seconds to 5 minutes
- Check logs for processing progress

---

## Part 8: Best Practices

### Video Optimization
1. **Use 16:9 or 1:1 aspect ratio** for best display
2. **Keep videos under 2 minutes** for better engagement
3. **Add captions** - Many users watch without sound
4. **Use high contrast thumbnails** - First frame is important
5. **Enable faststart** - Better streaming performance

### Posting Strategy
1. **Monitor quota usage** - Don't exceed daily limits
2. **Post during peak hours** - Better engagement
3. **Use relevant hashtags** - Increase discoverability
4. **Include clear CTAs** - Drive traffic
5. **Test different formats** - Find what works

### Rate Limit Management
1. **Track daily/monthly usage** - Avoid hitting limits
2. **Schedule posts** - Spread throughout day
3. **Prioritize important content** - Save quota
4. **Monitor tier usage** - Upgrade if needed
5. **Set up alerts** - Get notified at 80% usage

### Error Handling
1. **Implement retry logic** - Network issues happen
2. **Log all operations** - Debug issues faster
3. **Monitor API status** - Check [X API Status](https://api.twitterstat.us/)
4. **Have backup strategy** - Manual posting if needed
5. **Test regularly** - Catch issues early

---

## Part 9: Monitoring & Logs

### Dashboard Metrics

Screndly provides:
- **Real-time quota usage** - Daily and monthly
- **Publish success rate** - Track failures
- **Processing time** - Video upload duration
- **Error logs** - Detailed error messages
- **API response codes** - Debug issues

### Example Log Output

```
[X] Starting post creation
[X] Rate limit OK for free tier
[X] Video detected, starting upload
[X] Validating video
[X] Video validation passed
[X] Video size: 48.3 MB
[X] Phase 1: INIT
[X] Media ID: 1234567890
[X] Phase 2: APPEND (uploading chunks)
[X] Total chunks: 10
[X] Uploaded chunk 1/10 (10%)
[X] Uploaded chunk 2/10 (20%)
...
[X] Uploaded chunk 10/10 (100%)
[X] Phase 3: FINALIZE
[X] Upload finalized
[X] Phase 4: STATUS polling
[X] Processing status: in_progress (45%)
[X] Waiting 5s before next check
[X] Processing status: in_progress (87%)
[X] Waiting 5s before next check
[X] Processing status: succeeded (100%)
[X] Video processing complete
[X] Tweet created: 1234567890123456789
✅ Tweet published successfully!
```

---

## Part 10: Production Deployment

### Checklist

- [ ] X Developer account approved
- [ ] App configured with OAuth 2.0
- [ ] Production callback URL added
- [ ] Environment variables set securely
- [ ] SSL/HTTPS enabled
- [ ] Error monitoring configured (Sentry, etc.)
- [ ] Logging set up
- [ ] Quota alerts configured
- [ ] Backup posting strategy in place
- [ ] Documentation updated

### Security

1. **Store secrets securely**
   - Use environment variables
   - Never commit to version control
   - Use secrets manager in production

2. **Rotate credentials regularly**
   - Change API keys every 90 days
   - Monitor for unauthorized access
   - Revoke compromised tokens immediately

3. **Use HTTPS**
   - Encrypt all traffic
   - Validate SSL certificates
   - Use secure redirect URIs

4. **Monitor access**
   - Log all API calls
   - Track failed authentications
   - Alert on suspicious activity

5. **Implement rate limiting**
   - Enforce tier limits
   - Prevent quota abuse
   - Implement exponential backoff

---

## Additional Resources

### Official Documentation
- [X API Documentation](https://developer.twitter.com/en/docs/twitter-api)
- [Media Upload Guide](https://developer.twitter.com/en/docs/twitter-api/v1/media/upload-media/overview)
- [OAuth 2.0 Guide](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
- [Rate Limits](https://developer.twitter.com/en/docs/twitter-api/rate-limits)

### Screndly Resources
- [X Adapter README](../adapters/README.md)
- [Test Suite](../tests/xAdapter.test.ts)
- [Privacy Policy](/legal/privacy)

### Support
- **X Developer Community**: [X Developer Forums](https://twittercommunity.com/)
- **Stack Overflow**: Tag `twitter-api`
- **Screndly Support**: Contact your administrator

---

**Last Updated**: 2024  
**Version**: 1.0  
**Author**: Screndly Team
