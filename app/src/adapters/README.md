# Screndly Meta Adapter

Production-ready Meta (Facebook & Instagram) integration for automated video publishing.

## Features

✅ **Instagram Business Publishing**
- Feed posts (3-60 seconds)
- Reels (3-90 seconds, 9:16 vertical)
- TMDb thumbnail support
- Location tagging
- User tagging
- Caption support

✅ **Facebook Page Publishing**
- Video posts (up to 240 minutes)
- Resumable upload for large files
- Custom thumbnails
- Description support

✅ **Threads Integration** (Best-effort)
- Limited API availability
- Updates as Meta releases more features

✅ **Security & Compliance**
- AES-256-GCM token encryption
- OAuth 2.0 authentication
- Long-lived token management (60 days)
- Automatic token refresh
- Secure credential storage

✅ **Rate Limiting & Quotas**
- Instagram Feed: 25 posts/day
- Instagram Reels: 50 posts/day
- Facebook: 200 posts/day
- Automatic quota tracking
- Midnight UTC reset

✅ **Video Processing**
- Format validation (MP4, MOV, AVI, MKV)
- Aspect ratio checking
- Duration validation
- File size limits
- Transcode recommendations
- Sharp-based thumbnail generation

✅ **Error Handling**
- Retry logic with exponential backoff
- Detailed error messages
- Rate limit detection
- Token expiration handling
- Network error recovery

## Quick Start

### 1. Prerequisites

```bash
# Create Meta Developer App
# https://developers.facebook.com/apps

# Get credentials
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_REDIRECT_URI=http://localhost:3000/auth/meta/callback
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
# .env
META_APP_ID=123456789
META_APP_SECRET=abc123def456
META_REDIRECT_URI=http://localhost:3000/auth/meta/callback
ENCRYPTION_SECRET=generate_secure_random_string
```

### 4. Initialize Adapter

```typescript
import { metaAdapter } from './adapters/metaAdapter';

// Initialize with page and Instagram account IDs
await metaAdapter.initialize();

// Or specify manually
const adapter = new MetaAdapter('page_id', 'instagram_account_id');
```

### 5. Publish Content

```typescript
// Publish to Instagram Feed
const feedResult = await metaAdapter.publishToInstagramFeed({
  videoUrl: 'https://cdn.example.com/trailer.mp4',
  caption: 'New movie trailer! 🎬 #MovieNight',
  thumbnailUrl: 'https://image.tmdb.org/t/p/original/poster.jpg',
  coverOffset: 5000, // 5 seconds
});

// Publish to Instagram Reels
const reelResult = await metaAdapter.publishToInstagramReels({
  videoUrl: 'https://cdn.example.com/reel.mp4',
  caption: 'Check out this trailer! 🔥',
  shareToFeed: true,
});

// Publish to Facebook
const fbResult = await metaAdapter.publishToFacebook({
  videoUrl: 'https://cdn.example.com/video.mp4',
  caption: 'New trailer just dropped!',
  thumbnailUrl: 'https://image.tmdb.org/t/p/original/backdrop.jpg',
});
```

## Architecture

```
┌─────────────────┐
│  Screndly App   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Meta Adapter   │──────┐
└────────┬────────┘      │
         │               │
    ┌────┴────┐          │
    │         │          │
    ▼         ▼          ▼
┌────────┐ ┌──────┐ ┌──────────┐
│ Video  │ │ Rate │ │  Token   │
│Process │ │Limit │ │ Storage  │
└────────┘ └──────┘ └──────────┘
                          │
                          ▼
                    ┌──────────┐
                    │   Meta   │
                    │   APIs   │
                    └──────────┘
```

## API Reference

### MetaAdapter

#### `initialize(): Promise<void>`
Initialize the adapter with OAuth credentials.

#### `publishToInstagramFeed(options): Promise<PublishResult>`
Publish video to Instagram feed.

**Options:**
- `videoUrl` (required): Video file URL
- `caption` (required): Post caption
- `thumbnailUrl` (optional): Cover image URL
- `coverOffset` (optional): Thumbnail offset in ms
- `locationId` (optional): Facebook location ID
- `userTags` (optional): Array of user tags with coordinates

**Returns:**
```typescript
{
  success: boolean;
  platform: 'instagram';
  mediaId?: string;
  postId?: string;
  error?: string;
  retryAfter?: number;
}
```

#### `publishToInstagramReels(options): Promise<PublishResult>`
Publish video as Instagram Reel.

**Options:**
- `videoUrl` (required): Video file URL (9:16 recommended)
- `caption` (required): Reel caption
- `thumbnailUrl` (optional): Cover image
- `coverOffset` (optional): Thumbnail offset in ms
- `shareToFeed` (optional): Also show in feed (default: true)
- `collaborators` (optional): Array of Instagram user IDs

#### `publishToFacebook(options): Promise<PublishResult>`
Publish video to Facebook Page.

**Options:**
- `videoUrl` (required): Video file URL
- `caption` (required): Post description
- `thumbnailUrl` (optional): Custom thumbnail

#### `getQuotaUsage(): Promise<QuotaUsage>`
Get current quota usage for all platforms.

**Returns:**
```typescript
{
  instagram_feed: { used: number; limit: number };
  instagram_reels: { used: number; limit: number };
  facebook: { used: number; limit: number };
}
```

### MetaAuth

#### `getAuthorizationUrl(returnTo): string`
Generate OAuth authorization URL.

#### `handleCallback(code, state): Promise<CallbackResult>`
Handle OAuth callback and store tokens.

#### `refreshTokenIfNeeded(): Promise<boolean>`
Refresh access token if expiring within 7 days.

#### `isAuthenticated(): Promise<boolean>`
Check if user has valid access token.

#### `revokeToken(): Promise<void>`
Revoke access and delete stored tokens.

### VideoProcessor

#### `validateVideo(url, platform): Promise<ValidationResult>`
Validate video against platform requirements.

**Platforms:**
- `instagram_feed`
- `instagram_reels`
- `facebook`

#### `generateThumbnail(url, timestampMs): Promise<string>`
Extract thumbnail from video at specific timestamp.

#### `createCompositeThumbnail(tmdbUrl, options): Promise<string>`
Create composite thumbnail with TMDb image and overlays.

#### `transcodeVideo(url, platform, options): Promise<string>`
Transcode video to meet platform requirements.

### RateLimiter

#### `checkLimit(platform): Promise<void>`
Check if posting is allowed (throws if over limit).

#### `incrementCount(platform): Promise<void>`
Increment usage count after successful post.

#### `getUsage(platform): Promise<{used, limit}>`
Get current quota usage.

#### `resetQuota(platform): void`
Manually reset quota (for testing).

## Video Requirements

### Instagram Feed
```typescript
{
  minDuration: 3,        // seconds
  maxDuration: 60,
  maxSize: 104857600,    // 100 MB
  aspectRatio: {
    min: 0.8,            // 4:5
    max: 1.91            // 1.91:1
  },
  formats: ['MP4', 'MOV'],
  codecs: ['H.264']
}
```

### Instagram Reels
```typescript
{
  minDuration: 3,
  maxDuration: 90,
  maxSize: 1073741824,   // 1 GB
  aspectRatio: {
    min: 0.01,
    max: 10
  },
  recommended: 0.5625,   // 9:16
  formats: ['MP4', 'MOV'],
  codecs: ['H.264'],
  frameRate: { min: 23, max: 60 }
}
```

### Facebook
```typescript
{
  minDuration: 1,
  maxDuration: 14400,    // 240 minutes
  maxSize: 10737418240,  // 10 GB
  formats: ['MP4', 'MOV', 'AVI', 'MKV'],
  codecs: ['H.264', 'VP8']
}
```

## Error Handling

### Common Error Codes

| Code | Error | Solution |
|------|-------|----------|
| 190 | Invalid OAuth token | Re-authenticate user |
| 368 | Policy violation | Review Meta policies |
| 32 | Rate limit | Wait and retry |
| 100 | Invalid parameter | Check video requirements |

### Example Error Handling

```typescript
const result = await metaAdapter.publishToInstagramFeed(options);

if (!result.success) {
  if (result.error?.includes('quota exceeded')) {
    // Wait until quota resets
    const quotas = await metaAdapter.getQuotaUsage();
    console.log('Quota resets at:', quotas.instagram_feed.resetAt);
  } else if (result.retryAfter) {
    // Retry after specified seconds
    setTimeout(() => retry(), result.retryAfter * 1000);
  } else {
    // Log error
    console.error('Publish failed:', result.error);
  }
}
```

## Testing

### Run Tests

```bash
# Unit tests
npm test

# With coverage
npm run test:coverage

# Integration tests (requires credentials)
npm run test:integration
```

### Test Mode

```typescript
// Enable test mode
process.env.META_TEST_MODE = 'true';

// All API calls will be mocked
const result = await metaAdapter.publishToInstagramFeed({
  videoUrl: 'test.mp4',
  caption: 'Test post'
});
// Returns mock success response
```

## Security Best Practices

### ⚠️ CRITICAL

1. **Never commit secrets**
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.production
   ```

2. **Use environment variables**
   ```bash
   # Development
   META_APP_SECRET=dev_secret
   
   # Production
   META_APP_SECRET=prod_secret_from_vault
   ```

3. **Rotate credentials regularly**
   - Change app secret every 90 days
   - Monitor for unauthorized access
   - Revoke compromised tokens immediately

4. **Use HTTPS in production**
   ```bash
   META_REDIRECT_URI=https://yourdomain.com/auth/callback
   ```

5. **Encrypt tokens at rest**
   - Uses AES-256-GCM encryption
   - Store encryption key in secrets manager
   - Never log decrypted tokens

## Production Deployment

### Checklist

- [ ] Complete Meta app review
- [ ] Configure production OAuth redirect URI
- [ ] Set secure environment variables
- [ ] Enable SSL/HTTPS
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure logging
- [ ] Test with multiple accounts
- [ ] Set up alerts for quota usage
- [ ] Document incident response procedures

### Environment Variables

```bash
# Required
META_APP_ID=production_app_id
META_APP_SECRET=production_app_secret
META_REDIRECT_URI=https://yourdomain.com/auth/meta/callback
ENCRYPTION_SECRET=strong_random_string
NODE_ENV=production

# Optional
META_API_VERSION=v18.0
META_TIMEOUT=30000
```

### Monitoring

Set up alerts for:
- Token expiration (< 7 days)
- Quota usage (> 80%)
- API error rate (> 5%)
- Failed publish attempts
- Authentication failures

## Troubleshooting

### "No Instagram Business account linked"
1. Verify Instagram account is Business/Creator type
2. Link to Facebook Page in Instagram settings
3. Wait 5-10 minutes for Meta sync
4. Reconnect in Screndly

### "Permission denied"
1. Check app has required permissions approved
2. Verify user has role in app (Admin/Developer/Tester)
3. Confirm OAuth redirect URI matches exactly

### "Video validation failed"
1. Check video meets requirements (see Video Requirements)
2. Use ffmpeg to transcode:
   ```bash
   ffmpeg -i input.mp4 -c:v libx264 -preset slow -crf 22 output.mp4
   ```

### "Rate limit exceeded"
1. Check quota in Screndly dashboard
2. Wait until midnight UTC for reset
3. Consider spreading posts throughout day
4. Use Facebook for higher volume (200/day)

## Documentation

- [Setup Guide](../docs/META_SETUP_GUIDE.md)
- [Instagram API Docs](https://developers.facebook.com/docs/instagram-api)
- [Facebook Video API](https://developers.facebook.com/docs/video-api)
- [Meta App Review](https://developers.facebook.com/docs/app-review)

## Support

- **Meta API Issues**: [Meta Developer Community](https://developers.facebook.com/community)
- **Screndly Issues**: Contact your administrator
- **Security Concerns**: Email security@yourcompany.com

## License

Proprietary - Screndly by Screen Render

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Maintainer**: Screndly Team
