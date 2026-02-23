import { useState, useRef } from 'react';
import { Trash2, Eye } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { Button } from './ui/button';
import { LiveDesignPreview } from './LiveDesignPreview';
import { DesignData } from './EditDesignBottomSheet';

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
  psdData?: any;
}

interface SwipeableTemplateCardProps {
  template: Template;
  onDelete: (id: string) => void;
  onEdit: (template: Template) => void;
  onExpand: (template: Template) => void;
  livePreviewData?: DesignData | null; // Real-time preview data when editing
  isBeingEdited?: boolean; // Whether this template is currently being edited
}

export function SwipeableTemplateCard({
  template,
  onDelete,
  onEdit,
  onExpand,
  livePreviewData,
  isBeingEdited,
}: SwipeableTemplateCardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    setSwipeDirection('none');
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentX.current = e.touches[0].clientX;
    currentY.current = e.touches[0].clientY;
    
    const deltaX = Math.abs(currentX.current - startX.current);
    const deltaY = Math.abs(currentY.current - startY.current);
    
    // Determine swipe direction on first significant movement
    if (swipeDirection === 'none' && (deltaX > 10 || deltaY > 10)) {
      // If horizontal movement is greater than vertical, it's a horizontal swipe
      if (deltaX > deltaY * 1.5) {
        setSwipeDirection('horizontal');
        setIsSwiping(true);
      } else {
        // Otherwise, it's vertical scrolling
        setSwipeDirection('vertical');
      }
    }
    
    // Only handle horizontal swipe (left only for delete)
    if (swipeDirection === 'horizontal') {
      e.stopPropagation();
      e.preventDefault(); // Prevent scrolling while swiping horizontally
      
      const diff = currentX.current - startX.current;
      
      // Only allow left swipe (negative values)
      if (diff <= 0) {
        // Limit swipe distance
        const maxSwipe = 120;
        const clampedDiff = Math.max(-maxSwipe, diff);
        
        setSwipeX(clampedDiff);
      }
    }
  };

  const handleTouchEnd = () => {
    // Only process swipe action if it was a horizontal swipe
    if (swipeDirection === 'horizontal') {
      const threshold = 90;
      
      // Swipe left (delete)
      if (swipeX < -threshold) {
        haptics.medium();
        onDelete(template.id);
      }
    }
    
    // Reset state
    setIsSwiping(false);
    setSwipeDirection('none');
    setSwipeX(0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Background delete button */}
      <div className="absolute inset-0 flex justify-end items-center bg-[#ec1e24] rounded-2xl">
        <div 
          className="flex items-center justify-center px-6 text-white transition-opacity h-full"
          style={{ 
            opacity: swipeX < 0 ? 1 : 0,
            width: '120px'
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <Trash2 className="w-5 h-5" />
            <span className="text-xs whitespace-nowrap">Delete</span>
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div
        className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] overflow-hidden hover:border-[#ec1e24] transition-all group relative"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Template Preview - Clickable */}
        <div className="relative w-full aspect-video bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden">
          {/* Desktop delete button - only visible on hover - positioned at bottom-right of image */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              haptics.medium();
              onDelete(template.id);
            }}
            className="hidden lg:block absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 dark:text-gray-400 hover:text-[#ec1e24] dark:hover:text-[#ec1e24]"
            aria-label="Delete template"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => onExpand(template)}
            className="absolute inset-0 w-full h-full"
          >
            {isBeingEdited && livePreviewData ? (
              <LiveDesignPreview
                templatePreviewUrl={template.previewUrl}
                designData={livePreviewData}
                aspectRatio={template.aspectRatio}
              />
            ) : (
              <img
                src={template.previewUrl}
                alt={template.name}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
          
          {/* Aspect Ratio Badge */}
          <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white pointer-events-none">
            {template.aspectRatio}
          </div>

          {/* Live Edit Indicator */}
          {isBeingEdited && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-[#ec1e24] backdrop-blur-sm rounded text-xs text-white flex items-center gap-1 pointer-events-none">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Live Preview
            </div>
          )}
        </div>

        {/* Template Info & Actions */}
        <div className="p-4">
          <h3 className="text-gray-900 dark:text-white mb-1 truncate">{template.name}</h3>
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF] mb-3 capitalize">
            {template.source} · {template.width}×{template.height}
          </p>

          <div className="flex gap-2">
            <Button
              onClick={() => onEdit(template)}
              className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white text-sm"
              size="sm"
            >
              Edit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}