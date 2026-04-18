import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Upload, X, Sparkles } from 'lucide-react';
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
  fetchDesignStudioTMDbImages,
  searchDesignStudioTMDb,
  uploadDesignStudioAsset,
  type DesignStudioBrandBlockMode,
  type DesignStudioTMDbImagePool,
  type DesignStudioLayoutVariant,
  type DesignStudioTMDbSearchResult,
} from '../lib/api/designStudio';
import { buildDesignStudioMediaStreamUrl } from '../lib/designStudioMedia';
import { LiveDesignPreview } from './LiveDesignPreview';
import { markNextPopStateAsHandled } from '../hooks/useTransientHistoryState';
import { useDesktopFileDrop } from '../hooks/useDesktopFileDrop';
import undoIcon from '../public/icons/icons/hugeroundedicons/arrow-move-up-left-stroke-rounded.svg';
import redoIcon from '../public/icons/icons/hugeroundedicons/arrow-move-up-right-stroke-rounded.svg';

const EXPANDED_PREVIEW_TAP_MOVE_TOLERANCE = 24;
const EXPANDED_PREVIEW_DOUBLE_TAP_PROXIMITY = 32;
const EXPANDED_PREVIEW_PAN_START_TOLERANCE = 10;

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
    fontScale?: number;
    headlineWidthScale?: number;
    lineHeightMultiplier?: number;
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
  sourceContext?: {
    sourceHeadline: string;
    suggestedHeadline?: string;
    sourceName?: string;
    sourceSummary?: string;
    sourceUrl?: string;
    fetchedAt?: string;
    matchedKeyword?: string;
  };
  onSave: (data: DesignData) => void;
  onChange?: (data: DesignData) => void; // Real-time preview updates
  isRendering?: boolean;
}

export interface DesignData {
  headerText: string;
  subtext?: string;
  headerTextColor?: string; // Text color for header
  subtextColor?: string; // Text color for subtext
  fontScale?: number;
  headlineWidthScale?: number;
  lineHeightMultiplier?: number;
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
  sourceContext,
  onSave,
  onChange,
  isRendering = false,
}: EditDesignBottomSheetProps) {
  const variantOverlayDirectionMap: Record<DesignStudioLayoutVariant, 'top' | 'bottom' | 'left' | 'right'> = {
    bottom_center: 'bottom',
    bottom_left: 'right',
    bottom_right: 'left',
    top_center: 'top',
    top_left: 'right',
    top_right: 'left',
  };

  const { settings: persistedSettings } = useSettings();
  const [headerText, setHeaderText] = useState(initialData?.headerText || '');
  const [subtext, setSubtext] = useState(initialData?.subtext || '');
  const [headerTextColor, setHeaderTextColor] = useState(initialData?.headerTextColor || '#FFFFFF');
  const [subtextColor, setSubtextColor] = useState(initialData?.subtextColor || '#000000');
  const [fontScale, setFontScale] = useState(initialData?.fontScale ?? 1);
  const [headlineWidthScale, setHeadlineWidthScale] = useState(initialData?.headlineWidthScale ?? 1);
  const [lineHeightMultiplier, setLineHeightMultiplier] = useState(initialData?.lineHeightMultiplier ?? 0.93);
  const [backgroundImage, setBackgroundImage] = useState(initialData?.backgroundImage || '');
  const [previewBackgroundImage, setPreviewBackgroundImage] = useState(initialData?.backgroundImage || '');
  const [imageFocalPoint, setImageFocalPoint] = useState(initialData?.imageFocalPoint || { x: 50, y: 50 });
  const [imageZoom, setImageZoom] = useState(initialData?.imageZoom || 1.0);
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<DesignStudioTMDbSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTmdbResult, setSelectedTmdbResult] = useState<DesignStudioTMDbSearchResult | null>(null);
  const [tmdbImagePool, setTmdbImagePool] = useState<DesignStudioTMDbImagePool | null>(null);
  const [tmdbImageCategory, setTmdbImageCategory] = useState<'backdrops' | 'posters' | 'profiles'>('backdrops');
  const [isLoadingTmdbImages, setIsLoadingTmdbImages] = useState(false);
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
  const expandedPreviewViewportRef = useRef<HTMLDivElement | null>(null);
  const expandedPreviewOffsetRef = useRef({ x: 0, y: 0 });
  const expandedPreviewZoomRef = useRef(1);
  const expandedPreviewPinchDistanceRef = useRef<number | null>(null);
  const expandedPreviewPanStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const expandedPreviewLastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const expandedPreviewTapStartRef = useRef<{ x: number; y: number } | null>(null);
  const appliedInitialDataRef = useRef<string>('');
  const historyRef = useRef<DesignData[]>([]);
  const redoHistoryRef = useRef<DesignData[]>([]);
  const lastHistorySignatureRef = useRef('');
  const skipHistorySignatureRef = useRef('');
  const resetHistorySignatureRef = useRef('');
  const [exportFormat, setExportFormat] = useState<'jpeg' | 'png'>(
    persistedSettings.exportFormat === 'png' ? 'png' : 'jpeg',
  );
  const [, setHistoryVersion] = useState(0);

  const dismissActiveTextInput = () => {
    if (typeof document === 'undefined') return;

    const activeElement = document.activeElement as HTMLElement | null;
    if (!activeElement) return;

    const tagName = activeElement.tagName?.toLowerCase();
    const isTextField = tagName === 'textarea'
      || (tagName === 'input' && (activeElement as HTMLInputElement).type !== 'range')
      || activeElement.isContentEditable;

    if (isTextField) {
      activeElement.blur();
    }
  };

  const sliderInteractionProps = {
    onPointerDown: dismissActiveTextInput,
    onTouchStart: dismissActiveTextInput,
    onMouseDown: dismissActiveTextInput,
  } as const;

  useEffect(() => {
    return () => {
      if (previewBackgroundImage.startsWith('blob:')) {
        URL.revokeObjectURL(previewBackgroundImage);
      }
    };
  }, [previewBackgroundImage]);

  useEffect(() => {
    if (!open || !initialData) {
      if (!open) {
        appliedInitialDataRef.current = '';
      }
      return;
    }

    const signature = JSON.stringify({
      templateName,
      exportFormat: persistedSettings.exportFormat,
      headerText: initialData.headerText || '',
      subtext: initialData.subtext || '',
      headerTextColor: initialData.headerTextColor || '#FFFFFF',
      subtextColor: initialData.subtextColor || '#000000',
      fontScale: initialData.fontScale ?? 1,
      headlineWidthScale: initialData.headlineWidthScale ?? 1,
      lineHeightMultiplier: initialData.lineHeightMultiplier ?? 0.93,
      backgroundImage: initialData.backgroundImage || '',
      imageFocalPoint: initialData.imageFocalPoint || { x: 50, y: 50 },
      imageZoom: initialData.imageZoom || 1,
      overlayEnabled: initialData.overlayEnabled || false,
      overlayColor: initialData.overlayColor || '#000000',
      overlayOpacity: initialData.overlayOpacity || 70,
      gradientPosition: initialData.gradientPosition || 'top',
      templateVariant: initialData.templateVariant || 'bottom_center',
      fadeEnabled: initialData.fadeEnabled ?? true,
      fadeOpacity: initialData.fadeOpacity ?? 90,
      brandBlockMode: initialData.brandBlockMode || 'auto',
    });

    if (appliedInitialDataRef.current === signature) {
      return;
    }

    appliedInitialDataRef.current = signature;
    setHeaderText(initialData.headerText || '');
    setSubtext(initialData.subtext || '');
    setHeaderTextColor(initialData.headerTextColor || '#FFFFFF');
    setSubtextColor(initialData.subtextColor || '#000000');
    setFontScale(initialData.fontScale ?? 1);
    setHeadlineWidthScale(initialData.headlineWidthScale ?? 1);
    setLineHeightMultiplier(initialData.lineHeightMultiplier ?? 0.93);
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
    resetHistorySignatureRef.current = signature;
  }, [open, initialData, persistedSettings.exportFormat, templateName]);

  useEffect(() => {
    expandedPreviewOffsetRef.current = expandedPreviewOffset;
  }, [expandedPreviewOffset]);

  useEffect(() => {
    expandedPreviewZoomRef.current = expandedPreviewZoom;
  }, [expandedPreviewZoom]);

  const resolvedPreviewBackgroundSrc = useMemo(() => {
    const source = previewBackgroundImage || backgroundImage || '';
    return buildDesignStudioMediaStreamUrl(source) || source;
  }, [previewBackgroundImage, backgroundImage]);

  const currentDesignSnapshot = useMemo<DesignData>(() => ({
    headerText,
    subtext: hasSubtext ? subtext : undefined,
    headerTextColor,
    subtextColor,
    fontScale,
    headlineWidthScale,
    lineHeightMultiplier,
    backgroundImage,
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
  }), [
    headerText,
    hasSubtext,
    subtext,
    headerTextColor,
    subtextColor,
    fontScale,
    headlineWidthScale,
    lineHeightMultiplier,
    backgroundImage,
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
  ]);

  const currentDesignSignature = useMemo(
    () => JSON.stringify(currentDesignSnapshot),
    [currentDesignSnapshot],
  );

  const applyDesignSnapshot = useCallback((snapshot: DesignData) => {
    const signature = JSON.stringify(snapshot);
    skipHistorySignatureRef.current = signature;
    setHeaderText(snapshot.headerText || '');
    setSubtext(snapshot.subtext || '');
    setHeaderTextColor(snapshot.headerTextColor || '#FFFFFF');
    setSubtextColor(snapshot.subtextColor || '#000000');
    setFontScale(snapshot.fontScale ?? 1);
    setHeadlineWidthScale(snapshot.headlineWidthScale ?? 1);
    setLineHeightMultiplier(snapshot.lineHeightMultiplier ?? 0.93);
    setBackgroundImage(snapshot.backgroundImage || '');
    setPreviewBackgroundImage(snapshot.backgroundImage || '');
    setImageFocalPoint(snapshot.imageFocalPoint || { x: 50, y: 50 });
    setImageZoom(snapshot.imageZoom || 1);
    setOverlayEnabled(snapshot.overlayEnabled || false);
    setOverlayColor(snapshot.overlayColor || '#000000');
    setOverlayOpacity(snapshot.overlayOpacity || 70);
    setGradientPosition(snapshot.gradientPosition || 'top');
    setTemplateVariant(snapshot.templateVariant || 'bottom_center');
    setFadeEnabled(snapshot.fadeEnabled ?? true);
    setFadeOpacity(snapshot.fadeOpacity ?? 90);
    setBrandBlockMode(snapshot.brandBlockMode || 'auto');
    setCaption(snapshot.caption || '');
    setContentType((snapshot.contentType as DesignContentType | undefined) || 'general');
    setExportFormat(snapshot.exportFormat === 'png' ? 'png' : 'jpeg');
  }, []);

  useEffect(() => {
    if (!open) {
      historyRef.current = [];
      redoHistoryRef.current = [];
      lastHistorySignatureRef.current = '';
      skipHistorySignatureRef.current = '';
      resetHistorySignatureRef.current = '';
      setHistoryVersion(0);
      return;
    }

    if (resetHistorySignatureRef.current === currentDesignSignature) {
      historyRef.current = [currentDesignSnapshot];
      redoHistoryRef.current = [];
      lastHistorySignatureRef.current = currentDesignSignature;
      resetHistorySignatureRef.current = '';
      skipHistorySignatureRef.current = '';
      setHistoryVersion((value) => value + 1);
      return;
    }

    if (skipHistorySignatureRef.current === currentDesignSignature) {
      lastHistorySignatureRef.current = currentDesignSignature;
      skipHistorySignatureRef.current = '';
      setHistoryVersion((value) => value + 1);
      return;
    }

    if (!lastHistorySignatureRef.current) {
      historyRef.current = [currentDesignSnapshot];
      redoHistoryRef.current = [];
      lastHistorySignatureRef.current = currentDesignSignature;
      setHistoryVersion((value) => value + 1);
      return;
    }

    if (lastHistorySignatureRef.current === currentDesignSignature) {
      return;
    }

    historyRef.current = [...historyRef.current, currentDesignSnapshot].slice(-40);
    redoHistoryRef.current = [];
    lastHistorySignatureRef.current = currentDesignSignature;
    setHistoryVersion((value) => value + 1);
  }, [open, currentDesignSnapshot, currentDesignSignature]);

  const canUndo = historyRef.current.length > 1;
  const canRedo = redoHistoryRef.current.length > 0;

  const handleUndo = useCallback(() => {
    if (historyRef.current.length <= 1) {
      return;
    }

    const current = historyRef.current[historyRef.current.length - 1];
    const previous = historyRef.current[historyRef.current.length - 2];
    redoHistoryRef.current = [current, ...redoHistoryRef.current].slice(0, 40);
    historyRef.current = historyRef.current.slice(0, -1);
    lastHistorySignatureRef.current = JSON.stringify(previous);
    applyDesignSnapshot(previous);
    haptics.light();
    setHistoryVersion((value) => value + 1);
  }, [applyDesignSnapshot]);

  const handleRedo = useCallback(() => {
    if (redoHistoryRef.current.length === 0) {
      return;
    }

    const [next, ...remaining] = redoHistoryRef.current;
    historyRef.current = [...historyRef.current, next].slice(-40);
    redoHistoryRef.current = remaining;
    lastHistorySignatureRef.current = JSON.stringify(next);
    applyDesignSnapshot(next);
    haptics.light();
    setHistoryVersion((value) => value + 1);
  }, [applyDesignSnapshot]);

  // Trigger real-time preview updates whenever design data changes
  useEffect(() => {
    if (onChange && open) {
      onChange({
        headerText,
        subtext: hasSubtext ? subtext : undefined,
        headerTextColor,
        subtextColor,
        fontScale,
        headlineWidthScale,
        lineHeightMultiplier,
        backgroundImage: backgroundImage,
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
    fontScale,
    headlineWidthScale,
    lineHeightMultiplier,
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

  const handleBackgroundFile = async (file: File) => {
    haptics.light();
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
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleBackgroundFile(file);
      e.target.value = '';
    }
  };

  const backgroundDrop = useDesktopFileDrop({
    accept: 'image/*',
    isEnabled: !isUploadingBackground,
    onFiles: (files) => {
      if (files[0]) {
        void handleBackgroundFile(files[0]);
      }
    },
  });

  const handleTmdbSearch = async () => {
    if (!tmdbSearchQuery.trim()) return;

    haptics.medium();
    setIsSearching(true);

    try {
      setSelectedTmdbResult(null);
      setTmdbImagePool(null);
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

  const handleSelectTmdbResult = async (result: DesignStudioTMDbSearchResult) => {
    haptics.light();
    setSelectedTmdbResult(result);
    setIsLoadingTmdbImages(true);
    try {
      const pool = await fetchDesignStudioTMDbImages(result.mediaType, result.id);
      setTmdbImagePool(pool);
      const nextCategory = result.mediaType === 'person'
        ? 'profiles'
        : pool.backdrops?.length
          ? 'backdrops'
          : 'posters';
      setTmdbImageCategory(nextCategory);
    } catch (error) {
      console.error('TMDb image fetch failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load TMDb images');
      setSelectedTmdbResult(null);
      setTmdbImagePool(null);
    } finally {
      setIsLoadingTmdbImages(false);
    }
  };

  const handleSelectTmdbImage = (imageUrl: string) => {
    haptics.light();
    setBackgroundImage(imageUrl);
    setPreviewBackgroundImage(imageUrl);
    setSelectedTmdbImage(imageUrl);
    setSelectedTmdbResult(null);
    setTmdbImagePool(null);
    setTmdbResults([]);
    setTmdbSearchQuery('');
    toast.success('Image selected from TMDb');
  };

  const handleBackToTmdbResults = () => {
    haptics.light();
    setSelectedTmdbResult(null);
    setTmdbImagePool(null);
  };

  const activeTmdbImages = useMemo(() => {
    if (!tmdbImagePool) return [];
    if (tmdbImageCategory === 'profiles') return tmdbImagePool.profiles || [];
    if (tmdbImageCategory === 'posters') return tmdbImagePool.posters || [];
    return tmdbImagePool.backdrops || [];
  }, [tmdbImageCategory, tmdbImagePool]);

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
      fontScale,
      headlineWidthScale,
      lineHeightMultiplier,
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
    fontScale,
    headlineWidthScale,
    lineHeightMultiplier,
    backgroundImage,
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
    expandedPreviewTapStartRef.current = null;
    expandedPreviewZoomRef.current = 1;
    setExpandedPreviewZoom(1);
    setExpandedPreviewOffset({ x: 0, y: 0 });
  };

  const clampExpandedPreviewOffset = useCallback((offset: { x: number; y: number }, zoom: number) => {
    const viewport = expandedPreviewViewportRef.current;
    if (!viewport || zoom <= 1) {
      return { x: 0, y: 0 };
    }

    const maxX = Math.max(0, (viewport.clientWidth * (zoom - 1)) / 2);
    const maxY = Math.max(0, (viewport.clientHeight * (zoom - 1)) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, offset.x)),
      y: Math.min(maxY, Math.max(-maxY, offset.y)),
    };
  }, []);

  const applyExpandedPreviewZoom = useCallback((nextZoom: number, nextOffset = expandedPreviewOffsetRef.current) => {
    const clampedZoom = Math.max(1, Math.min(4, nextZoom));
    expandedPreviewZoomRef.current = clampedZoom;
    setExpandedPreviewZoom(clampedZoom);
    setExpandedPreviewOffset(clampExpandedPreviewOffset(nextOffset, clampedZoom));
  }, [clampExpandedPreviewOffset]);

  const toggleExpandedPreviewZoom = useCallback(() => {
    const nextZoom = expandedPreviewZoomRef.current > 1 ? 1 : 2;
    applyExpandedPreviewZoom(nextZoom, { x: 0, y: 0 });
  }, [applyExpandedPreviewZoom]);

  const openExpandedPreview = useCallback(() => {
    haptics.light();
    resetExpandedPreviewTransform();
    setIsImageExpanded(true);
  }, []);

  const handleExpandedPreviewTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      expandedPreviewTapStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
      if (expandedPreviewZoomRef.current > 1) {
        expandedPreviewPanStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          offsetX: expandedPreviewOffsetRef.current.x,
          offsetY: expandedPreviewOffsetRef.current.y,
        };
      } else {
        expandedPreviewPanStartRef.current = null;
      }
      expandedPreviewPinchDistanceRef.current = null;
      return;
    }

    if (event.touches.length !== 2) {
      expandedPreviewPinchDistanceRef.current = null;
      expandedPreviewPanStartRef.current = null;
      expandedPreviewTapStartRef.current = null;
      return;
    }

    const firstTouch = event.touches[0];
    const secondTouch = event.touches[1];
    expandedPreviewPanStartRef.current = null;
    expandedPreviewTapStartRef.current = null;
    expandedPreviewPinchDistanceRef.current = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    );
  };

  const handleExpandedPreviewTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1 && expandedPreviewTapStartRef.current) {
      const touch = event.touches[0];
      const movedX = Math.abs(touch.clientX - expandedPreviewTapStartRef.current.x);
      const movedY = Math.abs(touch.clientY - expandedPreviewTapStartRef.current.y);
      if (movedX > EXPANDED_PREVIEW_TAP_MOVE_TOLERANCE || movedY > EXPANDED_PREVIEW_TAP_MOVE_TOLERANCE) {
        expandedPreviewTapStartRef.current = null;
      }
    }

    if (event.touches.length === 1 && expandedPreviewPanStartRef.current && expandedPreviewZoomRef.current > 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - expandedPreviewPanStartRef.current.x;
      const deltaY = touch.clientY - expandedPreviewPanStartRef.current.y;

      if (
        Math.abs(deltaX) <= EXPANDED_PREVIEW_PAN_START_TOLERANCE &&
        Math.abs(deltaY) <= EXPANDED_PREVIEW_PAN_START_TOLERANCE &&
        expandedPreviewTapStartRef.current
      ) {
        return;
      }

      expandedPreviewTapStartRef.current = null;
      event.preventDefault();
      setExpandedPreviewOffset(clampExpandedPreviewOffset({
        x: expandedPreviewPanStartRef.current.offsetX + deltaX,
        y: expandedPreviewPanStartRef.current.offsetY + deltaY,
      }, expandedPreviewZoomRef.current));
      return;
    }

    if (event.touches.length !== 2 || expandedPreviewPinchDistanceRef.current == null) {
      return;
    }

    event.preventDefault();
    const firstTouch = event.touches[0];
    const secondTouch = event.touches[1];
    const nextDistance = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    );
    const scaleRatio = nextDistance / expandedPreviewPinchDistanceRef.current;
    expandedPreviewPinchDistanceRef.current = nextDistance;
    applyExpandedPreviewZoom(expandedPreviewZoomRef.current * scaleRatio);
  };

  const handleExpandedPreviewTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    const activeTap = expandedPreviewTapStartRef.current;
    const changedTouch = event.changedTouches[0];
    if (activeTap && changedTouch) {
      const now = Date.now();
      const lastTap = expandedPreviewLastTapRef.current;
      const tapX = changedTouch.clientX;
      const tapY = changedTouch.clientY;
      if (
        lastTap &&
        now - lastTap.time <= 300 &&
        Math.abs(lastTap.x - tapX) <= EXPANDED_PREVIEW_DOUBLE_TAP_PROXIMITY &&
        Math.abs(lastTap.y - tapY) <= EXPANDED_PREVIEW_DOUBLE_TAP_PROXIMITY
      ) {
        toggleExpandedPreviewZoom();
        expandedPreviewLastTapRef.current = null;
      } else {
        expandedPreviewLastTapRef.current = { time: now, x: tapX, y: tapY };
      }
    }
    expandedPreviewTapStartRef.current = null;
    expandedPreviewPinchDistanceRef.current = null;
    expandedPreviewPanStartRef.current = null;
  };

  const handleExpandedPreviewTouchCancel = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    expandedPreviewTapStartRef.current = null;
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
    if (!expandedPreviewPanStartRef.current || expandedPreviewZoomRef.current <= 1) {
      return;
    }

    event.preventDefault();
    setExpandedPreviewOffset(clampExpandedPreviewOffset({
      x: expandedPreviewPanStartRef.current.offsetX + (event.clientX - expandedPreviewPanStartRef.current.x),
      y: expandedPreviewPanStartRef.current.offsetY + (event.clientY - expandedPreviewPanStartRef.current.y),
    }, expandedPreviewZoomRef.current));
  };

  const handleExpandedPreviewMouseUp = () => {
    expandedPreviewPanStartRef.current = null;
  };

  const handleCancel = () => {
    haptics.light();
    onOpenChange(false);
  };

  const closeExpandedPreview = () => {
    if (!isImageExpanded) {
      return;
    }

    haptics.light();
    markNextPopStateAsHandled();
    setIsImageExpanded(false);
    resetExpandedPreviewTransform();
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
    <BottomSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isImageExpanded) {
          closeExpandedPreview();
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
        <BottomSheetHeader>
        <BottomSheetTitle className="text-gray-900 dark:text-white">Edit Design</BottomSheetTitle>
        <p className="text-xs text-[#6B7280] mt-1">
          PSD layer changes are applied during render and exported using your Design Studio output format.
        </p>
      </BottomSheetHeader>

      <BottomSheetBody>
        <div className="relative space-y-4" data-scrollable>
          <div className="pointer-events-none sticky top-20 z-20 -mb-14 flex justify-end pr-1">
            <div className="pointer-events-auto flex flex-col gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                aria-label="Undo design changes"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white/92 shadow-sm backdrop-blur transition hover:border-[#ec1e24]/60 hover:text-[#ec1e24] disabled:cursor-not-allowed disabled:opacity-35 dark:border-[#333333] dark:bg-black/88 dark:text-white"
              >
                <span
                  aria-hidden="true"
                  className="h-5 w-5"
                  style={{
                    display: 'inline-block',
                    backgroundColor: 'currentColor',
                    WebkitMaskImage: `url("${undoIcon}")`,
                    maskImage: `url("${undoIcon}")`,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                  }}
                />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                aria-label="Redo design changes"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white/92 shadow-sm backdrop-blur transition hover:border-[#ec1e24]/60 hover:text-[#ec1e24] disabled:cursor-not-allowed disabled:opacity-35 dark:border-[#333333] dark:bg-black/88 dark:text-white"
              >
                <span
                  aria-hidden="true"
                  className="h-5 w-5"
                  style={{
                    display: 'inline-block',
                    backgroundColor: 'currentColor',
                    WebkitMaskImage: `url("${redoIcon}")`,
                    maskImage: `url("${redoIcon}")`,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                  }}
                />
              </button>
            </div>
          </div>
          {sourceContext ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#333333] dark:bg-black">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-gray-900 dark:text-white">Source Headline</Label>
                <div className="flex items-center gap-2 text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                  {sourceContext.sourceName ? <span>{sourceContext.sourceName}</span> : null}
                  {sourceContext.fetchedAt ? (
                    <span>{new Date(sourceContext.fetchedAt).toLocaleString()}</span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-900 dark:text-white">
                {sourceContext.sourceHeadline}
              </p>
              {sourceContext.sourceSummary ? (
                <p className="mt-2 text-sm leading-6 text-[#6B7280] dark:text-[#9CA3AF]">
                  {sourceContext.sourceSummary}
                </p>
              ) : null}
              {sourceContext.suggestedHeadline && sourceContext.suggestedHeadline !== sourceContext.sourceHeadline ? (
                <p className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  Suggested headline prefill: {sourceContext.suggestedHeadline}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {sourceContext.matchedKeyword ? (
                  <span className="rounded-full bg-[#ec1e24]/10 px-2.5 py-1 text-[11px] text-[#ec1e24]">
                    {sourceContext.matchedKeyword}
                  </span>
                ) : null}
                {sourceContext.sourceUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(sourceContext.sourceUrl, '_blank', 'noopener,noreferrer')}
                    className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white text-xs"
                  >
                    Open Source
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
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
                  Warning: exceeds recommended limit and may use a smaller font.
                </p>
            )}
            {headerText.length > 60 && headerText.length <= 90 && (
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                  Tip: a medium font size will be used.
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

            <div className="mt-4 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                    Text Size
                  </Label>
                  <span className="text-xs text-gray-600 dark:text-[#6B7280]">
                    {fontScale.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.4"
                  step="0.05"
                  value={fontScale}
                  {...sliderInteractionProps}
                  onChange={(e) => {
                    haptics.light();
                    setFontScale(Number(e.target.value));
                  }}
                  className="w-full accent-[#ec1e24]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                    Headline Width
                  </Label>
                  <span className="text-xs text-gray-600 dark:text-[#6B7280]">
                    {headlineWidthScale.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.02"
                  value={headlineWidthScale}
                  {...sliderInteractionProps}
                  onChange={(e) => {
                    haptics.light();
                    setHeadlineWidthScale(Number(e.target.value));
                  }}
                  className="w-full accent-[#ec1e24]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs text-gray-700 dark:text-[#9CA3AF]">
                    Line Spacing
                  </Label>
                  <span className="text-xs text-gray-600 dark:text-[#6B7280]">
                    {lineHeightMultiplier.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.85"
                  max="1.15"
                  step="0.01"
                  value={lineHeightMultiplier}
                  {...sliderInteractionProps}
                  onChange={(e) => {
                    haptics.light();
                    setLineHeightMultiplier(Number(e.target.value));
                  }}
                  className="w-full accent-[#ec1e24]"
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
                    Warning: exceeds recommended limit and may use a smaller font.
                  </p>
              )}
              {subtext.length > 90 && subtext.length <= 120 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                    Tip: a medium font size will be used.
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
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['bottom_center', 'Bottom Center'],
                    ['bottom_left', 'Bottom Left'],
                    ['bottom_right', 'Bottom Right'],
                    ['top_center', 'Top Center'],
                    ['top_left', 'Top Left'],
                    ['top_right', 'Top Right'],
                  ] as Array<[DesignStudioLayoutVariant, string]>).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      onClick={() => {
                        haptics.light();
                        setTemplateVariant(value);
                        setGradientPosition(variantOverlayDirectionMap[value]);
                      }}
                      variant="outline"
                      size="sm"
                      className={`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${
                        templateVariant === value
                          ? 'bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]'
                          : 'bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]'
                      }`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
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
                    {...sliderInteractionProps}
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
              <label
                className={`block ${backgroundDrop.isDragging ? 'rounded-lg ring-1 ring-[#ec1e24]/50' : ''}`}
                {...backgroundDrop.bind}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploadingBackground}
                  className="hidden"
                />
                <div
                  className={`border border-gray-200 dark:border-[#333333] rounded-lg p-4 text-center cursor-pointer hover:border-[#ec1e24] transition-colors ${
                    backgroundDrop.isDragging ? 'border-[#ec1e24] bg-[#ec1e24]/10' : ''
                  }`}
                >
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
              {selectedTmdbResult ? (
                <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-[#333333] dark:bg-black">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleBackToTmdbResults}
                      className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#9CA3AF]"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                    <div className="text-right">
                      <p className="text-sm text-gray-900 dark:text-white">{selectedTmdbResult.title}</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] uppercase">
                        {selectedTmdbResult.mediaType}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {selectedTmdbResult.mediaType !== 'person' ? (
                      <>
                        <Button
                          type="button"
                          onClick={() => setTmdbImageCategory('backdrops')}
                          variant="outline"
                          size="sm"
                          className={`text-xs ${tmdbImageCategory === 'backdrops' ? 'bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white' : 'bg-white dark:bg-[#000000]'}`}
                        >
                          Backdrops
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setTmdbImageCategory('posters')}
                          variant="outline"
                          size="sm"
                          className={`text-xs ${tmdbImageCategory === 'posters' ? 'bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white' : 'bg-white dark:bg-[#000000]'}`}
                        >
                          Posters
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => setTmdbImageCategory('profiles')}
                        variant="outline"
                        size="sm"
                        className="text-xs bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white"
                      >
                        Profiles
                      </Button>
                    )}
                  </div>

                  {isLoadingTmdbImages ? (
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Loading TMDb images...</p>
                  ) : activeTmdbImages.length === 0 ? (
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">No images available in this section.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      {activeTmdbImages.map((asset) => (
                        <button
                          key={asset.url}
                          type="button"
                          onClick={() => handleSelectTmdbImage(asset.url)}
                          className={`relative overflow-hidden rounded-lg border-2 border-transparent hover:border-[#ec1e24] transition-colors ${
                            tmdbImageCategory === 'backdrops' ? 'aspect-video' : 'aspect-[2/3]'
                          }`}
                        >
                          <img
                            src={asset.url}
                            alt={`${selectedTmdbResult.title} ${tmdbImageCategory}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : tmdbResults.length > 0 ? (
                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                  {tmdbResults.map((result) => {
                    const thumb = result.backdrop || result.poster || result.profile || '';
                    return (
                      <button
                        key={`${result.mediaType}-${result.id}`}
                        type="button"
                        onClick={() => handleSelectTmdbResult(result)}
                        className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-[#ec1e24] dark:border-[#333333] dark:bg-black"
                      >
                        <div className="h-14 w-14 overflow-hidden rounded-md bg-[#111111] shrink-0">
                          {thumb ? (
                            <img src={thumb} alt={result.title} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-gray-900 dark:text-white">{result.title}</p>
                          <p className="mt-1 text-xs uppercase text-[#6B7280] dark:text-[#9CA3AF]">
                            {result.mediaType}
                            {result.releaseDate ? ` • ${result.releaseDate.slice(0, 4)}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
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
                      src={resolvedPreviewBackgroundSrc}
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
                      {...sliderInteractionProps}
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
                      {...sliderInteractionProps}
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
                      {...sliderInteractionProps}
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
                      onClick={openExpandedPreview}
                      aria-label="Expand composition preview"
                      className={`relative block w-full ${getAspectRatioClass()} rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]`}
                    >
                      <LiveDesignPreview
                        templatePreviewUrl={resolvedPreviewBackgroundSrc}
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
                    {...sliderInteractionProps}
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
                  <button
                    type="button"
                    onClick={openExpandedPreview}
                    aria-label="Expand overlay preview"
                    className={`relative block w-full ${getAspectRatioClass()} rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]`}
                  >
                    <LiveDesignPreview
                      templatePreviewUrl={resolvedPreviewBackgroundSrc}
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
      <Dialog
        open={isImageExpanded}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeExpandedPreview();
            return;
          }

          setIsImageExpanded(true);
        }}
      >
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
                closeExpandedPreview();
              }}
              className="absolute top-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-black/80 text-white transition-colors hover:bg-black"
            >
              <X className="w-6 h-6" />
            </button>
            <div
              ref={expandedPreviewViewportRef}
              className="flex max-h-[85vh] min-h-[60vh] select-none items-center justify-center overflow-hidden"
              onTouchStart={handleExpandedPreviewTouchStart}
              onTouchMove={handleExpandedPreviewTouchMove}
              onTouchEnd={handleExpandedPreviewTouchEnd}
              onTouchCancel={handleExpandedPreviewTouchCancel}
              onMouseDown={handleExpandedPreviewMouseDown}
              onMouseMove={handleExpandedPreviewMouseMove}
              onMouseUp={handleExpandedPreviewMouseUp}
              onMouseLeave={handleExpandedPreviewMouseUp}
              style={{ touchAction: 'none' }}
              onDoubleClick={(event) => {
                event.preventDefault();
                toggleExpandedPreviewZoom();
              }}
            >
              <div
                className="relative w-[min(100%,calc(85vh*0.8))] aspect-[4/5] max-h-[80vh] overflow-hidden rounded-lg"
                style={{
                  transform: `translate(${expandedPreviewOffset.x}px, ${expandedPreviewOffset.y}px) scale(${expandedPreviewZoom})`,
                  transformOrigin: 'center center',
                  cursor: expandedPreviewZoom > 1 ? 'grab' : 'default',
                  willChange: 'transform',
                }}
              >
                <LiveDesignPreview
                  templatePreviewUrl={resolvedPreviewBackgroundSrc}
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
