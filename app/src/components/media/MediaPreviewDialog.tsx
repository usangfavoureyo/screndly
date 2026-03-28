import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { VisuallyHidden } from '../ui/visually-hidden';
import { haptics } from '../../utils/haptics';

type MediaPreviewKind = 'image' | 'video';

interface MediaPreviewDialogProps {
  open: boolean;
  src?: string | null;
  imageSources?: string[];
  badgeLabels?: string[];
  initialIndex?: number;
  mediaType: MediaPreviewKind;
  title?: string;
  badgeLabel?: string;
  onOpenChange: (open: boolean) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTouchDistance(
  touchA: Pick<Touch, 'clientX' | 'clientY'>,
  touchB: Pick<Touch, 'clientX' | 'clientY'>,
) {
  return Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY);
}

function formatPlaybackTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return '0:00';
  }

  const wholeSeconds = Math.floor(value);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = wholeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function MediaPreviewDialog({
  open,
  src,
  imageSources,
  badgeLabels,
  initialIndex = 0,
  mediaType,
  title,
  badgeLabel,
  onOpenChange,
}: MediaPreviewDialogProps) {
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const scaleRef = useRef(MIN_SCALE);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const resolvedImageSources = mediaType === 'image'
    ? (Array.isArray(imageSources) && imageSources.length > 0
      ? imageSources.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : (src ? [src] : []))
    : [];
  const activeImageSource = mediaType === 'image'
    ? (resolvedImageSources[currentImageIndex] ?? resolvedImageSources[0] ?? src ?? null)
    : src;
  const activeBadgeLabel = mediaType === 'image'
    ? (Array.isArray(badgeLabels) ? badgeLabels[currentImageIndex] : undefined) || badgeLabel
    : badgeLabel;

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

    const rect = imageContainerRef.current?.getBoundingClientRect();
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

  const resetImageTransform = useCallback(() => {
    pinchStartRef.current = null;
    panStartRef.current = null;
    swipeStartRef.current = null;
    scaleRef.current = MIN_SCALE;
    offsetRef.current = { x: 0, y: 0 };
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
    setIsInteracting(false);
  }, []);

  const goToImage = useCallback((nextIndex: number) => {
    if (resolvedImageSources.length <= 1) {
      return;
    }

    const boundedIndex = clamp(nextIndex, 0, resolvedImageSources.length - 1);
    setCurrentImageIndex(boundedIndex);
    resetImageTransform();
  }, [resetImageTransform, resolvedImageSources.length]);

  const updateTransform = useCallback((nextScale: number, nextOffset: { x: number; y: number }) => {
    const safeScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const safeOffset = clampOffset(safeScale, nextOffset);

    scaleRef.current = safeScale;
    offsetRef.current = safeOffset;
    setScale(safeScale);
    setOffset(safeOffset);
  }, [clampOffset]);

  const resetVideoPlayback = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();

      try {
        video.currentTime = 0;
      } catch {
        // Ignore media reset issues in unsupported environments.
      }
    }

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  useEffect(() => {
    if (!open) {
      resetImageTransform();
      resetVideoPlayback();
      return;
    }

    if (mediaType === 'image') {
      const safeIndex = resolvedImageSources.length > 0
        ? clamp(initialIndex, 0, resolvedImageSources.length - 1)
        : 0;
      setCurrentImageIndex(safeIndex);
      resetImageTransform();
      return;
    }

    resetVideoPlayback();
  }, [initialIndex, mediaType, open, resetImageTransform, resetVideoPlayback, resolvedImageSources.length, src]);

  useEffect(() => {
    if (!open || mediaType !== 'image' || resolvedImageSources.length <= 1) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        haptics.light();
        goToImage(currentImageIndex - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        haptics.light();
        goToImage(currentImageIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentImageIndex, goToImage, mediaType, open, resolvedImageSources.length]);

  const handleDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      resetImageTransform();
      resetVideoPlayback();
    }

    onOpenChange(nextOpen);
  }, [onOpenChange, resetImageTransform, resetVideoPlayback]);

  const handleClose = useCallback(() => {
    haptics.light();
    handleDialogOpenChange(false);
  }, [handleDialogOpenChange]);

  const handleImageTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
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
      swipeStartRef.current = null;
      return;
    }

    if (event.touches.length === 1 && scaleRef.current <= MIN_SCALE && resolvedImageSources.length > 1) {
      const touch = event.touches[0];
      swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleImageTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
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

  const handleImageTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const swipeStart = swipeStartRef.current;
    let didNavigate = false;

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

    if (event.changedTouches.length === 1 && swipeStart && scaleRef.current <= MIN_SCALE && resolvedImageSources.length > 1) {
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - swipeStart.x;
      const deltaY = touch.clientY - swipeStart.y;

      if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
        haptics.light();
        goToImage(currentImageIndex + (deltaX < 0 ? 1 : -1));
        didNavigate = true;
      }
    }

    if (!didNavigate && scaleRef.current <= 1.01) {
      resetImageTransform();
    }

    swipeStartRef.current = null;
  };

  const handleImageDoubleClick = () => {
    if (scaleRef.current > MIN_SCALE) {
      resetImageTransform();
      return;
    }

    updateTransform(2, { x: 0, y: 0 });
  };

  const toggleVideoPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }

      return;
    }

    video.pause();
    setIsPlaying(false);
  }, []);

  const handleVideoScrub = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value);
    const video = videoRef.current;
    if (!video || !Number.isFinite(nextTime)) {
      return;
    }

    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const previewTitle = title || (mediaType === 'video' ? 'Video preview' : 'Image preview');
  const previewDescription = mediaType === 'video'
    ? 'Expanded video preview with tap playback and scrub controls.'
    : resolvedImageSources.length > 1
      ? 'Expanded image preview with swipe, pinch, and double-tap zoom.'
      : 'Expanded image preview with pinch and double-tap zoom.';

  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="w-[calc(100%-1rem)] max-w-6xl overflow-hidden border-none bg-transparent p-0 shadow-none"
        hideCloseButton
      >
        <VisuallyHidden>
          <DialogTitle>{previewTitle}</DialogTitle>
          <DialogDescription>{previewDescription}</DialogDescription>
        </VisuallyHidden>

        <div className="relative overflow-hidden rounded-2xl bg-black">
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 z-50 rounded-full bg-black/80 p-2 text-white transition-colors hover:bg-black"
            aria-label="Close preview"
          >
            <X className="h-6 w-6" />
          </button>

          {activeBadgeLabel ? (
            <div className="absolute left-4 top-4 z-40 rounded-full bg-black/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
              {activeBadgeLabel}
            </div>
          ) : null}

          {mediaType === 'image' && resolvedImageSources.length > 1 ? (
            <div className="absolute right-4 top-16 z-40 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
              {currentImageIndex + 1} / {resolvedImageSources.length}
            </div>
          ) : null}

          {mediaType === 'image' && resolvedImageSources.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  goToImage(currentImageIndex - 1);
                }}
                disabled={currentImageIndex === 0}
                className="absolute left-4 top-1/2 z-40 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Show previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  goToImage(currentImageIndex + 1);
                }}
                disabled={currentImageIndex >= resolvedImageSources.length - 1}
                className="absolute right-4 top-1/2 z-40 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Show next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          ) : null}

          {mediaType === 'image' ? (
            <div
              ref={imageContainerRef}
              className="flex h-[90vh] w-full select-none items-center justify-center overflow-hidden bg-black"
              style={{ touchAction: 'none' }}
              onDoubleClick={handleImageDoubleClick}
              onTouchStart={handleImageTouchStart}
              onTouchMove={handleImageTouchMove}
              onTouchEnd={handleImageTouchEnd}
              onTouchCancel={handleImageTouchEnd}
            >
              {activeImageSource ? (
                <img
                  src={activeImageSource}
                  alt={previewTitle}
                  draggable={false}
                  className="max-h-full max-w-full object-contain"
                  style={{
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                    transition: isInteracting ? 'none' : 'transform 180ms ease-out',
                    transformOrigin: 'center center',
                  }}
                />
              ) : (
                <div className="text-sm text-white/70">Preview unavailable</div>
              )}
            </div>
          ) : (
            <div className="relative flex h-[90vh] w-full items-center justify-center overflow-hidden bg-black">
              {activeImageSource ? (
                <>
                  <video
                    ref={videoRef}
                    src={activeImageSource}
                    className="h-full w-full object-contain"
                    playsInline
                    preload="metadata"
                    onClick={() => {
                      void toggleVideoPlayback();
                    }}
                    onLoadedMetadata={(event) => {
                      setDuration(event.currentTarget.duration || 0);
                      setCurrentTime(event.currentTarget.currentTime || 0);
                    }}
                    onTimeUpdate={(event) => {
                      setCurrentTime(event.currentTarget.currentTime || 0);
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />

                  {!isPlaying ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/60 text-white shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                        <Play className="ml-1 h-10 w-10 fill-current" />
                      </div>
                    </div>
                  ) : null}

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent p-4 sm:p-5">
                    <div className="pointer-events-auto flex items-center gap-3 text-white">
                      <button
                        type="button"
                        onClick={() => {
                          void toggleVideoPlayback();
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 transition-colors hover:bg-white/15"
                        aria-label={isPlaying ? 'Pause video' : 'Play video'}
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                      </button>
                      <span className="min-w-[3rem] text-xs tabular-nums sm:text-sm">
                        {formatPlaybackTime(currentTime)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={duration > 0 ? duration : 1}
                        step="0.1"
                        value={duration > 0 ? Math.min(currentTime, duration) : 0}
                        onChange={handleVideoScrub}
                        className="h-1 flex-1 cursor-pointer accent-[#ec1e24]"
                        aria-label="Scrub video playback"
                      />
                      <span className="min-w-[3rem] text-right text-xs tabular-nums sm:text-sm">
                        {formatPlaybackTime(duration)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-white/70">Preview unavailable</div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
