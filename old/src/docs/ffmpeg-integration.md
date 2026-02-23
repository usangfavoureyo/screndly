# FFmpeg.wasm Video Cutting Integration

## Overview

The Video Scenes module uses **FFmpeg.wasm** to perform mechanical video cuts directly in the browser. No server required. No scene detection. Pure precision extraction.

## How It Works

### 1. **Manual Timestamp Entry**
- User provides exact start and end times (HH:MM:SS or MM:SS format)
- No automatic scene detection
- User controls every cut

### 2. **FFmpeg Command Execution**
```bash
ffmpeg -i input.mp4 -ss 00:12:34 -to 00:15:20 -c copy output.mp4
```

**Flags:**
- `-i input.mp4` - Input file (local or Backblaze URL)
- `-ss 00:12:34` - Start timestamp
- `-to 00:15:20` - End timestamp
- `-c copy` - Stream copy (no re-encoding, fast & lossless)

### 3. **Processing Pipeline**

```
User Input → Load FFmpeg.wasm → Load Video → Execute Cut → Download
    ↓              ↓                  ↓            ↓          ↓
Timestamps    (~10-15s first)    File/URL    -c copy    Blob URL
```

## Features

### ✅ **Local Files**
- Upload video from device
- Processed entirely in browser
- No server costs
- Privacy-focused (never leaves device)

### ☁️ **Backblaze Cloud Videos**
- Direct URL access (no download)
- FFmpeg.wasm fetches only needed data
- Seamless cloud integration
- Cost-effective (free egress within limits)

### 📊 **Progress Tracking**
- Real-time progress updates
- Step-by-step status messages
- Accurate percentage completion

### 💾 **Output**
- MP4 format
- Blob URL for preview
- Instant download
- Filename: `{movieTitle}_{startTime}_{endTime}.mp4`

## Performance

### First-Time Load
- **10-15 seconds** - FFmpeg.wasm initialization
- Downloads ~30MB of WASM files
- Cached by browser for subsequent uses

### Subsequent Cuts
- **Instant** - FFmpeg already loaded
- Processing time depends on:
  - Video size
  - Clip duration
  - Browser performance

### `-c copy` Optimization
- No re-encoding
- Direct stream copy
- **10-100x faster** than re-encoding
- Lossless quality

## Code Structure

### `/utils/ffmpeg.ts`
Main utilities:
- `loadFFmpeg()` - Lazy initialization
- `cutVideoSegment()` - Execute cut command
- `validateTimestamp()` - Format validation
- `getClipDuration()` - Calculate duration

### `/components/VideoStudioPage.tsx`
Integration:
- `handleCutScene()` - Main cut handler
- `handleDownloadScene()` - Download output
- Progress tracking
- UI state management

## API

### Cut Video Segment

```typescript
const result = await cutVideoSegment({
  input: File | string,        // Local file or URL
  startTime: "00:12:34",       // HH:MM:SS or MM:SS
  endTime: "00:15:20",         // HH:MM:SS or MM:SS
  outputFormat: "mp4",         // Default: mp4
  onProgress: (progress, msg) => {
    console.log(`${progress}%: ${msg}`);
  }
});

if (result.success) {
  // Download or preview
  const url = result.outputUrl;
  const blob = result.outputBlob;
}
```

## Timestamp Format

### Accepted Formats
- `HH:MM:SS` - Hours:Minutes:Seconds (e.g., `01:23:45`)
- `MM:SS` - Minutes:Seconds (e.g., `23:45`)

### Validation
- Auto-formatted as user types
- Colon insertion at correct positions
- Real-time duration preview
- Error handling for invalid ranges

## Error Handling

### Common Errors
1. **End time before start time**
   - Validation before processing
   - User-friendly error message

2. **Invalid timestamp format**
   - Real-time format validation
   - Helpful format hints

3. **FFmpeg load failure**
   - Retry mechanism
   - Clear error reporting

4. **Network issues (Backblaze)**
   - Timeout handling
   - Fallback suggestions

## Cost Analysis

### Local Files
- **$0** - Runs entirely in browser
- No bandwidth costs
- No server infrastructure

### Backblaze Files
- **First cut:** Free (within 3x storage egress)
- **Example:** 
  - 200GB stored → 600GB free egress/month
  - 30-minute video = ~2GB
  - 300 cuts per month = FREE

### vs. Server-Side Processing
- Server: $50-200/month (EC2, Lambda, etc.)
- FFmpeg.wasm: $0/month
- **Savings: $600-2,400/year**

## Browser Compatibility

### Supported
- ✅ Chrome 91+
- ✅ Edge 91+
- ✅ Safari 15.4+
- ✅ Firefox 89+

### Requirements
- SharedArrayBuffer support
- WebAssembly support
- Modern JavaScript (ES2020+)

## Future Enhancements

### Potential Features
- [ ] GPU-accelerated encoding
- [ ] Multi-clip batch processing
- [ ] Advanced filters (blur, color grading)
- [ ] Audio normalization
- [ ] Multiple output formats (WebM, AV1)

### Current Scope
- ✅ Simple, fast, mechanical cuts
- ✅ No unnecessary features
- ✅ Production-ready
- ✅ Cost-effective

## Usage Example

```typescript
// 1. User uploads video or selects from Backblaze
const videoFile = /* File or Backblaze URL */;

// 2. User enters timestamps manually
const startTime = "00:12:34";
const endTime = "00:15:20";

// 3. Cut scene
const result = await cutVideoSegment({
  input: videoFile,
  startTime,
  endTime,
  onProgress: (progress, message) => {
    updateUI(progress, message);
  }
});

// 4. Download
if (result.success) {
  downloadFile(result.outputBlob, 'scene.mp4');
}
```

## Minimal-Cost Workflow

This is the **minimal-cost workflow** mentioned:
1. ✅ Manual timestamp entry (user controls)
2. ✅ FFmpeg mechanical cut (no AI detection)
3. ✅ Browser-based processing (no servers)
4. ✅ `-c copy` flag (no re-encoding)
5. ✅ Backblaze integration (cheap storage)

**Total monthly cost: $0-10** (depending on Backblaze usage)

## Support

For issues or questions:
1. Check browser console for FFmpeg logs
2. Verify timestamp format
3. Test with smaller video first
4. Check browser compatibility
