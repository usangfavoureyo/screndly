import { useState, useEffect, useRef } from 'react';
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
import { useSettings } from '../contexts/SettingsContext';
import ColorPickerPopup from './ColorPickerPopup';
import { generateDesignStudioCaption } from '../utils/designStudioCaptionGenerator';
import type { DesignContentType } from '../utils/designStudioCaptionGenerator';
import {
  searchDesignStudioTMDb,
  uploadDesignStudioAsset,
  type DesignStudioBrandBlockMode,
  type DesignStudioLayoutVariant,
  type DesignStudioTMDbSearchResult,
} from '../lib/api/designStudio';
import { LiveDesignPreview } from './LiveDesignPreview';

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
    templateVariant?: DesignStudioLayoutVariant;
    fadeEnabled?: boolean;
    fadeOpacity?: number;
    brandBlockMode?: DesignStudioBrandBlockMode;
  };
  hasHeader?: boolean;
  hasBackground?: boolean;
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
  templateVariant?: DesignStudioLayoutVariant;
  fadeEnabled?: boolean;
  fadeOpacity?: number;
  brandBlockMode?: DesignStudioBrandBlockMode;
  caption?: string; // AI-generated caption
  contentType?: 'poster' | 'carousel' | 'story' | 'announcement' | 'general';
  exportFormat?: 'jpeg' | 'png';
}

export function EditDesignBottomSheet({
  open,
  onOpenChange,
  templateName,
  aspectRatio,
  initialData,
  hasHeader = true,
  hasBackground = true,
  hasSubtext = false,
  hasOverlay = false,
  onSave,
  onChange,
  isRendering = false,
}: EditDesignBottomSheetProps) {
  const { settings: persistedSettings } = useSettings();
  const [headerText, setHeaderText] = useState(initialData?.headerText || '');
  const [subtext, setSubtext] = useState(initialData?.subtext || '');
  const [headerTextColor, setHeaderTextColor] = useState(initialData?.headerTextColor || '#FFFFFF');
  const [subtextColor, setSubtextColor] = useState(initialData?.subtextColor || '#000000');
  const [backgroundImage, setBackgroundImage] = useState(initialData?.backgroundImage || '');
  const [previewBackgroundImage, setPreviewBackgroundImage] = useState(initialData?.backgroundImage || '');
  const [imageFocalPoint, setImageFocalPoint] = useState(initialData?.imageFocalPoint || { x: 50, y: 50 });
  const [imageZoom, setImageZoom] = useState(initialData?.imageZoom || 1.0);
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<DesignStudioTMDbSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTmdbImage, setSelectedTmdbImage] = useState<string | null>(null);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [showFocalPointAdjuster, setShowFocalPointAdjuster] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(initialData?.overlayEnabled || false);
  const [overlayColor, setOverlayColor] = useState(initialData?.overlayColor || '#000000');
  const [overlayOpacity, setOverlayOpacity] = useState(initialData?.overlayOpacity || 70);
  const [gradientPosition, setGradientPosition] = useState(initialData?.gradientPosition || 'top');
  const [templateVariant, setTemplateVariant] = useState<DesignStudioLayoutVariant>(initialData?.templateVariant || 'bottom_center');
  const [fadeEnabled, setFadeEnabled] = useState(initialData?.fadeEnabled ?? true);
  const [fadeOpacity, setFadeOpacity] = useState(initialData?.fadeOpacity ?? 90);
  const [brandBlockMode, setBrandBlockMode] = useState<DesignStudioBrandBlockMode>(initialData?.brandBlockMode || 'auto');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHeaderTextColorPicker, setShowHeaderTextColorPicker] = useState(false);
  const [showSubtextColorPicker, setShowSubtextColorPicker] = useState(false);
  const [contentType, setContentType] = useState<DesignContentType>('general');
  const [caption, setCaption] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [expandedPreviewZoom, setExpandedPreviewZoom] = useState(1);
  const [expandedPreviewOffset, setExpandedPreviewOffset] = useState({ x: 0, y: 0 });
  const expandedPreviewOffsetRef = useRef({ x: 0, y: 0 });
  const expandedPreviewPinchDistanceRef = useRef<number | null>(null);
  const expandedPreviewPanStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [exportFormat, setExportFormat] = useState<'jpeg' | 'png'>(
    persistedSettings.exportFormat === 'png' ? 'png' : 'jpeg',
  );

  useEffect(() => {
    return () => {
      if (previewBackgroundImage.startsWith('blob:')) {
        URL.revokeObjectURL(previewBackgroundImage);
      }
    };
  }, [previewBackgroundImage]);

  useEffect(() => {
    if (initialData) {
      setHeaderText(initialData.headerText || '');
      setSubtext(initialData.subtext || '');
      setHeaderTextColor(initialData.headerTextColor || '#FFFFFF');
      setSubtextColor(initialData.subtextColor || '#000000');
      setBackgroundImage(initialData.backgroundImage || '');
      setPreviewBackgroundImage(initialData.backgroundImage || '');
      setImageFocalPoint(initialData.imageFocalPoint || { x: 50, y: 50 });
      setImageZoom(initialData.imageZoom || 1.0);
      setOverlayEnabled(initialData.overlayEnabled || false);
      setOverlayColor(initialData.overlayColor || '#000000');
      setOverlayOpacity(initialData.overlayOpacity || 70);
      setGradientPosition(initialData.gradientPosition || 'top');
      setTemplateVariant(initialData.templateVariant || 'bottom_center');
      setFadeEnabled(initialData.fadeEnabled ?? true);
      setFadeOpacity(initialData.fadeOpacity ?? 90);
      setBrandBlockMode(initialData.brandBlockMode || 'auto');
      setExportFormat(persistedSettings.exportFormat === 'png' ? 'png' : 'jpeg');
    }
  }, [initialData, persistedSettings.exportFormat]);

  useEffect(() => {
    expandedPreviewOffsetRef.current = expandedPreviewOffset;
  }, [expandedPreviewOffset]);

  // Trigger real-time preview updates whenever design data changes
  useEffect(() => {
    if (onChange && open) {
      onChange({
        headerText,
        subtext: hasSubtext ? subtext : undefined,
        headerTextColor,
        subtextColor,
        backgroundImage: previewBackgroundImage || backgroundImage,
        imageFocalPoint,
        imageZoom,
        overlayEnabled,
        overlayColor,
        overlayOpacity,
        gradientPosition,
        templateVariant,
        fadeEnabled,
        fadeOpacity,
        brandBlockMode,
        exportFormat,
      });
    }
     
  }, [
    headerText, 
    subtext, 
    headerTextColor,
    subtextColor,
    backgroundImage,
    previewBackgroundImage,
    imageFocalPoint.x, 
    imageFocalPoint.y, 
    imageZoom, 
    overlayEnabled,
    overlayColor, 
    overlayOpacity, 
    templateVariant,
    fadeEnabled,
    fadeOpacity,
    brandBlockMode,
    open, 
    hasSubtext,
    gradientPosition,
    exportFormat,
  ]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    haptics.light();
    const file = e.target.files?.[0];
    if (file) {
      const localPreviewUrl = URL.createObjectURL(file);
      if (previewBackgroundImage.startsWith('blob:')) {
        URL.revokeObjectURL(previewBackgroundImage);
      }
      setPreviewBackgroundImage(localPreviewUrl);
      setIsUploadingBackground(true);
      try {
        const uploadedImage = await uploadDesignStudioAsset(file, 'renders');
        setBackgroundImage(uploadedImage.url);
        toast.success('Image uploaded');
      } catch (error) {
        console.error('Background upload failed:', error);
        setPreviewBackgroundImage(backgroundImage);
        toast.error(error instanceof Error ? error.message : 'Failed to upload image');
      } finally {
        setIsUploadingBackground(false);
        e.target.value = '';
      }
    }
  };

  const handleTmdbSearch = async () => {
    if (!tmdbSearchQuery.trim()) return;

    haptics.medium();
    setIsSearching(true);

    try {
      const results = await searchDesignStudioTMDb(tmdbSearchQuery);
      setTmdbResults(results);

      if (results.length === 0) {
        toast('No TMDb matches found', {
          description: 'Try a more exact movie or TV title.',
        });
      }
    } catch (error) {
      console.error('TMDb search failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to search TMDb');
      setTmdbResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectTmdbImage = (imageUrl: string) => {
    haptics.light();
    setBackgroundImage(imageUrl);
    setPreviewBackgroundImage(imageUrl);
    setSelectedTmdbImage(imageUrl);
    setTmdbResults([]);
    setTmdbSearchQuery('');
    toast.success('Image selected from TMDb');
  };

  const handleSave = () => {
    if (hasHeader && !headerText.trim()) {
      toast.error('Header text is required');
      return;
    }

    if (isUploadingBackground) {
      toast.error('Please wait for the background image upload to finish');
      return;
    }

    haptics.medium();
    onSave({
      headerText: hasHeader ? headerText : '',
      subtext: hasSubtext ? subtext : undefined,
      headerTextColor,
      subtextColor,
      backgroundImage: hasBackground ? backgroundImage : undefined,
      imageFocalPoint,
      imageZoom,
      overlayEnabled,
      overlayColor,
      overlayOpacity,
      gradientPosition,
      templateVariant,
      fadeEnabled,
      fadeOpacity,
      brandBlockMode,
      caption: caption || undefined,
      contentType,
      exportFormat,
    });
  };

  const currentPreviewData: DesignData = {
    headerText,
    subtext: hasSubtext ? subtext : undefined,
    headerTextColor,
    subtextColor,
    backgroundImage: previewBackgroundImage || backgroundImage,
    imageFocalPoint,
    imageZoom,
    overlayEnabled,
    overlayColor,
    overlayOpacity,
    gradientPosition,
    templateVariant,
    fadeEnabled,
    fadeOpacity,
    brandBlockMode,
    caption,
    contentType,
    exportFormat,
  };

  const resetExpandedPreviewTransform = () => {
    expandedPreviewPinchDistanceRef.current = null;
    expandedPreviewPanStartRef.current = null;
    setExpandedPreviewZoom(1);
    setExpandedPreviewOffset({ x: 0, y: 0 });
  };

  const handleExpandedPreviewTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1 && expandedPreviewZoom > 1) {
      const touch = event.touches[0];
      expandedPreviewPanStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        offsetX: expandedPreviewOffsetRef.current.x,
        offsetY: expandedPreviewOffsetRef.current.y,
      };
      expandedPreviewPinchDistanceRef.current = null;
      return;
    }

    if (event.touches.length !== 2) {
      expandedPreviewPinchDistanceRef.current = null;
      expandedPreviewPanStartRef.current = null;
      return;
    }

    const [firstTouch, secondTouch] = event.touches;
    expandedPreviewPanStartRef.current = null;
    expandedPreviewPinchDistanceRef.current = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    );
  };

  const handleExpandedPreviewTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1 && expandedPreviewPanStartRef.current && expandedPreviewZoom > 1) {
      event.preventDefault();
      const touch = event.touches[0];
      setExpandedPreviewOffset({
        x: expandedPreviewPanStartRef.current.offsetX + (touch.clientX - expandedPreviewPanStartRef.current.x),
        y: expandedPreviewPanStartRef.current.offsetY + (touch.clientY - expandedPreviewPanStartRef.current.y),
      });
      return;
    }

    if (event.touches.length !== 2 || expandedPreviewPinchDistanceRef.current == null) {
      return;
    }

    event.preventDefault();
    const [firstTouch, secondTouch] = event.touches;
    const nextDistance = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    );
    const scaleRatio = nextDistance / expandedPreviewPinchDistanceRef.current;
    expandedPreviewPinchDistanceRef.current = nextDistance;
    setExpandedPreviewZoom((current) => Math.max(1, Math.min(4, current * scaleRatio)));
  };

  const handleExpandedPreviewTouchEnd = () => {
    expandedPreviewPinchDistanceRef.current = null;
    expandedPreviewPanStartRef.current = null;
  };

  const handleExpandedPreviewMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (expandedPreviewZoom <= 1) {
      return;
    }

    event.preventDefault();
    expandedPreviewPanStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: expandedPreviewOffsetRef.current.x,
      offsetY: expandedPreviewOffsetRef.current.y,
    };
  };

  const handleExpandedPreviewMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!expandedPreviewPanStartRef.current || expandedPreviewZoom <= 1) {
      return;
    }

    event.preventDefault();
    setExpandedPreviewOffset({
      x: expandedPreviewPanStartRef.current.offsetX + (event.clientX - expandedPreviewPanStartRef.current.x),
      y: expandedPreviewPanStartRef.current.offsetY + (event.clientY - expandedPreviewPanStartRef.current.y),
    });
  };

  const handleExpandedPreviewMouseUp = () => {
    expandedPreviewPanStartRef.current = null;
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
          PSD layer changes are applied during render and exported using your Design Studio output format.
        </p>
      </BottomSheetHeader>

      <BottomSheetBody>
        <div className="space-y-4" data-scrollable>
          {/* Header Text (Required) */}
          {hasHeader && (
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
                  type="button"
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
          )}

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

          <div>
            <Label className="text-gray-900 dark:text-white mb-2 block">Layout & Branding</Label>
            <div className="bg-white dark:bg-black rounded-lg p-4 space-y-4">
              <div>
                <Label className="text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block">
                  Variant
                </Label>
                <Select
                  value={templateVariant}
                  onValueChange={(value: DesignStudioLayoutVariant) => {
                    haptics.light();
                    setTemplateVariant(value);
                  }}
                >
                  <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom_center">Bottom Center</SelectItem>
                    <SelectItem value="bottom_left">Bottom Left</SelectItem>
                    <SelectItem value="bottom_right">Bottom Right</SelectItem>
                    <SelectItem value="top_center">Top Center</SelectItem>
                    <SelectItem value="top_left">Top Left</SelectItem>
                    <SelectItem value="top_right">Top Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block">
                  Brand Block
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['auto', 'Auto'],
                    ['black', 'Black'],
                    ['white', 'White'],
                  ] as const).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      onClick={() => {
                        haptics.light();
                        setBrandBlockMode(value as DesignStudioBrandBlockMode);
                      }}
                      variant="outline"
                      size="sm"
                      className={`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${
                        brandBlockMode === value
                          ? 'bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]'
                          : 'bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]'
                      }`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                    Use Fade
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.light();
                      setFadeEnabled((current) => !current);
                    }}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      fadeEnabled ? 'bg-[#ec1e24]' : 'bg-gray-300 dark:bg-[#333333]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        fadeEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                      Fade Opacity
                    </Label>
                    <span className="text-xs text-gray-600 dark:text-[#6B7280]">
                      {fadeOpacity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={fadeOpacity}
                    disabled={!fadeEnabled}
                    onChange={(e) => {
                      haptics.light();
                      setFadeOpacity(Number(e.target.value));
                    }}
                    className="w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24] disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Image Replacement Section */}
          {hasBackground && (
          <div>
            <Label className="text-gray-900 dark:text-white mb-2 block">Background Image</Label>
            
            {/* Upload from Device */}
            <div className="mb-3">
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploadingBackground}
                  className="hidden"
                />
                <div className="border border-gray-200 dark:border-[#333333] rounded-lg p-4 text-center cursor-pointer hover:border-[#ec1e24] transition-colors">
                  <Upload className="w-6 h-6 text-gray-400 dark:text-[#666666] mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                    {isUploadingBackground ? 'Uploading background...' : 'Upload from device'}
                  </p>
                </div>
              </label>
              {isUploadingBackground ? (
                <p className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  Preparing background image for rendering...
                </p>
              ) : null}
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
                          onClick={() => result.backdrop && handleSelectTmdbImage(result.backdrop)}
                          disabled={!result.backdrop}
                          className="relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-[#ec1e24] transition-colors"
                        >
                          {result.backdrop ? (
                            <img
                              src={result.backdrop}
                              alt="Backdrop"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-500 dark:bg-[#111111] dark:text-[#6B7280]">
                              No backdrop
                            </div>
                          )}
                          <div className="absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1.5 py-0.5 rounded">
                            Backdrop
                          </div>
                        </button>
                        <button
                          onClick={() => result.poster && handleSelectTmdbImage(result.poster)}
                          disabled={!result.poster}
                          className="relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-transparent hover:border-[#ec1e24] transition-colors"
                        >
                          {result.poster ? (
                            <img
                              src={result.poster}
                              alt="Poster"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-500 dark:bg-[#111111] dark:text-[#6B7280]">
                              No poster
                            </div>
                          )}
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
            {(previewBackgroundImage || backgroundImage) && (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]">
                  <button
                    type="button"
                    onClick={() => {
                      haptics.light();
                      setIsImageExpanded(true);
                    }}
                    className="w-full"
                  >
                    <img
                      src={previewBackgroundImage || backgroundImage}
                      alt="Selected background"
                      className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.light();
                      if (previewBackgroundImage.startsWith('blob:')) {
                        URL.revokeObjectURL(previewBackgroundImage);
                      }
                      setBackgroundImage('');
                      setPreviewBackgroundImage('');
                      setSelectedTmdbImage(null);
                      setImageFocalPoint({ x: 50, y: 50 });
                      setImageZoom(1.0);
                    }}
                    className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/78 text-white shadow-lg transition-colors hover:bg-black"
                  >
                    <X className="h-5 w-5" />
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
                      max="4"
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
                      <span>400%</span>
                    </div>
                  </div>

                  {/* Live Composition Preview */}
                  <div>
                    <Label className="text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block">
                      Composition Preview
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        haptics.light();
                        resetExpandedPreviewTransform();
                        setIsImageExpanded(true);
                      }}
                      className={`relative block w-full ${getAspectRatioClass()} rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]`}
                    >
                      <LiveDesignPreview
                        templatePreviewUrl={previewBackgroundImage || backgroundImage || ''}
                        designData={currentPreviewData}
                      />
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        Tap to Expand
                      </div>
                    </button>
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
          )}

          {/* Text Overlay Gradient Controls */}
          {
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
                      type="button"
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
                    <LiveDesignPreview
                      templatePreviewUrl={previewBackgroundImage || backgroundImage || ''}
                      designData={currentPreviewData}
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
          }

          <div>
            <Label className="text-gray-900 dark:text-white mb-2 block">Output Format</Label>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-3">
              Choose whether this render exports as JPEG or PNG
            </p>

            <div className="bg-white dark:bg-black rounded-lg p-4 space-y-3">
              <div>
                <Label className="text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block">
                  Export Format
                </Label>
                <Select
                  value={exportFormat}
                  onValueChange={(value: 'jpeg' | 'png') => {
                    haptics.light();
                    setExportFormat(value);
                  }}
                >
                  <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                    <SelectItem value="png">PNG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

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
                    }, persistedSettings);
                    
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
            disabled={isRendering || isUploadingBackground || (hasHeader && !headerText.trim())}
            className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white disabled:opacity-50"
          >
            {isUploadingBackground ? 'Uploading Background...' : isRendering ? 'Queueing Render...' : 'Save & Queue Render'}
          </Button>
        </div>
      </BottomSheetFooter>
    </BottomSheet>

    {/* Expanded Image Preview Dialog */}
    {isImageExpanded && (
      <Dialog open={isImageExpanded} onOpenChange={setIsImageExpanded}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none" hideCloseButton>
          <VisuallyHidden>
            <DialogTitle>Design Preview</DialogTitle>
            <DialogDescription>
              Full size preview of the composed design with zoom and pan controls
            </DialogDescription>
          </VisuallyHidden>
          <div className="relative rounded-2xl bg-black/95 p-4">
            <button
              onClick={() => {
                haptics.light();
                setIsImageExpanded(false);
                resetExpandedPreviewTransform();
              }}
              className="absolute top-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-black/80 text-white transition-colors hover:bg-black"
            >
              <X className="w-6 h-6" />
            </button>
            <div
              className="flex max-h-[85vh] min-h-[60vh] items-center justify-center overflow-hidden touch-pan-y"
              onTouchStart={handleExpandedPreviewTouchStart}
              onTouchMove={handleExpandedPreviewTouchMove}
              onTouchEnd={handleExpandedPreviewTouchEnd}
              onMouseDown={handleExpandedPreviewMouseDown}
              onMouseMove={handleExpandedPreviewMouseMove}
              onMouseUp={handleExpandedPreviewMouseUp}
              onMouseLeave={handleExpandedPreviewMouseUp}
            >
              <div
                className="relative w-[min(100%,calc(85vh*0.8))] aspect-[4/5] max-h-[80vh] overflow-hidden rounded-lg"
                style={{
                  transform: `translate(${expandedPreviewOffset.x}px, ${expandedPreviewOffset.y}px) scale(${expandedPreviewZoom})`,
                  transformOrigin: 'center center',
                  cursor: expandedPreviewZoom > 1 ? 'grab' : 'default',
                }}
              >
                <LiveDesignPreview
                  templatePreviewUrl={previewBackgroundImage || backgroundImage || ''}
                  designData={currentPreviewData}
                />
              </div>
            </div>
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
