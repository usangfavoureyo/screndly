# Video Studio Auto-Assignment - User Guide

## Quick Start

The Video Studio now has **AI-powered auto-assignment** that automatically detects movie titles from your voiceover and assigns them to your uploaded videos. No more manual typing!

## How It Works (In 3 Steps)

### Step 1: Upload Your Videos
Upload 2-10 trailer videos for the movies you want to feature.

```
✅ minecraft-trailer.mp4 (156 MB)
✅ freaky-tales.mp4 (98 MB)
✅ sinners-trailer.mp4 (142 MB)
✅ unicorn-teaser.mp4 (87 MB)
```

### Step 2: Upload Your Voiceover
Upload your voiceover narration that mentions each movie.

**Example voiceover:**
> "What if I told you April 2025 is stacked with epic movies? First up, **A Minecraft Movie** drops on April 4th with Jason Momoa. Same day, **Freaky Tales** hits with a funky Oakland vibe. April 18th brings **Sinners**, a vampire thriller with Michael B. Jordan. Also that day, **Death of a Unicorn** rolls in with Paul Rudd and Jenna Ortega."

✅ The AI will automatically detect:
- A Minecraft Movie (@ 0:15)
- Freaky Tales (@ 0:42)
- Sinners (@ 1:08)
- Death of a Unicorn (@ 1:25)

### Step 3: Auto-Assign or Manual Entry

You'll see this dialog:

```
┌──────────────────────────────────────────────────────┐
│ ✓ 🎬 Voiceover Analysis Complete!                   │
│                                                      │
│ We detected 4 movies in your voiceover:             │
│                                                      │
│ ① A Minecraft Movie (mentioned at 0:15)            │
│ ② Freaky Tales (mentioned at 0:42)                 │
│ ③ Sinners (mentioned at 1:08)                      │
│ ④ Death of a Unicorn (mentioned at 1:25)           │
│                                                      │
│ You uploaded 4 videos. Auto-assign in order?        │
│                                                      │
│ [  ✓ Auto-Assign Titles  ] [ I'll Do It Manually ] │
└──────────────────────────────────────────────────────┘
```

**Option A: Click "Auto-Assign Titles"**
- System automatically maps:
  - Video 1 → A Minecraft Movie
  - Video 2 → Freaky Tales
  - Video 3 → Sinners
  - Video 4 → Death of a Unicorn

**Option B: Click "I'll Do It Manually"**
- Enter titles yourself in the text fields below each video

## What You'll See After Auto-Assignment

Each video will show its assigned title:

```
🎬 minecraft-trailer.mp4          156.2 MB  ✕
   ┌────────────────────────────────────────┐
   │ A Minecraft Movie                      │
   └────────────────────────────────────────┘
   ✓ Title set: A Minecraft Movie  [🤖 Auto-detected]  @ 0:15
```

The **🤖 Auto-detected** badge shows the title was detected from your voiceover!

## Benefits

### ✅ Save Time
No need to type out movie titles manually for each video.

### ✅ Perfect Sync
The AI knows exactly when you mention each movie, so scenes will perfectly sync with your narration.

### ✅ Avoid Mistakes
No more typos or mismatched titles.

### ✅ Full Control
You can always edit or override auto-detected titles if needed.

## Tips for Best Results

### 1. Mention Titles Clearly
❌ Bad: "Then there's this awesome movie about blocks..."
✅ Good: "A Minecraft Movie drops April 4th..."

### 2. Mention Movies in Order
If you upload videos in this order:
- Video 1: Minecraft
- Video 2: Freaky Tales
- Video 3: Sinners

Mention them in your voiceover in the same order for automatic matching.

### 3. Include Release Dates
The AI can extract release dates too:
- "A Minecraft Movie drops **April 4th**"
- "Sinners releases **April 18th**"

### 4. Upload Voiceover After Videos
The auto-detection only works if you have videos uploaded first. If you upload voiceover first, just upload it again after adding videos.

## Example Workflows

### Workflow 1: Monthly Releases Video

**Goal:** Create a "Movies Coming in April 2025" video

**Steps:**
1. Switch to **Monthly Releases** module
2. Set filter to **Movies**
3. Upload 5 trailer videos
4. Upload voiceover that mentions all 5 movies
5. Wait 2-3 seconds for AI analysis
6. Click "Auto-Assign Titles"
7. Review assignments (edit if needed)
8. Click "Generate Video"

**Result:** A perfectly synced monthly releases video where each movie's scenes appear exactly when you mention them!

### Workflow 2: Trailer Review Video

**Goal:** Create a review comparing 3 trailers for the same movie

**Steps:**
1. Switch to **Video Review** module
2. Upload 3 trailers (teaser, official, final)
3. Upload voiceover: "First we have the teaser trailer for The Batman. Then the official trailer dropped. Finally, the final trailer..."
4. AI detects: "The Batman - Teaser", "The Batman - Official", "The Batman - Final"
5. Click "Auto-Assign Titles"
6. Add your review commentary
7. Click "Generate Video"

**Result:** A trailer evolution video with perfect scene matching!

## Troubleshooting

### Issue: "No titles detected"
**Solution:** Make sure your voiceover clearly mentions movie/show titles. Try saying the full title name.

**Example:**
- ❌ "The Minecraft movie" → Might not detect
- ✅ "A Minecraft Movie" → Will detect

### Issue: "Wrong number of titles detected"
**Solution:** 
- If too many detected: Click "I'll Do It Manually" and assign yourself
- If too few detected: Add titles manually for missing videos

### Issue: "Titles assigned to wrong videos"
**Solution:** You can manually edit any title field even after auto-assignment. Just click the text field and change it.

### Issue: "Analysis taking too long"
**Solution:** The analysis typically takes 2-3 seconds. If it's taking longer than 10 seconds, try:
- Refresh the page
- Re-upload the voiceover
- Check your internet connection

## Manual Override

Even after auto-assignment, you have complete control:

1. **Edit a title:** Click the text field and type a new title
2. **Remove auto-detection badge:** Just edit the title and the badge disappears
3. **Clear all titles:** Remove voiceover and manually enter titles
4. **Mix auto and manual:** Auto-assign some, manually enter others

## Advanced Features

### Timestamp Display
When titles are auto-detected, you'll see when each movie was mentioned:

```
✓ Title set: A Minecraft Movie  @ 0:15
```

This helps verify the AI correctly identified when you talked about each movie.

### Confidence Scores
The system tracks confidence scores internally (0-100%). Low confidence titles get flagged for your review.

### Release Date Extraction
The AI can also extract release dates from your voiceover:
- "April 4th" → Stored with title
- "Coming November 22" → Stored with title
- "This Friday" → Detected but may need manual correction

## FAQ

**Q: What if I don't have a voiceover?**
A: No problem! Just enter titles manually in the text field under each video.

**Q: Can I use auto-assignment with YouTube URLs?**
A: Currently, auto-assignment only works with uploaded video files. YouTube URL support is coming soon!

**Q: What languages are supported?**
A: Currently English only. Multi-language support is planned for future releases.

**Q: How accurate is the AI?**
A: The system uses GPT-4 and achieves 95%+ accuracy with clearly spoken titles. Always review auto-assignments before generating.

**Q: Can I save my assignments?**
A: Assignments are stored with your project. If you reload the page, you'll need to re-upload files and re-assign.

**Q: Does this work on mobile?**
A: Yes! The feature works on both desktop and mobile browsers.

## Best Practices

### ✅ DO:
- Upload all videos before uploading voiceover
- Mention each movie title clearly and completely
- Keep titles in the same order as your uploaded videos
- Review auto-assignments before generating
- Use the auto-detection as a starting point

### ❌ DON'T:
- Use nicknames or abbreviations for movies
- Mention movies out of order from your video uploads
- Rely 100% on auto-detection without reviewing
- Upload voiceover before videos (won't trigger analysis)

## Getting Help

If you encounter issues:

1. Check this guide first
2. Try the manual assignment option
3. Contact support with:
   - Number of videos uploaded
   - Number of titles detected
   - Example of your voiceover text
   - Screenshot of the issue

## Summary

The Auto-Assignment feature makes creating multi-movie compilation videos **10x faster**. Here's the magic:

1. Upload videos → Upload voiceover → Click Auto-Assign
2. The AI handles the boring data entry
3. You focus on creative editing and narration
4. Generate a perfectly synced final video

**That's it!** You're now a Video Studio pro. Happy creating! 🎬✨
