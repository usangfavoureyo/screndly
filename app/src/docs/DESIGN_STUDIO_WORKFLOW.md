# Design Studio Workflow

Complete end-to-end process from template creation to published design.

---

## Phase 1: Template Creation (Designer's Workflow)

### Step 1.1: Create PSD in Photoshop/Photopea

**For a basic news template (1080x1350px, Instagram post):**

1. **Create background layer**
   - Name: `Background` or `Image` or `Photo`
   - Type: Smart Object (preferred) or regular image layer
   - This will be replaced with user-uploaded images

2. **Create text overlay gradient** (optional but recommended)
   - Name: `Overlay` or `Gradient` or `Text-Overlay`
   - Type: Gradient Fill adjustment layer or Layer Style
   - Default: Black gradient from top, 70% opacity
   - This ensures text readability over any image

3. **Create headline text layers (Strategy 2)**
   - **"Header Large"**
     - Font: 72pt, Bold
     - Max width: 960px (with 60px padding)
     - Position: Top-aligned at Y=100px
     - For headlines: **1–40 characters** (short, punchy)
   
   - **"Header Medium"**
     - Font: 56pt, Bold
     - Max width: 960px
     - Position: Top-aligned at Y=100px (same as Large)
     - For headlines: **41–90 characters** (moderate length)
   
   - **"Header Small"**
     - Font: 44pt, Bold
     - Max width: 960px
     - Position: Top-aligned at Y=100px (same as Large)
     - For headlines: **91–120 characters** (longer, wraps more)

   **Critical:** All three variants must have identical top anchor points!

4. **Create subtext layers (optional, Strategy 2)**
   - **"Subtext Large"** - 36pt, Regular
   - **"Subtext Medium"** - 28pt, Regular
   - **"Subtext Small"** - 22pt, Regular
   - Position: Below header, top-aligned at Y=300px

5. **Set text layer properties**
   - Use **Paragraph Text** (not Point Text)
   - Enable **Auto Leading** (line height)
   - Set **Left Align** or **Center Align**
   - Define fixed text box width
   - Set default text color (white for dark overlays)

### Step 1.2: Save and Export

1. **Save as PSD**: `breaking-news-template.psd`
2. **Create preview PNG**: Flatten duplicate, export at 800px width
3. **Document the template**:
   - Template name
   - Aspect ratio (e.g., 4:5 for Instagram)
   - Has subtext? (Yes/No)
   - Has overlay? (Yes/No)
   - Character limits enforced

---

## Phase 2: Template Upload (Screndly User)

### Step 2.1: Upload PSD to Design Studio

**User Action:**
1. Navigate to Design Studio
2. Click "Upload Template" button
3. Select `breaking-news-template.psd` from device

**What Happens Behind the Scenes:**

```typescript
// 1. Photopea service initializes (hidden iframe)
await photopeaService.initialize();

// 2. Load PSD file
await photopeaService.loadPSD(file);

// 3. Analyze layer structure
const analysis = await photopeaService.analyzeLayers();

// Returns:
{
  width: 1080,
  height: 1350,
  detectedLayers: {
    hasHeader: true,
    hasSubtext: true,
    hasOverlay: true,
    hasBackground: true,
    hasHeaderVariants: true,  // ✅ Found Large/Medium/Small
    hasSubtextVariants: true  // ✅ Found Large/Medium/Small
  },
  textVariants: {
    header: {
      large: "Header Large",
      medium: "Header Medium",
      small: "Header Small"
    },
    subtext: {
      large: "Subtext Large",
      medium: "Subtext Medium",
      small: "Subtext Small"
    }
  },
  layers: [...]
}

// 4. Generate preview image
const previewDataUrl = await photopeaService.getPreview();

// 5. Create template object
const template = {
  id: 'template-123',
  name: 'Breaking News Template',
  previewUrl: previewDataUrl,
  aspectRatio: '4:5',
  width: 1080,
  height: 1350,
  hasSubtext: true,
  hasOverlay: true,
  psdData: {
    layers: analysis.layers,
    detectedLayers: analysis.detectedLayers,
    textVariants: analysis.textVariants,
    fileUrl: URL.createObjectURL(file) // Store for later rendering
  }
};

// 6. Add to template library
setTemplates([template, ...templates]);

// 7. Close Photopea document
await photopeaService.closeDocument();
```

**User Sees:**
- ✅ Toast: "Template analyzed and uploaded!"
- ✅ New template card appears in grid
- ✅ Preview image displayed
- ✅ Activity log entry created

---

## Phase 3: Create Design (User Workflow)

### Step 3.1: Select Template

**User Action:**
1. Browse template gallery (responsive grid)
2. Tap/click template card
3. Edit bottom sheet slides up

**What Opens:**
- Edit Design Bottom Sheet
- Pre-filled with template defaults
- Character counters visible
- Live preview canvas at bottom

### Step 3.2: Fill Out Design Form

**User Fills Required Fields:**

1. **Header Text** (REQUIRED)
   ```
   User types: "Apple Announces New Vision Pro Features"
   Character count: 42/90 (yellow warning - medium font)
   
   Visual feedback:
   - Counter turns YELLOW (medium font will be used)
   - Helper text: "💡 Medium font size will be used"
   ```

2. **Header Text Color**
   ```
   User clicks color swatch → ColorPickerPopup opens
   Selects: #FFFFFF (white)
   Hex input also available for precise values
   ```

3. **Subtext** (Optional, if template has it)
   ```
   User types: "New spatial computing capabilities revealed"
   Character count: 45/120 (green - large font)
   ```

4. **Subtext Color**
   ```
   User selects: #E0E0E0(light gray)
   ```

5. **Background Image**
   
   **Option A: Upload from Device**
   ```
   User taps "Upload from device"
   Selects image from camera roll
   Image appears in preview
   ```

   **Option B: Search TMDb**
   ```
   User types: "Apple Vision Pro"
   Taps search → Mock results appear
   User selects backdrop image
   Image appears in preview
   ```

6. **Image Composition** (Auto-revealed when image is selected)
   ```
   Horizontal Position: 50% (centered)
   Vertical Position: 30% (upper third)
   Zoom: 120% (slightly zoomed in)
   
   Live preview canvas updates in real-time
   ```

7. **Text Overlay Settings** (If template has overlay)
   ```
   Overlay Color: #000000 (black)
   Overlay Strength: 70%
   Gradient Position: Top
   
   Live preview shows gradient effect
   ```

**Real-Time Preview:**
- Every change triggers `onChange()` callback
- Preview canvas updates instantly using CSS transforms
- User sees exactly what final design will look like

### Step 3.3: Save & Render

**User Action:**
1. Reviews all inputs
2. Checks live preview
3. Taps "Save & Render" button

**Validation:**
```typescript
// Check required fields
if (!headerText.trim()) {
  toast.error('Header text is required');
  return;
}

// Check character limits (already enforced by input maxLength)
// Proceed to rendering...
```

---

## Phase 4: Photopea Rendering (Backend Processing)

### Step 4.1: Generate Photopea Script

```typescript
const designData: DesignData = {
  headerText: "Apple Announces New Vision Pro Features", // 42 chars
  headerTextColor: "#FFFFFF",
  subtext: "New spatial computing capabilities revealed", // 45 chars
  subtextColor: "#E0E0E0",
  backgroundImage: "data:image/jpeg;base64,...",
  imageFocalPoint: { x: 50, y: 30 },
  imageZoom: 1.2,
  overlayColor: "#000000",
  overlayOpacity: 70,
  gradientPosition: "top"
};

// Generate script (simplified view)
const script = generateRenderScript(designData, {
  width: 1080,
  height: 1350,
  hasSubtext: true,
  hasOverlay: true
});
```

### Step 4.2: Execute Photopea Script

**Script Does (In Order):**

```javascript
// 1. Select header text variant based on character count (42 chars)
if (text.length < 60) {
  activeLayer = "Header Large";  // ❌ Not used
} else if (text.length < 100) {
  activeLayer = "Header Medium"; // ✅ SELECTED (42 chars)
}

// 2. Hide unused variants
hideLayer("Header Large");
showLayer("Header Medium");
hideLayer("Header Small");

// 3. Update active header layer
layer("Header Medium").text = "Apple Announces New Vision Pro Features";
layer("Header Medium").textColor = RGB(255, 255, 255); // White

// 4. Select subtext variant (45 chars)
activeLayer = "Subtext Large"; // ✅ SELECTED (45 chars < 60)

hideLayer("Subtext Medium");
hideLayer("Subtext Small");

// 5. Update active subtext layer
layer("Subtext Large").text = "New spatial computing capabilities revealed";
layer("Subtext Large").textColor = RGB(224, 224, 224); // Light gray

// 6. Replace background image
layer("Background").replaceImage("data:image/jpeg;base64,...");

// 7. Apply image transforms
layer("Background").scale(120%);
layer("Background").translate(
  calculateX(focalPoint.x = 50),
  calculateY(focalPoint.y = 30)
);

// 8. Update gradient overlay
layer("Overlay").color = RGB(0, 0, 0); // Black
layer("Overlay").opacity = 70;
layer("Overlay").gradientAngle = 90; // Top to bottom

// 9. Flatten all layers
document.flatten();

// 10. Export as JPEG
document.saveAs("output.jpg", { quality: 12, embedColorProfile: true });
```

### Step 4.3: Return Rendered Image

```typescript
// Photopea returns base64 JPEG
const base64Result = await photopeaService.executeScript(script);

// Convert to Blob
const blob = base64ToBlob(base64Result);

// Create object URL for display
const outputUrl = URL.createObjectURL(blob);

// Create rendered design object
const renderedDesign = {
  id: 'design-456',
  templateId: 'template-123',
  templateName: 'Breaking News Template',
  outputUrl: outputUrl, // Local preview
  data: designData,
  createdAt: new Date(),
  aspectRatio: '4:5'
};

// Add to rendered designs list
setRenderedDesigns([renderedDesign, ...renderedDesigns]);
```

**User Sees:**
- ✅ "Design rendered successfully!" toast
- ✅ Bottom sheet closes
- ✅ Rendered design appears at top of "Your Designs" section
- ✅ Activity log updated

---

## Phase 5: Review & Publish

### Step 5.1: Review Rendered Design

**User sees the rendered design card:**
- Full-resolution preview image
- Template name badge
- Timestamp
- Actions: Edit, Publish, Delete

**User can:**
1. **View full-size** - Tap image → Expands to full screen
2. **Edit** - Tap edit icon → Reopens edit sheet with existing data
3. **Delete** - Swipe left (mobile) or hover delete (desktop)

### Step 5.2: Publish to Socials

**User Action:**
1. Tap "Publish" button (Send icon)
2. Publish bottom sheet opens

**Publish Options:**
```
┌─────────────────────────────────┐
│  Publish Design                 │
├─────────────────────────────────┤
│                                 │
│  [ ] Twitter                    │
│  [ ] Instagram                  │
│  [ ] Facebook                   │
│  [ ] Threads                    │
│                                 │
│  Schedule (Optional)            │
│  [Now ▼] [Cancel] [Publish]     │
└─────────────────────────────────┘
```

### Step 5.3: Upload to Backblaze & Post

**What Happens:**

```typescript
// 1. Upload to Backblaze B2 (permanent storage)
const backblazeUrl = await uploadToBackblaze(blob, {
  bucket: 'screndly-designs-public',
  fileName: `design-${Date.now()}.jpg`,
  contentType: 'image/jpeg'
});

// 2. Post to selected platforms
await postToTwitter({
  imageUrl: backblazeUrl,
  caption: designData.headerText
});

await postToInstagram({
  imageUrl: backblazeUrl,
  caption: designData.headerText
});

// 3. Log activity
addActivity({
  type: 'design_published',
  platforms: ['Twitter', 'Instagram'],
  designId: renderedDesign.id,
  timestamp: new Date()
});
```

**User Sees:**
- ✅ "Design published to Twitter, Instagram!" toast
- ✅ Activity log updated with publish event
- ✅ Design marked as published (visual indicator)

---

## Visual Workflow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          DESIGNER WORKFLOW                           │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │  Create PSD Template        │
                    │  - Background layer         │
                    │  - Header Large/Med/Small   │
                    │  - Subtext Large/Med/Small  │
                    │  - Gradient overlay         │
                    └─────────────┬───────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          SCRENDLY USER WORKFLOW                      │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Upload PSD to Screndly     │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Photopea Analyzes Layers   │
                    │  - Detects variants         │
                    │  - Generates preview        │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Template Added to Library  │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  User Selects Template      │
                    │  Edit Bottom Sheet Opens    │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  User Fills Form Fields     │
                    │  - Header text (42 chars)   │
                    │  - Colors                   │
                    │  - Upload image             │
                    │  - Adjust composition       │
                    │  - Adjust overlay           │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Live Preview Updates       │
                    │  (CSS simulation)           │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  User Taps "Save & Render"  │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Generate Photopea Script   │
                    │  - Select text variants     │
                    │  - Replace image            │
                    │  - Apply transforms         │
                    │  - Update overlay           │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Photopea Renders JPEG      │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Rendered Design Displayed  │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  User Taps "Publish"        │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Upload to Backblaze B2     │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Post to Social Platforms   │
                    │  (Twitter, Instagram, etc)  │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  ✅ Design Published!       │
                    └─────────────────────────────┘
```

---

## Key Decision Points

### Character Count → Font Size Selection

| Character Count | Variant Selected | Font Size | Use Case |
|----------------|------------------|-----------|----------|
| **1–60** | Header Large | 72pt | Short, punchy headlines |
| **61–100** | Header Medium | 56pt | Moderate-length news titles |
| **101–120** | Header Small | 44pt | Longer, detailed headlines |

### Template Detection Logic

```typescript
// If template has variants:
if (analysis.detectedLayers.hasHeaderVariants) {
  // Use Strategy 2 (multi-size variants)
  generateTextVariantUpdateScript(variantPatterns, text, color);
} else {
  // Fallback to Strategy 1 (single paragraph text box)
  generateTextUpdateScript(layerNamePatterns, text, color);
}
```

---

## Error Handling & Fallbacks

### 1. Photopea Unavailable

```typescript
try {
  await photopeaService.renderDesign(data, templateData);
} catch (error) {
  // Fall back to mock rendering
  toast('Using mock rendering (Photopea unavailable)');
  // Display placeholder image
  // User can still proceed with workflow
}
```

### 2. Layer Not Found

```typescript
// Photopea script continues even if layer missing
if (!targetLayer) {
  // Log warning but don't crash
  console.warn('Layer not found, skipping');
  // Continue to next step
}
```

### 3. Image Upload Failed

```typescript
if (!file) {
  toast.error('Please select an image');
  return;
}

if (file.size > 10_000_000) {
  toast.error('Image too large (max 10MB)');
  return;
}
```

---

## Performance Optimizations

### 1. Photopea Initialization
- Initialize once on first use
- Reuse iframe for subsequent renders
- Destroy only on app cleanup

### 2. Template Caching
- Store PSD file URL in template object
- Load from cache on re-render
- No need to re-analyze layers

### 3. Preview Performance
- Live preview uses CSS transforms (instant)
- Photopea rendering only on "Save & Render" click
- Debounce real-time preview updates (50ms)

---

## Success Metrics

✅ **Template Upload:** < 3 seconds for layer analysis  
✅ **Live Preview:** < 50ms update on input change  
✅ **Rendering:** < 5 seconds for 1080x1350 JPEG  
✅ **Publishing:** < 10 seconds total (render + upload + post)  

**Target:** User can go from template selection to published design in **< 60 seconds**.

---

## Next Steps for Production

1. **Test with Real PSD Templates**
   - Create production templates following naming conventions
   - Validate layer detection accuracy
   - Test all variant combinations

2. **Integrate Real TMDb API**
   - Replace mock search with actual API calls
   - Add backdrop/poster image selection
   - Cache search results

3. **Add Backblaze Upload**
   - Implement B2 API integration
   - Generate public URLs for rendered designs
   - Set up CDN for fast delivery

4. **Social Platform Integration**
   - Twitter API for image posts
   - Instagram Graph API
   - Facebook Graph API
   - Threads API

5. **Performance Testing**
   - Benchmark rendering times
   - Optimize large PSD files
   - Add loading states & progress indicators

---

**Last Updated:** December 2025  
**Status:** ✅ Architecture Complete, Ready for Real PSD Testing
