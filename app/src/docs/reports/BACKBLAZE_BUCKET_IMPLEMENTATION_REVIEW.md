# Backblaze B2 Bucket Implementation Review

**Date:** December 9, 2025  
**Status:** ✅ Dual-Bucket Security Isolation Complete

---

## 📋 Executive Summary

Screndly now implements a **dual-bucket architecture** with separate Backblaze B2 buckets for improved security isolation:
- **General Bucket:** For trailer uploads and general storage
- **Videos Bucket:** Dedicated for movies and TV shows content (Video Scenes Module)

Each bucket has its own application keys for **enhanced security** and **granular access control**.

---

## 🗂️ Bucket Configuration

### 1. General Storage Bucket
**Purpose:** Trailer uploads and general file storage

**Settings Location:** `/contexts/SettingsContext.tsx` (Lines 12-14)
```typescript
backblazeKeyId: string;
backblazeApplicationKey: string;
backblazeBucketName: string;
```

**UI Configuration:** `/components/settings/ApiKeysSettings.tsx` (Lines 134-182)
- Key ID input (password field)
- Application Key input (password field)
- Bucket Name input
- Label: "Backblaze B2 - General Storage"
- Description: "For trailer uploads"

**Default Values:**
- All fields default to empty strings
- Users must configure credentials in Settings → API Keys

---

### 2. Videos Bucket (Movies & TV Shows)
**Purpose:** Dedicated storage for movies and TV shows video content used in the Video Scenes Module

**Settings Location:** `/contexts/SettingsContext.tsx` (Lines 15-17)
```typescript
backblazeVideosKeyId: string;
backblazeVideosApplicationKey: string;
backblazeVideosBucketName: string;
```

**UI Configuration:** `/components/settings/ApiKeysSettings.tsx` (Lines 184-230)
- Key ID input (password field)
- Application Key input (password field)
- Bucket Name input (placeholder: "screndly-videos")
- Label: "Backblaze B2 - Videos Bucket"
- Description: "For movies and TV shows (Video Scenes Module)"
- Separated with border-top divider for visual distinction

**Default Values:**
- All fields default to empty strings
- Independent configuration from general bucket

---

## 🔧 Implementation Details

### Components Using Videos Bucket

#### 1. BackblazeVideoBrowser.tsx
**Location:** `/components/BackblazeVideoBrowser.tsx`

**Purpose:** Browse and select video files from the Videos Bucket

**Credentials Used:** (Lines 48-62)
```typescript
settings.backblazeVideosKeyId
settings.backblazeVideosApplicationKey
settings.backblazeVideosBucketName
```

**Features:**
- Lists all video files from Videos Bucket
- Filters for video file types: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.m4v`
- Search functionality by filename
- File metadata display (size, upload date)
- Error handling with user-friendly messages

**Error Message:**
```
"Backblaze Videos Bucket not configured"
Description: "Add credentials in Settings → API Keys → Videos Bucket"
```

---

#### 2. SubtitleTimestampAssist.tsx
**Location:** `/components/SubtitleTimestampAssist.tsx`

**Purpose:** Load subtitle files (.srt) from the Videos Bucket for timestamp assistance

**Credentials Used:** (Lines 87-101)
```typescript
settings.backblazeVideosKeyId
settings.backblazeVideosApplicationKey
settings.backblazeVideosBucketName
```

**Features:**
- Loads subtitle files from Videos Bucket
- Filters for subtitle formats: `.srt`, `.vtt`, `.sub`
- Parses and validates SRT format
- Integrates with AI Assist for dialogue-based scene finding
- Download sample SRT functionality

**Error Message:**
```
"Backblaze Videos Bucket not configured"
Description: "Add credentials in Settings → API Keys → Videos Bucket"
```

**Button Text:**
- "Backblaze" button to browse cloud subtitle files
- Located alongside "Local File" upload option

---

### Components Using General Bucket

#### 1. BackblazeUploader.tsx
**Location:** `/components/BackblazeUploader.tsx`

**Purpose:** Upload video files to the General Bucket

**Credentials Retrieved Via:** `utils/backblaze.ts` → `getBackblazeConfig()`
```typescript
const keyId = localStorage.getItem('backblazeKeyId');
const applicationKey = localStorage.getItem('backblazeApplicationKey');
const bucketName = localStorage.getItem('backblazeBucketName');
```

**Features:**
- Drag-and-drop file upload
- Progress tracking
- File size validation (default 500MB max)
- Custom file naming with prefix
- Success/error state handling

**Error Message:**
```
"Backblaze B2 not configured. Please add your credentials in Settings → API Keys"
```

---

### Utility Functions

#### `/utils/backblaze.ts`

**Key Functions:**

1. **`getBackblazeConfig()`** (Lines 38-54)
   - Retrieves general bucket credentials from localStorage
   - Returns `null` if not configured
   - Default endpoint: `s3.us-west-004.backblazeb2.com`

2. **`uploadToBackblaze()`** (Lines 60-152)
   - Uses general bucket credentials
   - S3-compatible API upload
   - Progress tracking with callbacks
   - Basic authentication with keyId:applicationKey
   - Returns public URL on success

3. **`deleteFromBackblaze()`** (Lines 157-181)
   - Deletes files from general bucket
   - Uses DELETE method on S3-compatible API

4. **`listBackblazeFiles()`** (Lines 266-337)
   - **Generic function** - accepts credentials as parameters
   - Used by both bucket types (passed different credentials)
   - Parses S3 XML response
   - Returns file metadata: fileName, fileId, contentType, contentLength, uploadTimestamp, url

5. **`generateFileName()`** (Lines 186-200)
   - Creates unique filenames with timestamp and random string
   - Format: `{prefix}-{baseName}-{timestamp}-{random}.{ext}`

6. **`getPublicUrl()`** (Lines 205-213)
   - Generates public URL for files in general bucket

7. **`isBackblazeConfigured()`** (Lines 218-220)
   - Checks if general bucket is configured

8. **`validateBackblazeConfig()`** (Lines 225-261)
   - Validates general bucket credentials by attempting list operation

---

## 🔐 Security Architecture

### Bucket Separation Benefits

1. **Access Control Isolation**
   - General bucket: Broader access for trailer uploads
   - Videos bucket: Restricted access for sensitive content library

2. **Independent Application Keys**
   - Separate API keys per bucket
   - Revoke access to one bucket without affecting the other
   - Different permission levels per bucket

3. **Storage Organization**
   - Clear separation of content types
   - Easier bucket lifecycle management
   - Simplified cleanup policies per content type

4. **Credential Rotation**
   - Rotate keys independently
   - Minimize blast radius if credentials are compromised

---

## 📊 Current Usage Mapping

| Component | Bucket Used | Purpose | Credentials Source |
|-----------|-------------|---------|-------------------|
| `BackblazeUploader` | General | Upload trailers | `settings.backblazeKeyId/ApplicationKey/BucketName` |
| `BackblazeVideoBrowser` | Videos | Browse movies/TV content | `settings.backblazeVideosKeyId/ApplicationKey/BucketName` |
| `SubtitleTimestampAssist` | Videos | Load subtitle files | `settings.backblazeVideosKeyId/ApplicationKey/BucketName` |

---

## ⚙️ Settings Storage

### SettingsContext Persistence
**Location:** `/contexts/SettingsContext.tsx`

**Auto-save Behavior:** (Lines 354-362)
- Debounced save to localStorage (1 second delay)
- Storage key: `'screndlySettings'`
- Full settings object serialized as JSON

**Merging Strategy:** (Lines 336-345)
- On load, merges saved settings with defaults
- Ensures new fields exist even in older saved data
- Preserves platform-specific blacklist configurations

---

## 🎯 UI/UX Considerations

### Input Focus Styling
**Current Implementation:**
- Focus events trigger haptics: `onFocus={() => haptics.light()}`
- Standard border focus via default input styling
- **Note:** Grey `#292929` focus styling update is pending across all inputs

### Password Fields
- All Key ID and Application Key inputs use `type="password"`
- Masked for security when configuring credentials

### Visual Hierarchy
- General bucket section appears first
- Videos bucket section separated with top border (`border-t`)
- Each bucket has clear heading and description
- Distinct placeholders: "my-screndly-bucket" vs "screndly-videos"

---

## 🚨 Error Handling

### Validation Checks

1. **Component Level:** (Example from BackblazeVideoBrowser.tsx)
```typescript
if (!settings.backblazeVideosKeyId || 
    !settings.backblazeVideosApplicationKey || 
    !settings.backblazeVideosBucketName) {
  toast.error('Backblaze Videos Bucket not configured', {
    description: 'Add credentials in Settings → API Keys → Videos Bucket'
  });
  return;
}
```

2. **Utility Level:** (`utils/backblaze.ts`)
```typescript
if (!config) {
  return {
    success: false,
    error: 'Backblaze B2 not configured. Please add your credentials...'
  };
}
```

### User Feedback
- Toast notifications for all errors
- Haptic feedback on errors: `haptics.error()`
- Descriptive error messages with actionable guidance
- Loading states during API calls

---

## 📝 Future Considerations

### Potential Enhancements

1. **Endpoint Configuration**
   - Allow users to customize S3-compatible endpoint per bucket
   - Currently hardcoded to `s3.us-west-004.backblazeb2.com`

2. **Bucket Validation**
   - Add "Test Connection" button for each bucket in settings
   - Real-time validation feedback

3. **Usage Statistics**
   - Display storage usage per bucket
   - Track upload/download bandwidth

4. **Bucket-Specific Upload Limits**
   - Different max file size limits per bucket
   - Content-type restrictions per bucket

5. **Multi-Region Support**
   - Allow selection of Backblaze region per bucket
   - Optimize for geographic distribution

6. **Unified File Browser**
   - Option to browse both buckets in single interface
   - Clear visual distinction of bucket source per file

---

## ✅ Verification Checklist

- [x] Dual bucket configuration in SettingsContext
- [x] Separate UI sections in ApiKeysSettings
- [x] BackblazeVideoBrowser uses Videos Bucket
- [x] SubtitleTimestampAssist uses Videos Bucket
- [x] BackblazeUploader uses General Bucket
- [x] Error messages reference correct bucket
- [x] Password fields for all credential inputs
- [x] Auto-save to localStorage implemented
- [x] Default values properly initialized
- [x] Haptic feedback on user interactions

---

## 🔄 Migration Path

For users upgrading from single-bucket setup:

1. Existing credentials remain in general bucket settings
2. Videos bucket credentials start empty
3. No breaking changes - components gracefully handle missing Videos Bucket config
4. User can continue with general bucket only (reduced functionality)
5. Full feature access requires configuring both buckets

---

## 📌 Related Files

### Core Implementation
- `/contexts/SettingsContext.tsx` - Settings definitions and persistence
- `/components/settings/ApiKeysSettings.tsx` - UI for credential configuration
- `/utils/backblaze.ts` - API utilities and authentication

### Components Using Videos Bucket
- `/components/BackblazeVideoBrowser.tsx` - Video file browser
- `/components/SubtitleTimestampAssist.tsx` - Subtitle file loader

### Components Using General Bucket
- `/components/BackblazeUploader.tsx` - File uploader

### Integration Points
- `/components/VideoStudioPage.tsx` - Parent container for Video Scenes module
- All haptics calls reference `/utils/haptics.ts`
- Toast notifications via `sonner@2.0.3`

---

## 🎨 Pending: Input Focus Styling

**Requirement from Background:**
> "updating input focus styling to grey `#292929` across the app"

**Current State:**
- Input focus uses default browser/Tailwind styling
- Haptic feedback implemented on focus events

**To Implement:**
- Apply `focus:border-[#292929]` or `focus:ring-[#292929]` to all Input components
- Update `/components/ui/input.tsx` base styles
- Verify consistency across both bucket configuration sections

---

## Summary

The Backblaze B2 dual-bucket implementation is **fully functional** with proper security isolation. The Videos Bucket is correctly integrated into the Video Scenes Module components (`BackblazeVideoBrowser` and `SubtitleTimestampAssist`), while the General Bucket continues to serve trailer upload needs. 

All credential management flows through the centralized `SettingsContext`, with clear UI separation in the Settings page, comprehensive error handling, and user-friendly feedback mechanisms.

**Next Steps:**
1. Review input focus styling consistency (`#292929`)
2. Consider adding bucket validation/testing features
3. Monitor for any additional components that should use the Videos Bucket
