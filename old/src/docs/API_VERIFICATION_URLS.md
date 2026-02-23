# API Verification URLs for Screndly

These URLs are required when submitting Screndly for Meta and TikTok API verification.

---

## 🔗 Required URLs

### Privacy Policy
```
https://screndly.com/privacy
```
**Purpose**: Full privacy policy with detailed information about data collection, storage, and usage  
**Contains**: Meta, X, and TikTok integration disclosures

---

### Terms of Service
```
https://screndly.com/terms
```
**Purpose**: Legal terms and conditions for using Screndly  
**Contains**: User agreements, liability disclaimers, acceptable use policies

---

### Data Deletion Instructions
```
https://screndly.com/data-deletion
```
**Purpose**: Step-by-step instructions for users to request data deletion  
**Contains**: 
- Screndly account deletion process
- Meta (Facebook & Instagram) data deletion
- X (Twitter) data deletion  
- TikTok data deletion
- Timeline for deletion (immediate to 90 days)

---

### App Information / Use Case
```
https://screndly.com/app-info
```
**Purpose**: Explains what Screndly does and how it uses platform APIs  
**Contains**:
- What Screndly is (automated trailer distribution)
- How it works (6-step process)
- Platform integrations and permissions
- Data we collect vs. data we DON'T collect
- Security measures
- Target users (studios, networks, creators)

---

### Contact / Support
```
https://screndly.com/contact
```
**Purpose**: Contact information for support and privacy inquiries  
**Contains**: Email addresses for support, privacy requests, and general inquiries

---

## 📱 Meta App Review Submission

### Required Information

**App Name**: Screndly  
**App Description**: Automated movie and TV trailer distribution platform for social media

**Category**: Business Tools / Social Media Management

**Privacy Policy URL**: `https://screndly.com/privacy`  
**Terms of Service URL**: `https://screndly.com/terms`  
**Data Deletion URL**: `https://screndly.com/data-deletion`  
**App Information URL**: `https://screndly.com/app-info`

### Permissions Requested

1. **pages_show_list**  
   - Purpose: View user's Facebook Pages
   - Used for: Displaying connected Pages in dashboard

2. **pages_manage_posts**  
   - Purpose: Create posts on Facebook Pages
   - Used for: Publishing trailer videos to Pages

3. **pages_read_engagement**  
   - Purpose: View Page insights
   - Used for: (Optional) Track engagement metrics

4. **instagram_basic**  
   - Purpose: Access Instagram Business profile
   - Used for: Connect Instagram Business accounts

5. **instagram_content_publish**  
   - Purpose: Publish content to Instagram
   - Used for: Publishing trailer videos and Reels

6. **publish_video**  
   - Purpose: Upload video files
   - Used for: Uploading trailer videos to Meta platforms

7. **business_management**  
   - Purpose: Manage Business accounts
   - Used for: Link Instagram Business to Facebook Pages

### Use Case Description

```
Screndly is an automation platform for film studios, TV networks, and content 
creators to distribute movie and TV trailers across social media platforms.

The platform monitors RSS feeds for new trailer releases and automatically posts 
them to connected Facebook Pages and Instagram Business accounts with optimized 
captions and formatting.

We only access the user's Facebook Pages and Instagram Business accounts that 
they explicitly connect. We do NOT access personal profiles, followers, messages, 
or any user-generated content.

All OAuth tokens are encrypted using AES-256-GCM and stored securely. Users can 
disconnect at any time and request full data deletion.
```

### Demo Video Requirements

Create a screen recording showing:
1. Login to Screndly dashboard
2. Navigate to Settings → Meta
3. Click "Connect Facebook & Instagram"
4. Complete OAuth flow (show permissions dialog)
5. View connected accounts in dashboard
6. Configure RSS feed for trailers
7. Trigger test publish
8. Show video appearing on Facebook Page
9. Show Settings → Disconnect option
10. Navigate to Data Deletion page

**Duration**: 2-3 minutes  
**Format**: MP4, 1080p, 30fps  
**Upload to**: YouTube (unlisted) or direct file upload

---

## 🎵 TikTok App Review Submission

### Required Information

**App Name**: Screndly  
**App Description**: Automated movie trailer distribution for TikTok creators and studios

**Category**: Marketing / Social Media Tools

**Privacy Policy URL**: `https://screndly.com/privacy`  
**Terms of Service URL**: `https://screndly.com/terms`  
**Data Deletion URL**: `https://screndly.com/data-deletion`  
**Use Case URL**: `https://screndly.com/app-info`

### Scopes Requested

1. **user.info.basic**  
   - Purpose: Access user profile information
   - Used for: Display user's TikTok username in dashboard

2. **video.upload**  
   - Purpose: Upload video files to TikTok
   - Used for: Uploading trailer videos

3. **video.publish**  
   - Purpose: Publish videos to TikTok account
   - Used for: Publishing trailer content

### Use Case Description

```
Screndly helps movie studios, TV networks, and content creators automatically 
distribute trailers to TikTok.

The platform monitors RSS feeds for new trailer releases and publishes them to 
the user's TikTok account with optimized vertical formatting (9:16 aspect ratio) 
and captions.

We enforce TikTok's posting guidelines: maximum 5 posts per day, 1-hour spacing 
between posts to prevent spam.

We only access the user's TikTok account that they explicitly connect. We do NOT 
access followers, comments, messages, or any other user content.

All OAuth tokens are encrypted and users can disconnect and request data deletion 
at any time.
```

### Documentation to Provide

1. **Screenshots** (minimum 5):
   - Login screen
   - Dashboard overview
   - Settings → TikTok connection
   - OAuth authorization flow
   - Published video on TikTok

2. **Demo Video**:
   - Show complete flow from connection to publishing
   - Duration: 2-3 minutes
   - Show quota limits and spam prevention

3. **Technical Documentation**:
   - OAuth 2.0 implementation details
   - Video processing pipeline
   - Rate limiting implementation
   - Security measures (encryption, etc.)

### Review Timeline

- **Submission**: Submit through TikTok Developer Portal
- **Initial Review**: 1-2 business days
- **Detailed Review**: 3-5 business days
- **Approval/Rejection**: Email notification
- **Revisions**: If rejected, address feedback and resubmit

---

## 🔐 Security & Compliance

### Data Protection

- **Encryption**: AES-256-GCM for all OAuth tokens
- **Authentication**: OAuth 2.0 (no password storage)
- **HTTPS**: All traffic encrypted with SSL/TLS
- **Token Storage**: Encrypted localStorage (frontend), backend database (production)

### Compliance

- **GDPR**: Data deletion within 30 days
- **CCPA**: User data rights respected
- **Platform Policies**: Compliant with Meta, X, and TikTok developer terms

### Data Retention

- **Active Users**: Data stored while account active
- **Disconnected Platforms**: Tokens deleted immediately
- **Deleted Accounts**: All data removed within 30 days
- **Legal Requirements**: Transaction logs retained 7 years

---

## 📧 Contact Information

### Support Email
```
support@screndly.com
```
**Response Time**: Within 48 hours

### Privacy Inquiries
```
privacy@screndly.com
```
**Response Time**: Within 24 hours

### Legal / Compliance
```
legal@screndly.com
```

---

## ✅ Pre-Submission Checklist

### Meta App Review
- [ ] Privacy Policy page live and accessible
- [ ] Data Deletion page live with clear instructions
- [ ] App Info page explains use case clearly
- [ ] Demo video recorded (2-3 minutes)
- [ ] Screenshots prepared (5-10 images)
- [ ] Test users created for review team
- [ ] All permissions justified in use case
- [ ] OAuth callback URL configured correctly
- [ ] App domain verified

### TikTok App Review
- [ ] Privacy Policy page live and accessible
- [ ] Data Deletion page live with clear instructions
- [ ] Use Case documentation page live
- [ ] Demo video recorded showing complete flow
- [ ] Screenshots prepared (minimum 5)
- [ ] Technical documentation prepared
- [ ] Rate limiting implementation documented
- [ ] OAuth 2.0 flow tested
- [ ] Callback URL configured

---

## 🚀 After Approval

### Meta
1. Remove test mode restrictions
2. Submit for App Review (Business Verification)
3. Wait 3-7 business days for production approval
4. Update app status to "Live"
5. Users can now connect their accounts

### TikTok
1. App status changes to "Approved"
2. Receive production credentials
3. Update environment variables with production keys
4. Users can now connect their accounts
5. Monitor for any policy violations

---

## 📞 Support During Review

If reviewers have questions, they can contact:
- **Email**: support@screndly.com
- **Response SLA**: Within 12 hours during business days

Provide detailed responses addressing:
- How specific permissions are used
- Data flow diagrams if requested
- Security implementation details
- Compliance certifications if available

---

**Last Updated**: 2024  
**Version**: 1.0  
**Maintained by**: Screndly Development Team
