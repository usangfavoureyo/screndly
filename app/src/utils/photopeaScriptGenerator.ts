/**
 * Photopea Script Generator
 * Translates DesignData into executable Photopea JSX scripts
 */

import { DesignData } from '../components/EditDesignBottomSheet';

interface PhotopeaTransform {
  translateX: number;
  translateY: number;
  scale: number;
}

interface PhotopeaGradient {
  angle: number;
  opacity: number;
  color: { r: number; g: number; b: number };
}

/**
 * Converts hex color to RGB object for Photopea
 */
export function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return { r, g, b };
}

/**
 * Calculates image transform from focal point and zoom
 */
export function calculateImageTransform(
  focalPoint: { x: number; y: number },
  zoom: number,
  templateWidth: number,
  templateHeight: number,
  imageWidth: number,
  imageHeight: number
): PhotopeaTransform {
  // Calculate scaled dimensions
  const scaledWidth = imageWidth * zoom;
  const scaledHeight = imageHeight * zoom;

  // Calculate the offset needed to position the focal point at center
  // focalPoint is 0-100%, where 50,50 is center
  const focalPointX = (focalPoint.x / 100) * scaledWidth;
  const focalPointY = (focalPoint.y / 100) * scaledHeight;

  // Calculate translation to center the focal point
  const translateX = (templateWidth / 2) - focalPointX;
  const translateY = (templateHeight / 2) - focalPointY;

  return {
    translateX,
    translateY,
    scale: zoom,
  };
}

/**
 * Maps gradient position to Photopea angle
 */
export function mapGradientPosition(position: 'top' | 'bottom' | 'left' | 'right'): number {
  const angleMap: Record<string, number> = {
    top: 90,      // Gradient from top to bottom
    bottom: -90,  // Gradient from bottom to top
    left: 180,    // Gradient from left to right
    right: 0,     // Gradient from right to left
  };
  return angleMap[position] || 90;
}

/**
 * Generates Photopea script to find layer by name pattern
 */
export function generateFindLayerScript(namePatterns: string[]): string {
  return `
function findLayerByPattern(patterns) {
  var doc = app.activeDocument;
  
  function searchLayers(layers) {
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var layerNameLower = layer.name.toLowerCase();
      
      for (var j = 0; j < patterns.length; j++) {
        if (layerNameLower.indexOf(patterns[j].toLowerCase()) !== -1) {
          return layer;
        }
      }
      
      // Recursively search layer sets (groups)
      if (layer.typename === "LayerSet") {
        var found = searchLayers(layer.layers);
        if (found) return found;
      }
    }
    return null;
  }
  
  return searchLayers(doc.layers);
}

var targetLayer = findLayerByPattern(${JSON.stringify(namePatterns)});
`;
}

/**
 * Generates script to update text layer content and color
 */
export function generateTextUpdateScript(
  layerNamePatterns: string[],
  newText: string,
  color?: string
): string {
  const rgb = color ? hexToRGB(color) : null;
  
  return `
${generateFindLayerScript(layerNamePatterns)}

if (targetLayer && targetLayer.kind === LayerKind.TEXT) {
  targetLayer.textItem.contents = ${JSON.stringify(newText)};
  
  ${rgb ? `
  var textColor = new SolidColor();
  textColor.rgb.red = ${rgb.r};
  textColor.rgb.green = ${rgb.g};
  textColor.rgb.blue = ${rgb.b};
  targetLayer.textItem.color = textColor;
  ` : ''}
} else {
  // Layer not found or not a text layer
  var errorMsg = targetLayer ? "Layer found but not text type" : "Layer not found";
  // Continue execution - non-critical error
}
`;
}

/**
 * Generates script to update text with multi-size variant selection
 * (Strategy 2: Pre-designed text layers for different lengths)
 */
export function generateTextVariantUpdateScript(
  variantPatterns: {
    large: string[];    // 1-2 lines (< 60 chars)
    medium: string[];   // 2-3 lines (60-100 chars)
    small: string[];    // 3-4+ lines (100+ chars)
  },
  newText: string,
  color?: string
): string {
  const rgb = color ? hexToRGB(color) : null;
  const textLength = newText.length;
  
  // Determine which variant to use based on character count
  let activeVariant: 'large' | 'medium' | 'small';
  if (textLength < 60) {
    activeVariant = 'large';
  } else if (textLength < 100) {
    activeVariant = 'medium';
  } else {
    activeVariant = 'small';
  }
  
  return `
// Find all headline variants
function findLayerVariant(patterns) {
  var doc = app.activeDocument;
  
  function searchLayers(layers) {
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var layerNameLower = layer.name.toLowerCase();
      
      for (var j = 0; j < patterns.length; j++) {
        if (layerNameLower.indexOf(patterns[j].toLowerCase()) !== -1) {
          return layer;
        }
      }
      
      if (layer.typename === "LayerSet") {
        var found = searchLayers(layer.layers);
        if (found) return found;
      }
    }
    return null;
  }
  
  return searchLayers(doc.layers);
}

// Find each variant layer
var largeLayer = findLayerVariant(${JSON.stringify(variantPatterns.large)});
var mediumLayer = findLayerVariant(${JSON.stringify(variantPatterns.medium)});
var smallLayer = findLayerVariant(${JSON.stringify(variantPatterns.small)});

// Select active variant based on text length (${textLength} chars)
var activeLayer = null;
var activeVariant = "${activeVariant}";

if (activeVariant === "large" && largeLayer) {
  activeLayer = largeLayer;
  if (mediumLayer) mediumLayer.visible = false;
  if (smallLayer) smallLayer.visible = false;
} else if (activeVariant === "medium" && mediumLayer) {
  activeLayer = mediumLayer;
  if (largeLayer) largeLayer.visible = false;
  if (smallLayer) smallLayer.visible = false;
} else if (activeVariant === "small" && smallLayer) {
  activeLayer = smallLayer;
  if (largeLayer) largeLayer.visible = false;
  if (mediumLayer) mediumLayer.visible = false;
} else {
  // Fallback: use whichever layer exists
  activeLayer = largeLayer || mediumLayer || smallLayer;
}

// Update the active layer
if (activeLayer && activeLayer.kind === LayerKind.TEXT) {
  activeLayer.visible = true;
  activeLayer.textItem.contents = ${JSON.stringify(newText)};
  
  ${rgb ? `
  var textColor = new SolidColor();
  textColor.rgb.red = ${rgb.r};
  textColor.rgb.green = ${rgb.g};
  textColor.rgb.blue = ${rgb.b};
  activeLayer.textItem.color = textColor;
  ` : ''}
}
`;
}

/**
 * Generates script to replace image in Smart Object or image layer
 */
export function generateImageReplaceScript(
  layerNamePatterns: string[],
  imageDataUrl: string,
  transform?: PhotopeaTransform
): string {
  return `
${generateFindLayerScript(layerNamePatterns)}

if (targetLayer) {
  // Store original bounds
  var originalBounds = targetLayer.bounds;
  var docWidth = app.activeDocument.width.value;
  var docHeight = app.activeDocument.height.value;
  
  try {
    // Method 1: Try Smart Object replacement
    if (targetLayer.kind === LayerKind.SMARTOBJECT) {
      // Open new image
      var imageFile = ${JSON.stringify(imageDataUrl)};
      app.open(new File(imageFile));
      var imageDoc = app.activeDocument;
      
      // Copy image
      imageDoc.activeLayer.duplicate(targetLayer.parent, ElementPlacement.PLACEBEFORE);
      imageDoc.close(SaveOptions.DONOTSAVECHANGES);
      
      // Remove old layer and rename new one
      var newLayer = targetLayer.parent.layers[0];
      var oldName = targetLayer.name;
      targetLayer.remove();
      newLayer.name = oldName;
      targetLayer = newLayer;
    } 
    // Method 2: Replace regular image layer
    else if (targetLayer.kind === LayerKind.NORMAL || targetLayer.kind === LayerKind.PIXEL) {
      // Open and place new image
      var imageFile = ${JSON.stringify(imageDataUrl)};
      app.open(new File(imageFile));
      var imageDoc = app.activeDocument;
      
      // Select all and copy
      imageDoc.selection.selectAll();
      imageDoc.selection.copy();
      imageDoc.close(SaveOptions.DONOTSAVECHANGES);
      
      // Paste into original document
      app.activeDocument = targetLayer.parent.parent;
      targetLayer.remove();
      app.activeDocument.paste();
      var newLayer = app.activeDocument.activeLayer;
      newLayer.name = oldName;
      targetLayer = newLayer;
    }
    
    ${transform ? `
    // Apply transforms
    var scale = ${transform.scale};
    var translateX = ${transform.translateX};
    var translateY = ${transform.translateY};
    
    // Resize layer based on scale
    var currentWidth = targetLayer.bounds[2] - targetLayer.bounds[0];
    var currentHeight = targetLayer.bounds[3] - targetLayer.bounds[1];
    var newWidth = currentWidth * scale;
    var newHeight = currentHeight * scale;
    
    targetLayer.resize(newWidth / currentWidth * 100, newHeight / currentHeight * 100, AnchorPosition.MIDDLECENTER);
    
    // Translate to position focal point
    targetLayer.translate(translateX, translateY);
    ` : ''}
    
  } catch (e) {
    // Error handling - continue execution
  }
}
`;
}

/**
 * Generates script to update gradient overlay (Strategy: Pre-authored variants)
 * Uses visibility switching between 4 pre-authored overlay layers
 */
export function generateGradientUpdateScript(
  enabled: boolean,
  color: string,
  opacity: number,
  position: 'top' | 'bottom' | 'left' | 'right'
): string {
  const rgb = hexToRGB(color);
  
  return `
// Find all overlay variants
function findOverlayVariants() {
  var doc = app.activeDocument;
  var overlays = {
    top: null,
    bottom: null,
    left: null,
    right: null
  };
  
  function searchLayers(layers) {
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var nameLower = layer.name.toLowerCase();
      
      // Match overlay direction variants
      if (nameLower.match(/overlay.*top/)) {
        overlays.top = layer;
      } else if (nameLower.match(/overlay.*bottom/)) {
        overlays.bottom = layer;
      } else if (nameLower.match(/overlay.*left/)) {
        overlays.left = layer;
      } else if (nameLower.match(/overlay.*right/)) {
        overlays.right = layer;
      }
      
      // Recursively search layer sets
      if (layer.typename === "LayerSet") {
        searchLayers(layer.layers);
      }
    }
  }
  
  searchLayers(doc.layers);
  return overlays;
}

var overlays = findOverlayVariants();

${enabled ? `
// Hide all overlays first
if (overlays.top) overlays.top.visible = false;
if (overlays.bottom) overlays.bottom.visible = false;
if (overlays.left) overlays.left.visible = false;
if (overlays.right) overlays.right.visible = false;

// Activate selected overlay variant
var activeOverlay = overlays["${position}"];

if (activeOverlay) {
  activeOverlay.visible = true;
  activeOverlay.opacity = ${opacity};
  
  // Apply color to solid color adjustment layer
  try {
    // Method 1: Try solid color fill layer
    if (activeOverlay.kind === LayerKind.SOLIDFILL) {
      var solidColor = new SolidColor();
      solidColor.rgb.red = ${rgb.r};
      solidColor.rgb.green = ${rgb.g};
      solidColor.rgb.blue = ${rgb.b};
      activeOverlay.fillColor = solidColor;
    }
    // Method 2: Try adjustment layer (Color Fill)
    else {
      var idsetd = charIDToTypeID("setd");
      var desc = new ActionDescriptor();
      var idnull = charIDToTypeID("null");
      var ref = new ActionReference();
      ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
      desc.putReference(idnull, ref);
      
      var idT = charIDToTypeID("T   ");
      var descColor = new ActionDescriptor();
      var idClr = charIDToTypeID("Clr ");
      var descRGB = new ActionDescriptor();
      descRGB.putDouble(charIDToTypeID("Rd  "), ${rgb.r});
      descRGB.putDouble(charIDToTypeID("Grn "), ${rgb.g});
      descRGB.putDouble(charIDToTypeID("Bl  "), ${rgb.b});
      descColor.putObject(idClr, charIDToTypeID("RGBC"), descRGB);
      desc.putObject(idT, charIDToTypeID("SoFi"), descColor);
      
      executeAction(idsetd, desc, DialogModes.NO);
    }
  } catch (e) {
    // Fallback: just adjust opacity
    activeOverlay.opacity = ${opacity};
  }
}
` : `
// Overlay disabled - hide all overlays
if (overlays.top) overlays.top.visible = false;
if (overlays.bottom) overlays.bottom.visible = false;
if (overlays.left) overlays.left.visible = false;
if (overlays.right) overlays.right.visible = false;
`}
`;
}

/**
 * Generates complete rendering script from DesignData
 */
export function generateRenderScript(
  data: DesignData,
  templateData: {
    width: number;
    height: number;
    hasSubtext: boolean;
    hasOverlay: boolean;
  }
): string {
  const scripts: string[] = [];
  
  // 1. Update header text
  if (data.headerText) {
    scripts.push(generateTextUpdateScript(
      ['header', 'title', 'headline', 'main'],
      data.headerText,
      data.headerTextColor
    ));
  }
  
  // 2. Update subtext (if applicable)
  if (templateData.hasSubtext && data.subtext) {
    scripts.push(generateTextUpdateScript(
      ['subtext', 'subtitle', 'description', 'caption', 'body'],
      data.subtext,
      data.subtextColor
    ));
  }
  
  // 3. Replace background image with transforms (if provided)
  if (data.backgroundImage) {
    let transform: PhotopeaTransform | undefined;
    
    // Calculate transform if focal point or zoom is customized
    if (data.imageFocalPoint || data.imageZoom) {
      // Note: We'll need actual image dimensions in production
      // For now, assume image matches template aspect ratio
      transform = calculateImageTransform(
        data.imageFocalPoint || { x: 50, y: 50 },
        data.imageZoom || 1.0,
        templateData.width,
        templateData.height,
        templateData.width, // Placeholder - should be actual image width
        templateData.height  // Placeholder - should be actual image height
      );
    }
    
    scripts.push(generateImageReplaceScript(
      ['background', 'image', 'photo', 'artwork', 'bg'],
      data.backgroundImage,
      transform
    ));
  }
  
  // 4. Update gradient overlay (if applicable)
  if (templateData.hasOverlay && data.overlayColor && data.overlayOpacity !== undefined) {
    scripts.push(generateGradientUpdateScript(
      true,
      data.overlayColor,
      data.overlayOpacity,
      data.gradientPosition || 'top'
    ));
  }
  
  // 5. Export as JPEG
  scripts.push(`
// Flatten and export
try {
  // Flatten all layers
  app.activeDocument.flatten();
  
  // Save as JPEG
  var jpegOptions = new JPEGSaveOptions();
  jpegOptions.quality = 12; // Max quality
  jpegOptions.embedColorProfile = true;
  
  var outputFile = new File(app.activeDocument.path + "/output.jpg");
  app.activeDocument.saveAs(outputFile, jpegOptions, true);
  
} catch (e) {
  // Error in export
}
`);
  
  // Combine all scripts
  return scripts.join('\n\n');
}

/**
 * Generates script to analyze PSD layers and detect structure
 */
export function generateLayerAnalysisScript(): string {
  return `
function analyzeLayers() {
  var doc = app.activeDocument;
  var result = {
    width: doc.width.value,
    height: doc.height.value,
    layers: [],
    detectedLayers: {
      hasHeader: false,
      hasSubtext: false,
      hasOverlay: false,
      hasBackground: false,
      hasHeaderVariants: false, // Multi-size headline support
      hasSubtextVariants: false
    },
    textVariants: {
      header: {
        large: null,
        medium: null,
        small: null
      },
      subtext: {
        large: null,
        medium: null,
        small: null
      }
    }
  };
  
  function scanLayers(layers, path) {
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var layerInfo = {
        name: layer.name,
        type: layer.kind.toString(),
        visible: layer.visible,
        opacity: layer.opacity,
        path: path + "/" + layer.name
      };
      
      var nameLower = layer.name.toLowerCase();
      
      // Detect layer purposes
      if (layer.kind === LayerKind.TEXT) {
        layerInfo.isText = true;
        layerInfo.textContent = layer.textItem.contents;
        
        // Check for multi-size header variants (Strategy 2)
        if (nameLower.match(/header.*large|headline.*large|title.*large/)) {
          result.detectedLayers.hasHeader = true;
          result.detectedLayers.hasHeaderVariants = true;
          result.textVariants.header.large = layer.name;
          layerInfo.purpose = "header_large";
        } else if (nameLower.match(/header.*medium|headline.*medium|title.*medium/)) {
          result.detectedLayers.hasHeader = true;
          result.detectedLayers.hasHeaderVariants = true;
          result.textVariants.header.medium = layer.name;
          layerInfo.purpose = "header_medium";
        } else if (nameLower.match(/header.*small|headline.*small|title.*small/)) {
          result.detectedLayers.hasHeader = true;
          result.detectedLayers.hasHeaderVariants = true;
          result.textVariants.header.small = layer.name;
          layerInfo.purpose = "header_small";
        } else if (nameLower.match(/header|title|headline|main/)) {
          result.detectedLayers.hasHeader = true;
          layerInfo.purpose = "header";
        }
        
        // Check for multi-size subtext variants
        if (nameLower.match(/subtext.*large|subtitle.*large|description.*large/)) {
          result.detectedLayers.hasSubtext = true;
          result.detectedLayers.hasSubtextVariants = true;
          result.textVariants.subtext.large = layer.name;
          layerInfo.purpose = "subtext_large";
        } else if (nameLower.match(/subtext.*medium|subtitle.*medium|description.*medium/)) {
          result.detectedLayers.hasSubtext = true;
          result.detectedLayers.hasSubtextVariants = true;
          result.textVariants.subtext.medium = layer.name;
          layerInfo.purpose = "subtext_medium";
        } else if (nameLower.match(/subtext.*small|subtitle.*small|description.*small/)) {
          result.detectedLayers.hasSubtext = true;
          result.detectedLayers.hasSubtextVariants = true;
          result.textVariants.subtext.small = layer.name;
          layerInfo.purpose = "subtext_small";
        } else if (nameLower.match(/subtext|subtitle|description|caption|body/)) {
          result.detectedLayers.hasSubtext = true;
          layerInfo.purpose = "subtext";
        }
      }
      
      if (nameLower.match(/background|image|photo|artwork|bg/) || layer.kind === LayerKind.SMARTOBJECT) {
        result.detectedLayers.hasBackground = true;
        layerInfo.purpose = "background";
      }
      
      if (nameLower.match(/overlay|gradient/) && (layer.kind === LayerKind.GRADIENTFILL || layer.kind === LayerKind.NORMAL)) {
        result.detectedLayers.hasOverlay = true;
        layerInfo.purpose = "overlay";
      }
      
      result.layers.push(layerInfo);
      
      // Recursively scan layer sets
      if (layer.typename === "LayerSet") {
        scanLayers(layer.layers, path + "/" + layer.name);
      }
    }
  }
  
  scanLayers(doc.layers, "");
  
  return JSON.stringify(result);
}

app.echoToOE(analyzeLayers());
`;
}
