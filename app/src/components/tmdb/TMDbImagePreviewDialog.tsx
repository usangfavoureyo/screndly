import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { VisuallyHidden } from '../ui/visually-hidden';
import { haptics } from '../../utils/haptics';

interface TMDbImagePreviewDialogProps {
  open: boolean;
  imageUrl?: string | null;
  title?: string;
  imageType?: 'poster' | 'backdrop';
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTouchDistance(touchA: Touch, touchB: Touch) {
  return Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY);
}

export function TMDbImagePreviewDialog({
  open,
  imageUrl,
  title,
  imageType,
  onOpenChange,
  onClose,
}: TMDbImagePreviewDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);

  const scaleRef = useRef(MIN_SCALE);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const clampOffset = useCallback((nextScale: number, nextOffset: { x: number; y: number }) => {
    if (nextScale <= MIN_SCALE) {
      return { x: 0, y: 0 };
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return nextOffset;
    }

    const maxOffsetX = ((nextScale - 1) * rect.width) / 2;
    const maxOffsetY = ((nextScale - 1) * rect.height) / 2;

    return {
      x: clamp(nextOffset.x, -maxOffsetX, maxOffsetX),
      y: clamp(nextOffset.y, -maxOffsetY, maxOffsetY),
    };
  }, []);

  const resetTransform = useCallback(() => {
    pinchStartRef.current = null;
    panStartRef.current = null;
    scaleRef.current = MIN_SCALE;
    offsetRef.current = { x: 0, y: 0 };
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
    setIsInteracting(false);
  }, []);

  const updateTransform = useCallback((nextScale: number, nextOffset: { x: number; y: number }) => {
    const safeScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const safeOffset = clampOffset(safeScale, nextOffset);

    scaleRef.current = safeScale;
    offsetRef.current = safeOffset;
    setScale(safeScale);
    setOffset(safeOffset);
  }, [clampOffset]);

  useEffect(() => {
    if (open) {
      resetTransform();
    }
  }, [imageUrl, open, resetTransform]);

  const handleClose = useCallback(() => {
    haptics.light();
    resetTransform();
    onClose();
  }, [onClose, resetTransform]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const [touchA, touchB] = [event.touches[0], event.touches[1]];
      pinchStartRef.current = {
        distance: getTouchDistance(touchA, touchB),
        scale: scaleRef.current,
      };
      panStartRef.current = null;
      setIsInteracting(true);
      return;
    }

    if (event.touches.length === 1 && scaleRef.current > MIN_SCALE) {
      const touch = event.touches[0];
      panStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        offsetX: offsetRef.current.x,
        offsetY: offsetRef.current.y,
      };
      setIsInteracting(true);
    }
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2 && pinchStartRef.current) {
      event.preventDefault();

      const [touchA, touchB] = [event.touches[0], event.touches[1]];
      const distance = getTouchDistance(touchA, touchB);
      const nextScale = pinchStartRef.current.scale * (distance / pinchStartRef.current.distance);
      updateTransform(nextScale, offsetRef.current);
      return;
    }

    if (event.touches.length === 1 && scaleRef.current > MIN_SCALE && panStartRef.current) {
      event.preventDefault();

      const touch = event.touches[0];
      updateTransform(scaleRef.current, {
        x: panStartRef.current.offsetX + (touch.clientX - panStartRef.current.x),
        y: panStartRef.current.offsetY + (touch.clientY - panStartRef.current.y),
      });
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchStartRef.current = null;
    }

    if (event.touches.length === 1 && scaleRef.current > MIN_SCALE) {
      const touch = event.touches[0];
      panStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        offsetX: offsetRef.current.x,
        offsetY: offsetRef.current.y,
      };
      return;
    }

    panStartRef.current = null;
    setIsInteracting(false);

    if (scaleRef.current <= 1.01) {
      resetTransform();
    }
  };

  const handleDoubleClick = () => {
    if (scaleRef.current > MIN_SCALE) {
      resetTransform();
      return;
    }

    updateTransform(2, { x: 0, y: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl w-[calc(100%-1rem)] p-0 overflow-hidden bg-transparent border-none shadow-none"
        hideCloseButton
      >
        <VisuallyHidden>
          <DialogTitle>{title || 'TMDb image preview'}</DialogTitle>
          <DialogDescription>
            Expanded {imageType === 'backdrop' ? 'backdrop' : 'poster'} image preview
          </DialogDescription>
        </VisuallyHidden>

        <div className="relative overflow-hidden rounded-2xl bg-black">
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 z-50 rounded-full bg-black/80 p-2 text-white transition-colors hover:bg-black"
            aria-label="Close image"
          >
            <X className="h-6 w-6" />
          </button>

          {imageType && (
            <div className="absolute left-4 top-4 z-40 rounded-full bg-black/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
              {imageType}
            </div>
          )}

          <div
            ref={containerRef}
            className="flex h-[90vh] w-full items-center justify-center overflow-hidden bg-black select-none"
            style={{ touchAction: 'none' }}
            onDoubleClick={handleDoubleClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {imageUrl && (
              <img
                src={imageUrl}
                alt={title || 'TMDb image'}
                draggable={false}
                className="max-h-full max-w-full object-contain"
                style={{
                  transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                  transition: isInteracting ? 'none' : 'transform 180ms ease-out',
                  transformOrigin: 'center center',
                }}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
