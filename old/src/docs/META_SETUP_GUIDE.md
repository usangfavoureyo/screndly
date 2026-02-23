# Meta (Facebook & Instagram) Setup Guide for Screndly

This guide walks you through setting up Meta integration for automated Instagram and Facebook posting.

## Prerequisites

Before you begin, ensure you have:

1. **A Facebook Account** - Personal Facebook account with admin access
2. **A Facebook Page** - Create one at [facebook.com/pages/create](https://www.facebook.com/pages/create)
3. **An Instagram Business Account** - Must be a Business or Creator account (not Personal)
4. **Basic technical knowledge** - Ability to configure app settings and API keys

---

## Part 1: Create a Meta Developer App

### Step 1: Create App
1. Go to [Meta Developers](https://developers.facebook.com/apps)
2. Click **"Create App"**
3. Select **"Business"** as the app type
4. Fill in app details:
   - **App Name**: `Screndly` (or your preferred name)
   - **App Contact Email**: Your email
   - **Business Account**: Select or create one
5. Click **"Create App"**

### Step 2: Add Products
Add the following products to your app:

1. **Facebook Login**
   - Click **"Set Up"** on Facebook Login
   - No additional configuration needed at this stage

2. **Instagram Graph API**
   - Click **"Set Up"** on Instagram API
   - This enables Instagram publishing capabilities

3. **Webhooks** (Optional but recommended)
   - For real-time updates on post status
   - Configure later once your app is live

### Step 3: Configure OAuth Settings
1. Go to **App Settings** → **Basic**
2. Add your **App Domains**:
   - For development: `localhost`
   - For production: `yourdomain.com`

3. Go to **Facebook Login** → **Settings**
4. Add **Valid OAuth Redirect URIs**:
   - Development: `http://localhost:3000/auth/meta/callback`
   - Production: `https://yourdomain.com/auth/meta/callback`

5. Enable **"Client OAuth Login"**
6. Enable **"Web OAuth Login"**

---

## Part 2: Link Instagram to Facebook Page

### Step 1: Convert Instagram to Business Account
1. Open Instagram mobile app
2. Go to **Settings** → **Account**
3. Tap **"Switch to Professional Account"**
4. Choose **"Business"** or **"Creator"**
5. Complete the setup process

### Step 2: Connect Instagram to Facebook Page
1. Open Instagram Settings → **Account**
2. Tap **"Linked Accounts"**
3. Select **"Facebook"**
4. Log in and select your Facebook Page
5. Confirm the connection

### Step 3: Verify Connection
1. Go to your Facebook Page
2. Click **Settings** → **Instagram**
3. You should see your Instagram account listed as **"Connected"**

---

## Part 3: Request Permissions (App Review)

Meta requires app review for advanced permissions. Here's what you need:

### Required Permissions

| Permission | Purpose | Required For |
|------------|---------|--------------|
| `instagram_basic` | Get basic Instagram account info | Instagram posting |
| `instagram_content_publish` | Publish photos and videos | Instagram posting |
| `instagram_manage_insights` | Get post insights | Analytics (optional) |
| `pages_read_engagement` | Read Page engagement | Analytics |
| `pages_show_list` | List user's Pages | Account selection |
| `pages_manage_posts` | Create/delete Page posts | Facebook posting |
| `pages_manage_metadata` | Update Page info | Page management |
| `pages_read_user_content` | Read Page content | Content management |
| `publish_video` | Upload videos to Pages | Video posting |
| `business_management` | Manage business assets | Multi-account support |

### Step 1: Prepare for Review
Before submitting for review, prepare:

1. **App Icon** - 1024x1024 px PNG
2. **Privacy Policy URL** - Link to your privacy policy
3. **Terms of Service URL** - Link to your terms
4. **App Description** - Clear explanation of your app's purpose
5. **Video Demo** - Screen recording showing how you use each permission

### Step 2: Submit for Review
1. Go to **App Review** → **Permissions and Features**
2. For each required permission:
   - Click **"Request"**
   - Provide **detailed usage description**
   - Upload **video demonstration**
   - Provide **sample API calls**

### Sample Permission Request Text

**instagram_content_publish:**
```
Screndly is an automated content publishing tool for movie trailer distribution. 
We use this permission to publish user-created video content to their connected 
Instagram Business accounts. Users explicitly configure which videos to post 
through our dashboard. Sample API call: POST /{ig-user-id}/media with video_url 
and caption parameters, followed by POST /{ig-user-id}/media_publish.
```

**pages_manage_posts:**
```
We use this permission to publish video trailers to the user's Facebook Page. 
Users maintain full control over which content is published through our automation 
settings. Sample API call: POST /{page-id}/videos with video file upload and 
description.
```

### Sample API Calls for Review

Include these in your review submission:

**Instagram Posting:**
```bash
# Create media container
POST https://graph.facebook.com/v18.0/{ig-user-id}/media
{
  "media_type": "VIDEO",
  "video_url": "https://example.com/video.mp4",
  "caption": "New trailer out now!",
  "access_token": "{access-token}"
}

# Publish media
POST https://graph.facebook.com/v18.0/{ig-user-id}/media_publish
{
  "creation_id": "{container-id}",
  "access_token": "{access-token}"
}
```

**Facebook Video Upload:**
```bash
# Resumable upload
POST https://graph.facebook.com/v18.0/{page-id}/videos
{
  "upload_phase": "start",
  "file_size": 15728640,
  "access_token": "{access-token}"
}
```

### Step 3: During Development (Before Approval)
While your app is in Development mode:
- Only accounts with **Admin**, **Developer**, or **Tester** roles can use it
- Add test users in **Roles** → **Test Users**
- All features work normally for these users

---

## Part 4: Configure Screndly

### Step 1: Get App Credentials
1. Go to **App Settings** → **Basic** in Meta Developers
2. Copy your **App ID** and **App Secret**

### Step 2: Set Environment Variables
Add these to your `.env` file:

```bash
# Meta Configuration
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
META_REDIRECT_URI=http://localhost:3000/auth/meta/callback

# Encryption (Change in production!)
ENCRYPTION_SECRET=generate_a_secure_random_string_here
```

**⚠️ Security Warning:**
- **NEVER** commit secrets to version control
- Use different secrets for dev/staging/production
- Rotate secrets regularly
- Use a secrets manager in production (AWS Secrets Manager, HashiCorp Vault, etc.)

### Step 3: Connect in Screndly Dashboard
1. Log in to Screndly
2. Go to **Settings**
3. Find the **Meta (Facebook & Instagram)** section
4. Click **"Connect Meta"**
5. Log in to Facebook and authorize the app
6. Select your Facebook Page
7. Confirm the connection

---

## Part 5: Video Requirements

### Instagram Feed Posts
- **Duration**: 3-60 seconds
- **File Size**: Max 100 MB
- **Aspect Ratio**: 4:5 to 1.91:1 (Portrait to Landscape)
- **Format**: MP4 or MOV
- **Codec**: H.264
- **Daily Limit**: 25 posts

### Instagram Reels
- **Duration**: 3-90 seconds
- **File Size**: Max 1 GB
- **Aspect Ratio**: 9:16 recommended (vertical)
- **Format**: MP4 or MOV
- **Codec**: H.264
- **Frame Rate**: 23-60 fps
- **Daily Limit**: 50 Reels

### Facebook Videos
- **Duration**: 1 second - 240 minutes
- **File Size**: Max 10 GB
- **Format**: MP4, MOV, AVI, MKV
- **Codec**: H.264 or VP8
- **Daily Limit**: 200 posts

### Best Practices
- **Use 9:16 aspect ratio** for Reels (1080x1920)
- **Use 1:1 or 4:5** for Instagram feed posts
- **Keep videos under 30 seconds** for better engagement
- **Add captions** - Many users watch without sound
- **Use high-quality thumbnails** from TMDb

---

## Part 6: Troubleshooting

### "No Instagram Business account linked"
**Solution:**
1. Ensure your Instagram account is set to Business/Creator
2. Link it to your Facebook Page (see Part 2)
3. Wait 5-10 minutes for Meta to sync
4. Try reconnecting in Screndly

### "Permission denied" errors
**Solution:**
- Check that your app has been approved for the required permissions
- Verify the user account has a role in your app (Admin/Developer/Tester)
- Ensure OAuth redirect URI is correctly configured

### "Rate limit exceeded"
**Solution:**
- Check quota usage in Screndly Settings
- Daily limits reset at midnight UTC
- Consider spreading posts throughout the day
- Use Facebook for higher volume posting (200/day limit)

### "Video validation failed"
**Solution:**
- Check video meets platform requirements (see Part 5)
- Use ffmpeg to transcode video:
  ```bash
  # For Instagram Reels (9:16)
  ffmpeg -i input.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset slow -crf 22 output.mp4
  
  # For Instagram Feed (1:1)
  ffmpeg -i input.mp4 -vf "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset slow -crf 22 output.mp4
  ```

### Token expired
**Solution:**
- Long-lived tokens last ~60 days
- Screndly automatically refreshes tokens before expiration
- If expired, reconnect through Settings → Meta section

---

## Part 7: Security & Compliance

### Data Privacy
- Screndly stores OAuth tokens encrypted using AES-256-GCM
- Tokens are only used for authorized actions
- No follower data is accessed or stored
- Users can revoke access anytime

### Meta Platform Policies
Ensure compliance with:
- [Meta Platform Terms](https://developers.facebook.com/terms)
- [Instagram Platform Policy](https://developers.facebook.com/docs/instagram-api/overview#instagram-platform-policy)
- [Facebook Platform Policy](https://developers.facebook.com/docs/development/release/policies)

### GDPR/CCPA Compliance
- Provide data export capabilities
- Allow users to delete their data
- Maintain audit logs
- Update privacy policy

### Rate Limiting
- Respect Meta's rate limits
- Implement exponential backoff
- Monitor quota usage
- Alert users when approaching limits

---

## Part 8: Production Deployment

### Before Going Live
- [ ] Complete Meta app review
- [ ] Add production OAuth redirect URI
- [ ] Set secure environment variables
- [ ] Enable SSL/HTTPS
- [ ] Configure error monitoring
- [ ] Set up logging
- [ ] Test with multiple accounts
- [ ] Prepare incident response plan

### Environment Variables (Production)
```bash
META_APP_ID=your_production_app_id
META_APP_SECRET=your_production_app_secret
META_REDIRECT_URI=https://yourdomain.com/auth/meta/callback
ENCRYPTION_SECRET=use_a_strong_randomly_generated_secret
NODE_ENV=production
```

### Monitoring
Set up monitoring for:
- API error rates
- Token expiration alerts
- Quota usage warnings
- Failed publish attempts
- User connection status

### Backup & Recovery
- Regularly backup encrypted tokens
- Document token recovery procedures
- Maintain audit logs
- Test restore procedures

---

## Additional Resources

### Official Documentation
- [Instagram Content Publishing](https://developers.facebook.com/docs/instagram-api/guides/content-publishing)
- [Instagram Reels Publishing](https://developers.facebook.com/docs/instagram-api/guides/reels)
- [Facebook Video API](https://developers.facebook.com/docs/video-api)
- [Resumable Upload](https://developers.facebook.com/docs/video-api/guides/resumable-upload)

### Screndly Resources
- Privacy Policy: `/legal/privacy`
- Terms of Service: `/legal/terms`
- Cookie Policy: `/legal/cookies`
- Support: Contact your administrator

### Community
- Meta Developers Community: [developers.facebook.com/community](https://developers.facebook.com/community)
- Stack Overflow: Tag `facebook-graph-api` or `instagram-graph-api`

---

## Support

For issues with:
- **Meta Integration**: Check Meta Developer Community
- **Screndly Configuration**: Contact your system administrator
- **API Limits**: Review Meta's Platform Policies
- **Security Concerns**: Email your security team

**Last Updated**: 2024
**Version**: 1.0
