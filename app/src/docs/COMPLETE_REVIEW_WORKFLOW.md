# 🎬 Complete Review Module Workflow - All Steps

## Full Audio Upload Sequence

Screndly uses **THREE audio sources** for video generation:

1. **🎬 Trailer Video** (has original audio - dialogue, explosions, music)
2. **🎤 Voiceover** (your narration audio)
3. **🎵 Background Music** (cinematic soundtrack)

---

## ✅ **COMPLETE WORKFLOW (Current):**

### **Step 1: Upload Trailer Video**
```
📍 Location: Video Studio → Review → "Trailer Videos" section
Action: Click "Upload Trailer Videos" and select your MP4/MOV file
Result: Video card appears with title input field
```

### **Step 2: Upload Voiceover**
```
📍 Location: Right below trailer upload → "Voice-over" section
Action: Click "Upload Audio" and select your voiceover MP3/WAV
Result: 
  - Voiceover uploads
  - AI analyzes and extracts movie titles
  - Shows "✓ Detected 1 title from voiceover"
  - If multiple videos: Shows auto-assign dialog
```

### **Step 3: Upload Background Music**
```
📍 Location: Right below voiceover → "Music Track" section
Action: Click "Upload Music" and select cinematic background music
Result: Music file name appears
Note: This is the soundtrack that plays throughout the video
```

### **Step 4: Analyze Trailer with AI** ⚠️ (Currently hidden!)
```
📍 Current Location: Inside "Audio Dynamics & Trailer Audio Hooks" panel
Problem: You must:
  1. Scroll down to Audio Dynamics panel
  2. Click chevron to expand
  3. Scroll down to "Trailer Audio Hooks" section
  4. Find "Analyze Trailer with AI" button

Action: Click "Analyze Trailer with AI"
Result:
  - Google Video Intelligence analyzes trailer (2-3 seconds)
  - Shows AI-selected hooks:
    • Opening Hook (0:05): Action Peak - explosion, car chase
    • Mid-Video Hook (0:52): Suspense - dramatic dialogue
    • Ending Hook (1:58): Title Card - logo reveal
  - Shows "Browse all 47 detected scenes" button
```

### **Step 5: Configure Audio Dynamics**
```
📍 Location: "Audio Dynamics & Trailer Audio Hooks" panel
Action: Configure settings:
  
  🔊 Auto-Ducking Mode:
    - Partial (music volume lowers during voiceover)
    - Full Mute (music silences during voiceover)
    - Adaptive (smart volume adjustment)
  
  🎬 Trailer Audio Hooks:
    - Enable/disable hooks
    - Select placements (opening, mid-video, ending)
    - Set hook duration (1-10s)
    - Set trailer volume (0-100%)
    - Set crossfade duration (0-3s)
    - Choose variety style (balanced/dramatic/action)

Result: Audio mixing configured
```

### **Step 6: Configure Caption Template**
```
📍 Location: "Caption Template & Editor" panel
Action: Choose template, font, colors, animation
Result: Caption styling configured
```

### **Step 7: Generate LLM Prompt**
```
📍 Location: Bottom of page → "Generate LLM Prompt" button
Action: Click button
Result: Generates AI prompt in right-side panel

WITHOUT AI Analysis:
  "Create 9:16 video. Include trailer audio hooks at: opening, mid-video, ending.
   Each hook lasts 3s with 0.5s crossfade. Variety: balanced."

WITH AI Analysis:
  "Create 9:16 video. Include AI-selected trailer audio hooks.
   Opening hook (5.3s): Action Peak - explosion, car chase.
   Mid-video hook (72.5s): Suspense Moment - tension, dramatic.
   Ending hook (142.8s): Title Card - logo reveal.
   Each hook lasts 3s with 0.5s crossfade. Variety: balanced."
```

### **Step 8: Review/Edit JSON**
```
📍 Location: Right-side panel (JSON viewer/editor)
Action: Review generated JSON configuration
Can edit manually if needed
```

### **Step 9: Generate Video**
```
📍 Location: Right-side panel → "Generate Video" button
Action: Click button
Result:
  - Shotstack receives JSON config
  - Uses AI-selected timestamps for trailer clips
  - Mixes: trailer audio hooks + voiceover + background music
  - Renders video (2-5 minutes)
  - Shows progress bar
  - Downloads when complete
```

---

## 🎵 **How the Three Audio Sources Work Together:**

### **Audio Timeline Example (30-second video):**

```
Time:    0s──────5s──────10s─────20s─────25s──────30s
         │       │       │       │       │       │
Trailer: ████████░░░░░░░░░░░░░░░░████████░░░░░░░░  (Hooks only)
         │ Hook1 │               │ Hook2 │
         
Voiceover:░░░░░░████████████████████████░░░░░░░░  (Main narration)
         │       │ "Coming soon..."      │
         
BG Music:████████████████████████████████████████  (Throughout)
         │ Cinematic soundtrack playing    │
         │ (auto-ducked during voiceover)  │
```

### **Volume Mixing:**

| Timeline Section | Trailer Audio | Voiceover | Background Music |
|-----------------|---------------|-----------|------------------|
| 0-5s (Opening Hook) | **100%** 🔊 | 0% | 30% (ducked) |
| 5-20s (Voiceover) | 0% | **100%** 🔊 | 30% (ducked) |
| 20-25s (Mid Hook) | **80%** 🔊 | 0% | 20% (ducked) |
| 25-30s (Ending) | 0% | **100%** 🔊 | 30% (ducked) |

---

## 🎯 **What Each Audio Source Does:**

### **1. Trailer Video Audio:**
- **Purpose:** Original trailer sounds (explosions, dialogue, music)
- **Usage:** Short "hooks" at specific moments (3-7 seconds)
- **AI Enhancement:** Google Video Intelligence selects BEST moments
- **Example:** Opening explosion scene, dramatic dialogue, title card reveal

### **2. Voiceover:**
- **Purpose:** Your narration explaining the movie
- **Usage:** Main audio track, plays most of the video
- **AI Enhancement:** Extracts movie titles automatically
- **Example:** "Coming this December, the epic conclusion to the saga..."

### **3. Background Music:**
- **Purpose:** Cinematic soundtrack for atmosphere
- **Usage:** Plays throughout entire video (but ducked during speech)
- **Enhancement:** Auto-ducking adjusts volume intelligently
- **Example:** Epic orchestral music, tension-building soundtrack

---

## 📊 **What Goes into the LLM Prompt:**

### **Without AI Analysis:**
```
Video Details:
- Aspect Ratio: 9:16
- Movie: "Dune: Part Three"
- Voiceover: dune3_vo.mp3
- Background Music: epic_soundtrack.mp3

Audio Configuration:
- Auto-Ducking: Partial
- Include trailer audio hooks at: opening, mid-video, ending
- Hook duration: 3s
- Crossfade: 0.5s
- Trailer volume: 85%
- Variety: balanced

Captions:
- Template: Minimal
- Font: Bebas Neue
- Position: Bottom
```

### **With AI Analysis:**
```
Video Details:
- Aspect Ratio: 9:16
- Movie: "Dune: Part Three"
- Voiceover: dune3_vo.mp3
- Background Music: epic_soundtrack.mp3

Audio Configuration:
- Auto-Ducking: Partial
- Include AI-selected trailer audio hooks at: opening, mid-video, ending
- Opening hook (5.3s): Action Peak with explosion and car chase
- Mid-video hook (72.5s): Suspense Moment with tension and dramatic music
- Ending hook (142.8s): Title Card with logo reveal
- Hook duration: 3s
- Crossfade: 0.5s
- Trailer volume: 85%
- Variety: balanced

AI Analysis Summary:
- Total scenes detected: 47
- Total duration: 150s
- Average intensity: High
- Scene types: action_peak, dramatic_dialogue, suspense_moment, title_card

Captions:
- Template: Minimal
- Font: Bebas Neue
- Position: Bottom
```

**See the difference?** With AI analysis, the prompt includes:
- ✅ Exact timestamps (5.3s, 72.5s, 142.8s)
- ✅ Scene types (Action Peak, Suspense, Title Card)
- ✅ Content descriptions (explosion, dramatic music, logo)
- ✅ Total scenes and duration stats

---

## 🎬 **The Final Video Shotstack Creates:**

```
[0-5s] Opening Hook
  Video: Trailer explosion scene (AI-selected at 5.3s)
  Audio: Trailer original audio at 85% volume
  Music: Background music at 20% (ducked)
  
[5-20s] Voiceover Section
  Video: B-roll from trailer (other AI-selected scenes)
  Audio: Your voiceover at 100% volume
  Music: Background music at 30% (partial ducking)
  Text: Captions synced to voiceover
  
[20-25s] Mid-Video Hook
  Video: Trailer suspense scene (AI-selected at 72.5s)
  Audio: Trailer original audio at 85% volume
  Music: Background music at 20% (ducked)
  
[25-30s] Ending + CTA
  Video: Title card reveal (AI-selected at 142.8s)
  Audio: Voiceover finale
  Music: Background music crescendo
  Text: "COMING DECEMBER 2025"
```

---

## 💡 **Why Background Music Matters:**

### **Without Background Music:**
```
0-5s: Trailer audio ✓
5-20s: Just voiceover (feels empty) ❌
20-25s: Trailer audio ✓
```

### **With Background Music:**
```
0-5s: Trailer audio + music (full cinematic feel) ✓
5-20s: Voiceover + music (professional production) ✓
20-25s: Trailer audio + music (epic finale) ✓
```

**Background music fills the gaps and ties everything together!**

---

## ⚠️ **Current UX Issue:**

### **The Problem:**
All three uploads are visible and easy to find ✅
- Trailer Videos ✅
- Voiceover ✅
- Music Track ✅

BUT the "Analyze Trailer with AI" button is hidden deep inside the Audio Dynamics panel ❌

### **The Solution:**
Move the AI Analysis section to appear **right after Trailer Videos upload**, BEFORE Voiceover and Music. This way the workflow becomes:

```
1. Upload Trailer ✅
2. Analyze with AI ✅ (moved here!)
3. Upload Voiceover ✅
4. Upload Music ✅
5. Configure Audio/Captions ✅
6. Generate Prompt ✅
7. Generate Video ✅
```

---

## 🎯 **Recommended Workflow Order:**

### **Why This Order Makes Sense:**

**1. Trailer First** - Need video to analyze  
**2. AI Analysis** - Detect scenes while user prepares other files  
**3. Voiceover** - Main narration content  
**4. Music** - Supporting atmosphere  
**5. Configure** - Fine-tune audio mixing with AI-selected scenes  
**6. Generate** - Create final video  

This way, AI analysis happens EARLY and informs the rest of the workflow!

---

## ✅ **Summary:**

### **Three Audio Sources:**
1. 🎬 **Trailer Audio** (hooks) - AI-selected moments
2. 🎤 **Voiceover** (narration) - Your script
3. 🎵 **Background Music** (atmosphere) - Cinematic soundtrack

### **AI Enhancement:**
- Analyzes trailer video
- Selects best hook moments
- Includes in LLM prompt with timestamps
- Shotstack uses for precise editing

### **Current Issue:**
- All uploads are visible ✅
- AI analysis button is hidden ❌
- Need to move it earlier in workflow

**The system is complete and functional - just needs better UX placement!** 🚀
