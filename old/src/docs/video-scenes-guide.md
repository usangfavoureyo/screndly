# Video Scenes Module - User Guide

## Quick Start

The Video Scenes Module allows you to cut precise segments from videos using manual timestamps. No AI detection. No guessing. Just mechanical, frame-accurate cuts.

## Step-by-Step Instructions

### 1. **Enter Movie/TV Show Title** (Optional)
```
e.g., "The Dark Knight" or "Breaking Bad S01E01"
```
This will be used in the output filename.

### 2. **Select Video Source**

#### Option A: Upload Local File
- Click "Upload Local File"
- Select MP4, MOV, or other video formats
- File stays on your device (never uploaded)

#### Option B: Backblaze Cloud Video
- Click "Browse Backblaze"
- Navigate your cloud storage
- Select video directly from cloud
- No download required

### 3. **Enter Timestamps**

#### Format Options
- **HH:MM:SS** (Hours:Minutes:Seconds)
  - Example: `01:23:45` = 1 hour, 23 minutes, 45 seconds
- **MM:SS** (Minutes:Seconds)
  - Example: `23:45` = 23 minutes, 45 seconds

#### Example Use Cases
```
Action Scene:     00:45:20 → 00:47:35 (2m 15s)
Opening Credits:  00:00:00 → 00:02:30 (2m 30s)
Cliffhanger:      00:38:15 → 00:39:00 (45s)
```

### 4. **Review Clip Duration**
- Blue preview box shows calculated duration
- Example: "📹 Clip Duration: **135s**"
- Verify before processing

### 5. **Cut Scene**
Click "Cut & Generate Scene" button

**First-Time Processing:**
```
5%   - Loading FFmpeg.wasm...
15%  - Loading video file...
30%  - Preparing to cut video...
35%  - Cutting from 00:12:34 to 00:15:20...
90%  - Reading output file...
100% - Complete!
```

**Subsequent Cuts:**
- Instant start (FFmpeg already loaded)
- Faster processing
- Same quality

### 6. **Preview & Download**
- ✅ Green success banner appears
- 🎬 Video preview player shown
- 💾 "Download Scene" button available
- Filename: `{MovieTitle}_{StartTime}_{EndTime}.mp4`

## Features

### ✂️ **Precision Cutting**
- Frame-accurate timestamps
- No quality loss (`-c copy` flag)
- Mechanical extraction only

### 🚀 **Performance**
- **First cut:** ~10-15 seconds (load FFmpeg)
- **Next cuts:** Instant (already loaded)
- Processing speed: Depends on clip length

### 💰 **Cost-Effective**
- **Local files:** $0 (browser-only)
- **Backblaze:** Free (within egress limits)
- **No server costs**

### 🔒 **Privacy**
- 100% client-side processing
- Videos never leave your device
- No cloud upload (except Backblaze source)

## Tips & Tricks

### 🎯 **Find Exact Timestamps**
1. Use VLC Media Player:
   - Tools → Media Information
   - Shows current timestamp
2. Use YouTube (if available):
   - Pause at desired frame
   - Check video progress bar

### ⚡ **Optimize Performance**
- Keep clips under 10 minutes for best performance
- Use `-c copy` (automatic) for lossless cutting
- Close other browser tabs during processing

### 📝 **Naming Conventions**
Use descriptive titles:
- ✅ `Inception_Dream_Sequence`
- ✅ `Breaking_Bad_S05E14_Finale`
- ❌ `video1`

### 🎬 **Common Cuts**
```
Trailer Scenes:      30-90 seconds
Reaction Clips:      5-30 seconds
Full Scenes:         2-5 minutes
Compilation Clips:   Multiple cuts needed
```

## Troubleshooting

### ❌ **"Invalid timestamp format"**
**Problem:** Wrong format entered
**Solution:** Use `HH:MM:SS` or `MM:SS`
```
❌ 1:23:4    (missing zero)
✅ 01:23:04  (correct)

❌ 83:45     (invalid minutes)
✅ 01:23:45  (correct)
```

### ❌ **"End time must be after start time"**
**Problem:** End timestamp before start
**Solution:** Swap timestamps
```
❌ Start: 00:15:00, End: 00:10:00
✅ Start: 00:10:00, End: 00:15:00
```

### ⏳ **"Processing taking too long"**
**Problem:** Large file or first-time load
**Solutions:**
1. Wait for FFmpeg initialization (first time only)
2. Check internet connection (for Backblaze files)
3. Try smaller clip duration
4. Refresh page and retry

### 🌐 **"Failed to load FFmpeg"**
**Problem:** Browser compatibility or network
**Solutions:**
1. Use Chrome, Edge, Firefox, or Safari (latest)
2. Check browser console for errors
3. Disable ad blockers temporarily
4. Try incognito/private mode

## Advanced Usage

### 🔗 **Backblaze Integration**
```
1. Configure Backblaze credentials in Settings
2. Browse cloud storage in Video Scenes
3. Select video (no download)
4. FFmpeg fetches only needed segment
5. Cost: Free (within 3x storage egress)
```

### 📊 **Output Details**
```
Format:     MP4
Codec:      Same as input (stream copy)
Quality:    Lossless (no re-encoding)
Size:       Proportional to duration
Bitrate:    Same as source
```

### 🎞️ **Batch Processing**
For multiple cuts from same video:
1. Cut first scene
2. Download
3. Enter new timestamps
4. Cut again (instant - FFmpeg loaded)
5. Repeat

## Workflow Examples

### Example 1: Social Media Clip
```
1. Movie: "Interstellar"
2. Source: Backblaze cloud
3. Start: 01:45:20
4. End: 01:46:35
5. Duration: 75s
6. Output: Interstellar_01-45-20_01-46-35.mp4
7. Use: Instagram Reel
```

### Example 2: Trailer Montage
```
Scene 1: 00:12:00 → 00:12:15 (15s)
Scene 2: 00:34:20 → 00:34:40 (20s)
Scene 3: 00:58:10 → 00:58:25 (15s)

Total: 3 cuts, 50s footage
Combine in external editor
```

### Example 3: Analysis Clip
```
1. Movie: "The Matrix"
2. Source: Local file
3. Start: 00:23:45
4. End: 00:25:10
5. Duration: 85s
6. Purpose: Video essay scene
```

## Technical Specifications

### Supported Formats
- **Input:** MP4, MOV, AVI, MKV, WebM
- **Output:** MP4 (H.264/AAC)

### Browser Requirements
- Chrome 91+
- Edge 91+
- Safari 15.4+
- Firefox 89+
- WebAssembly support required

### File Size Limits
- **Local:** Limited by browser memory (~2-4GB)
- **Backblaze:** Unlimited (fetched as stream)

### Processing Speed
```
30s clip  → ~5-10 seconds
2m clip   → ~15-30 seconds
5m clip   → ~30-60 seconds
10m clip  → ~1-2 minutes
```

## FAQ

**Q: Does this re-encode the video?**
A: No. Uses `-c copy` for stream copying (lossless).

**Q: Can I cut from Backblaze without downloading?**
A: Yes. FFmpeg.wasm fetches only the needed segment.

**Q: Why does first cut take longer?**
A: FFmpeg.wasm initialization (~10-15s). Cached afterward.

**Q: Is there a clip length limit?**
A: No hard limit, but shorter clips (<10m) process faster.

**Q: Can I extract audio only?**
A: Not yet. Video output only (with audio track).

**Q: Does this work offline?**
A: Partial. Local files work offline. Backblaze requires internet.

## Best Practices

### ✅ Do's
- ✅ Use descriptive movie titles
- ✅ Verify timestamps before cutting
- ✅ Keep clips under 10 minutes
- ✅ Test with small clip first
- ✅ Save important clips immediately

### ❌ Don'ts
- ❌ Don't close browser during processing
- ❌ Don't cut entire movies (use original)
- ❌ Don't exceed browser memory limits
- ❌ Don't rely on auto-save (manual download)

## Support

For issues or questions:
1. Check browser console (F12)
2. Verify timestamp format
3. Test with smaller clip
4. Review troubleshooting section
5. Check FFmpeg logs in console

## Keyboard Shortcuts

```
None currently implemented
Future: Timeline scrubbing, quick timestamp entry
```

## Related Features

- **Video Review:** Analyze full trailers
- **Video Studio Activity:** Track all cuts
- **Backblaze Integration:** Cloud storage access
- **Lower Thirds:** Add text overlays (separate module)

---

**Last Updated:** December 2024
**FFmpeg Version:** 0.12.6 (via WebAssembly)
**Module Status:** ✅ Production Ready
