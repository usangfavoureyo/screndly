import { useState, useEffect } from 'react';
import { Upload, X, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { VisuallyHidden } from './ui/visually-hidden';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import ColorPickerPopup from './ColorPickerPopup';
import { generateDesignStudioCaption } from '../utils/designStudioCaptionGenerator';
import type { DesignContentType } from '../utils/designStudioCaptionGenerator';

interface EditDesignBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  aspectRatio?: string; // Template aspect ratio (e.g., '4:5', '1:1', '16:9')
  initialData?: {
    headerText?: string;
    subtext?: string;
    headerTextColor?: string; // Text color for header
    subtextColor?: string; // Text color for subtext
    backgroundImage?: string;
    imageFocalPoint?: { x: number; y: number }; // Percentage (0-100) for repositioning
    imageZoom?: number; // Scale factor (1.0 = 100%)
    overlayEnabled?: boolean; // Toggle overlay ON/OFF
    overlayColor?: string; // Hex color for gradient overlay
    overlayOpacity?: number; // 0-100
    gradientPosition?: 'top' | 'bottom' | 'left' | 'right'; // Gradient direction
  };
  hasSubtext?: boolean;
  hasOverlay?: boolean; // Whether template has a gradient overlay adjustment layer
  onSave: (data: DesignData) => void;
  onChange?: (data: DesignData) => void; // Real-time preview updates
  isRendering?: boolean;
}

export interface DesignData {
  headerText: string;
  subtext?: string;
  headerTextColor?: string; // Text color for header
  subtextColor?: string; // Text color for subtext
  backgroundImage?: string;
  imageFocalPoint?: { x: number; y: number }; // Percentage (0-100) for repositioning
  imageZoom?: number; // Scale factor (1.0 = 100%)
  overlayEnabled?: boolean; // Toggle overlay ON/OFF
  overlayColor?: string; // Hex color for gradient overlay
  overlayOpacity?: number; // 0-100
  gradientPosition?: 'top' | 'bottom' | 'left' | 'right'; // Gradient direction
  caption?: string; // AI-generated caption
  contentType?: 'poster' | 'carousel' | 'story' | 'announcement' | 'general';
}

export function EditDesignBottomSheet({
  open,
  onOpenChange,
  templateName,
  aspectRatio,
  initialData,
  hasSubtext = false,
  hasOverlay = false,
  onSave,
  onChange,
  isRendering = false,
}: EditDesignBottomSheetProps) {
  const [headerText, setHeaderText] = useState(initialData?.headerText || '');
  const [subtext, setSubtext] = useState(initialData?.subtext || '');
  const [headerTextColor, setHeaderTextColor] = useState(initialData?.headerTextColor || '#000000');
  const [subtextColor, setSubtextColor] = useState(initialData?.subtextColor || '#000000');
  const [backgroundImage, setBackgroundImage] = useState(initialData?.backgroundImage || '');
  const [imageFocalPoint, setImageFocalPoint] = useState(initialData?.imageFocalPoint || { x: 50, y: 50 });
  const [imageZoom, setImageZoom] = useState(initialData?.imageZoom || 1.0);
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTmdbImage, setSelectedTmdbImage] = useState<string | null>(null);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [showFocalPointAdjuster, setShowFocalPointAdjuster] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(initialData?.overlayEnabled || false);
  const [overlayColor, setOverlayColor] = useState(initialData?.overlayColor || '#000000');
  const [overlayOpacity, setOverlayOpacity] = useState(initialData?.overlayOpacity || 70);
  const [gradientPosition, setGradientPosition] = useState(initialData?.gradientPosition || 'top');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHeaderTextColorPicker, setShowHeaderTextColorPicker] = useState(false);
  const [showSubtextColorPicker, setShowSubtextColorPicker] = useState(false);
  const [contentType, setContentType] = useState<DesignContentType>('general');
  const [caption, setCaption] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);

  useEffect(() => {
    if (initialData) {
      setHeaderText(initialData.headerText || '');
      setSubtext(initialData.subtext || '');
      setHeaderTextColor(initialData.headerTextColor || '#000000');
      setSubtextColor(initialData.subtextColor || '#000000');
      setBackgroundImage(initialData.backgroundImage || '');
      setImageFocalPoint(initialData.imageFocalPoint || { x: 50, y: 50 });
      setImageZoom(initialData.imageZoom || 1.0);
      setOverlayEnabled(initialData.overlayEnabled || false);
      setOverlayColor(initialData.overlayColor || '#000000');
      setOverlayOpacity(initialData.overlayOpacity || 70);
      setGradientPosition(initialData.gradientPosition || 'top');
    }
  }, [initialData]);

  // Trigger real-time preview updates whenever design data changes
  useEffect(() => {
    if (onChange && open) {
      onChange({
        headerText,
        subtext: hasSubtext ? subtext : undefined,
        headerTextColor,
        subtextColor,
        backgroundImage,
        imageFocalPoint,
        imageZoom,
        overlayEnabled,
        overlayColor,
        overlayOpacity,
        gradientPosition,
      });
    }
     
  }, [
    headerText, 
    subtext, 
    headerTextColor,
    subtextColor,
    backgroundImage, 
    imageFocalPoint.x, 
    imageFocalPoint.y, 
    imageZoom, 
    overlayEnabled,
    overlayColor, 
    overlayOpacity, 
    open, 
    hasSubtext,
    gradientPosition
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    haptics.light();
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setBackgroundImage(imageUrl);
        toast.success('Image uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTmdbSearch = async () => {
    if (!tmdbSearchQuery.trim()) return;

    haptics.medium();
    setIsSearching(true);

    // Simulate TMDB search
    setTimeout(() => {
      const mockResults = [
        {
          id: 1,
          title: tmdbSearchQuery,
          backdrop: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800',
          poster: 'https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=400',
        },
        {
          id: 2,
          title: `${tmdbSearchQuery} 2`,
          backdrop: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
          poster: 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400',
        },
      ];
      setTmdbResults(mockResults);
      setIsSearching(false);
    }, 1000);
  };

  const handleSelectTmdbImage = (imageUrl: string) => {
    haptics.light();
    setBackgroundImage(imageUrl);
    setSelectedTmdbImage(imageUrl);
    setTmdbResults([]);
    setTmdbSearchQuery('');
    toast.success('Image selected from TMDb');
  };

  const handleSave = () => {
    if (!headerText.trim()) {
      toast.error('Header text is required');
      return;
    }

    haptics.medium();
    onSave({
      headerText,
      subtext: hasSubtext ? subtext : undefined,
      headerTextColor,
      subtextColor,
      backgroundImage,
      imageFocalPoint,
      imageZoom,
      overlayEnabled,
      overlayColor,
      overlayOpacity,
      gradientPosition,
      caption: caption || undefined,
      contentType,
    });
  };

  const handleCancel = () => {
    haptics.light();
    onOpenChange(false);
  };

  // Helper function to get aspect ratio class
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '1:1':
        return 'aspect-square';
      case '16:9':
        return 'aspect-video';
      case '9:16':
        return 'aspect-[9/16]';
      case '4:5':
        return 'aspect-[4/5]';
      case '5:4':
        return 'aspect-[5/4]';
      default:
        return 'aspect-square'; // Default fallback
    }
  };

  return (
    <>
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetHeader>
        <BottomSheetTitle className="text-gray-900 dark:text-white">Edit Design</BottomSheetTitle>
        <p className="text-xs text-[#6B7280] mt-1">
          Customize text, colors, and images for your design
        </p>
      </BottomSheetHeader>

      <BottomSheetBody>
        <div className="space-y-4" data-scrollable>
          {/* Header Text (Required) */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-gray-900 dark:text-white">
                Header Text <span className="text-[#ec1e24]">*</span>
              </Label>
              <span className={`text-xs ${
                headerText.length > 90 
                  ? 'text-[#ec1e24] font-medium' 
                  : headerText.length > 70
                  ? 'text-yellow-600 dark:text-yellow-500'
                  : 'text-gray-500 dark:text-[#6B7280]'
              }`}>
                {headerText.length}/90
              </span>
            </div>
            <Input
              value={headerText}
              onChange={(e) => {
                haptics.light();
                const newValue = e.target.value;
                if (newValue.length <= 120) { // Hard limit
                  setHeaderText(newValue);
                }
              }}
              placeholder="Enter header text..."
              className="bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"
            />
            {headerText.length > 90 && (
              <p className="text-xs text-[#ec1e24] mt-1">
                ⚠️ Exceeds recommended limit (may use smaller font)
              </p>
            )}
            {headerText.length > 60 && headerText.length <= 90 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                💡 Medium font size will be used
              </p>
            )}
            
            {/* Header Text Color Picker */}
            <div className="mt-3">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                  Header Text Color
                </Label>
                <span className="text-xs text-gray-600 dark:text-[#6B7280]">
                  {headerTextColor.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    haptics.light();
                    setShowHeaderTextColorPicker(true);
                  }}
                  className="w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform"
                  style={{ backgroundColor: headerTextColor }}
                  title={headerTextColor}
                />
                <input
                  type="text"
                  value={headerTextColor}
                  onChange={(e) => {
                    haptics.light();
                    setHeaderTextColor(e.target.value);
                  }}
                  onFocus={() => haptics.light()}
                  className="flex-1 px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-[#292929]"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>

          {/* Subtext (Optional, conditional) */}
          {hasSubtext && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-gray-900 dark:text-white">Subtext</Label>
                <span className={`text-xs ${
                  subtext.length > 120 
                    ? 'text-[#ec1e24] font-medium' 
                    : subtext.length > 90
                    ? 'text-yellow-600 dark:text-yellow-500'
                    : 'text-gray-500 dark:text-[#6B7280]'
                }`}>
                  {subtext.length}/120
                </span>
              </div>
              <Textarea
                value={subtext}
                onChange={(e) => {
                  haptics.light();
                  const newValue = e.target.value;
                  if (newValue.length <= 150) { // Hard limit
                    setSubtext(newValue);
                  }
                }}
                placeholder="Enter subtext (optional)..."
                rows={3}
                className="bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929] resize-none"
              />
              {subtext.length > 120 && (
                <p className="text-xs text-[#ec1e24] mt-1">
                  ⚠️ Exceeds recommended limit (may use smaller font)
                </p>
              )}
              {subtext.length > 90 && subtext.length <= 120 && (
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                  💡 Medium font size will be used
                </p>
              )}
              
              {/* Subtext Color Picker */}
              <div className="mt-3">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                    Subtext Color
                  </Label>
                  <span className="text-xs text-gray-600 dark:text-[#6B7280]">
                    {subtextColor.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      haptics.light();
                      setShowSubtextColorPicker(true);
                    }}
                    className="w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform"
                    style={{ backgroundColor: subtextColor }}
                    title={subtextColor}
                  />
                  <input
                    type="text"
                    value={subtextColor}
                    onChange={(e) => {
                      haptics.light();
                      setSubtextColor(e.target.value);
                    }}
                    onFocus={() => haptics.light()}
                    className="flex-1 px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-[#292929]"
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Image Replacement Section */}
          <div>
            <Label className="text-gray-900 dark:text-white mb-2 block">Background Image</Label>
            
            {/* Upload from Device */}
            <div className="mb-3">
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="border border-gray-200 dark:border-[#333333] rounded-lg p-4 text-center cursor-pointer hover:border-[#ec1e24] transition-colors">
                  <Upload className="w-6 h-6 text-gray-400 dark:text-[#666666] mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                    Upload from device
                  </p>
                </div>
              </label>
            </div>

            {/* TMDb Search */}
            <div className="mb-3">
              <div className="flex gap-2">
                <Input
                  value={tmdbSearchQuery}
                  onChange={(e) => {
                    haptics.light();
                    setTmdbSearchQuery(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTmdbSearch();
                    }
                  }}
                  placeholder="Search TMDb for movie/TV..."
                  className="flex-1 bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"
                />
                <Button
                  onClick={handleTmdbSearch}
                  disabled={isSearching || !tmdbSearchQuery.trim()}
                  className="bg-[#ec1e24] hover:bg-[#d01a20] text-white"
                >
                  Search
                </Button>
              </div>

              {/* TMDb Results */}
              {tmdbResults.length > 0 && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {tmdbResults.map((result) => (
                    <div key={result.id} className="space-y-2">
                      <p className="text-sm text-gray-900 dark:text-white">{result.title}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleSelectTmdbImage(result.backdrop)}
                          className="relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-[#ec1e24] transition-colors"
                        >
                          <img
                            src={result.backdrop}
                            alt="Backdrop"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1.5 py-0.5 rounded">
                            Backdrop
                          </div>
                        </button>
                        <button
                          onClick={() => handleSelectTmdbImage(result.poster)}
                          className="relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-transparent hover:border-[#ec1e24] transition-colors"
                        >
                          <img
                            src={result.poster}
                            alt="Poster"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1.5 py-0.5 rounded">
                            Poster
                          </div>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current Image Preview */}
            {backgroundImage && (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]">
                  <button
                    onClick={() => {
                      haptics.light();
                      setIsImageExpanded(true);
                    }}
                    className="w-full"
                  >
                    <img
                      src={backgroundImage}
                      alt="Selected background"
                      className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  </button>
                  <button
                    onClick={() => {
                      haptics.light();
                      setBackgroundImage('');
                      setSelectedTmdbImage(null);
                      setImageFocalPoint({ x: 50, y: 50 });
                      setImageZoom(1.0);
                    }}
                    className="absolute top-2 right-2 p-1 bg-black/70 rounded-full hover:bg-black transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>

                {/* Focal Point & Zoom Adjuster */}
                <div className="bg-white dark:bg-black rounded-lg p-4 space-y-3">
                  <p className="text-sm text-gray-900 dark:text-white">
                    Adjust Composition
                  </p>
                  <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-3">
                    Reposition the image to ensure your subject is properly framed
                  </p>
                  
                  {/* Horizontal Position (X-axis) */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                        Horizontal Position
                      </Label>
                      <span className="text-xs text-gray-600 dark:text-[#6B7280]">
                        {imageFocalPoint.x}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={imageFocalPoint.x}
                      onChange={(e) => {
                        haptics.light();
                        setImageFocalPoint({ ...imageFocalPoint, x: Number(e.target.value) });
                      }}
                      className="w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                      <span>Left</span>
                      <span>Center</span>
                      <span>Right</span>
                    </div>
                  </div>

                  {/* Vertical Position (Y-axis) */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                        Vertical Position
                      </Label>
                      <span className="text-xs text-gray-600 dark:text-[#6B7280]">
                        {imageFocalPoint.y}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={imageFocalPoint.y}
                      onChange={(e) => {
                        haptics.light();
                        setImageFocalPoint({ ...imageFocalPoint, y: Number(e.target.value) });
                      }}
                      className="w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                      <span>Top</span>
                      <span>Center</span>
                      <span>Bottom</span>
                    </div>
                  </div>

                  {/* Zoom/Scale */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                        Zoom
                      </Label>
                      <span className="text-xs text-gray-600 dark:text-[#6B7280]">
                        {Math.round(imageZoom * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={imageZoom}
                      onChange={(e) => {
                        haptics.light();
                        setImageZoom(Number(e.target.value));
                      }}
                      className="w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                      <span>50%</span>
                      <span>100%</span>
                      <span>200%</span>
                    </div>
                  </div>

                  {/* Live Composition Preview */}
                  <div>
                    <Label className="text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block">
                      Composition Preview
                    </Label>
                    <div className={`relative ${getAspectRatioClass()} rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]`}>
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${backgroundImage})`,
                          backgroundSize: `${imageZoom * 100}%`,
                          backgroundPosition: `${imageFocalPoint.x}% ${imageFocalPoint.y}%`,
                          backgroundRepeat: 'no-repeat',
                        }}
                      />
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        Live Preview
                      </div>
                    </div>
                  </div>

                  {/* Reset Button */}
                  <Button
                    onClick={() => {
                      haptics.light();
                      setImageFocalPoint({ x: 50, y: 50 });
                      setImageZoom(1.0);
                      toast.success('Composition reset to defaults');
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs"
                  >
                    Reset to Center
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Text Overlay Gradient Controls (Conditional) */}
          {hasOverlay && (
            <div>
              <Label className="text-gray-900 dark:text-white mb-2 block">Text Overlay Settings</Label>
              <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-3">
                Adjust the gradient overlay to ensure your text is readable
              </p>

              <div className="bg-white dark:bg-black rounded-lg p-4 space-y-3">
                {/* Overlay Color Picker */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                      Overlay Color
                    </Label>
                    <span className="text-xs text-gray-600 dark:text-[#6B7280]">
                      {overlayColor.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        haptics.light();
                        setShowColorPicker(true);
                      }}
                      className="w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform"
                      style={{ backgroundColor: overlayColor }}
                      title={overlayColor}
                    />
                    <input
                      type="text"
                      value={overlayColor}
                      onChange={(e) => {
                        haptics.light();
                        setOverlayColor(e.target.value);
                      }}
                      onFocus={() => haptics.light()}
                      className="flex-1 px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-[#292929]"
                      placeholder="#000000"
                    />
                  </div>
                </div>

                {/* Overlay Opacity */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                      Overlay Strength
                    </Label>
                    <span className="text-xs text-gray-600 dark:text-[#6B7280]">
                      {overlayOpacity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={overlayOpacity}
                    onChange={(e) => {
                      haptics.light();
                      setOverlayOpacity(Number(e.target.value));
                    }}
                    className="w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                    <span>Transparent</span>
                    <span>Subtle</span>
                    <span>Strong</span>
                  </div>
                </div>

                {/* Gradient Position */}
                <div>
                  <Label className="text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block">
                    Gradient Position
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => {
                        haptics.light();
                        setGradientPosition('top');
                      }}
                      variant="outline"
                      size="sm"
                      className={`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${
                        gradientPosition === 'top' 
                          ? 'bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]' 
                          : 'bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]'
                      }`}
                    >
                      Top
                    </Button>
                    <Button
                      onClick={() => {
                        haptics.light();
                        setGradientPosition('bottom');
                      }}
                      variant="outline"
                      size="sm"
                      className={`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${
                        gradientPosition === 'bottom' 
                          ? 'bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]' 
                          : 'bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]'
                      }`}
                    >
                      Bottom
                    </Button>
                    <Button
                      onClick={() => {
                        haptics.light();
                        setGradientPosition('left');
                      }}
                      variant="outline"
                      size="sm"
                      className={`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${
                        gradientPosition === 'left' 
                          ? 'bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]' 
                          : 'bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]'
                      }`}
                    >
                      Left
                    </Button>
                    <Button
                      onClick={() => {
                        haptics.light();
                        setGradientPosition('right');
                      }}
                      variant="outline"
                      size="sm"
                      className={`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${
                        gradientPosition === 'right' 
                          ? 'bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]' 
                          : 'bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]'
                      }`}
                    >
                      Right
                    </Button>
                  </div>
                </div>

                {/* Visual Preview */}
                <div>
                  <Label className="text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block">
                    Overlay Preview
                  </Label>
                  <div className={`relative ${getAspectRatioClass()} rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]`}>
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: backgroundImage
                          ? `url(${backgroundImage})`
                          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        backgroundSize: backgroundImage ? `${imageZoom * 100}%` : 'cover',
                        backgroundPosition: backgroundImage ? `${imageFocalPoint.x}% ${imageFocalPoint.y}%` : 'center',
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: (() => {
                          const gradientDirectionMap: Record<string, string> = {
                            top: 'to bottom',
                            bottom: 'to top',
                            left: 'to right',
                            right: 'to left',
                          };
                          const direction = gradientDirectionMap[gradientPosition] || 'to bottom';
                          return `linear-gradient(${direction}, ${overlayColor}${Math.round(overlayOpacity * 2.55).toString(16).padStart(2, '0')} 0%, transparent 100%)`;
                        })(),
                      }}
                    />
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      Live Preview
                    </div>
                  </div>
                </div>

                {/* Reset Button */}
                <Button
                  onClick={() => {
                    haptics.light();
                    setOverlayColor('#000000');
                    setOverlayOpacity(70);
                    setGradientPosition('top');
                    toast.success('Overlay reset to defaults');
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#000000] text-xs"
                >
                  Reset Overlay
                </Button>
              </div>
            </div>
          )}

          {/* AI Caption Generation Section */}
          <div>
            <Label className="text-gray-900 dark:text-white mb-2 block">Social Media Caption</Label>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-3">
              Generate AI-powered captions for your design
            </p>

            <div className="bg-white dark:bg-black rounded-lg p-4 space-y-3">
              {/* Content Type Selector */}
              <div>
                <Label className="text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block">
                  Content Type
                </Label>
                <Select
                  value={contentType}
                  onValueChange={(value: DesignContentType) => {
                    haptics.light();
                    setContentType(value);
                  }}
                >
                  <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poster">Poster/Announcement</SelectItem>
                    <SelectItem value="carousel">Carousel Post</SelectItem>
                    <SelectItem value="story">Story (Vertical)</SelectItem>
                    <SelectItem value="announcement">Breaking News</SelectItem>
                    <SelectItem value="general">General Content</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-2">
                  Select the type of content to customize caption style
                </p>
              </div>

              {/* Generate Caption Button */}
              <Button
                onClick={async () => {
                  if (!headerText.trim()) {
                    toast.error('Add header text first to generate caption');
                    return;
                  }

                  haptics.medium();
                  setIsGeneratingCaption(true);
                  
                  try {
                    const result = await generateDesignStudioCaption({
                      contentType,
                      title: headerText,
                      tagline: subtext,
                      context: templateName,
                    });
                    
                    setCaption(result.caption);
                    toast.success(`Caption generated! (${result.charCount} characters)`);
                    haptics.success();
                  } catch (error) {
                    toast.error('Failed to generate caption');
                    console.error('Caption generation error:', error);
                  } finally {
                    setIsGeneratingCaption(false);
                  }
                }}
                disabled={isGeneratingCaption || !headerText.trim()}
                variant="outline"
                className="w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A]"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isGeneratingCaption ? 'Generating...' : 'Generate Caption with AI'}
              </Button>

              {/* Caption Text Area */}
              {caption && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                      Generated Caption
                    </Label>
                    <span className={`text-xs ${
                      caption.length > 280 
                        ? 'text-[#ec1e24]' 
                        : caption.length > 250
                        ? 'text-yellow-600 dark:text-yellow-500'
                        : 'text-gray-500 dark:text-[#6B7280]'
                    }`}>
                      {caption.length}/280
                    </span>
                  </div>
                  <Textarea
                    value={caption}
                    onChange={(e) => {
                      haptics.light();
                      setCaption(e.target.value);
                    }}
                    placeholder="Generated caption will appear here..."
                    rows={6}
                    className="bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929] resize-none"
                  />
                  <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-2">
                    You can edit the caption before saving
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </BottomSheetBody>

      <BottomSheetFooter>
        <div className="flex gap-3 w-full">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isRendering || !headerText.trim()}
            className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white disabled:opacity-50"
          >
            {isRendering ? 'Rendering...' : 'Save & Render'}
          </Button>
        </div>
      </BottomSheetFooter>
    </BottomSheet>

    {/* Expanded Image Preview Dialog */}
    {backgroundImage && (
      <Dialog open={isImageExpanded} onOpenChange={setIsImageExpanded}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none" hideCloseButton>
          <VisuallyHidden>
            <DialogTitle>Background Image Preview</DialogTitle>
            <DialogDescription>
              Full size preview of selected background image
            </DialogDescription>
          </VisuallyHidden>
          <div className="relative">
            <button
              onClick={() => {
                haptics.light();
                setIsImageExpanded(false);
              }}
              className="absolute top-4 right-4 z-50 bg-black/80 text-white p-2 rounded-full hover:bg-black transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={backgroundImage}
              alt="Selected background"
              className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    )}

    {/* Color Picker Popup */}
    <ColorPickerPopup
      isOpen={showColorPicker}
      onClose={() => setShowColorPicker(false)}
      currentColor={overlayColor}
      onColorSelect={(color) => {
        haptics.light();
        setOverlayColor(color);
      }}
    />

    {/* Header Text Color Picker */}
    <ColorPickerPopup
      isOpen={showHeaderTextColorPicker}
      onClose={() => setShowHeaderTextColorPicker(false)}
      currentColor={headerTextColor}
      onColorSelect={(color) => {
        haptics.light();
        setHeaderTextColor(color);
      }}
    />

    {/* Subtext Color Picker */}
    <ColorPickerPopup
      isOpen={showSubtextColorPicker}
      onClose={() => setShowSubtextColorPicker(false)}
      currentColor={subtextColor}
      onColorSelect={(color) => {
        haptics.light();
        setSubtextColor(color);
      }}
    />
  </>
  );
}