# Screndly - Comprehensive Manual Testing Checklist

**Date:** December 9, 2025  
**Version:** 2.1.0  
**Tester:** _____________________

---

## ✅ Test Execution Status

- [ ] All automated tests passed
- [ ] All manual tests completed
- [ ] All critical paths verified
- [ ] All bug fixes validated

---

## 1. Recent Bug Fixes Verification

### 1.1 React Imports in VideoStudioPage ✅
- [ ] Navigate to Video Studio page
- [ ] Page loads without console errors
- [ ] No "React is not defined" errors
- [ ] All components render properly

**Expected:** Page loads successfully with all React components functional

---

### 1.2 Sonner Toast Import Consistency ✅
Test toast notifications across these pages:

- [ ] **VideoStudioPage** - Upload a video, verify toast appears
- [ ] **BackblazeUploader** - Test upload, verify toast notification
- [ ] **BackblazeVideoBrowser** - Load files, verify toast messages
- [ ] **ChannelsPage** - Add/remove channel, verify toast
- [ ] **RSSPage** - Add feed, verify toast
- [ ] **PlatformsPage** - Connect platform, verify toast
- [ ] **TMDbFeedsPage** - Add feed, verify toast
- [ ] **SubtitleTimestampAssist** - Load subtitles, verify toast

**Expected:** All toasts work consistently with no import errors

---

### 1.3 Input/Textarea Focus Styling (#292929) ✅

Test in the following locations:

#### Settings Page
- [ ] Navigate to Settings → API Keys
- [ ] Click on "YouTube API Key" input field
- [ ] **Verify:** Border color changes to grey `#292929`
- [ ] **Verify:** Ring color is `#292929` with 50% opacity
- [ ] Tab to next field
- [ ] **Verify:** Focus styling appears on next field

#### Video Studio Page
- [ ] Navigate to Video Studio
- [ ] Click on "Video Title" input
- [ ] **Verify:** Focus border is grey `#292929`
- [ ] Click on "Review Caption" textarea
- [ ] **Verify:** Textarea focus border is grey `#292929`
- [ ] Click on "Releases Caption" textarea
- [ ] **Verify:** Focus styling consistent
- [ ] Click on "Scenes Caption" textarea
- [ ] **Verify:** Focus styling consistent

#### RSS Page
- [ ] Navigate to RSS Feeds
- [ ] Click "Add Feed" button
- [ ] Focus on "Feed Name" input
- [ ] **Verify:** Focus border is grey `#292929`
- [ ] Focus on "Feed URL" input
- [ ] **Verify:** Focus styling consistent

#### Channels Page
- [ ] Navigate to Channels
- [ ] Click "Add Channel"
- [ ] Focus on channel input fields
- [ ] **Verify:** All inputs have grey `#292929` focus border

**Expected:** All input and textarea fields across the app have consistent grey `#292929` focus styling

---

### 1.4 Dual Backblaze B2 Bucket Implementation ✅

#### General Storage Bucket (Trailers)
- [ ] Navigate to Settings → API Keys
- [ ] Scroll to "Backblaze B2 General Storage"
- [ ] **Verify:** Three input fields present:
  - [ ] Key ID
  - [ ] Application Key
  - [ ] Bucket Name
- [ ] Enter test credentials (or leave empty)
- [ ] **Verify:** Settings save successfully

#### Videos Bucket (Movies/TV Shows)
- [ ] In Settings → API Keys
- [ ] Scroll to "Backblaze B2 Videos Bucket"
- [ ] **Verify:** Separate three input fields present:
  - [ ] Videos Key ID
  - [ ] Videos Application Key
  - [ ] Videos Bucket Name
- [ ] Enter different test credentials
- [ ] **Verify:** Settings save separately from general bucket

#### Security Isolation Test
- [ ] Set different credentials for each bucket
- [ ] Navigate to Backblaze Uploader
- [ ] **Verify:** Uses general bucket credentials
- [ ] Navigate to Video Studio → Browse Videos
- [ ] **Verify:** Uses videos bucket credentials
- [ ] Check localStorage in DevTools
- [ ] **Verify:** Six separate keys exist:
  - `backblazeKeyId` (general)
  - `backblazeApplicationKey` (general)
  - `backblazeBucketName` (general)
  - `backblazeVideosKeyId` (videos)
  - `backblazeVideosApplicationKey` (videos)
  - `backblazeVideosBucketName` (videos)

**Expected:** Two completely separate Backblaze B2 configurations with distinct credentials

---

## 2. SEO Caption Validation

### 2.1 Review Section Caption
- [ ] Navigate to Video Studio
- [ ] Scroll to "Review" section
- [ ] Enter caption with 119 characters
- [ ] **Verify:** Shows warning "Minimum 120 characters required"
- [ ] Enter caption with 120 characters
- [ ] **Verify:** No warning shown
- [ ] Enter caption with 250 characters
- [ ] **Verify:** No warning shown
- [ ] Enter caption with 251 characters
- [ ] **Verify:** Shows error "Maximum 250 characters allowed"
- [ ] Enter caption with emoji: "Test 🎬"
- [ ] **Verify:** Shows error "Emojis not allowed in SEO captions"

### 2.2 Releases Section Caption
- [ ] Navigate to "Releases" section in Video Studio
- [ ] Test character limits (120-250)
- [ ] **Verify:** Same validation as Review section
- [ ] Test emoji detection
- [ ] **Verify:** Emojis blocked with error message

### 2.3 Scenes Section Caption
- [ ] Navigate to "Scenes" section in Video Studio
- [ ] Test character limits (120-250)
- [ ] **Verify:** Same validation as Review section
- [ ] Test emoji detection
- [ ] **Verify:** Emojis blocked with error message

**Expected:** All three sections enforce 120-250 character limit and block emojis

---

## 3. Core Functionality Tests

### 3.1 Video Upload & Processing
- [ ] Navigate to Video Studio
- [ ] Click "Upload Video" button
- [ ] Select a test video file (MP4)
- [ ] **Verify:** Upload progress shown
- [ ] **Verify:** Video preview appears after upload
- [ ] **Verify:** Video metadata extracted (duration, resolution)
- [ ] Click Play button
- [ ] **Verify:** Video plays in preview
- [ ] Click Pause button
- [ ] **Verify:** Video pauses

### 3.2 FFmpeg Integration
- [ ] Upload a video
- [ ] Set start timestamp (e.g., 00:00:10)
- [ ] Set end timestamp (e.g., 00:00:20)
- [ ] Click "Cut Segment"
- [ ] **Verify:** FFmpeg processing starts
- [ ] **Verify:** Progress indicator shown
- [ ] **Verify:** Segment preview generated
- [ ] **Verify:** No console errors

### 3.3 Platform Connections
- [ ] Navigate to Platforms page
- [ ] **Verify:** All platform cards displayed:
  - [ ] YouTube
  - [ ] Instagram
  - [ ] Facebook
  - [ ] TikTok
  - [ ] X (Twitter)
  - [ ] Threads
- [ ] Click "Connect" on any platform
- [ ] **Verify:** Connection modal opens
- [ ] **Verify:** Instructions displayed
- [ ] Close modal
- [ ] **Verify:** Modal closes cleanly

### 3.4 RSS Feeds
- [ ] Navigate to RSS Feeds page
- [ ] Click "Add Feed"
- [ ] Enter feed name and URL
- [ ] **Verify:** Feed added to list
- [ ] Click on feed card
- [ ] **Verify:** Feed preview loads
- [ ] Click "Delete" on feed
- [ ] **Verify:** Confirmation dialog appears
- [ ] Confirm deletion
- [ ] **Verify:** Feed removed from list

### 3.5 TMDb Integration
- [ ] Navigate to TMDb Feeds
- [ ] **Verify:** Feed configuration options shown
- [ ] Enable a feed type (e.g., "Now Playing")
- [ ] **Verify:** Feed activates
- [ ] **Verify:** Settings save
- [ ] Navigate to TMDb Activity
- [ ] **Verify:** Activity log shown
- [ ] **Verify:** Posts display if any exist

---

## 4. UI/UX Tests

### 4.1 Navigation
- [ ] Test main navigation menu
- [ ] Click through all menu items:
  - [ ] Dashboard
  - [ ] Video Studio
  - [ ] Platforms
  - [ ] RSS Feeds
  - [ ] TMDb Feeds
  - [ ] Channels
  - [ ] Settings
- [ ] **Verify:** Each page loads correctly
- [ ] **Verify:** No broken links
- [ ] **Verify:** Smooth transitions

### 4.2 Responsive Design
- [ ] Test on desktop (1920x1080)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667)
- [ ] **Verify:** Layout adapts properly
- [ ] **Verify:** All buttons accessible
- [ ] **Verify:** No horizontal scroll

### 4.3 Dark/Light Mode
- [ ] Toggle theme in settings
- [ ] **Verify:** Theme switches immediately
- [ ] **Verify:** All text readable
- [ ] **Verify:** Focus styling visible in both modes
- [ ] **Verify:** No color contrast issues

### 4.4 Haptic Feedback (Mobile)
- [ ] Test on mobile device
- [ ] Click buttons
- [ ] **Verify:** Haptic feedback fires
- [ ] Navigate between pages
- [ ] **Verify:** Subtle haptics on transitions
- [ ] Show error toast
- [ ] **Verify:** Error haptic pattern

---

## 5. Performance Tests

### 5.1 Load Times
- [ ] Clear browser cache
- [ ] Load app
- [ ] **Measure:** Initial load time < 3 seconds
- [ ] Navigate to Video Studio
- [ ] **Measure:** Page transition < 500ms
- [ ] Upload video
- [ ] **Verify:** Responsive during upload

### 5.2 Memory Usage
- [ ] Open DevTools → Memory
- [ ] Navigate through app for 5 minutes
- [ ] **Verify:** No memory leaks
- [ ] **Verify:** Memory stays under 150MB

### 5.3 Network Efficiency
- [ ] Open DevTools → Network
- [ ] Load app
- [ ] **Verify:** No unnecessary requests
- [ ] **Verify:** Images optimized
- [ ] **Verify:** API calls minimal

---

## 6. Error Handling

### 6.1 Network Errors
- [ ] Disconnect internet
- [ ] Try to upload video
- [ ] **Verify:** Error message shown
- [ ] **Verify:** User informed clearly
- [ ] Reconnect internet
- [ ] Retry upload
- [ ] **Verify:** Upload resumes

### 6.2 Invalid Input
- [ ] Enter invalid URL in RSS feed
- [ ] **Verify:** Validation error shown
- [ ] Enter malformed API key
- [ ] **Verify:** Error message displayed
- [ ] Upload invalid file type
- [ ] **Verify:** File type error shown

### 6.3 Storage Limits
- [ ] Fill localStorage to capacity
- [ ] Try to save settings
- [ ] **Verify:** Graceful error handling
- [ ] **Verify:** User notified

---

## 7. Accessibility Tests

### 7.1 Keyboard Navigation
- [ ] Use Tab key to navigate
- [ ] **Verify:** All interactive elements focusable
- [ ] **Verify:** Focus indicator visible
- [ ] Use Enter/Space to activate buttons
- [ ] **Verify:** All buttons work with keyboard
- [ ] Test arrow keys in menus
- [ ] **Verify:** Menu navigation works

### 7.2 Screen Reader
- [ ] Enable screen reader
- [ ] Navigate through app
- [ ] **Verify:** All buttons announced
- [ ] **Verify:** All inputs labeled
- [ ] **Verify:** All images have alt text
- [ ] **Verify:** Navigation landmarks present

### 7.3 Color Contrast
- [ ] Check all text elements
- [ ] **Verify:** Contrast ratio ≥ 4.5:1 (normal text)
- [ ] **Verify:** Contrast ratio ≥ 3:1 (large text)
- [ ] Test in both light and dark modes

---

## 8. PWA Features

### 8.1 Installation
- [ ] Click browser install prompt
- [ ] **Verify:** App installs to home screen
- [ ] Open installed app
- [ ] **Verify:** Runs as standalone app
- [ ] **Verify:** App icon correct

### 8.2 Offline Capability
- [ ] Install app
- [ ] Disconnect internet
- [ ] Open app
- [ ] **Verify:** Basic functionality works
- [ ] **Verify:** Cached pages load
- [ ] Reconnect internet
- [ ] **Verify:** App syncs data

### 8.3 Service Worker
- [ ] Open DevTools → Application → Service Workers
- [ ] **Verify:** Service worker registered
- [ ] **Verify:** Service worker activated
- [ ] Update app code
- [ ] **Verify:** Service worker updates

---

## 9. Data Persistence

### 9.1 LocalStorage
- [ ] Configure settings
- [ ] Close browser completely
- [ ] Reopen app
- [ ] **Verify:** Settings retained
- [ ] Add RSS feeds
- [ ] Refresh page
- [ ] **Verify:** Feeds persist

### 9.2 Session Management
- [ ] Connect to platform
- [ ] Close tab (not browser)
- [ ] Reopen tab
- [ ] **Verify:** Session maintained
- [ ] Close browser
- [ ] Reopen browser
- [ ] **Verify:** Proper session handling

---

## 10. Critical User Flows

### 10.1 Video Trailer Creation Flow
1. [ ] Navigate to Video Studio
2. [ ] Upload source video
3. [ ] Set title and captions (verify 120-250 char limit)
4. [ ] Select aspect ratio (16:9, 9:16, 1:1)
5. [ ] Choose music genre
6. [ ] Set ducking mode
7. [ ] Add lower thirds
8. [ ] Preview trailer
9. [ ] Export/render trailer
10. [ ] **Verify:** No errors throughout flow

### 10.2 Platform Posting Flow
1. [ ] Navigate to Platforms
2. [ ] Connect to YouTube
3. [ ] Enter API credentials
4. [ ] **Verify:** Connection successful
5. [ ] Navigate to Video Studio
6. [ ] Create trailer
7. [ ] Select "Post to YouTube"
8. [ ] **Verify:** Post options shown
9. [ ] Enter post details
10. [ ] **Verify:** Validation works

### 10.3 RSS Feed Management Flow
1. [ ] Navigate to RSS Feeds
2. [ ] Click "Add Feed"
3. [ ] Enter feed details
4. [ ] Enable auto-import
5. [ ] Set schedule
6. [ ] **Verify:** Feed added
7. [ ] Wait for feed update
8. [ ] Navigate to Activity
9. [ ] **Verify:** Feed items appear
10. [ ] **Verify:** Status updates shown

---

## Test Summary

### Critical Issues Found
_List any critical issues discovered during testing:_

1. 
2. 
3. 

### Minor Issues Found
_List any minor issues discovered during testing:_

1. 
2. 
3. 

### Improvements Suggested
_List any suggested improvements:_

1. 
2. 
3. 

### Overall Assessment
- [ ] ✅ All tests passed - Ready for production
- [ ] ⚠️ Minor issues found - Can deploy with fixes planned
- [ ] ❌ Critical issues found - Do not deploy

---

## Sign-off

**Tester Name:** _____________________  
**Date:** _____________________  
**Time Spent:** _____ hours  
**Signature:** _____________________

---

## Notes

_Add any additional notes or observations:_




