# FFmpeg.wasm Quick Reference

## 🚀 One-Line Summary
**Browser-based video cutting with manual timestamps, zero server costs, lossless quality.**

---

## 📋 Command Reference

### Core FFmpeg Command
```bash
ffmpeg -i input.mp4 -ss 00:12:34 -to 00:15:20 -c copy output.mp4
```

| Flag | Purpose | Value |
|------|---------|-------|
| `-i` | Input file | File or URL |
| `-ss` | Start timestamp | HH:MM:SS |
| `-to` | End timestamp | HH:MM:SS |
| `-c copy` | Stream copy | No re-encoding |

---

## 🎯 Timestamp Formats

### Accepted
```
HH:MM:SS  →  01:23:45  (1h 23m 45s)
MM:SS     →  23:45     (23m 45s)
```

### Examples
```javascript
validateTimestamp('01:23:45')  // ✅ true
validateTimestamp('23:45')     // ✅ true
validateTimestamp('1:23:45')   // ❌ false (missing zero)
validateTimestamp('60:00')     // ❌ false (invalid minutes)
```

---

## 💻 Code Usage

### Cut Video
```typescript
import { cutVideoSegment } from '@/utils/ffmpeg';

const result = await cutVideoSegment({
  input: videoFile,           // File or URL
  startTime: '00:12:34',      // Start timestamp
  endTime: '00:15:20',        // End timestamp
  outputFormat: 'mp4',        // Optional, default: mp4
  onProgress: (progress, message) => {
    console.log(`${progress}%: ${message}`);
  }
});

if (result.success) {
  const { outputUrl, outputBlob, duration } = result;
  // Download or preview
}
```

### Validate Timestamps
```typescript
import { validateTimestamp } from '@/utils/ffmpeg';

const valid = validateTimestamp('01:23:45');  // true
```

### Calculate Duration
```typescript
import { getClipDuration } from '@/utils/ffmpeg';

const seconds = getClipDuration('00:12:00', '00:14:15');
// Returns: 135 (2m 15s)
```

---

## ⚡ Performance

| Scenario | Time | Notes |
|----------|------|-------|
| First Load | 10-15s | FFmpeg.wasm initialization |
| Subsequent Loads | Instant | Cached in browser |
| 30s Clip | 5-10s | Depends on browser |
| 2m Clip | 15-30s | Stream copy (fast) |
| 10m Clip | 1-2m | Still fast (-c copy) |

---

## 💰 Cost Analysis

| Source | Processing | Bandwidth | Total |
|--------|-----------|-----------|-------|
| Local File | $0 | $0 | **$0** |
| Backblaze | $0 | Free* | **$0*** |

*Free within 3x storage egress limit

---

## 🎬 Common Use Cases

### Social Media Clips
```typescript
// Instagram Reel (15-90s)
getClipDuration('00:00:00', '00:01:30')  // 90s

// TikTok (15-60s)
getClipDuration('01:23:00', '01:23:45')  // 45s

// YouTube Short (up to 60s)
getClipDuration('00:12:00', '00:13:00')  // 60s
```

### Trailer Scenes
```typescript
// Action sequence (2-3 minutes)
getClipDuration('00:45:20', '00:47:35')  // 135s

// Opening credits (2-3 minutes)
getClipDuration('00:00:00', '00:02:30')  // 150s

// Cliffhanger ending (30-60s)
getClipDuration('00:38:15', '00:39:00')  // 45s
```

---

## 🔧 Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid timestamp" | Wrong format | Use HH:MM:SS or MM:SS |
| "End before start" | Reversed times | Swap timestamps |
| "Failed to load FFmpeg" | Browser issue | Update browser, disable adblock |
| Processing timeout | Large file | Reduce clip length |

---

## 🌐 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 91+ | ✅ Full Support |
| Edge | 91+ | ✅ Full Support |
| Safari | 15.4+ | ✅ Full Support |
| Firefox | 89+ | ✅ Full Support |

**Requirements:**
- WebAssembly support
- SharedArrayBuffer support
- Modern JavaScript (ES2020+)

---

## 📦 File Support

### Input Formats
```
MP4, MOV, AVI, MKV, WebM, FLV, WMV
```

### Output Format
```
MP4 (H.264 video + AAC audio)
```

### Size Limits
- **Local:** ~2-4GB (browser memory)
- **Backblaze:** Unlimited (streamed)

---

## 🎯 Workflow Checklist

- [ ] Enter video title (optional)
- [ ] Select video source (local or Backblaze)
- [ ] Enter start timestamp (HH:MM:SS)
- [ ] Enter end timestamp (HH:MM:SS)
- [ ] Verify clip duration preview
- [ ] Click "Cut & Generate Scene"
- [ ] Wait for processing (10-60s)
- [ ] Preview in video player
- [ ] Download output file

---

## 📊 Output Details

| Property | Value |
|----------|-------|
| Format | MP4 |
| Video Codec | Same as input (copy) |
| Audio Codec | Same as input (copy) |
| Quality | Lossless (no re-encoding) |
| Bitrate | Same as source |
| Resolution | Same as source |
| Filename | `{title}_{start}_{end}.mp4` |

---

## 🔍 Debug Commands

### Check if FFmpeg loaded
```typescript
import { isFFmpegLoaded } from '@/utils/ffmpeg';
console.log(isFFmpegLoaded());  // true or false
```

### Load FFmpeg manually
```typescript
import { loadFFmpeg } from '@/utils/ffmpeg';
const ffmpeg = await loadFFmpeg(progress => {
  console.log(`Loading: ${progress}%`);
});
```

### Browser console
```javascript
// View FFmpeg logs
// Check console for [FFmpeg] messages during processing
```

---

## 📝 Integration Points

### VideoStudioPage.tsx
```typescript
// State
const [scenesOutputUrl, setScenesOutputUrl] = useState('');
const [scenesOutputBlob, setScenesOutputBlob] = useState<Blob | null>(null);

// Cut handler
const handleCutScene = async () => {
  const result = await cutVideoSegment({ /* ... */ });
  if (result.success) {
    setScenesOutputUrl(result.outputUrl);
    setScenesOutputBlob(result.outputBlob);
  }
};

// Download handler
const handleDownloadScene = () => {
  const a = document.createElement('a');
  a.href = scenesOutputUrl;
  a.download = `${scenesMovieTitle}_${scenesStartTime}_${scenesEndTime}.mp4`;
  a.click();
};
```

---

## 🚦 Status Indicators

### UI States
```typescript
scenesIsProcessing      // Currently cutting
scenesProgress          // 0-100 percentage
scenesProgressMessage   // Status text
scenesOutputUrl         // Ready to download
```

### Progress Messages
```
5%   → "Loading FFmpeg.wasm..."
15%  → "Loading video file..."
30%  → "Preparing to cut video..."
35%  → "Cutting from 00:12:34 to 00:15:20..."
90%  → "Reading output file..."
100% → "Complete!"
```

---

## 🎓 Learning Resources

### FFmpeg Command Reference
```bash
# Basic cut
ffmpeg -i input.mp4 -ss 00:01:00 -to 00:02:00 -c copy output.mp4

# With re-encoding (slower, not used)
ffmpeg -i input.mp4 -ss 00:01:00 -to 00:02:00 output.mp4

# Audio only extraction (future feature)
ffmpeg -i input.mp4 -ss 00:01:00 -to 00:02:00 -vn -c:a copy audio.aac
```

### Useful Links
- FFmpeg.wasm: https://github.com/ffmpegwasm/ffmpeg.wasm
- FFmpeg Docs: https://ffmpeg.org/documentation.html
- WebAssembly: https://webassembly.org/

---

## 🎯 Production Checklist

- [x] FFmpeg.wasm integration
- [x] Local file support
- [x] Backblaze cloud support
- [x] Progress tracking
- [x] Error handling
- [x] Download functionality
- [x] Video preview
- [x] Timestamp validation
- [x] Duration calculation
- [x] User-friendly UI
- [x] Mobile responsive
- [x] Dark mode support
- [x] Haptic feedback
- [x] Toast notifications
- [x] Documentation
- [x] Unit tests

---

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Last Updated:** December 2024
