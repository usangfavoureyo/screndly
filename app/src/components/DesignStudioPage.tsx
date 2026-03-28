import { useState, useRef, useEffect } from 'react';
import { Upload, CloudRounded, X } from 'lucide-react';
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
import { useUndo } from './UndoContext';
import {
  createDesignStudioActivity,
  fetchDesignStudioState,
  saveDesignStudioState,
  uploadDesignStudioAsset,
} from '../lib/api/designStudio';
import { publishContent, type PlatformSelection } from '../lib/api/platforms';

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

function parseTemplate(template: any): Template {
  return {
    ...template,
    lastEdited: new Date(template.lastEdited),
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
  }));
}

function serializeRenderedDesigns(renderedDesigns: RenderedDesign[]) {
  return renderedDesigns.map((renderedDesign) => ({
    ...renderedDesign,
    createdAt: renderedDesign.createdAt.toISOString(),
  }));
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [meta, content] = dataUrl.split(',');
  if (!meta || !content) {
    throw new Error('Invalid preview data');
  }

  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/png';
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
}

export default function DesignStudioPage({ onNavigate, previousPage }: DesignStudioPageProps) {
  const { addNotification } = useNotifications();
  const { showUndo } = useUndo();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [renderedDesigns, setRenderedDesigns] = useState<RenderedDesign[]>([]);
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const persistState = async (nextTemplates: Template[], nextRenderedDesigns: RenderedDesign[]) => {
    await saveDesignStudioState({
      templates: serializeTemplates(nextTemplates),
      renderedDesigns: serializeRenderedDesigns(nextRenderedDesigns),
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
    const b2Templates: Template[] = selectedFiles.map(file => ({
      id: `bb-${file.fileId}-${Date.now()}`,
      name: file.fileName.replace('.psd', '').replace('templates/', ''),
      previewUrl: file.url.replace('.psd', '_preview.jpg'),
      aspectRatio: '4:5',
      width: 1080,
      height: 1350,
      source: 'backblaze',
      lastEdited: file.lastModified,
      hasSubtext: true,
      psdData: {
        b2Url: file.url,
        fileName: file.fileName,
      },
    }));

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

      await photopeaService.closeDocument();
      toast.success('Design rendered successfully!');
      haptics.success();
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

  return (
    <div className="space-y-6">
      {/* Header - Match Video Studio exactly */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 dark:text-white mb-2">Design Studio</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">PSD-driven creative automation workspace</p>
        </div>
        <Button
          onClick={() => {
            haptics.light();
            onNavigate('design-studio-activity', 'design-studio');
          }}
          variant="outline"
          className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
        >
          View Activity
        </Button>
      </div>

      {/* Template Ingestion Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload PSD */}
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

        {/* Load from Backblaze */}
        <button
          onClick={handleLoadFromBackblaze}
          className="border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center hover:border-[#ec1e24] transition-colors bg-white dark:bg-[#000000]"
        >
          <CloudRounded className="w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-3" />
          <p className="text-gray-900 dark:text-white">Load from Backblaze</p>
        </button>
      </div>

      {/* Templates Grid */}
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
    </div>
  );
}
