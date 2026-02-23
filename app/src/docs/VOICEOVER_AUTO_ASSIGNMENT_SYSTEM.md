# Voiceover Auto-Assignment System

## Overview

The Video Studio now features an **advanced voiceover-aware auto-assignment system** that automatically extracts movie/show titles from voiceover audio and intelligently maps them to uploaded video files. This eliminates manual title entry and ensures perfect synchronization between voiceover narration and visual content.

---

## How It Works

### 1. **Voiceover Upload & Analysis**

When you upload a voiceover audio file:

```
User uploads voiceover.mp3
    ↓
System analyzes audio transcript
    ↓
AI/LLM extracts movie titles with timestamps
    ↓
Returns structured data:
- Title: "A Minecraft Movie"
- Timestamp: "0:15"
- Release Date: "April 4th"
- Confidence: 0.98
```

**What's happening behind the scenes:**
- Audio is transcribed (in production: Whisper API)
- Transcript is sent to GPT-4 with a prompt to extract:
  - Movie/show titles mentioned
  - Release dates
  - Voiceover timestamps
  - Context snippets
- Results are displayed in the Auto-Assign Dialog

---

### 2. **Auto-Assignment Logic**

When detected titles match video count:

```
Detected Titles (from voiceover order):
1. "A Minecraft Movie" @ 0:15
2. "Freaky Tales" @ 0:42
3. "Sinners" @ 1:08
4. "Death of a Unicorn" @ 1:25

Uploaded Videos:
- minecraft-trailer.mp4
- freaky-tales-teaser.mp4
- sinners-official.mp4
- unicorn-clip.mp4

Auto-Assignment:
Video 0 → "A Minecraft Movie" (mentioned @ 0:15)
Video 1 → "Freaky Tales" (mentioned @ 0:42)
Video 2 → "Sinners" (mentioned @ 1:08)
Video 3 → "Death of a Unicorn" (mentioned @ 1:25)
```

**Key Features:**
- ✅ Chronological mapping based on voiceover mention order
- ✅ Timestamp preservation for LLM scene extraction
- ✅ Validation to ensure video count matches detected title count
- ✅ Visual indicators showing auto-detected vs. manual titles

---

### 3. **LLM Scene Extraction with Context**

When generating the final video, the LLM receives enriched context:

```json
{
  "voiceover_transcript": "What if I told you April 2025...",
  "voiceover_file": "voiceover.mp3",
  "video_mappings": [
    {
      "index": 0,
      "file": "video_0.mp4",
      "title": "A Minecraft Movie",
      "mentioned_at": "0:15",
      "release_date": "April 4th",
      "auto_detected": true,
      "instruction": "When voiceover mentions 'A Minecraft Movie' at 0:15, show scenes from video_0.mp4"
    }
  ]
}
```

**This allows the LLM to:**
- Know exactly when each movie is mentioned in the voiceover
- Pull the correct trailer file for that timestamp
- Extract relevant scenes that match the voiceover description
- Sync visuals perfectly with audio narration

---

## User Workflow

### Scenario 1: Voiceover First, Then Videos

```
1. Upload voiceover.mp3
   → System analyzes: "Detected 4 movies"
   → Shows badge: "✓ Detected 4 titles from voiceover"

2. Upload 4 video files
   → System detects match: 4 videos = 4 detected titles
   → Auto-Assign Dialog appears

3. Click "✨ Auto-Assign Titles"
   → Titles instantly mapped in chronological order
   → Each video shows: "✓ Auto-detected: A Minecraft Movie @ 0:15"

4. Generate Video
   → LLM uses timestamp + title mappings for perfect sync
```

---

### Scenario 2: Videos First, Then Voiceover

```
1. Upload 4 video files
   → System shows: "4 / 10 videos"

2. Upload voiceover.mp3
   → System analyzes: "Detected 4 movies"
   → Auto-Assign Dialog appears immediately

3. Click "✨ Auto-Assign Titles"
   → Titles mapped to uploaded videos
```

---

### Scenario 3: Mismatch (Manual Override)

```
1. Upload voiceover.mp3
   → Detected: 4 titles

2. Upload 3 videos
   → Auto-Assign Dialog shows warning:
   → "⚠️ Video count mismatch: Upload 4 videos to enable auto-assignment"

3. Options:
   a) Upload 1 more video → Auto-assign becomes available
   b) Click "I'll Do It Manually" → Enter titles manually
```

---

## UI Components

### 1. **Voiceover Upload Section**

```tsx
<label>
  Voice-over
  {isAnalyzing && <span>Analyzing...</span>}
</label>

<upload-area>
  {file.name}
  {isAnalyzing && "Extracting movie titles..."}
</upload-area>

{detectedTitles.length > 0 && (
  <badge>✓ Detected 4 titles from voiceover</badge>
)}
```

---

### 2. **Auto-Assign Dialog**

```tsx
🎤 Voiceover Analysis Complete

We detected 4 movies in your voiceover:
#1 A Minecraft Movie @ 0:15 • April 4th
#2 Freaky Tales @ 0:42 • April 4th
#3 Sinners @ 1:08 • April 18th
#4 Death of a Unicorn @ 1:25 • April 18th

[✨ Auto-Assign Titles]  [I'll Do It Manually]
```

---

### 3. **Video Title Display**

**Auto-detected:**
```
✓ Auto-detected: A Minecraft Movie @ 0:15
```

**Manual:**
```
✓ Title set: Gladiator II
```

---

## Technical Implementation

### State Management

```typescript
// Detected titles from voiceover analysis
const [reviewDetectedTitles, setReviewDetectedTitles] = useState<Array<{
  title: string;
  releaseDate?: string;
  timestamp: string;
  confidence: number;
  context: string;
}>>([]);

// Analysis status
const [reviewIsAnalyzing, setReviewIsAnalyzing] = useState(false);

// Auto-assign dialog visibility
const [reviewShowAutoAssign, setReviewShowAutoAssign] = useState(false);
```

---

### Analysis Function

```typescript
const analyzeVoiceoverForTitles = async (file: File) => {
  // 1. Convert audio to text (Whisper API in production)
  const transcript = await transcribeAudio(file);
  
  // 2. Send to GPT-4 for extraction
  const prompt = `
    Analyze this movie release voiceover transcript and extract:
    1. All movie/show titles mentioned
    2. Release dates mentioned for each
    3. Approximate timestamp when each title is first mentioned
    
    Transcript: "${transcript}"
    
    Return as JSON array.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }]
  });
  
  return JSON.parse(response.choices[0].message.content);
};
```

---

### Auto-Assignment Function

```typescript
const autoAssignTitles = (
  detectedTitles: Array<DetectedTitle>,
  module: 'review' | 'monthly'
) => {
  const assignments = {};
  
  // Assign titles to videos in chronological order
  detectedTitles.forEach((titleData, index) => {
    assignments[index] = {
      title: titleData.title,
      releaseDate: titleData.releaseDate,
      voiceoverTimestamp: titleData.timestamp,
      autoDetected: true,
      type: 'movie'
    };
  });
  
  if (module === 'review') {
    setReviewVideoTitles(assignments);
  } else {
    setMonthlyVideoTitles(assignments);
  }
};
```

---

### Voiceover Upload Handler

```typescript
const handleVoiceoverUpload = async (file: File, module: 'review' | 'monthly') => {
  if (module === 'review') {
    setReviewVoiceover(file);
    setReviewIsAnalyzing(true);
    
    try {
      // Analyze voiceover for movie titles
      const detectedTitles = await analyzeVoiceoverForTitles(file);
      setReviewDetectedTitles(detectedTitles);
      
      // Show auto-assign dialog if we have videos uploaded
      if (reviewVideoFiles.length > 0 && 
          reviewVideoFiles.length === detectedTitles.length) {
        setReviewShowAutoAssign(true);
      }
    } finally {
      setReviewIsAnalyzing(false);
    }
  }
};
```

---

## Example: April 2025 Releases

### Input Voiceover Transcript

```
"What if I told you April 2025 is about to unload a treasure chest 
of movies so epic you'll be begging for more popcorn?

Kicking things off on April 4th, A Minecraft Movie drops you into 
the pixelated madness of the Overworld. Jason Momoa and Jack Black 
lead a ragtag crew...

Same day, Freaky Tales hits with a funky 1987 Oakland vibe—Pedro 
Pascal and Ben Mendelsohn star in four twisted stories...

April 18th brings Sinners, where Michael B. Jordan and Ryan Coogler 
team up again for a vampire thriller...

Also that day, Death of a Unicorn rolls in with Paul Rudd and Jenna 
Ortega accidentally offing a mythical beast..."
```

---

### AI Extraction Output

```json
{
  "titles": [
    {
      "title": "A Minecraft Movie",
      "release_date": "April 4th",
      "timestamp": "0:15",
      "confidence": 0.98,
      "context": "Jason Momoa and Jack Black lead a ragtag crew..."
    },
    {
      "title": "Freaky Tales",
      "release_date": "April 4th",
      "timestamp": "0:42",
      "confidence": 0.95,
      "context": "Pedro Pascal and Ben Mendelsohn star..."
    },
    {
      "title": "Sinners",
      "release_date": "April 18th",
      "timestamp": "1:08",
      "confidence": 0.99,
      "context": "Michael B. Jordan and Ryan Coogler team up..."
    },
    {
      "title": "Death of a Unicorn",
      "release_date": "April 18th",
      "timestamp": "1:25",
      "confidence": 0.92,
      "context": "Paul Rudd and Jenna Ortega accidentally offing..."
    }
  ]
}
```

---

### Final Video Mapping

```
Video 0: minecraft-trailer.mp4
└─ Title: "A Minecraft Movie"
└─ Voiceover Timestamp: 0:15
└─ Release Date: April 4th
└─ Auto-detected: true

Video 1: freaky-tales.mp4
└─ Title: "Freaky Tales"
└─ Voiceover Timestamp: 0:42
└─ Release Date: April 4th
└─ Auto-detected: true

Video 2: sinners-official.mp4
└─ Title: "Sinners"
└─ Voiceover Timestamp: 1:08
└─ Release Date: April 18th
└─ Auto-detected: true

Video 3: unicorn-clip.mp4
└─ Title: "Death of a Unicorn"
└─ Voiceover Timestamp: 1:25
└─ Release Date: April 18th
└─ Auto-detected: true
```

---

## Benefits

### For Users
- ⚡ **Saves Time**: No manual title entry for 10+ videos
- 🎯 **Perfect Accuracy**: Titles exactly as mentioned in voiceover
- 🔄 **Chronological Order**: Videos mapped in the order they're discussed
- ✅ **Validation**: Warns if video count doesn't match detected titles

### For LLM Scene Extraction
- 🎬 **Timestamp Awareness**: Knows when each movie is mentioned
- 🎯 **Precise Mapping**: Pulls correct trailer for each timestamp
- 🎨 **Context Understanding**: Has release dates and descriptions
- 🔗 **Perfect Sync**: Visual content matches voiceover narration

---

## Production Considerations

### Current Implementation (Demo)
- Mock analysis with realistic data
- 2-second simulated processing
- Pre-defined extraction results

### Production Requirements
1. **Audio Transcription**
   - Integrate Whisper API or similar
   - Handle various audio formats
   - Support multiple languages

2. **LLM Integration**
   - OpenAI GPT-4 API calls
   - Error handling for failed extractions
   - Confidence thresholds

3. **TMDb Integration**
   - Verify extracted titles against TMDb
   - Fetch additional metadata (poster, year, etc.)
   - Handle title variations

4. **User Corrections**
   - Allow manual editing of auto-detected titles
   - Save user corrections for future reference
   - Learn from user feedback

---

## Future Enhancements

### Phase 1: Smart Matching
- Fuzzy matching for title variations
- TMDb API lookup for verification
- Confidence scores for each detection

### Phase 2: Visual Analysis
- Analyze video thumbnails for title matching
- OCR on title cards in trailers
- Logo detection for franchises

### Phase 3: Multi-Language Support
- Transcription in multiple languages
- Translation for title matching
- Region-specific release dates

### Phase 4: Learning System
- Remember user corrections
- Improve extraction accuracy over time
- Personalized title preferences

---

## Related Documentation

- [Video Title Mapping System](./VIDEO_TITLE_MAPPING_SYSTEM.md)
- [LLM Prompt Configuration](./LLM_PROMPT_SYSTEM.md)
- [Video Studio Settings](./VIDEO_STUDIO_SETTINGS.md)

---

**Last Updated**: November 26, 2025
