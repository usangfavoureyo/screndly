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
  hasHeader?: boolean;
  hasBackground?: boolean;
  hasSubtext: boolean;
  hasOverlay?: boolean;
  psdData?: any;
}

interface SwipeableTemplateCardProps {
  template: Template;
  onDelete: (id: string) => void;
  onEdit: (template: Template) => void;
  onExpand: (template: Template) => void;
  livePreviewData?: DesignData | null;
  isBeingEdited?: boolean;
  renderedPreviewUrl?: string | null;
}

export function SwipeableTemplateCard({
  template,
  onDelete,
  onEdit,
  onExpand,
  livePreviewData,
  isBeingEdited,
  renderedPreviewUrl,
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

    if (swipeDirection === 'none' && (deltaX > 10 || deltaY > 10)) {
      if (deltaX > deltaY * 1.5) {
        setSwipeDirection('horizontal');
        setIsSwiping(true);
      } else {
        setSwipeDirection('vertical');
      }
    }

    if (swipeDirection === 'horizontal') {
      e.stopPropagation();
      e.preventDefault();

      const diff = currentX.current - startX.current;
      if (diff <= 0) {
        const maxSwipe = 120;
        const clampedDiff = Math.max(-maxSwipe, diff);
        setSwipeX(clampedDiff);
      }
    }
  };

  const handleTouchEnd = () => {
    if (swipeDirection === 'horizontal') {
      const threshold = 90;
      if (swipeX < -threshold) {
        haptics.medium();
        onDelete(template.id);
      }
    }

    setIsSwiping(false);
    setSwipeDirection('none');
    setSwipeX(0);
  };

  const previewImageUrl = renderedPreviewUrl || template.previewUrl;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 flex items-center justify-end rounded-2xl bg-[#ec1e24]">
        <div
          className="flex h-full items-center justify-center px-6 text-white transition-opacity"
          style={{ opacity: swipeX < 0 ? 1 : 0, width: '120px' }}
        >
          <div className="flex flex-col items-center gap-1">
            <Trash2 className="h-5 w-5" />
            <span className="whitespace-nowrap text-xs">Delete</span>
          </div>
        </div>
      </div>

      <div
        className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all hover:border-[#ec1e24] dark:border-[#333333] dark:bg-[#000000]"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-[#1A1A1A]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              haptics.medium();
              onDelete(template.id);
            }}
            className="absolute bottom-3 right-3 z-10 hidden text-gray-600 opacity-0 transition-opacity hover:text-[#ec1e24] group-hover:opacity-100 dark:text-gray-400 dark:hover:text-[#ec1e24] lg:block"
            aria-label="Delete template"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <button onClick={() => onExpand(template)} className="absolute inset-0 h-full w-full">
            {isBeingEdited && livePreviewData ? (
              <LiveDesignPreview templatePreviewUrl={previewImageUrl} designData={livePreviewData} />
            ) : (
              <img src={previewImageUrl} alt={template.name} className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
              <Eye className="h-8 w-8 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </button>

          <div className="pointer-events-none absolute top-3 right-3 rounded bg-black/70 px-2 py-1 text-xs text-white backdrop-blur-sm">
            {template.aspectRatio}
          </div>

          {renderedPreviewUrl ? (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-[#ec1e24] px-2 py-1 text-xs text-white">
              Last Render
            </div>
          ) : null}

          {isBeingEdited ? (
            <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1 rounded bg-[#ec1e24] px-2 py-1 text-xs text-white backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Editing
            </div>
          ) : null}
        </div>

        <div className="p-4">
          <h3 className="mb-1 truncate text-gray-900 dark:text-white">{template.name}</h3>
          <p className="mb-3 text-sm capitalize text-gray-600 dark:text-[#9CA3AF]">
            {template.source} · {template.width}×{template.height}
          </p>

          <div className="flex gap-2">
            <Button
              onClick={() => onEdit(template)}
              className="flex-1 bg-[#ec1e24] text-sm text-white hover:bg-[#d01a20]"
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