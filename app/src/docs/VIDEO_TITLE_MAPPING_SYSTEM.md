# Video Studio - Title Mapping System

## Overview

The Video Studio now includes a **video-to-title mapping system** that solves the critical challenge of associating uploaded trailer videos with specific movie/TV show titles. This enables the AI/LLM to correctly identify which scenes belong to which title when generating compilation videos.

## The Problem We Solved

### Before (The Issue You Identified):
If you uploaded 5 trailer videos for 5 different movies coming out in November (e.g., Gladiator II, Wicked, Red One, Moana 2, Mufasa), the system had no way to know:
- Which video file corresponds to which movie
- Which scenes to extract from which video
- How to properly label and organize content in the final compilation

### After (The Solution):
Each uploaded video now has an associated **title input field** where you specify exactly which movie/show that video represents. This creates a clear mapping that gets sent to the AI for processing.

## How It Works

### 1. Upload Phase
When you upload multiple videos in either module (Video Review or Monthly Releases):

```
Video 1: gladiator-trailer.mp4 → User inputs: "Gladiator II"
Video 2: wicked-teaser.mp4 → User inputs: "Wicked"
Video 3: red-one-trailer.mp4 → User inputs: "Red One"
Video 4: moana-official.mp4 → User inputs: "Moana 2"
Video 5: mufasa-preview.mp4 → User inputs: "Mufasa: The Lion King"
```

### 2. Title Mapping Storage
The system stores this mapping in state:

```typescript
{
  0: { title: "Gladiator II", tmdbId: 558449, year: "2024", type: "movie" },
  1: { title: "Wicked", tmdbId: 402431, year: "2024", type: "movie" },
  2: { title: "Red One", tmdbId: 646097, year: "2024", type: "movie" },
  3: { title: "Moana 2", tmdbId: 1241982, year: "2024", type: "movie" },
  4: { title: "Mufasa: The Lion King", tmdbId: 762509, year: "2024", type: "movie" }
}
```

### 3. LLM/AI Processing Context
When you click "Generate Video", the system sends the mapping to the AI:

```json
{
  "videoMappings": [
    {
      "videoIndex": 0,
      "sourceFile": "gladiator-trailer.mp4",
      "title": "Gladiator II",
      "instructions": "Extract the most action-packed 10-15 seconds from this trailer"
    },
    {
      "videoIndex": 1,
      "sourceFile": "wicked-teaser.mp4",
      "title": "Wicked",
      "instructions": "Extract the most visually stunning 10-15 seconds from this trailer"
    },
    // ... etc for all videos
  ],
  "finalVideoInstructions": "Create a monthly releases compilation. For each movie listed above, extract scenes from its corresponding video file and sequence them with title cards showing: [Movie Title] - Coming [Release Date]"
}
```

### 4. AI Scene Extraction
The AI can now:
- **Identify the source**: "For Gladiator II, I need to look at video index 0"
- **Extract relevant scenes**: "Take the gladiator combat scene from 0:45-0:58"
- **Label correctly**: "Add title card: GLADIATOR II - NOVEMBER 22"
- **Organize**: "Place this after the Wicked segment and before Red One"

## User Interface

### Video Card Structure
```
┌─────────────────────────────────────────────────┐
│ 🎬 gladiator-trailer.mp4          125.3 MB  ✕  │
│                                                 │
│ ┌─────────────────────────────────────────────┐│
│ │ Enter movie/show title (e.g., Gladiator II)││
│ └─────────────────────────────────────────────┘│
│ ✓ Title set: Gladiator II                      │
└─────────────────────────────────────────────────┘
```

### Info Banner
When videos are uploaded, an informational banner appears:

```
ℹ️ Important: Add a title for each video

This helps the AI identify which scenes belong to which movie/show. 
For example, if you upload 5 trailers, label each one (e.g., 
"Gladiator II", "Wicked", "Red One") so the AI can correctly 
extract and organize scenes for the final video.
```

## Implementation Details

### State Management

**Review Module:**
```typescript
const [reviewVideoFiles, setReviewVideoFiles] = useState<File[]>([]);
const [reviewVideoTitles, setReviewVideoTitles] = useState<{
  [key: number]: { 
    title: string; 
    tmdbId?: number; 
    year?: string; 
    type?: 'movie' | 'tv' 
  }
}>({});
```

**Monthly Module:**
```typescript
const [monthlyVideoFiles, setMonthlyVideoFiles] = useState<File[]>([]);
const [monthlyVideoTitles, setMonthlyVideoTitles] = useState<{
  [key: number]: { 
    title: string; 
    tmdbId?: number; 
    year?: string; 
    type?: 'movie' | 'tv' 
  }
}>({});
```

### Title Management
- **Add**: When user types a title, it updates the mapping for that video index
- **Remove**: When a video is deleted, its title mapping is also removed
- **Validation**: System shows checkmark when title is set
- **Persistence**: Titles are maintained even if videos are reordered

## Example Workflows

### Workflow 1: Monthly Releases Video
1. **User uploads 5 trailers** for movies coming out in November
2. **User labels each video:**
   - Video 1: "Gladiator II"
   - Video 2: "Wicked"
   - Video 3: "Red One"
   - Video 4: "Moana 2"
   - Video 5: "Mufasa: The Lion King"
3. **User clicks "Generate Video"**
4. **System sends to AI:**
   ```json
   {
     "task": "Create November 2024 releases compilation",
     "videos": [
       { "index": 0, "title": "Gladiator II", "source": "file_0" },
       { "index": 1, "title": "Wicked", "source": "file_1" },
       { "index": 2, "title": "Red One", "source": "file_2" },
       { "index": 3, "title": "Moana 2", "source": "file_3" },
       { "index": 4, "title": "Mufasa: The Lion King", "source": "file_4" }
     ]
   }
   ```
5. **AI generates:**
   - Extracts 15 seconds from each trailer
   - Adds title cards for each movie
   - Sequences them with music and transitions
   - Creates a cohesive 2-3 minute monthly compilation

### Workflow 2: Trailer Review Video
1. **User uploads 3 trailers** for the same movie at different stages
2. **User labels each video:**
   - Video 1: "The Batman - Teaser Trailer"
   - Video 2: "The Batman - Official Trailer"
   - Video 3: "The Batman - Final Trailer"
3. **User adds voiceover** explaining the progression
4. **System sends to AI:**
   ```json
   {
     "task": "Create trailer evolution review",
     "videos": [
       { "index": 0, "title": "The Batman - Teaser Trailer", "type": "teaser" },
       { "index": 1, "title": "The Batman - Official Trailer", "type": "main" },
       { "index": 2, "title": "The Batman - Final Trailer", "type": "final" }
     ],
     "voiceover": "voiceover_transcript.txt",
     "instructions": "Show side-by-side comparisons of similar scenes across all three trailers"
   }
   ```
5. **AI generates:**
   - Syncs voiceover timestamps with correct video sources
   - Shows scene comparisons from the right trailers
   - Highlights differences between versions

## Benefits

### ✅ Clarity
- User explicitly defines what each video represents
- No ambiguity for the AI to interpret

### ✅ Accuracy
- AI can confidently extract scenes from the correct source
- Reduces errors in scene selection and labeling

### ✅ Flexibility
- Works for multiple trailers of the same movie
- Works for multiple different movies
- Works for review/comparison videos

### ✅ Scalability
- System supports up to 10 videos with clear mappings
- Easy to extend with TMDb integration for auto-complete

## Future Enhancements

### Phase 2: TMDb Autocomplete
```typescript
// When user types, search TMDb
const searchResults = await searchTMDb(userInput);

// Show dropdown with results
<Autocomplete>
  <Item>Gladiator II (2024) - Movie</Item>
  <Item>Gladiator (2000) - Movie</Item>
</Autocomplete>

// When selected, auto-fill metadata
{
  title: "Gladiator II",
  tmdbId: 558449,
  year: "2024",
  type: "movie",
  releaseDate: "2024-11-22",
  poster: "https://..."
}
```

### Phase 3: Smart Scene Detection
```typescript
// AI analyzes video content and suggests titles
const suggestions = await analyzeVideoContent(videoFile);

// "This appears to be a Gladiator II trailer based on:"
// - Visual similarity to poster
// - Audio: "From director Ridley Scott" detected
// - Text overlay: "GLADIATOR II" detected
```

### Phase 4: Timestamp Annotations
```typescript
// Allow users to specify which parts to use
{
  videoIndex: 0,
  title: "Gladiator II",
  segments: [
    { start: "0:15", end: "0:28", label: "Opening scene" },
    { start: "1:45", end: "2:03", label: "Battle sequence" }
  ]
}
```

## Technical Notes

### Data Flow
```
User Upload → State Update → Title Input → Mapping Creation → 
Generate Click → Mapping Sent to AI → Scene Extraction → Video Compilation
```

### API Integration
The title mapping should be included in the Vizla API request:

```javascript
const generateVideo = async () => {
  const videoMappings = Object.entries(monthlyVideoTitles).map(([index, data]) => ({
    videoIndex: parseInt(index),
    fileName: monthlyVideoFiles[parseInt(index)].name,
    title: data.title,
    tmdbId: data.tmdbId,
    type: data.type
  }));

  const response = await fetch('/api/vizla/generate', {
    method: 'POST',
    body: JSON.stringify({
      videos: videoFiles,
      mappings: videoMappings,
      voiceover: voiceoverFile,
      music: musicFile,
      instructions: "Create monthly releases video..."
    })
  });
};
```

## Conclusion

This video-to-title mapping system solves the fundamental problem of disambiguating multiple uploaded videos. By requiring users to explicitly label each video, we provide the AI with clear, unambiguous instructions on which content to extract from which source file, enabling accurate and intelligent video compilation.
