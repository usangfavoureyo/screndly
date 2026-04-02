import { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, CloudRounded, X, MoreVertical, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from "sonner";
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { EditDesignBottomSheet, DesignData } from './EditDesignBottomSheet';
import { PublishBottomSheet } from './PublishBottomSheet';
import { BackblazeTemplateBrowser } from './BackblazeTemplateBrowser';
import { SwipeableTemplateCard } from './SwipeableTemplateCard';
import { VisuallyHidden } from './ui/visually-hidden';
import { haptics } from '../utils/haptics';
import { addRecentActivity, addLogEntry } from '../utils/activityStore';
import { getPhotopeaService } from '../utils/photopeaService';
import { useNotifications } from '../contexts/NotificationsContext';
import { useSettings } from '../contexts/SettingsContext';
import { useRSSFeeds } from '../contexts/RSSFeedsContext';
import { useUndo } from './UndoContext';
import { SegmentedTabSwitcher } from './SegmentedTabSwitcher';
import { BottomSheet, BottomSheetBody, BottomSheetFooter, BottomSheetHeader, BottomSheetTitle } from './ui/bottom-sheet';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  createDesignStudioActivity,
  fetchDesignStudioState,
  saveDesignStudioState,
  uploadDesignStudioAsset,
  type DesignStudioAutoEditorialRecord,
  type DesignStudioLayoutVariant,
} from '../lib/api/designStudio';
import { publishContent, type PlatformSelection } from '../lib/api/platforms';
import { generateDesignStudioCaption } from '../utils/designStudioCaptionGenerator';

interface DesignStudioPageProps {
  onNavigate: (page: string, fromPage?: string | null) => void;
  previousPage?: string | null;
}

interface Template {
  id: string;
  name: string;
  previewUrl: string;
  aspectRatio: string;
  width: number;
  height: number;
  source: 'upload' | 'backblaze';
  lastEdited: Date;
  hasSubtext: boolean;
  hasCategory?: boolean;
  hasSource?: boolean;
  psdData?: any; // Will store actual PSD data in production
  layoutVariant?: DesignStudioLayoutVariant;
  mappedLayers?: string[];
  textZone?: { horizontal: 'left' | 'center' | 'right'; vertical: 'top' | 'bottom' };
  imageAnchor?: { x: number; y: number };
  overlayDirection?: 'top' | 'bottom' | 'left' | 'right';
  overlayStrength?: number;
  safeMargin?: number;
  isValidated?: boolean;
  validationState?: 'valid' | 'warning' | 'invalid';
  isDefaultManual?: boolean;
  isDefaultAuto?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RenderedDesign {
  id: string;
  templateId: string;
  templateName: string;
  outputUrl: string;
  data: DesignData;
  createdAt: Date;
  aspectRatio: string;
  caption?: string; // AI-generated caption
  contentType?: 'poster' | 'carousel' | 'story' | 'announcement' | 'general';
}

type DesignStudioTab = 'manual' | 'auto';

type AutoEditorial = DesignStudioAutoEditorialRecord;

type AutoEditorialAction =
  | 'caption'
  | 'header'
  | 'subheader'
  | 'background'
  | 'overlay'
  | 'template'
  | 'schedule';

function parseTemplate(template: any): Template {
  return {
    ...template,
    lastEdited: new Date(template.lastEdited),
    createdAt: template.createdAt ? new Date(template.createdAt) : undefined,
    updatedAt: template.updatedAt ? new Date(template.updatedAt) : undefined,
  };
}

function parseRenderedDesign(renderedDesign: any): RenderedDesign {
  return {
    ...renderedDesign,
    createdAt: new Date(renderedDesign.createdAt),
  };
}

function serializeTemplates(templates: Template[]) {
  return templates.map((template) => ({
    ...template,
    lastEdited: template.lastEdited.toISOString(),
    createdAt: template.createdAt?.toISOString(),
    updatedAt: template.updatedAt?.toISOString(),
  }));
}

function serializeRenderedDesigns(renderedDesigns: RenderedDesign[]) {
  return renderedDesigns.map((renderedDesign) => ({
    ...renderedDesign,
    createdAt: renderedDesign.createdAt.toISOString(),
  }));
}

function defaultLayoutMetadata(layoutVariant: DesignStudioLayoutVariant = 'top_left') {
  switch (layoutVariant) {
    case 'top_right':
      return {
        textZone: { horizontal: 'right' as const, vertical: 'top' as const },
        imageAnchor: { x: 28, y: 68 },
        overlayDirection: 'top' as const,
        overlayStrength: 76,
        safeMargin: 48,
      };
    case 'top_center':
      return {
        textZone: { horizontal: 'center' as const, vertical: 'top' as const },
        imageAnchor: { x: 50, y: 72 },
        overlayDirection: 'top' as const,
        overlayStrength: 78,
        safeMargin: 48,
      };
    case 'bottom_left':
      return {
        textZone: { horizontal: 'left' as const, vertical: 'bottom' as const },
        imageAnchor: { x: 70, y: 30 },
        overlayDirection: 'bottom' as const,
        overlayStrength: 74,
        safeMargin: 48,
      };
    case 'bottom_right':
      return {
        textZone: { horizontal: 'right' as const, vertical: 'bottom' as const },
        imageAnchor: { x: 30, y: 30 },
        overlayDirection: 'bottom' as const,
        overlayStrength: 74,
        safeMargin: 48,
      };
    case 'bottom_center':
      return {
        textZone: { horizontal: 'center' as const, vertical: 'bottom' as const },
        imageAnchor: { x: 50, y: 28 },
        overlayDirection: 'bottom' as const,
        overlayStrength: 76,
        safeMargin: 48,
      };
    case 'top_left':
    default:
      return {
        textZone: { horizontal: 'left' as const, vertical: 'top' as const },
        imageAnchor: { x: 72, y: 68 },
        overlayDirection: 'top' as const,
        overlayStrength: 76,
        safeMargin: 48,
      };
  }
}

function parseAutoEditorial(editorial: any): AutoEditorial {
  return {
    ...editorial,
    targetPlatforms: Array.isArray(editorial.targetPlatforms) ? editorial.targetPlatforms : [],
    createdAt: editorial.createdAt || new Date().toISOString(),
    updatedAt: editorial.updatedAt || editorial.createdAt || new Date().toISOString(),
  };
}

function normalizeKeyword(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function inspectTemplateFromUrl(url: string) {
  const photopeaService = getPhotopeaService();
  await photopeaService.initialize();
  try {
    await photopeaService.loadPSDFromURL(url);
    return await photopeaService.analyzeLayers();
  } finally {
    try {
      await photopeaService.closeDocument();
    } catch (closeError) {
      console.warn('Failed to close inspected PSD document:', closeError);
    }
  }
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [meta, content] = dataUrl.split(',');
  if (!meta || !content) {
    throw new Error('Invalid preview data');
  }

  const mimeMatch = meta.match(/data:(.*|);base64/);
  const mimeType = mimeMatch?.[1] || 'image/png';
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
}

export default function DesignStudioPage({ onNavigate }: DesignStudioPageProps) {
  const { addNotification } = useNotifications();
  const { settings } = useSettings();
  const { feeds, getActivity } = useRSSFeeds();
  const { showUndo } = useUndo();
  const [activeTab, setActiveTab] = useState<DesignStudioTab>(() => {
    const savedTab = localStorage.getItem('designStudioActiveTab');
    return savedTab === 'auto' ? 'auto' : 'manual';
  });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [renderedDesigns, setRenderedDesigns] = useState<RenderedDesign[]>([]);
  const [autoEditorials, setAutoEditorials] = useState<AutoEditorial[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<Template | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isPublishSheetOpen, setIsPublishSheetOpen] = useState(false);
  const [livePreviewData, setLivePreviewData] = useState<DesignData | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [publishTarget, setPublishTarget] = useState<RenderedDesign | null>(null);
  const [showBackblazeBrowser, setShowBackblazeBrowser] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isGeneratingAutoEditorials, setIsGeneratingAutoEditorials] = useState(false);
  const [previewEditorial, setPreviewEditorial] = useState<AutoEditorial | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [selectedEditorial, setSelectedEditorial] = useState<AutoEditorial | null>(null);
  const [isEditorialActionsOpen, setIsEditorialActionsOpen] = useState(false);
  const [isEditorialEditorOpen, setIsEditorialEditorOpen] = useState(false);
  const [editorialEditorMode, setEditorialEditorMode] = useState<AutoEditorialAction>('caption');
  const [editorialDraftValue, setEditorialDraftValue] = useState('');
  const [editorialOverlayDirection, setEditorialOverlayDirection] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [editorialOverlayStrength, setEditorialOverlayStrength] = useState(75);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('designStudioActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    let mounted = true;

    const loadState = async () => {
      try {
        const state = await fetchDesignStudioState();
        if (!mounted) {
          return;
        }

        setTemplates((state.templates || []).map(parseTemplate));
        setRenderedDesigns((state.renderedDesigns || []).map(parseRenderedDesign));
        setAutoEditorials((state.autoEditorials || []).map(parseAutoEditorial));
      } catch (error) {
        console.error('Failed to load Design Studio state:', error);
        if (mounted) {
          toast.error('Failed to load Design Studio data');
        }
      } finally {
        if (mounted) {
          setIsLoadingState(false);
        }
      }
    };

    loadState();

    return () => {
      mounted = false;
    };
  }, []);

  // Calculate aspect ratio from dimensions
  const calculateAspectRatio = (width: number, height: number): string => {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    const w = width / divisor;
    const h = height / divisor;
    
    // Common aspect ratios
    if (w === 16 && h === 9) return '16:9';
    if (w === 9 && h === 16) return '9:16';
    if (w === 1 && h === 1) return '1:1';
    if (w === 4 && h === 5) return '4:5';
    if (w === 5 && h === 4) return '5:4';
    if (w === 3 && h === 4) return '3:4';
    if (w === 4 && h === 3) return '4:3';
    
    return `${w}:${h}`;
  };

  const persistState = async (
    nextTemplates: Template[],
    nextRenderedDesigns: RenderedDesign[],
    nextAutoEditorials: AutoEditorial[] = autoEditorials,
  ) => {
    await saveDesignStudioState({
      templates: serializeTemplates(nextTemplates),
      renderedDesigns: serializeRenderedDesigns(nextRenderedDesigns),
      autoEditorials: nextAutoEditorials,
    });
  };

  const handleUploadPSD = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.psd')) {
      toast.error('Please upload a PSD file');
      return;
    }

    haptics.medium();
    toast.success('Processing PSD template with Photopea...');

    try {
      const photopeaService = getPhotopeaService();
      await photopeaService.initialize();
      await photopeaService.loadPSD(file);
      const analysis = await photopeaService.analyzeLayers();
      const previewDataUrl = await photopeaService.getPreview();
      const previewFile = dataUrlToFile(previewDataUrl, `${file.name.replace(/\.psd$/i, '')}-preview.png`);

      const [templateUpload, previewUpload] = await Promise.all([
        uploadDesignStudioAsset(file, 'templates'),
        uploadDesignStudioAsset(previewFile, 'template-previews'),
      ]);
      const layoutMetadata = defaultLayoutMetadata('top_left');
      const mappedLayers = Array.isArray(analysis.layers)
        ? analysis.layers.map((layer: { name?: string }) => layer.name).filter((name): name is string => Boolean(name))
        : [];
      const isValidated = Boolean(analysis.detectedLayers.hasHeader && analysis.detectedLayers.hasBackground);

      const template: Template = {
        id: `template-${Date.now()}`,
        name: file.name.replace('.psd', ''),
        previewUrl: previewUpload.url,
        aspectRatio: calculateAspectRatio(analysis.width, analysis.height),
        width: analysis.width,
        height: analysis.height,
        source: 'upload',
        lastEdited: new Date(),
        hasSubtext: analysis.detectedLayers.hasSubtext,
        hasCategory: false,
        hasSource: false,
        layoutVariant: 'top_left',
        mappedLayers,
        textZone: layoutMetadata.textZone,
        imageAnchor: layoutMetadata.imageAnchor,
        overlayDirection: layoutMetadata.overlayDirection,
        overlayStrength: layoutMetadata.overlayStrength,
        safeMargin: layoutMetadata.safeMargin,
        isValidated,
        validationState: isValidated ? 'valid' : 'warning',
        isDefaultManual: templates.length === 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        psdData: {
          layers: analysis.layers,
          detectedLayers: analysis.detectedLayers,
          b2Url: templateUpload.url,
          fileName: templateUpload.fileName,
          previewFileName: previewUpload.fileName,
        },
      };

      const nextTemplates = [template, ...templates];
      await persistState(nextTemplates, renderedDesigns);
      setTemplates(nextTemplates);
      await createDesignStudioActivity('template_uploaded', {
        templateName: template.name,
      });

      toast.success(`Template "${template.name}" analyzed and uploaded!`);
      await photopeaService.closeDocument();
    } catch (error) {
      console.error('Photopea analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process PSD template');
    } finally {
      e.target.value = '';
    }
  };

  const handleLoadFromBackblaze = async () => {
    haptics.medium();
    setShowBackblazeBrowser(true);
  };

  const handleLoadSelectedTemplates = async (selectedFiles: any[]) => {
    const b2Templates: Template[] = [];

    for (const [index, file] of selectedFiles.entries()) {
      let width = 1080;
      let height = 1350;
      let hasSubtext = true;
      let mappedLayers: string[] = [];
      let isValidated = false;

      try {
        const analysis = await inspectTemplateFromUrl(file.url);
        width = analysis.width;
        height = analysis.height;
        hasSubtext = analysis.detectedLayers.hasSubtext;
        mappedLayers = Array.isArray(analysis.layers)
          ? analysis.layers.map((layer: { name?: string }) => layer.name).filter((name): name is string => Boolean(name))
          : [];
        isValidated = Boolean(analysis.detectedLayers.hasHeader && analysis.detectedLayers.hasBackground);
      } catch (error) {
        console.warn('Failed to inspect Backblaze template metadata, falling back to default canvas size:', file.fileName, error);
      }
      const layoutMetadata = defaultLayoutMetadata('top_left');

      b2Templates.push({
        id: `bb-${file.fileId}-${Date.now()}-${index}`,
        name: file.fileName.replace('.psd', '').replace('templates/', ''),
        previewUrl: file.url.replace('.psd', '_preview.jpg'),
        aspectRatio: calculateAspectRatio(width, height),
        width,
        height,
        source: 'backblaze',
        lastEdited: new Date(file.lastModified),
        hasSubtext,
        layoutVariant: 'top_left',
        mappedLayers,
        textZone: layoutMetadata.textZone,
        imageAnchor: layoutMetadata.imageAnchor,
        overlayDirection: layoutMetadata.overlayDirection,
        overlayStrength: layoutMetadata.overlayStrength,
        safeMargin: layoutMetadata.safeMargin,
        isValidated,
        validationState: isValidated ? 'valid' : 'warning',
        createdAt: new Date(),
        updatedAt: new Date(),
        psdData: {
          b2Url: file.url,
          fileName: file.fileName,
        },
      });
    }

    const nextTemplates = [...b2Templates, ...templates];
    await persistState(nextTemplates, renderedDesigns);
    setTemplates(nextTemplates);
    await createDesignStudioActivity('templates_loaded', {
      source: 'backblaze',
      count: b2Templates.length,
    });

    toast.success(`${b2Templates.length} template${b2Templates.length !== 1 ? 's' : ''} loaded from Backblaze`);
    haptics.success();
    setShowBackblazeBrowser(false);
  };

  const handleExpandTemplate = (template: Template) => {
    haptics.light();
    setExpandedTemplate(template);
    setIsExpanded(true);
  };

  const handleEditTemplate = (template: Template) => {
    haptics.light();
    setSelectedTemplate(template);
    setEditingTemplateId(template.id);
    setIsEditSheetOpen(true);
  };

  const handlePublishTemplate = (template: Template) => {
    haptics.light();
    
    // Check if there's a rendered design for this template
    const existingDesign = renderedDesigns.find(d => d.templateId === template.id);
    
    if (existingDesign) {
      setPublishTarget(existingDesign);
      setIsPublishSheetOpen(true);
    } else {
      // If no rendered design exists, open edit sheet first
      setSelectedTemplate(template);
      setEditingTemplateId(template.id);
      setIsEditSheetOpen(true);
      toast('Edit and render your design first', {
        description: 'Add your content, then save to publish',
      });
    }
  };

  const handleSaveDesign = async (data: DesignData) => {
    if (!selectedTemplate) return;

    setIsRendering(true);
    setIsEditSheetOpen(false);

    toast.success('Rendering design with Photopea...');

    try {
      const photopeaService = getPhotopeaService();
      await photopeaService.initialize();
      const psdUrl = selectedTemplate.psdData?.b2Url || selectedTemplate.psdData?.fileUrl;
      if (!psdUrl) {
        throw new Error('Template source file is missing');
      }

      await photopeaService.loadPSDFromURL(psdUrl);
      const renderedBlob = await photopeaService.renderDesign(data, {
        width: selectedTemplate.width,
        height: selectedTemplate.height,
        hasSubtext: selectedTemplate.hasSubtext || false,
        hasOverlay: true,
      });

      const renderedFile = new File(
        [renderedBlob],
        `${selectedTemplate.name.replace(/[^a-zA-Z0-9-_]+/g, '-')}.jpg`,
        { type: 'image/jpeg' }
      );
      const renderedUpload = await uploadDesignStudioAsset(renderedFile, 'renders');

      const renderedDesign: RenderedDesign = {
        id: `design-${Date.now()}`,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        outputUrl: renderedUpload.url,
        data,
        createdAt: new Date(),
        aspectRatio: selectedTemplate.aspectRatio,
        caption: data.caption,
        contentType: data.contentType,
      };

      const nextRenderedDesigns = [renderedDesign, ...renderedDesigns];
      await persistState(templates, nextRenderedDesigns);
      setRenderedDesigns(nextRenderedDesigns);
      setIsRendering(false);

      await photopeaService.closeDocument();
      toast.success('Design rendered successfully!');
      haptics.success();

      try {
        await createDesignStudioActivity('design_rendered', {
          templateName: selectedTemplate.name,
          designId: renderedDesign.id,
        });

        addRecentActivity({
          title: selectedTemplate.name,
          platform: 'Design Studio',
          status: 'success',
          type: 'designstudio',
        });

        addLogEntry({
          videoTitle: selectedTemplate.name,
          platform: 'Design Studio',
          status: 'success',
          type: 'designstudio',
        });

        addNotification({
          type: 'success',
          title: 'Design Rendered',
          message: `"${selectedTemplate.name}" rendered successfully`,
          source: 'design_studio',
          actionPage: 'design-studio-activity',
        });
      } catch (postRenderError) {
        console.error('Design rendered, but failed to record Design Studio activity:', postRenderError);
      }
    } catch (error) {
      console.error('Photopea rendering error:', error);
      setIsRendering(false);
      toast.error(error instanceof Error ? error.message : 'Failed to render design');
    }
  };

  const handlePublish = async (caption: string, platforms: PlatformSelection) => {
    if (!publishTarget) return;

    haptics.medium();
    try {
      const result = await publishContent(platforms, {
        text: caption || publishTarget.caption || publishTarget.templateName,
        title: publishTarget.templateName,
        imageUrl: publishTarget.outputUrl,
      });

      if (!result.success || !result.data) {
        toast.error(result.error?.message || 'Failed to publish design');
        return;
      }

      const successfulPlatforms = result.data.results
        .filter((item: any) => item.status === 'posted')
        .map((item: any) => item.platform);
      const failedPlatforms = result.data.results
        .filter((item: any) => item.status === 'failed')
        .map((item: any) => `${item.platform}${item.error ? `: ${item.error}` : ''}`);

      if (successfulPlatforms.length === 0) {
        toast.error(failedPlatforms[0] || 'Failed to publish design');
        return;
      }

      const nextRenderedDesigns = renderedDesigns.map((design) =>
        design.id === publishTarget.id
          ? { ...design, caption: caption || design.caption }
          : design
      );
      await persistState(templates, nextRenderedDesigns);
      setRenderedDesigns(nextRenderedDesigns);

      const platformsList = successfulPlatforms.join(', ');

      await createDesignStudioActivity('design_published', {
        templateName: publishTarget.templateName,
        designId: publishTarget.id,
        platforms: platformsList,
      });

      addRecentActivity({
        title: publishTarget.templateName,
        platform: platformsList,
        status: 'success',
        type: 'designstudio',
      });

      addLogEntry({
        videoTitle: publishTarget.templateName,
        platform: platformsList,
        status: 'success',
        type: 'designstudio',
        errorDetails: failedPlatforms.length > 0 ? failedPlatforms.join(' | ') : undefined,
      });

      addNotification({
        type: 'success',
        title: 'Design Published',
        message: `"${publishTarget.templateName}" published to ${platformsList}`,
        source: 'design_studio',
        actionPage: 'design-studio-activity',
      });

      if (failedPlatforms.length > 0) {
        toast.success(`Published to ${platformsList}`, {
          description: `Failed: ${failedPlatforms.join(' | ')}`,
        });
        return;
      }

      toast.success('Design published to selected platforms!');
    } catch (error) {
      console.error('Failed to finish Design Studio publish flow:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to publish design');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;

    const previousTemplates = [...templates];
    const previousRenderedDesigns = [...renderedDesigns];
    const nextTemplates = templates.filter(t => t.id !== id);
    const nextRenderedDesigns = renderedDesigns.filter(d => d.templateId !== id);

    try {
      await persistState(nextTemplates, nextRenderedDesigns);
      setTemplates(nextTemplates);
      setRenderedDesigns(nextRenderedDesigns);
      await createDesignStudioActivity('template_deleted', {
        templateName: template.name,
      });

      haptics.medium();
      toast.success(`Template deleted`);

      showUndo({
        id: `undo-template-${id}`,
        itemName: template.name,
        onUndo: async () => {
          await persistState(previousTemplates, previousRenderedDesigns);
          setTemplates(previousTemplates);
          setRenderedDesigns(previousRenderedDesigns);
          haptics.light();
          toast.success('Template restored');
        }
      });
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete template');
    }
  };

  const selectedFeedIds = useMemo(
    () => new Set(settings.designStudioSelectedRssFeedIds || []),
    [settings.designStudioSelectedRssFeedIds],
  );

  const validatedTemplates = useMemo(
    () => templates.filter((template) => template.isValidated !== false),
    [templates],
  );

  const autoStats = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return {
      generatedToday: autoEditorials.filter((item) => new Date(item.createdAt) >= startOfDay).length,
      queued: autoEditorials.filter((item) => item.status === 'queued' || item.status === 'scheduled').length,
      posted: autoEditorials.filter((item) => item.status === 'posted').length,
      failed: autoEditorials.filter((item) => item.status === 'failed').length,
    };
  }, [autoEditorials]);

  const defaultAutoTemplate = useMemo(() => {
    const requestedTemplate = templates.find((template) => template.id === settings.designStudioDefaultAutoTemplateId);
    return requestedTemplate && requestedTemplate.isValidated !== false
      ? requestedTemplate
      : validatedTemplates[0] || null;
  }, [templates, validatedTemplates, settings.designStudioDefaultAutoTemplateId]);

  const autoActivityBadgeCount = useMemo(
    () => autoEditorials.filter((item) => item.status === 'queued' || item.status === 'scheduled' || item.status === 'failed').length,
    [autoEditorials],
  );

  const getContentTypeForKeyword = (keyword: string | undefined): AutoEditorial['contentType'] => {
    const normalized = normalizeKeyword(keyword || '');
    if (normalized.includes('release date') || normalized.includes('premiere') || normalized.includes('premieres')) {
      return 'announcement';
    }
    if (normalized.includes('renew') || normalized.includes('cancel') || normalized.includes('confirm') || normalized.includes('development')) {
      return 'announcement';
    }
    return 'general';
  };

  const findMatchedKeyword = (title: string, keywords: string[]) => {
    const normalizedTitle = normalizeKeyword(title);
    return keywords.find((keyword) => normalizedTitle.includes(normalizeKeyword(keyword)));
  };

  const findBannedKeyword = (title: string, keywords: string[]) => {
    const normalizedTitle = normalizeKeyword(title);
    return keywords.find((keyword) => normalizedTitle.includes(normalizeKeyword(keyword)));
  };

  const deriveEditorialScore = (title: string, matchedKeyword: string, hasImage: boolean) => {
    let score = 50;
    if (matchedKeyword.split(' ').length > 1) {
      score += 12;
    } else {
      score += 8;
    }
    if (title.length >= 40 && title.length <= 110) {
      score += 12;
    }
    if (hasImage) {
      score += 10;
    }
    return Math.min(100, score);
  };

  const deriveHeaderText = (title: string) => {
    if (title.length <= 88) {
      return title;
    }
    return `${title.slice(0, 85).trim()}...`;
  };

  const deriveSubtext = (feedName?: string, matchedKeyword?: string) => {
    if (!feedName && !matchedKeyword) {
      return '';
    }
    if (feedName && matchedKeyword) {
      return `${feedName} • ${matchedKeyword}`;
    }
    return feedName || matchedKeyword || '';
  };

  const buildScheduledTime = (index: number) => {
    const intervalMinutes = Number.parseInt(settings.designStudioPostingInterval || '5', 10) || 5;
    const baseTime = new Date();
    baseTime.setMinutes(baseTime.getMinutes() + intervalMinutes * index);
    return baseTime.toISOString();
  };

  const renderAutoEditorialImage = async (
    template: Template,
    headerText: string,
    subtext: string,
    backgroundSource?: string,
  ) => {
    const photopeaService = getPhotopeaService();
    await photopeaService.initialize();

    try {
      const psdUrl = template.psdData?.b2Url || template.psdData?.fileUrl;
      if (!psdUrl) {
        throw new Error('Template source file is missing');
      }

      await photopeaService.loadPSDFromURL(psdUrl);
      const renderBlob = await photopeaService.renderDesign(
        {
          headerText,
          subtext: subtext || undefined,
          backgroundImage: backgroundSource,
          overlayColor: '#000000',
          overlayOpacity: template.overlayStrength || 75,
          gradientPosition: template.overlayDirection || 'top',
        },
        {
          width: template.width,
          height: template.height,
          hasSubtext: template.hasSubtext,
          hasOverlay: true,
        },
      );

      const renderedFile = new File(
        [renderBlob],
        `${template.name.replace(/[^a-zA-Z0-9-_]+/g, '-')}-auto.jpg`,
        { type: 'image/jpeg' },
      );
      const upload = await uploadDesignStudioAsset(renderedFile, 'renders');
      return upload.url;
    } finally {
      try {
        await photopeaService.closeDocument();
      } catch (closeError) {
        console.warn('Failed to close auto editorial document:', closeError);
      }
    }
  };

  const handleGenerateAutoEditorials = async () => {
    if (isGeneratingAutoEditorials) {
      return;
    }

    if (!settings.designStudioAutoEnabled) {
      toast.info('Enable Auto Editorials in Design Studio settings first');
      return;
    }

    if (selectedFeedIds.size === 0) {
      toast.info('Select at least one RSS feed source in Design Studio settings');
      return;
    }

    if (!defaultAutoTemplate) {
      toast.info('Select a validated default Auto template in Design Studio settings');
      return;
    }

    const triggerKeywords = settings.designStudioTriggerKeywords || [];
    if (triggerKeywords.length === 0) {
      toast.info('Add at least one editorial trigger keyword first');
      return;
    }

    setIsGeneratingAutoEditorials(true);

    try {
      const activity = await getActivity(200);
      const activityItems = activity?.items || [];
      const existingSourceIds = new Set(autoEditorials.map((item) => item.sourceFeedItemId));
      const seenTitles = new Set<string>();
      const bannedKeywords = settings.designStudioBannedKeywords || [];
      const candidates = activityItems
        .filter((item) => item.feedId && selectedFeedIds.has(item.feedId))
        .map((item) => {
          const blockedKeyword = findBannedKeyword(item.title, bannedKeywords);
          if (blockedKeyword) {
            return null;
          }

          const matchedKeyword = findMatchedKeyword(item.title, triggerKeywords);
          if (!matchedKeyword) {
            return null;
          }

          const normalizedTitle = normalizeKeyword(item.title);
          if (seenTitles.has(normalizedTitle) || existingSourceIds.has(item.id)) {
            return null;
          }
          seenTitles.add(normalizedTitle);

          const backgroundSource = item.imageUrl || item.imageUrls?.[0] || item.selectedImages?.[0]?.url;
          const score = deriveEditorialScore(item.title, matchedKeyword, Boolean(backgroundSource));
          return { item, matchedKeyword, score, backgroundSource };
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
        .filter((candidate) => candidate.score >= (settings.designStudioMinimumScoreThreshold || 55))
        .sort((left, right) => right.score - left.score)
        .slice(0, settings.designStudioMaxEditorialsPerRun || 5);

      if (candidates.length === 0) {
        toast.info('No matching editorial candidates found yet');
        return;
      }

      const nextAutoEditorials: AutoEditorial[] = [];

      for (const [index, candidate] of candidates.entries()) {
        const contentType = getContentTypeForKeyword(candidate.matchedKeyword);
        const headerText = deriveHeaderText(candidate.item.title);
        const subtext = deriveSubtext(candidate.item.feedName, candidate.matchedKeyword);
        const captionResult = await generateDesignStudioCaption(
          {
            contentType,
            title: candidate.item.title,
            tagline: subtext,
            context: candidate.item.description || candidate.item.feedName || 'Editorial update',
          },
          settings,
        );
        const renderedImage = await renderAutoEditorialImage(
          defaultAutoTemplate,
          headerText,
          subtext,
          candidate.backgroundSource,
        );
        const scheduleTime = buildScheduledTime(index);
        const editorial: AutoEditorial = {
          id: `auto-editorial-${Date.now()}-${index}`,
          sourceFeedItemId: candidate.item.id,
          sourceFeedId: candidate.item.feedId,
          sourceFeedName: candidate.item.feedName,
          sourceTitle: candidate.item.title,
          sourceUrl: candidate.item.link,
          matchedKeyword: candidate.matchedKeyword,
          templateId: defaultAutoTemplate.id,
          templateName: defaultAutoTemplate.name,
          renderedImage,
          headerText,
          subheaderText: subtext,
          caption: captionResult.caption,
          backgroundSource: candidate.backgroundSource,
          backgroundOffsetX: defaultAutoTemplate.imageAnchor?.x ?? 50,
          backgroundOffsetY: defaultAutoTemplate.imageAnchor?.y ?? 50,
          zoomLevel: 1,
          overlayDirection: defaultAutoTemplate.overlayDirection || 'top',
          overlayStrength: defaultAutoTemplate.overlayStrength || 75,
          scheduleTime,
          targetPlatforms: settings.designStudioTargetPlatforms || [],
          status: settings.designStudioAutoPost ? 'scheduled' : 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          postedAt: null,
          failureReason: null,
        };
        nextAutoEditorials.push(editorial);
      }

      const combinedEditorials = [...nextAutoEditorials, ...autoEditorials];
      await persistState(templates, renderedDesigns, combinedEditorials);
      setAutoEditorials(combinedEditorials);

      await Promise.all(
        nextAutoEditorials.map((editorial) =>
          createDesignStudioActivity('auto_editorial_generated', {
            sourceTitle: editorial.sourceTitle,
            templateName: editorial.templateName,
            matchedKeyword: editorial.matchedKeyword,
            status: editorial.status,
          }),
        ),
      );

      toast.success(`${nextAutoEditorials.length} auto editorial${nextAutoEditorials.length === 1 ? '' : 's'} generated`);
    } catch (error) {
      console.error('Failed to generate auto editorials:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate auto editorials');
    } finally {
      setIsGeneratingAutoEditorials(false);
    }
  };

  const updateEditorial = async (editorialId: string, updates: Partial<AutoEditorial>) => {
    const nextAutoEditorials = autoEditorials.map((item) =>
      item.id === editorialId
        ? { ...item, ...updates, updatedAt: new Date().toISOString() }
        : item,
    );
    await persistState(templates, renderedDesigns, nextAutoEditorials);
    setAutoEditorials(nextAutoEditorials);
  };

  const handlePublishAutoEditorial = async (editorial: AutoEditorial) => {
    try {
      const platforms = (editorial.targetPlatforms || []).reduce<Record<string, boolean>>((accumulator, platform) => {
        accumulator[platform] = true;
        return accumulator;
      }, {}) as PlatformSelection;

      const result = await publishContent(platforms, {
        text: editorial.caption,
        title: editorial.headerText,
        imageUrl: editorial.renderedImage,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to publish auto editorial');
      }

      const nextStatus: AutoEditorial['status'] = result.data.results.some((entry: { status: string }) => entry.status === 'posted')
        ? 'posted'
        : 'failed';

      await updateEditorial(editorial.id, {
        status: nextStatus,
        postedAt: nextStatus === 'posted' ? new Date().toISOString() : editorial.postedAt || null,
        failureReason: nextStatus === 'failed' ? 'No platform accepted the editorial' : null,
      });

      await createDesignStudioActivity(nextStatus === 'posted' ? 'auto_editorial_posted' : 'auto_editorial_failed', {
        sourceTitle: editorial.sourceTitle,
        templateName: editorial.templateName,
        platforms: (editorial.targetPlatforms || []).join(', '),
      });

      if (nextStatus === 'posted') {
        toast.success('Auto editorial published');
      } else {
        toast.error('Auto editorial failed to publish');
      }
    } catch (error) {
      console.error('Failed to publish auto editorial:', error);
      await updateEditorial(editorial.id, {
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Failed to publish auto editorial',
      });
      toast.error(error instanceof Error ? error.message : 'Failed to publish auto editorial');
    }
  };

  useEffect(() => {
    if (!settings.designStudioAutoEnabled || !settings.designStudioAutoPost) {
      return;
    }

    const interval = window.setInterval(() => {
      const dueEditorial = autoEditorials.find((item) => item.status === 'scheduled' && item.scheduleTime && new Date(item.scheduleTime).getTime() <= Date.now());
      if (dueEditorial) {
        void handlePublishAutoEditorial(dueEditorial);
      }
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoEditorials, settings.designStudioAutoEnabled, settings.designStudioAutoPost]);

  const openEditorialEditor = (editorial: AutoEditorial, mode: AutoEditorialAction) => {
    setSelectedEditorial(editorial);
    setEditorialEditorMode(mode);
    setEditorialDraftValue(
      mode === 'caption'
        ? editorial.caption
        : mode === 'header'
          ? editorial.headerText
          : mode === 'subheader'
            ? editorial.subheaderText || ''
            : mode === 'background'
              ? editorial.backgroundSource || ''
              : mode === 'schedule'
                ? editorial.scheduleTime || ''
                : mode === 'template'
                  ? editorial.templateId
                  : '',
    );
    setEditorialOverlayDirection(editorial.overlayDirection || 'top');
    setEditorialOverlayStrength(editorial.overlayStrength || 75);
    setIsEditorialActionsOpen(false);
    setIsEditorialEditorOpen(true);
  };

  const handleSaveEditorialEdit = async () => {
    if (!selectedEditorial) {
      return;
    }

    const updates: Partial<AutoEditorial> = {};

    switch (editorialEditorMode) {
      case 'caption':
        updates.caption = editorialDraftValue;
        break;
      case 'header':
        updates.headerText = editorialDraftValue;
        break;
      case 'subheader':
        updates.subheaderText = editorialDraftValue;
        break;
      case 'background':
        updates.backgroundSource = editorialDraftValue;
        break;
      case 'schedule':
        updates.scheduleTime = editorialDraftValue;
        updates.status = editorialDraftValue ? 'scheduled' : 'queued';
        break;
      case 'template': {
        const nextTemplate = templates.find((template) => template.id === editorialDraftValue);
        if (nextTemplate) {
          updates.templateId = nextTemplate.id;
          updates.templateName = nextTemplate.name;
        }
        break;
      }
      case 'overlay':
        updates.overlayDirection = editorialOverlayDirection;
        updates.overlayStrength = editorialOverlayStrength;
        break;
      default:
        break;
    }

    await updateEditorial(selectedEditorial.id, updates);
    await createDesignStudioActivity('auto_editorial_updated', {
      sourceTitle: selectedEditorial.sourceTitle,
      field: editorialEditorMode,
    });
    setIsEditorialEditorOpen(false);
    toast.success('Auto editorial updated');
  };

  const handleDeleteEditorial = async (editorial: AutoEditorial) => {
    const nextAutoEditorials = autoEditorials.filter((item) => item.id !== editorial.id);
    await persistState(templates, renderedDesigns, nextAutoEditorials);
    setAutoEditorials(nextAutoEditorials);
    setIsEditorialActionsOpen(false);
    await createDesignStudioActivity('auto_editorial_deleted', {
      sourceTitle: editorial.sourceTitle,
      templateName: editorial.templateName,
    });
    toast.success('Auto editorial deleted');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 dark:text-white mb-2">Design Studio</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">
            {activeTab === 'manual'
              ? 'Create and edit PSD templates manually'
              : 'Generate editorial designs automatically from selected news updates'}
          </p>
        </div>
        <Button
          onClick={() => {
            haptics.light();
            localStorage.setItem('designStudioActivityTab', activeTab);
            onNavigate('design-studio-activity', 'design-studio');
          }}
          variant="outline"
          className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
        >
          View Activity
        </Button>
      </div>

      <SegmentedTabSwitcher
        tabs={[
          { id: 'manual', label: 'Manual' },
          { id: 'auto', label: 'Auto' },
        ]}
        activeTab={activeTab}
        onChange={(tab) => {
          haptics.light();
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {activeTab === 'manual' ? (
        <>
          {/* Template Ingestion Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".psd"
                onChange={handleUploadPSD}
                className="hidden"
              />
              <div className="border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center hover:border-[#ec1e24] transition-colors bg-white dark:bg-[#000000]">
                <Upload className="w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-3" />
                <p className="text-gray-900 dark:text-white">Upload PSD Template</p>
              </div>
            </label>

            <button
              onClick={handleLoadFromBackblaze}
              className="border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center hover:border-[#ec1e24] transition-colors bg-white dark:bg-[#000000]"
            >
              <CloudRounded className="w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-3" />
              <p className="text-gray-900 dark:text-white">Load from Backblaze</p>
            </button>
          </div>

          {isLoadingState ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-72 rounded-2xl border border-gray-200 dark:border-[#333333] bg-gray-100 dark:bg-[#111111] animate-pulse"
                />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center">
              <p className="text-gray-600 dark:text-[#9CA3AF] mb-2">No templates yet</p>
              <p className="text-sm text-gray-500 dark:text-[#6B7280]">
                Upload a PSD template or load from Backblaze to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <SwipeableTemplateCard
                  key={template.id}
                  template={template}
                  onDelete={handleDeleteTemplate}
                  onEdit={handleEditTemplate}
                  onExpand={handleExpandTemplate}
                  livePreviewData={editingTemplateId === template.id ? livePreviewData : null}
                  isBeingEdited={editingTemplateId === template.id}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Generated Today', value: autoStats.generatedToday },
              { label: 'Queued', value: autoStats.queued },
              { label: 'Posted', value: autoStats.posted },
              { label: 'Failed', value: autoStats.failed },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] p-4 lg:p-5">
                <p className="text-xs lg:text-sm text-[#6B7280] dark:text-[#9CA3AF]">{stat.label}</p>
                <p className="mt-2 text-2xl lg:text-3xl text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] p-4 lg:p-6 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-gray-900 dark:text-white">Auto Editorial Controls</p>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1 max-w-2xl">
                  Selected RSS feeds + trigger keywords {'->'} candidate filtering {'->'} template render {'->'} queue or auto post.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void handleGenerateAutoEditorials()}
                  className="bg-[#ec1e24] hover:bg-[#d01a20] text-white"
                >
                  {isGeneratingAutoEditorials ? 'Generating...' : 'Generate Auto Editorials'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white gap-2"
                  onClick={() => {
                    haptics.light();
                    localStorage.setItem('designStudioActivityTab', 'auto');
                    onNavigate('design-studio-activity', 'design-studio');
                  }}
                >
                  View Activity
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#ec1e24] px-2 py-0.5 text-[11px] text-white">
                    {autoActivityBadgeCount}
                  </span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <div className="rounded-2xl border border-gray-200 dark:border-[#333333] p-4">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Auto Editorials</p>
                <p className="mt-2 text-sm text-gray-900 dark:text-white">
                  {settings.designStudioAutoEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-[#333333] p-4">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Posting Interval</p>
                <p className="mt-2 text-sm text-gray-900 dark:text-white">{settings.designStudioPostingInterval || '5'} min</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-[#333333] p-4">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Default Template</p>
                <p className="mt-2 text-sm text-gray-900 dark:text-white">{defaultAutoTemplate?.name || 'None selected'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-[#333333] p-4">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Auto Post</p>
                <p className="mt-2 text-sm text-gray-900 dark:text-white">{settings.designStudioAutoPost ? 'On' : 'Off'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-[#333333] p-4 col-span-2 lg:col-span-1">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Selected Feeds</p>
                <p className="mt-2 text-sm text-gray-900 dark:text-white">
                  {settings.designStudioSelectedRssFeedIds?.length || 0} of {feeds.length}
                </p>
              </div>
            </div>
          </div>

          {autoEditorials.length === 0 ? (
            <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center">
              <p className="text-gray-600 dark:text-[#9CA3AF] mb-2">No auto editorials yet</p>
              <p className="text-sm text-gray-500 dark:text-[#6B7280]">
                Editorials will appear here when feed items match your selected trigger topics
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {autoEditorials.map((editorial) => (
                <div
                  key={editorial.id}
                  className="rounded-2xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewEditorial(editorial);
                      setPreviewZoom(1);
                    }}
                    className="w-full"
                  >
                    <img
                      src={editorial.renderedImage}
                      alt={editorial.sourceTitle}
                      className="h-56 w-full object-cover lg:h-64"
                    />
                  </button>
                  <div className="p-4 lg:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[#6B7280] dark:text-[#9CA3AF]">{editorial.sourceFeedName || 'RSS Feed'}</p>
                        <p className="mt-1 text-sm leading-6 text-gray-900 dark:text-white">{editorial.sourceTitle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEditorial(editorial);
                          setIsEditorialActionsOpen(true);
                        }}
                        className="rounded-full border border-gray-200 dark:border-[#333333] p-2 text-gray-900 dark:text-white"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-[#111111] dark:text-[#9CA3AF]">
                        {editorial.status.charAt(0).toUpperCase() + editorial.status.slice(1)}
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-[#111111] dark:text-[#9CA3AF]">
                        {editorial.templateName || 'Template'}
                      </span>
                      {editorial.matchedKeyword ? (
                        <span className="rounded-full bg-[#ec1e24]/10 px-3 py-1 text-[#ec1e24]">
                          {editorial.matchedKeyword}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF] sm:grid-cols-2">
                      <p>Platforms: {(editorial.targetPlatforms || []).length > 0 ? editorial.targetPlatforms.join(', ') : 'None'}</p>
                      <p>
                        Schedule: {editorial.scheduleTime ? new Date(editorial.scheduleTime).toLocaleString() : 'Not scheduled'}
                      </p>
                    </div>

                    <p className="text-sm leading-6 text-[#6B7280] dark:text-[#9CA3AF] line-clamp-3">{editorial.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      
      {/* Edit Design Bottom Sheet */}
      {selectedTemplate && (
        <EditDesignBottomSheet
          open={isEditSheetOpen}
          onOpenChange={(open) => {
            setIsEditSheetOpen(open);
            if (!open) {
              setEditingTemplateId(null);
              setLivePreviewData(null);
            }
          }}
          templateName={selectedTemplate.name}
          hasSubtext={selectedTemplate.hasSubtext}
          hasOverlay={true} // Assume templates have overlay adjustment layers
          onSave={handleSaveDesign}
          onChange={(data) => setLivePreviewData(data)}
          isRendering={isRendering}
        />
      )}

      {/* Publish Bottom Sheet */}
      {publishTarget && (
        <PublishBottomSheet
          open={isPublishSheetOpen}
          onOpenChange={setIsPublishSheetOpen}
          title="Publish Design"
          description="Select platforms and customize your caption"
          initialCaption={publishTarget.caption || ''}
          onPublish={(caption, platforms) => handlePublish(caption, platforms)}
          onCaptionGenerate={() => {
            return publishTarget.caption || publishTarget.templateName || 'New design created!';
          }}
        />
      )}

      {/* Expanded Template Preview Dialog */}
      {expandedTemplate && (
        <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
          <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none" hideCloseButton>
            <VisuallyHidden>
              <DialogTitle>{expandedTemplate.name}</DialogTitle>
              <DialogDescription>
                Full size preview of {expandedTemplate.name} ({expandedTemplate.aspectRatio})
              </DialogDescription>
            </VisuallyHidden>
            <div className="relative">
              <button
                onClick={() => {
                  haptics.light();
                  setIsExpanded(false);
                }}
                className="absolute top-4 right-4 z-50 bg-black/80 text-white p-2 rounded-full hover:bg-black transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={expandedTemplate.previewUrl}
                alt={expandedTemplate.name}
                className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Backblaze Template Browser */}
      <BackblazeTemplateBrowser
        open={showBackblazeBrowser}
        onSelectTemplate={(file) => {
          handleLoadSelectedTemplates([file]).catch((error) => {
            console.error('Failed to load template from Backblaze:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to load template');
          });
        }}
        onClose={() => {
          haptics.light();
          setShowBackblazeBrowser(false);
        }}
      />

      <BottomSheet
        open={isEditorialActionsOpen}
        onOpenChange={setIsEditorialActionsOpen}
        heightMode="auto"
        className="bg-white dark:bg-[#000000]"
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Auto Editorial Actions</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-2">
            {selectedEditorial ? (
              <>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'caption')}
                  className="w-full rounded-2xl border border-gray-200 dark:border-[#333333] px-4 py-4 text-left text-gray-900 dark:text-white"
                >
                  Edit Caption
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'header')}
                  className="w-full rounded-2xl border border-gray-200 dark:border-[#333333] px-4 py-4 text-left text-gray-900 dark:text-white"
                >
                  Edit Header
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'subheader')}
                  className="w-full rounded-2xl border border-gray-200 dark:border-[#333333] px-4 py-4 text-left text-gray-900 dark:text-white"
                >
                  Edit Subtext
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'background')}
                  className="w-full rounded-2xl border border-gray-200 dark:border-[#333333] px-4 py-4 text-left text-gray-900 dark:text-white"
                >
                  Change Background
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'overlay')}
                  className="w-full rounded-2xl border border-gray-200 dark:border-[#333333] px-4 py-4 text-left text-gray-900 dark:text-white"
                >
                  Adjust Overlay
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'template')}
                  className="w-full rounded-2xl border border-gray-200 dark:border-[#333333] px-4 py-4 text-left text-gray-900 dark:text-white"
                >
                  Change Template
                </button>
                <button
                  type="button"
                  onClick={() => openEditorialEditor(selectedEditorial, 'schedule')}
                  className="w-full rounded-2xl border border-gray-200 dark:border-[#333333] px-4 py-4 text-left text-gray-900 dark:text-white"
                >
                  Edit Schedule
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditorialActionsOpen(false);
                    void handlePublishAutoEditorial(selectedEditorial);
                  }}
                  className="w-full rounded-2xl border border-gray-200 dark:border-[#333333] px-4 py-4 text-left text-gray-900 dark:text-white"
                >
                  Publish Now
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteEditorial(selectedEditorial)}
                  className="w-full rounded-2xl border border-[#ec1e24]/40 px-4 py-4 text-left text-[#ec1e24]"
                >
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </BottomSheetBody>
      </BottomSheet>

      <BottomSheet
        open={isEditorialEditorOpen}
        onOpenChange={setIsEditorialEditorOpen}
        heightMode="auto"
        className="bg-white dark:bg-[#000000]"
      >
        <BottomSheetHeader>
          <BottomSheetTitle>
            {editorialEditorMode === 'caption' && 'Edit Caption'}
            {editorialEditorMode === 'header' && 'Edit Header'}
            {editorialEditorMode === 'subheader' && 'Edit Subtext'}
            {editorialEditorMode === 'background' && 'Change Background'}
            {editorialEditorMode === 'overlay' && 'Adjust Overlay'}
            {editorialEditorMode === 'template' && 'Change Template'}
            {editorialEditorMode === 'schedule' && 'Edit Schedule'}
          </BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            {editorialEditorMode === 'template' ? (
              <div className="space-y-2">
                <Label>Validated Template</Label>
                <Select value={editorialDraftValue} onValueChange={setEditorialDraftValue}>
                  <SelectTrigger className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                    {validatedTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : editorialEditorMode === 'overlay' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Overlay Direction</Label>
                  <Select value={editorialOverlayDirection} onValueChange={(value) => setEditorialOverlayDirection(value as 'top' | 'bottom' | 'left' | 'right')}>
                    <SelectTrigger className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white">
                      <SelectValue placeholder="Select direction" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Overlay Strength</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editorialOverlayStrength}
                    onChange={(event) => setEditorialOverlayStrength(Number.parseInt(event.target.value || '0', 10))}
                    className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>
                  {editorialEditorMode === 'schedule'
                    ? 'Schedule Time'
                    : editorialEditorMode === 'background'
                      ? 'Background URL'
                      : 'Value'}
                </Label>
                <Input
                  type={editorialEditorMode === 'schedule' ? 'datetime-local' : 'text'}
                  value={editorialDraftValue}
                  onChange={(event) => setEditorialDraftValue(event.target.value)}
                  className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] text-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditorialEditorOpen(false)}
              className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveEditorialEdit()}
              className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white"
            >
              Save
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      <Dialog
        open={Boolean(previewEditorial)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewEditorial(null);
            setPreviewZoom(1);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-full p-0 overflow-hidden bg-transparent border-none" hideCloseButton>
          <VisuallyHidden>
            <DialogTitle>{previewEditorial?.headerText || 'Auto editorial preview'}</DialogTitle>
            <DialogDescription>
              Preview and inspect the generated editorial render.
            </DialogDescription>
          </VisuallyHidden>
          {previewEditorial ? (
            <div className="relative">
              <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewZoom((value) => Math.max(1, Number((value - 0.1).toFixed(1))))}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black/80 text-white"
                >
                  <ZoomOut className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom((value) => Math.min(3, Number((value + 0.1).toFixed(1))))}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black/80 text-white"
                >
                  <ZoomIn className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptics.light();
                    setPreviewEditorial(null);
                    setPreviewZoom(1);
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black/80 text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[90vh] overflow-auto rounded-lg bg-black p-6">
                <img
                  src={previewEditorial.renderedImage}
                  alt={previewEditorial.sourceTitle}
                  className="mx-auto h-auto max-w-full origin-center rounded-lg transition-transform duration-200"
                  style={{ transform: `scale(${previewZoom})` }}
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
