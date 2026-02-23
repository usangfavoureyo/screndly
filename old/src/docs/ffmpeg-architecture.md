# FFmpeg.wasm Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SCRENDLY WEB APP                            │
│                     (React + TypeScript + Vite)                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      VIDEO STUDIO PAGE                              │
│                  (/components/VideoStudioPage.tsx)                  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Video Scenes Module UI                                       │ │
│  │                                                              │ │
│  │  • Movie Title Input                                        │ │
│  │  • Video Source Selector (Local / Backblaze)                │ │
│  │  • Timestamp Inputs (Start / End)                           │ │
│  │  • Duration Preview                                         │ │
│  │  • Cut & Generate Button                                    │ │
│  │  • Progress Bar                                             │ │
│  │  • Video Preview Player                                     │ │
│  │  • Download Button                                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Event Handlers:                                                   │
│  • handleCutScene()      → Initiate cutting                       │
│  • handleDownloadScene() → Download output                        │
│                                                                     │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FFMPEG UTILITIES                               │
│                      (/utils/ffmpeg.ts)                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ loadFFmpeg()                                                 │ │
│  │ • Lazy initialization                                        │ │
│  │ • Download from CDN (unpkg.com)                             │ │
│  │ • Cache in browser                                          │ │
│  │ • Return FFmpeg instance                                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ cutVideoSegment()                                            │ │
│  │ • Load FFmpeg.wasm                                          │ │
│  │ • Load video (File or URL)                                  │ │
│  │ • Execute: ffmpeg -i ... -ss ... -to ... -c copy ...       │ │
│  │ • Generate Blob URL                                         │ │
│  │ • Return output                                             │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ validateTimestamp()                                          │ │
│  │ • Check HH:MM:SS or MM:SS format                            │ │
│  │ • Validate ranges (0-59 for minutes/seconds)                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ getClipDuration()                                            │ │
│  │ • Convert timestamps to seconds                             │ │
│  │ • Calculate difference                                      │ │
│  │ • Return duration                                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FFMPEG.WASM CORE                               │
│                 (@ffmpeg/ffmpeg + @ffmpeg/util)                     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ FFmpeg WebAssembly Binary                                    │ │
│  │ • Runs in browser                                            │ │
│  │ • Full FFmpeg functionality                                  │ │
│  │ • No server required                                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Commands:                                                         │
│  • -i       → Input file                                          │
│  • -ss      → Start timestamp                                     │
│  • -to      → End timestamp                                       │
│  • -c copy  → Stream copy (no re-encoding)                        │
│                                                                     │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ├──────────────┬──────────────┐
                   ▼              ▼              ▼
┌──────────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   LOCAL VIDEO FILE   │ │  BACKBLAZE   │ │  OUTPUT VIDEO    │
│                      │ │  CLOUD URL   │ │                  │
│  • User upload       │ │              │ │  • Blob URL      │
│  • Browser memory    │ │  • Direct    │ │  • MP4 format    │
│  • No server upload  │ │    access    │ │  • Lossless      │
│  • Privacy-first     │ │  • No        │ │  • Download      │
│                      │ │    download  │ │    ready         │
└──────────────────────┘ └──────────────┘ └──────────────────┘
```

---

## Data Flow

```
USER INPUT
    │
    ├─ Movie Title: "Interstellar"
    ├─ Video Source: Backblaze URL or Local File
    ├─ Start Time: "01:45:20"
    └─ End Time: "01:46:35"
    │
    ▼
VALIDATION
    │
    ├─ validateTimestamp("01:45:20") → ✅
    ├─ validateTimestamp("01:46:35") → ✅
    └─ getClipDuration("01:45:20", "01:46:35") → 75 seconds
    │
    ▼
FFMPEG LOADING
    │
    ├─ Check if loaded → No
    ├─ Download from CDN → ffmpeg-core.js + ffmpeg-core.wasm
    ├─ Initialize → 10-15 seconds
    └─ Cache in browser → Instant next time
    │
    ▼
VIDEO LOADING
    │
    ├─ Input Type → Local File or URL
    ├─ Fetch data → fetchFile()
    └─ Write to FFmpeg virtual filesystem → input.mp4
    │
    ▼
FFMPEG EXECUTION
    │
    ├─ Command: ffmpeg -i input.mp4 -ss 01:45:20 -to 01:46:35 -c copy output.mp4
    ├─ Stream copy (no re-encoding)
    ├─ Frame-accurate cut
    └─ Write output → output.mp4
    │
    ▼
OUTPUT GENERATION
    │
    ├─ Read file from virtual filesystem
    ├─ Create Blob → new Blob([data], { type: 'video/mp4' })
    ├─ Generate URL → URL.createObjectURL(blob)
    └─ Return { success: true, outputUrl, outputBlob }
    │
    ▼
UI UPDATE
    │
    ├─ Set output URL state
    ├─ Display video preview
    ├─ Show download button
    └─ Enable download
    │
    ▼
USER DOWNLOAD
    │
    ├─ Click download button
    ├─ Create <a> element
    ├─ Set href = outputUrl
    ├─ Set download = "Interstellar_01-45-20_01-46-35.mp4"
    └─ Trigger click → File saved
```

---

## Component Interaction

```
┌──────────────────────────────────────────────────────────────────┐
│                     VideoStudioPage                              │
│                                                                  │
│  State:                                                          │
│  • scenesMovieTitle          → "Interstellar"                   │
│  • scenesVideoSource         → "backblaze" | "local"            │
│  • scenesVideoFile           → File object                      │
│  • scenesVideoUrl            → Backblaze URL                    │
│  • scenesStartTime           → "01:45:20"                       │
│  • scenesEndTime             → "01:46:35"                       │
│  • scenesIsProcessing        → true/false                       │
│  • scenesProgress            → 0-100                            │
│  • scenesProgressMessage     → "Cutting from..."                │
│  • scenesOutputUrl           → Blob URL                         │
│  • scenesOutputBlob          → Blob object                      │
│                                                                  │
│  Handlers:                                                       │
│  • handleCutScene()                                             │
│  •   → Validate inputs                                          │
│  •   → Call cutVideoSegment()                                   │
│  •   → Update progress                                          │
│  •   → Set output URL/blob                                      │
│  •   → Show success toast                                       │
│  •                                                               │
│  • handleDownloadScene()                                        │
│  •   → Create download link                                     │
│  •   → Trigger download                                         │
│  •   → Show toast                                               │
│                                                                  │
└───────────────────────┬──────────────────────────────────────────┘
                        │
                        │ cutVideoSegment({ ... })
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                     /utils/ffmpeg.ts                             │
│                                                                  │
│  cutVideoSegment({                                               │
│    input: File | string,                                         │
│    startTime: "01:45:20",                                        │
│    endTime: "01:46:35",                                          │
│    outputFormat: "mp4",                                          │
│    onProgress: (progress, message) => { ... }                    │
│  })                                                              │
│                                                                  │
│  Returns:                                                        │
│  {                                                               │
│    success: true,                                                │
│    outputUrl: "blob:http://...",                                 │
│    outputBlob: Blob { size: 15728640, type: "video/mp4" },      │
│    duration: 75                                                  │
│  }                                                               │
│                                                                  │
└───────────────────────┬──────────────────────────────────────────┘
                        │
                        │ ffmpeg.exec([...])
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                     FFmpeg.wasm                                  │
│                                                                  │
│  Execution:                                                      │
│  ffmpeg -i input.mp4 -ss 01:45:20 -to 01:46:35 -c copy out.mp4  │
│                                                                  │
│  Progress Events:                                                │
│  • progress: 0.35 → onProgress(35, "Cutting from...")          │
│  • progress: 0.90 → onProgress(90, "Reading output file...")    │
│  • progress: 1.00 → onProgress(100, "Complete!")                │
│                                                                  │
│  Log Events:                                                     │
│  • [FFmpeg] Opening input file...                              │
│  • [FFmpeg] Stream #0:0: Video: h264                           │
│  • [FFmpeg] Stream #0:1: Audio: aac                            │
│  • [FFmpeg] Output file created successfully                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## State Machine

```
┌─────────────┐
│   IDLE      │ Initial state
└──────┬──────┘
       │ User clicks "Cut & Generate Scene"
       │
       ▼
┌─────────────┐
│ VALIDATING  │ Validate timestamps, video source
└──────┬──────┘
       │ Validation passed
       │
       ▼
┌─────────────┐
│  LOADING    │ Load FFmpeg.wasm (if not loaded)
│  FFMPEG     │ Progress: 0-15%
└──────┬──────┘
       │ FFmpeg loaded
       │
       ▼
┌─────────────┐
│  LOADING    │ Load video file/URL
│   VIDEO     │ Progress: 15-30%
└──────┬──────┘
       │ Video loaded
       │
       ▼
┌─────────────┐
│  CUTTING    │ Execute FFmpeg command
│             │ Progress: 30-90%
└──────┬──────┘
       │ Cutting complete
       │
       ▼
┌─────────────┐
│  READING    │ Read output from virtual filesystem
│  OUTPUT     │ Progress: 90-95%
└──────┬──────┘
       │ Output read
       │
       ▼
┌─────────────┐
│ GENERATING  │ Create Blob URL
│    BLOB     │ Progress: 95-100%
└──────┬──────┘
       │ Blob URL created
       │
       ▼
┌─────────────┐
│  SUCCESS    │ Display video preview + download button
│             │ Progress: 100%
└──────┬──────┘
       │ User clicks download
       │
       ▼
┌─────────────┐
│ DOWNLOADING │ Trigger browser download
└──────┬──────┘
       │ Download complete
       │
       ▼
┌─────────────┐
│   IDLE      │ Ready for next cut
└─────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        ERROR SCENARIOS                          │
└─────────────────────────────────────────────────────────────────┘

Scenario 1: Invalid Timestamp Format
────────────────────────────────────
Input: "1:23:45" (missing leading zero)
    │
    ▼
validateTimestamp("1:23:45")
    │
    └─ Returns false
    │
    ▼
Show error toast: "Invalid timestamp format. Use HH:MM:SS or MM:SS"
    │
    ▼
User corrects to "01:23:45"
    │
    ▼
Validation passes, continue


Scenario 2: End Time Before Start Time
────────────────────────────────────
Input: Start = "00:15:00", End = "00:10:00"
    │
    ▼
getClipDuration("00:15:00", "00:10:00")
    │
    └─ Returns -300 (negative)
    │
    ▼
Show error toast: "End time must be after start time"
    │
    ▼
User swaps times
    │
    ▼
Validation passes, continue


Scenario 3: FFmpeg Load Failure
────────────────────────────────────
loadFFmpeg()
    │
    └─ Network error / CDN down
    │
    ▼
Catch error in try/catch
    │
    └─ throw new Error("Failed to load FFmpeg: ...")
    │
    ▼
Show error toast: "Failed to load FFmpeg. Check network connection."
    │
    ▼
User refreshes or tries again later


Scenario 4: Video Load Failure
────────────────────────────────────
fetchFile(backblazeUrl)
    │
    └─ 404 Not Found / Network timeout
    │
    ▼
Catch error in cutVideoSegment()
    │
    └─ return { success: false, error: "..." }
    │
    ▼
Show error toast: "Failed to load video from Backblaze"
    │
    ▼
User checks URL or tries different video


Scenario 5: FFmpeg Execution Failure
────────────────────────────────────
ffmpeg.exec([...])
    │
    └─ Corrupted video / Unsupported codec
    │
    ▼
Catch error in cutVideoSegment()
    │
    └─ return { success: false, error: "FFmpeg execution failed" }
    │
    ▼
Show error toast: "Processing failed. Try different video format."
    │
    ▼
User converts video or tries different source
```

---

## Performance Optimization

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPTIMIZATION STRATEGIES                       │
└─────────────────────────────────────────────────────────────────┘

1. Lazy Loading
────────────────
FFmpeg.wasm only loaded when needed
    │
    ├─ User opens Video Scenes module → No load yet
    ├─ User clicks "Cut & Generate" → Load now
    └─ Subsequent cuts → Already loaded (instant)


2. Browser Caching
────────────────
FFmpeg core files cached by browser
    │
    ├─ First visit → Download ~30MB
    ├─ Second visit → Serve from cache (instant)
    └─ Cache persists across sessions


3. Stream Copy (-c copy)
────────────────
No video re-encoding
    │
    ├─ Without -c copy → 5-10 minutes for 2-minute clip
    ├─ With -c copy → 15-30 seconds for 2-minute clip
    └─ 10-100x faster


4. Blob URL Optimization
────────────────
Efficient memory management
    │
    ├─ Create Blob URL → Memory-efficient reference
    ├─ Video player uses URL → No data duplication
    └─ Cleanup when done → Prevent memory leaks


5. Progress Callbacks
────────────────
User experience optimization
    │
    ├─ Show real-time progress → User stays informed
    ├─ Display status messages → Reduce perceived wait time
    └─ Responsive UI → No frozen interface
```

---

## Security Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY FEATURES                          │
└─────────────────────────────────────────────────────────────────┘

1. Client-Side Processing
────────────────
✅ Videos never uploaded to servers
✅ All processing in user's browser
✅ No data collection
✅ Privacy-first approach


2. Input Validation
────────────────
✅ Timestamp format validation
✅ Time range validation
✅ File type checking (future)
✅ URL sanitization (Backblaze)


3. Error Handling
────────────────
✅ Try/catch blocks
✅ Graceful degradation
✅ User-friendly error messages
✅ No sensitive data in logs


4. Resource Limits
────────────────
✅ Browser memory limits respected
✅ Timeout handling
✅ Cleanup after processing
✅ Prevent memory leaks


5. CORS & CSP
────────────────
✅ Backblaze CORS configured
✅ FFmpeg CDN (unpkg.com) trusted
✅ No eval() or inline scripts
✅ Content Security Policy compliant
```

---

## Cost Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│                        COST BREAKDOWN                           │
└─────────────────────────────────────────────────────────────────┘

Traditional Server-Side Approach:
────────────────────────────────────
• EC2/Compute Instance      → $50-100/month
• Storage (S3/EBS)          → $20-50/month
• Bandwidth                 → $10-50/month
• Load Balancer             → $20/month
• Maintenance & Monitoring  → $50-100/month
────────────────────────────────────
TOTAL:                       $150-320/month
ANNUAL:                      $1,800-3,840/year


FFmpeg.wasm Browser Approach:
────────────────────────────────────
• Server Costs              → $0/month
• FFmpeg.wasm CDN           → $0/month (free CDN)
• Browser Processing        → $0/month (user's device)
• Storage (localStorage)    → $0/month
• Bandwidth (minimal)       → $0/month
────────────────────────────────────
TOTAL:                       $0/month
ANNUAL:                      $0/year


With Backblaze Integration:
────────────────────────────────────
• Backblaze Storage (200GB) → $1/month
• Egress (free 3x storage)  → $0-5/month
• Processing (browser)      → $0/month
────────────────────────────────────
TOTAL:                       $1-6/month
ANNUAL:                      $12-72/year


SAVINGS:
────────────────────────────────────
Server vs. Browser:          $1,800-3,840/year saved
Server vs. Backblaze+Browser: $1,730-3,825/year saved
ROI:                         Infinite (free solution)
```

---

**Architecture Status:** ✅ Production Ready  
**Last Updated:** December 2024  
**Version:** 1.0.0
