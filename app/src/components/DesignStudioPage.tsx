import { useState, useRef, useEffect } from 'react';
import { Upload, Cloud, FileImage, X } from 'lucide-react';
import { toast } from "sonner";
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { EditDesignBottomSheet, DesignData } from './EditDesignBottomSheet';
import { PublishBottomSheet } from './PublishBottomSheet';
import { BackblazeTemplateBrowser } from './BackblazeTemplateBrowser';
import { SwipeableTemplateCard } from './SwipeableTemplateCard';
import { VisuallyHidden } from './ui/visually-hidden';
import { haptics } from '../utils/haptics';
import { addDesignStudioActivity, addRecentActivity, addLogEntry } from '../utils/activityStore';
import { getPhotopeaService } from '../utils/photopeaService';
import { useNotifications } from '../contexts/NotificationsContext';
import { useUndo } from './UndoContext';

interface DesignStudioPageProps {
  onNavigate: (page: string) => void;
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

export default function DesignStudioPage({ onNavigate, previousPage }: DesignStudioPageProps) {
  const { addNotification } = useNotifications();
  const { showUndo } = useUndo();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [renderedDesigns, setRenderedDesigns] = useState<RenderedDesign[]>(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem('renderedDesigns');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Convert createdAt strings back to Date objects
        return parsed.map((design: any) => ({
          ...design,
          createdAt: new Date(design.createdAt)
        }));
      } catch (error) {
        console.error('Error loading rendered designs:', error);
        return [];
      }
    }
    return [];
  });
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<Template | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isPublishSheetOpen, setIsPublishSheetOpen] = useState(false);
  const [currentDesignData, setCurrentDesignData] = useState<DesignData | null>(null);
  const [livePreviewData, setLivePreviewData] = useState<DesignData | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [publishTarget, setPublishTarget] = useState<RenderedDesign | null>(null);
  const [showBackblazeBrowser, setShowBackblazeBrowser] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save renderedDesigns to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('renderedDesigns', JSON.stringify(renderedDesigns));
  }, [renderedDesigns]);

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
      // Get Photopea service
      const photopeaService = getPhotopeaService();

      // Initialize Photopea
      await photopeaService.initialize();

      // Load PSD file
      await photopeaService.loadPSD(file);

      // Analyze layer structure
      const analysis = await photopeaService.analyzeLayers();

      // Generate preview
      const previewDataUrl = await photopeaService.getPreview();

      // Create template from analysis
      const template: Template = {
        id: `template-${Date.now()}`,
        name: file.name.replace('.psd', ''),
        previewUrl: previewDataUrl,
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
          fileUrl: URL.createObjectURL(file), // Store file URL for later use
        },
      };

      setTemplates([template, ...templates]);
      
      addDesignStudioActivity({
        id: `activity-${Date.now()}`,
        type: 'template_uploaded',
        timestamp: new Date().toISOString(),
        details: {
          templateName: template.name,
        },
      });

      toast.success(`Template "${template.name}" analyzed and uploaded!`);
      
      // Close document to free memory
      await photopeaService.closeDocument();
      
    } catch (error) {
      console.error('Photopea analysis error:', error);
      
      // Fallback to mock processing
      toast('Using mock processing (Photopea unavailable)', {
        description: 'Real Photopea integration will be used in production',
      });

      setTimeout(() => {
        const foundLayers = {
          category: Math.random() > 0.5,
          header: true,
          subtext: Math.random() > 0.5,
          source: Math.random() > 0.5,
          image: true,
        };

        const detectedLayers = {
          hasCategory: foundLayers.category,
          hasHeaderText: foundLayers.header,
          hasSubtext: foundLayers.subtext,
          hasSource: foundLayers.source,
          hasImageLayer: foundLayers.image,
          textLayers: [
            foundLayers.category && 'category',
            foundLayers.header && 'header',
            foundLayers.subtext && 'subtext',
            foundLayers.source && 'source',
          ].filter(Boolean),
          imageLayers: foundLayers.image ? ['background'] : [],
        };

        const mockTemplate: Template = {
          id: `template-${Date.now()}`,
          name: file.name.replace('.psd', ''),
          previewUrl: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=800',
          aspectRatio: '16:9',
          width: 1920,
          height: 1080,
          source: 'upload',
          lastEdited: new Date(),
          hasSubtext: detectedLayers.hasSubtext,
          hasCategory: detectedLayers.hasCategory,
          hasSource: detectedLayers.hasSource,
          psdData: {
            layerMap: {
              category: foundLayers.category ? 'category' : null,
              headerText: foundLayers.header ? 'header' : null,
              subtext: foundLayers.subtext ? 'subtext' : null,
              source: foundLayers.source ? 'source' : null,
              backgroundImage: foundLayers.image ? 'background' : null,
            },
            detectedLayers,
          },
        };

        setTemplates([mockTemplate, ...templates]);
        
        addDesignStudioActivity({
          id: `activity-${Date.now()}`,
          type: 'template_uploaded',
          timestamp: new Date().toISOString(),
          details: {
            templateName: mockTemplate.name,
          },
        });

        toast.success(`Template "${mockTemplate.name}" uploaded (mock mode)`);
      }, 1500);
    }

    e.target.value = '';
  };

  const handleLoadFromBackblaze = async () => {
    haptics.medium();
    setShowBackblazeBrowser(true);
  };

  const handleLoadSelectedTemplates = (selectedFiles: any[]) => {
    // Convert selected B2 files to Template objects
    const b2Templates: Template[] = selectedFiles.map(file => ({
      id: `bb-${file.fileId}-${Date.now()}`,
      name: file.fileName.replace('.psd', '').replace('templates/', ''),
      previewUrl: file.url.replace('.psd', '_preview.jpg'), // Assume preview images exist
      aspectRatio: '4:5', // Default, will be determined when loaded
      width: 1080,
      height: 1350,
      source: 'backblaze',
      lastEdited: file.lastModified,
      hasSubtext: true, // Default assumption
      psdData: {
        b2Url: file.url,
        fileName: file.fileName,
      },
    }));

    setTemplates([...b2Templates, ...templates]);
    
    addDesignStudioActivity({
      id: `activity-${Date.now()}`,
      type: 'templates_loaded',
      timestamp: new Date().toISOString(),
      details: {
        source: 'backblaze',
        count: b2Templates.length,
      },
    });

    toast.success(`${b2Templates.length} template${b2Templates.length !== 1 ? 's' : ''} loaded from Backblaze`);
    haptics.success();

    // Close the bottom sheet
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
      // Get Photopea service
      const photopeaService = getPhotopeaService();

      // Initialize if needed
      await photopeaService.initialize();

      // Load the PSD template (in production, load from stored file/URL)
      // For now, we'll simulate since we don't have actual PSD files stored
      // await photopeaService.loadPSDFromURL(selectedTemplate.psdData?.fileUrl);

      // Render the design using Photopea
      const renderedBlob = await photopeaService.renderDesign(data, {
        width: selectedTemplate.width,
        height: selectedTemplate.height,
        hasSubtext: selectedTemplate.hasSubtext || false,
        hasOverlay: true,
      });

      // Convert blob to object URL for display
      const outputUrl = URL.createObjectURL(renderedBlob);

      const renderedDesign: RenderedDesign = {
        id: `design-${Date.now()}`,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        outputUrl,
        data,
        createdAt: new Date(),
        aspectRatio: selectedTemplate.aspectRatio,
        caption: data.caption,
        contentType: data.contentType,
      };

      setRenderedDesigns([renderedDesign, ...renderedDesigns]);
      setCurrentDesignData(data);
      setIsRendering(false);

      addDesignStudioActivity({
        id: `activity-${Date.now()}`,
        type: 'design_rendered',
        timestamp: new Date().toISOString(),
        details: {
          templateName: selectedTemplate.name,
          designId: renderedDesign.id,
        },
      });

      // Add to recent activity
      addRecentActivity({
        title: selectedTemplate.name,
        platform: 'Design Studio',
        status: 'success',
        type: 'designstudio',
      });

      // Add to logs
      addLogEntry({
        videoTitle: selectedTemplate.name,
        platform: 'Design Studio',
        status: 'success',
        type: 'designstudio',
      });

      // Send notification
      addNotification({
        type: 'success',
        title: 'Design Rendered',
        message: `"${selectedTemplate.name}" rendered successfully`,
      });

      toast.success('Design rendered successfully!');
      haptics.success();
    } catch (error) {
      console.error('Photopea rendering error:', error);
      
      // Fallback to mock rendering
      toast('Using mock rendering (Photopea unavailable)', {
        description: 'Real Photopea integration will be used in production',
      });

      setTimeout(() => {
        const renderedDesign: RenderedDesign = {
          id: `design-${Date.now()}`,
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          outputUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
          data,
          createdAt: new Date(),
          aspectRatio: selectedTemplate.aspectRatio,
          caption: data.caption,
          contentType: data.contentType,
        };

        setRenderedDesigns([renderedDesign, ...renderedDesigns]);
        setCurrentDesignData(data);
        setIsRendering(false);

        addDesignStudioActivity({
          id: `activity-${Date.now()}`,
          type: 'design_rendered',
          timestamp: new Date().toISOString(),
          details: {
            templateName: selectedTemplate.name,
            designId: renderedDesign.id,
          },
        });

        toast.success('Design rendered (mock mode)');
        haptics.success();
      }, 2000);
    }
  };

  const handlePublish = (caption: string, platforms: any) => {
    if (!publishTarget) return;

    haptics.medium();
    
    const platformsList = Object.keys(platforms).filter(k => platforms[k]).join(', ');
    
    addDesignStudioActivity({
      id: `activity-${Date.now()}`,
      type: 'design_published',
      timestamp: new Date().toISOString(),
      details: {
        templateName: publishTarget.templateName,
        designId: publishTarget.id,
        platforms: platformsList,
      },
    });

    // Add to recent activity
    addRecentActivity({
      title: publishTarget.templateName,
      platform: platformsList || 'Multiple platforms',
      status: 'success',
      type: 'designstudio',
    });

    // Add to logs
    addLogEntry({
      videoTitle: publishTarget.templateName,
      platform: platformsList || 'Multiple platforms',
      status: 'success',
      type: 'designstudio',
    });

    // Send notification
    addNotification({
      type: 'success',
      title: 'Design Published',
      message: `"${publishTarget.templateName}" published to ${platformsList || 'selected platforms'}`,
    });

    toast.success('Design published to selected platforms!');
  };

  const handleDeleteTemplate = (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;

    const previousTemplates = [...templates];
    const previousRenderedDesigns = [...renderedDesigns];

    setTemplates(templates.filter(t => t.id !== id));
    
    // Also remove any rendered designs for this template
    setRenderedDesigns(renderedDesigns.filter(d => d.templateId !== id));
    
    addDesignStudioActivity({
      id: `activity-${Date.now()}`,
      type: 'template_deleted',
      timestamp: new Date().toISOString(),
      details: {
        templateName: template.name,
      },
    });

    haptics.medium();
    toast.success(`Template deleted`);

    showUndo({
      id: `undo-template-${id}`,
      itemName: template.name,
      onUndo: () => {
        setTemplates(previousTemplates);
        setRenderedDesigns(previousRenderedDesigns);
        haptics.light();
        toast.success('Template restored');
      }
    });
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
            onNavigate('design-studio-activity');
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
          <Cloud className="w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-3" />
          <p className="text-gray-900 dark:text-white">Load from Backblaze</p>
        </button>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center">
          <FileImage className="w-12 h-12 text-gray-400 dark:text-[#666666] mx-auto mb-4" />
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
          onPublish={(caption, platforms) => handlePublish(caption, platforms)}
          onCaptionGenerate={() => {
            return publishTarget.name || 'New design created!';
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
          // Convert B2 file to Template object
          const template: Template = {
            id: `bb-${file.fileId}-${Date.now()}`,
            name: file.fileName.replace('.psd', '').replace('templates/', ''),
            previewUrl: file.url.replace('.psd', '_preview.jpg'), // Assume preview images exist
            aspectRatio: '4:5', // Default, will be determined when loaded
            width: 1080,
            height: 1350,
            source: 'backblaze',
            lastEdited: file.lastModified,
            hasSubtext: true, // Default assumption
            psdData: {
              b2Url: file.url,
              fileName: file.fileName,
            },
          };

          setTemplates([template, ...templates]);
          
          addDesignStudioActivity({
            id: `activity-${Date.now()}`,
            type: 'templates_loaded',
            timestamp: new Date().toISOString(),
            details: {
              source: 'backblaze',
              count: 1,
            },
          });

          haptics.success();
        }}
        onClose={() => {
          haptics.light();
          setShowBackblazeBrowser(false);
        }}
      />
    </div>
  );
}