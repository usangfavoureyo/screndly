# Review Module Workflow - Google Video Intelligence Integration

## 🎬 Complete Step-by-Step Workflow

### **Current Implementation Status:**

The AI Trailer Analysis button has been added to the **Audio Dynamics Panel** which appears after uploading the voiceover. However, this should be moved EARLIER in the workflow to make it more discoverable.

---

## ✅ **RECOMMENDED WORKFLOW** (What it SHOULD be):

### **Step 1: Upload Trailer Video**
```
1. Navigate to Video Studio → Review tab
2. Click "Upload Trailer Videos"
3. Select your trailer file (MP4, MOV, etc.)
4. ✨ NEW: Blue AI Analysis card appears immediately
```

### **Step 2: Analyze with AI**
```
5. Click "Analyze Trailer with AI" button (prominent blue button)
6. Wait 2-3 seconds while Google Video Intelligence analyzes
7. See AI-selected hooks:
   - Opening Hook (0:05) - Action Peak - explosion, car chase
   - Mid-Video Hook (0:52) - Suspense Moment - dramatic dialogue
   - Ending Hook (1:58) - Title Card - logo reveal
8. Click "Browse all 47 detected scenes →" to see full list (optional)
```

### **Step 3: Upload Voiceover**
```
9. Upload your voiceover audio file
10. System auto-detects movie titles from voiceover
11. Assign titles to videos (if multiple)
```

### **Step 4: Configure Audio Settings**
```
12. Upload background music (optional)
13. Open "Audio Dynamics" panel
14. Configure:
    - Auto-Ducking (Partial/Full/Adaptive)
    - Trailer Audio Hooks settings
    - Hook Duration, Volume, Crossfade
15. AI-selected scenes are ALREADY chosen from Step 2
```

### **Step 5: Generate LLM Prompt**
```
16. Click "Generate LLM Prompt"
17. See ENHANCED prompt with AI analysis:
    
    WITHOUT AI:
    "Include trailer audio hooks at: opening, mid-video, ending.
     Each hook lasts 3s with 0.5s crossfade."
    
    WITH AI:
    "Include AI-selected trailer audio hooks at: opening, mid-video, ending.
     Opening hook (5.3s): Action Peak - explosion, car chase.
     Mid-video hook (72.5s): Suspense Moment - tension, dramatic.
     Ending hook (142.8s): Title Card - logo reveal.
     Each hook lasts 3s with 0.5s crossfade."
```

### **Step 6: Generate Video**
```
18. Click "Generate Video"
19. Shotstack uses AI-selected timestamps
20. Wait for render (2-5 minutes)
21. Download final video
```

---

## ⚠️ **CURRENT ISSUE:**

The "Analyze Trailer with AI" button is currently hidden inside the **Audio Dynamics Panel**, which only appears AFTER uploading voiceover. This means:

1. User uploads trailer ✅
2. User must upload voiceover first ❌ (backwards!)
3. User must expand Audio Dynamics panel ❌ (hidden!)
4. THEN they see "Analyze Trailer with AI" ❌ (too late!)

**This needs to be fixed so the analysis happens IMMEDIATELY after trailer upload.**

---

## 🔧 **FIX NEEDED:**

Move the AI Analysis section from `/components/VideoStudioPage.tsx` line ~2716 to IMMEDIATELY after the video upload section (around line ~1355).

**Location in code:**
```typescript
// CURRENT (Wrong - inside Audio Dynamics Panel):
{isAudioPanelOpen && (
  // ... buried deep inside
  <Button onClick={() => handleAnalyzeTrailer('review')}>
    Analyze Trailer with AI
  </Button>
)}

// SHOULD BE (Right - right after video upload):
{reviewVideoFiles.length > 0 && (
  <div className="ai-analysis-card">
    <Button onClick={() => handleAnalyzeTrailer('review')}>
      Analyze Trailer with AI
    </Button>
  </div>
)}
<div>Voice-over upload...</div> // Voice-over comes AFTER
```

---

## 📊 **LLM Prompt Differences:**

### **Before AI Analysis:**
```json
{
  "audio_choreography": {
    "enabled": true,
    "segments": [
      {
        "type": "trailer_audio",
        "placement": "opening",
        "scene": "opening_action_hook",  // Generic
        "description": "Opening hook with trailer audio"
      }
    ]
  }
}
```

### **After AI Analysis:**
```json
{
  "audio_choreography": {
    "enabled": true,
    "segments": [
      {
        "type": "trailer_audio",
        "placement": "opening",
        "scene": "action_peak",  // Specific!
        "sceneTimestamp": 5.3,  // Exact timestamp!
        "sceneLabels": ["explosion", "car chase"],  // AI labels!
        "description": "Action Peak - explosion, car chase"  // AI reasoning!
      }
    ],
    "ai_analysis": {  // NEW section
      "total_scenes_detected": 47,
      "total_duration": 150,
      "selected_hooks": {
        "opening": { "timestamp": 5.3, "type": "action_peak" },
        "midVideo": { "timestamp": 72.5, "type": "suspense_moment" },
        "ending": { "timestamp": 142.8, "type": "title_card" }
      }
    }
  }
}
```

---

## 🎯 **Expected User Experience:**

### **Visual Flow:**
```
┌─────────────────────────────────────┐
│  Upload Trailer Videos              │
│  [Browse] Selected: trailer.mp4     │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  ✨ AI Trailer Analysis              │
│  Automatically detect best scenes    │
│  [Analyze Trailer with AI] ← BLUE   │
└─────────────────────────────────────┘
           ↓ (After clicking)
┌─────────────────────────────────────┐
│  ✓ Opening Hook (0:05)               │
│  Action Peak - explosion, car chase  │
│  ────────────────                    │
│  ✓ Mid-Video Hook (0:52)             │
│  Suspense - dramatic dialogue        │
│  ────────────────                    │
│  ✓ Ending Hook (1:58)                │
│  Title Card - logo reveal            │
│  [Browse all 47 scenes →]            │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Voice-over                          │
│  [Upload Audio]                      │
└─────────────────────────────────────┘
```

---

## 💡 **Why This Matters:**

1. **Discoverability** - Users see AI feature IMMEDIATELY
2. **Workflow Logic** - Analyze trailer BEFORE uploading voiceover
3. **Value Proposition** - Shows AI capability upfront
4. **User Trust** - Transparent about what AI detected
5. **Flexibility** - Can re-analyze or manually pick scenes

---

## 🚀 **Quick Fix Instructions:**

**File to edit:** `/components/VideoStudioPage.tsx`

**Find:** Line ~1355 (after video upload section)

**Add:** The AI Analysis card component (already created above)

**Result:** AI analysis appears immediately after uploading trailer, BEFORE voiceover section.

This will make the workflow intuitive and showcase the Google Video Intelligence integration properly!
