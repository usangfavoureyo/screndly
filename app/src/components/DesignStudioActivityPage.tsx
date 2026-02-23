import { Image, Calendar, Send, Trash2, X } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { VisuallyHidden } from './ui/visually-hidden';
import { DownloadBottomSheet } from './DownloadBottomSheet';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import { useUndo } from './UndoContext';
import { DesignStudioActivity } from '../utils/activityStore';
import { EditDesignBottomSheet, DesignData } from './EditDesignBottomSheet';
import { PublishBottomSheet } from './PublishBottomSheet';
import { Skeleton } from './ui/skeleton';

interface DesignStudioActivityPageProps {
  onNavigate: (page: string) => void;
  previousPage?: string | null;
}

interface RenderedDesign {
  id: string;
  templateId: string;
  templateName: string;
  outputUrl: string;
  data: DesignData;
  createdAt: Date;
  aspectRatio: string;
  hasSubtext: boolean;
  hasOverlay?: boolean; // Whether template has overlay settings
}

export function DesignStudioActivityPage({ onNavigate, previousPage }: DesignStudioActivityPageProps) {
  const { settings } = useSettings();
  const { showUndo } = useUndo();

  // Get retention period from settings (default 24 hours)
  const retentionHours = settings.designStudioActivityRetention || 24;
  const retentionMs = retentionHours * 60 * 60 * 1000;

  const shouldKeepItem = (item: DesignStudioActivity): boolean => {
    try {
      const now = Date.now();
      const itemTime = new Date(item.timestamp).getTime();
      const ageMs = now - itemTime;
      return ageMs <= retentionMs;
    } catch (error) {
      return true;
    }
  };

  // Load activities from API
  const [activities, setActivities] = useState<DesignStudioActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      setIsLoadingActivities(true);
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://screndly-production.up.railway.app';
        const res = await fetch(`${BACKEND_URL}/api/design-studio`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('screndly_token')}`,
          }
        });
        if (res.ok) {
          const { data } = await res.json();
          // Convert DB format to expected local format
          const mappedActivities = data.map((item: any) => ({
            id: item.id,
            type: item.type,
            timestamp: item.createdAt,
            details: {
              templateName: item.templateName,
              designId: item.designId,
              platforms: item.platforms,
            }
          })).filter(shouldKeepItem);
          setActivities(mappedActivities);
        } else {
          console.error("Failed to fetch design studio activities");
        }
      } catch (error) {
        console.error("Design studio fetch error:", error);
      } finally {
        setIsLoadingActivities(false);
      }
    }

    fetchActivities();
  }, [retentionMs]);

  const [renderedDesigns, setRenderedDesigns] = useState<RenderedDesign[]>(() => {
    // Load from localStorage
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

  const [selectedDesign, setSelectedDesign] = useState<RenderedDesign | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isPublishSheetOpen, setIsPublishSheetOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedDesign, setExpandedDesign] = useState<RenderedDesign | null>(null);
  const [isDownloadSheetOpen, setIsDownloadSheetOpen] = useState(false);
  const [downloadDesign, setDownloadDesign] = useState<RenderedDesign | null>(null);

  // Save renderedDesigns to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('renderedDesigns', JSON.stringify(renderedDesigns));
  }, [renderedDesigns]);

  const handleDeleteDesign = (design: RenderedDesign) => {
    const previousDesigns = [...renderedDesigns];

    haptics.medium();
    setRenderedDesigns(renderedDesigns.filter(d => d.id !== design.id));
    toast.success('Design deleted');

    showUndo({
      id: `undo-design-${design.id}`,
      itemName: design.templateName,
      onUndo: () => {
        setRenderedDesigns(previousDesigns);
        haptics.light();
        toast.success('Design restored');
      }
    });
  };

  const handleEditDesign = (design: RenderedDesign) => {
    haptics.light();
    setSelectedDesign(design);
    setIsEditSheetOpen(true);
  };

  const handlePublishDesign = (design: RenderedDesign) => {
    haptics.light();
    setSelectedDesign(design);
    setIsPublishSheetOpen(true);
  };

  const handleDownloadDesign = (design: RenderedDesign) => {
    haptics.light();
    setDownloadDesign(design);
    setIsDownloadSheetOpen(true);
  };

  const handleSaveDesign = (data: DesignData) => {
    if (!selectedDesign) return;

    haptics.medium();
    setIsEditSheetOpen(false);

    toast.success('Re-rendering design...');

    setTimeout(() => {
      const updatedDesign: RenderedDesign = {
        ...selectedDesign,
        data,
        outputUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
        createdAt: new Date(),
      };

      setRenderedDesigns(renderedDesigns.map(d =>
        d.id === selectedDesign.id ? updatedDesign : d
      ));

      toast.success('Design updated successfully!');
      haptics.success();
    }, 2000);
  };

  const handlePublish = (caption: string, platforms: any) => {
    if (!selectedDesign) return;

    haptics.medium();
    toast.success('Design published to selected platforms!');
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'design_rendered':
      case 'template_uploaded':
        return <Image className="w-5 h-5 text-[#ec1e24]" />;
      case 'design_published':
        return <Send className="w-5 h-5 text-green-600 dark:text-green-400" />;
      default:
        return <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getActivityTitle = (activity: DesignStudioActivity) => {
    switch (activity.type) {
      case 'template_uploaded':
        return 'Template Uploaded';
      case 'design_rendered':
        return 'Design Rendered';
      case 'design_published':
        return 'Design Published';
      default:
        return 'Activity';
    }
  };

  const getActivityDescription = (activity: DesignStudioActivity) => {
    const { templateName, platforms } = activity.details;
    switch (activity.type) {
      case 'template_uploaded':
        return templateName || 'Unknown template';
      case 'design_rendered':
        return templateName || 'Unknown template';
      case 'design_published':
        return `${templateName} → ${platforms || 'platforms'}`;
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => {
            haptics.light();
            onNavigate(previousPage || 'design-studio');
          }}
          className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-gray-900 dark:text-white mb-2">Design Studio Activity</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">
            Track your rendered designs and creative output
          </p>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 mt-6">
        <div>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-1">Total Designs</p>
          <p className="text-2xl text-gray-900 dark:text-white">{renderedDesigns.length}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6 mt-6">
        {/* Rendered Designs Section */}
        <div>
          <h2 className="text-gray-900 dark:text-white mb-4">Saved Designs</h2>

          {renderedDesigns.length === 0 ? (
            <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center">
              <p className="text-gray-600 dark:text-[#9CA3AF] mb-2">No saved designs yet</p>
              <p className="text-sm text-gray-500 dark:text-[#6B7280]">
                Your rendered designs will appear here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {renderedDesigns.map((design) => (
                <SwipeableActivityCard
                  key={design.id}
                  onDelete={() => handleDeleteDesign(design)}
                  deleteLabel="Delete Design"
                >
                  <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] overflow-hidden group">
                    {/* Design Preview - Clickable */}
                    <div className="relative w-full aspect-video bg-gray-100 dark:bg-[#1A1A1A]">
                      {/* Desktop delete button - only visible on hover - positioned at bottom-right of image */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          haptics.medium();
                          handleDeleteDesign(design);
                        }}
                        className="hidden lg:block absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 dark:text-gray-400 hover:text-[#ec1e24] dark:hover:text-[#ec1e24]"
                        aria-label="Delete design"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          haptics.light();
                          setExpandedDesign(design);
                          setIsExpanded(true);
                        }}
                        className="absolute inset-0 w-full h-full cursor-pointer"
                      >
                        <img
                          src={design.outputUrl}
                          alt={design.templateName}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      </button>

                      {/* Aspect Ratio Badge */}
                      <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white pointer-events-none">
                        {design.aspectRatio}
                      </div>
                    </div>

                    {/* Design Info & Actions */}
                    <div className="p-4">
                      <p className="text-gray-900 dark:text-white mb-1 truncate">
                        {design.data.headerText}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[#6B7280] mb-3">
                        {formatTimestamp(design.createdAt.toISOString())}
                      </p>

                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleEditDesign(design)}
                            variant="outline"
                            size="sm"
                            className="flex-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-sm"
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDownloadDesign(design)}
                            variant="outline"
                            size="sm"
                            className="flex-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-sm"
                          >
                            Download
                          </Button>
                        </div>
                        <Button
                          onClick={() => handlePublishDesign(design)}
                          size="sm"
                          className="w-full bg-[#ec1e24] hover:bg-[#d01a20] text-white text-sm"
                        >
                          Publish
                        </Button>
                      </div>
                    </div>
                  </div>
                </SwipeableActivityCard>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shared Edit Bottom Sheet */}
      <EditDesignBottomSheet
        open={isEditSheetOpen}
        onOpenChange={setIsEditSheetOpen}
        templateName={selectedDesign?.templateName || ''}
        aspectRatio={selectedDesign?.aspectRatio}
        initialData={selectedDesign?.data}
        hasSubtext={selectedDesign?.hasSubtext || false}
        hasOverlay={selectedDesign?.hasOverlay || false}
        onSave={handleSaveDesign}
      />

      {/* Shared Publish Bottom Sheet */}
      <PublishBottomSheet
        open={isPublishSheetOpen}
        onOpenChange={setIsPublishSheetOpen}
        title="Publish Design"
        description="Select platforms and customize your caption"
        onPublish={handlePublish}
        onCaptionGenerate={() => {
          return selectedDesign?.data.headerText
            ? `Check out: ${selectedDesign.data.headerText}`
            : 'New design created!';
        }}
      />

      {/* Download Bottom Sheet */}
      {downloadDesign && (
        <DownloadBottomSheet
          open={isDownloadSheetOpen}
          onOpenChange={setIsDownloadSheetOpen}
          defaultFileName={downloadDesign.templateName.toLowerCase().replace(/\s+/g, '-')}
          imageUrl={downloadDesign.outputUrl}
        />
      )}

      {/* Expanded Design Preview Dialog */}
      {expandedDesign && (
        <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
          <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none" hideCloseButton>
            <VisuallyHidden>
              <DialogTitle>{expandedDesign.templateName}</DialogTitle>
              <DialogDescription>
                Full size preview of {expandedDesign.templateName} ({expandedDesign.aspectRatio})
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
                src={expandedDesign.outputUrl}
                alt={expandedDesign.templateName}
                className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}