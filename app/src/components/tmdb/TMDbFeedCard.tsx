import { useCallback, useState, useRef, useEffect, memo } from 'react';
import { Check, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { haptics } from '../../utils/haptics';
import { useTMDbModalStore, TMDbFeed } from '../../stores/tmdbModalStore';
import { formatCalendarDate, formatDateTime } from '../../utils/calendarDate';
import {
  BottomSheet,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetBody,
} from '../ui/bottom-sheet';

interface TMDbFeedCardProps {
  feed: TMDbFeed;
  onUpdate?: (feedId: string, updates: Partial<TMDbFeed>) => void;
  onDelete?: (feedId: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onEnterSelectionMode?: (feedId: string) => void;
  onToggleSelection?: (feedId: string) => void;
}

/**
 * TMDbFeedCard - Memoized Feed Card Component
 * 
 * CRITICAL ARCHITECTURE:
 * - This component is wrapped in React.memo with custom equality
 * - All modals are opened via the global store (useTMDbModalStore)
 * - No useState for modal visibility - that state lives in the store
 * - No bottom sheets rendered inline - they're in TMDbModals portal
 * 
 * This prevents re-renders when:
 * - Opening/closing modals
 * - Changing image type
 * - Other cards update
 */
function TMDbFeedCardComponent({
  feed,
  selectionMode = false,
  selected = false,
  onEnterSelectionMode,
  onToggleSelection,
}: TMDbFeedCardProps) {
  // Modal controls from Zustand store - NO local useState for modals!
  const openEditCaption = useTMDbModalStore(s => s.openEditCaption);
  const openChangeImage = useTMDbModalStore(s => s.openChangeImage);
  const openReschedule = useTMDbModalStore(s => s.openReschedule);
  const openDelete = useTMDbModalStore(s => s.openDelete);
  const openPlatformSelect = useTMDbModalStore(s => s.openPlatformSelect);
  const openImagePreview = useTMDbModalStore(s => s.openImagePreview);

  // Menu bottom sheet state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const touchSwipeEnabled = true;

  // Swipe state for mobile/tablet delete
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [, setSwipeDirection] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);

  // Swipe state using refs for the listener to avoid stale closures
  const swipeXRef = useRef(0);
  const swipeDirectionRef = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const isSwipingRef = useRef(false);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuActionTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);

  // Card reference for native listeners
  const cardRef = useRef<HTMLDivElement>(null);
  const LONG_PRESS_MS = 450;
  const MOVE_CANCEL_THRESHOLD = 10;

  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(target.closest('button, a, input, textarea, select, [role="button"], [data-prevent-card-selection="true"]'));

  const clearLongPress = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    pressOriginRef.current = null;
  }, []);

  const startLongPress = useCallback((clientX: number, clientY: number, target: EventTarget | null) => {
    clearLongPress();
    longPressTriggeredRef.current = false;

    if (selectionMode || !onEnterSelectionMode || isInteractiveTarget(target)) {
      return;
    }

    pressOriginRef.current = { x: clientX, y: clientY };
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      haptics.medium();
      onEnterSelectionMode(feed.id);
    }, LONG_PRESS_MS);
  }, [clearLongPress, feed.id, onEnterSelectionMode, selectionMode]);

  const cancelLongPressOnMovement = useCallback((clientX: number, clientY: number) => {
    if (!pressOriginRef.current) return;

    const deltaX = Math.abs(clientX - pressOriginRef.current.x);
    const deltaY = Math.abs(clientY - pressOriginRef.current.y);
    if (deltaX > MOVE_CANCEL_THRESHOLD || deltaY > MOVE_CANCEL_THRESHOLD) {
      clearLongPress();
    }
  }, [clearLongPress]);

  // Stable handlers that don't change identity
  const handleImageClick = useCallback(() => {
    if (selectionMode) return;
    haptics.light();
    openImagePreview(feed);
  }, [feed, openImagePreview, selectionMode]);

  const handleEditCaption = useCallback(() => {
    if (selectionMode) return;
    haptics.light();
    openEditCaption(feed);
  }, [feed, openEditCaption, selectionMode]);

  const handleChangeImage = useCallback(() => {
    if (selectionMode) return;
    haptics.light();
    openChangeImage(feed);
  }, [feed, openChangeImage, selectionMode]);

  const handleSchedule = useCallback(() => {
    if (selectionMode) return;
    haptics.light();
    openReschedule(feed);
  }, [feed, openReschedule, selectionMode]);

  const handlePostNow = useCallback(() => {
    if (selectionMode) return;
    haptics.light();
    openPlatformSelect(feed, 'publish');
  }, [feed, openPlatformSelect, selectionMode]);

  const handleDelete = useCallback(() => {
    if (selectionMode) return;
    haptics.light();
    openDelete(feed);
  }, [feed, openDelete, selectionMode]);

  const closeMenuThen = useCallback((callback: () => void) => {
    setIsMenuOpen(false);

    if (menuActionTimeoutRef.current !== null) {
      window.clearTimeout(menuActionTimeoutRef.current);
    }

    menuActionTimeoutRef.current = window.setTimeout(() => {
      menuActionTimeoutRef.current = null;
      callback();
    }, 350);
  }, []);

  useEffect(() => {
    return () => {
      if (menuActionTimeoutRef.current !== null) {
        window.clearTimeout(menuActionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!touchSwipeEnabled) {
      return;
    }

    const card = cardRef.current;
    if (!card) return;

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      currentX.current = e.touches[0].clientX;
      currentY.current = e.touches[0].clientY;
      swipeDirectionRef.current = 'none';
      startLongPress(e.touches[0].clientX, e.touches[0].clientY, e.target);
    };

    const onTouchMove = (e: TouchEvent) => {
      cancelLongPressOnMovement(e.touches[0].clientX, e.touches[0].clientY);

      if (selectionMode || longPressTriggeredRef.current) {
        return;
      }

      // If we've already committed to a vertical scroll, ignore
      if (swipeDirectionRef.current === 'vertical') return;

      currentX.current = e.touches[0].clientX;
      currentY.current = e.touches[0].clientY;

      const diffX = currentX.current - startX.current;
      const diffY = currentY.current - startY.current;
      const deltaX = Math.abs(diffX);
      const deltaY = Math.abs(diffY);

      // Prefer vertical page scrolling. Horizontal swipe should only latch
      // after a deliberate left swipe.
      if (swipeDirectionRef.current === 'none') {
        if (deltaY >= 10 && deltaY > deltaX) {
          swipeDirectionRef.current = 'vertical';
          setSwipeDirection('vertical');
          return;
        }

        if (diffX < 0 && deltaX >= 24 && deltaX > deltaY * 2) {
          swipeDirectionRef.current = 'horizontal';
          isSwipingRef.current = true;
          setSwipeDirection('horizontal'); // Trigger re-render for UI state
          setIsSwiping(true);
        } else {
          return;
        }
      }

      // Handle horizontal swipe
      if (swipeDirectionRef.current === 'horizontal') {
        if (diffX <= 0) {
          const maxSwipe = 120;
          const clampedDiff = Math.max(-maxSwipe, diffX);
          swipeXRef.current = clampedDiff;
          setSwipeX(clampedDiff);
        }
      }
    };

    const onTouchEnd = () => {
      clearLongPress();

      if (selectionMode) {
        swipeDirectionRef.current = 'none';
        swipeXRef.current = 0;
        isSwipingRef.current = false;
        setSwipeX(0);
        setIsSwiping(false);
        setSwipeDirection('none');

        longPressTriggeredRef.current = false;
        currentX.current = startX.current;
        currentY.current = startY.current;
        return;
      }

      if (longPressTriggeredRef.current) {
        swipeDirectionRef.current = 'none';
        swipeXRef.current = 0;
        isSwipingRef.current = false;
        setSwipeX(0);
        setIsSwiping(false);
        setSwipeDirection('none');
        longPressTriggeredRef.current = false;
        currentX.current = startX.current;
        currentY.current = startY.current;
        return;
      }

      if (swipeDirectionRef.current === 'horizontal') {
        const threshold = 90;
        if (swipeXRef.current < -threshold) {
          haptics.medium();
          handleDelete();
        }
      }

      // Reset
      swipeDirectionRef.current = 'none';
      swipeXRef.current = 0;
      isSwipingRef.current = false;

      setSwipeX(0);
      setIsSwiping(false);
      setSwipeDirection('none');
      currentX.current = startX.current;
      currentY.current = startY.current;
    };

    const onTouchCancel = () => {
      clearLongPress();
      swipeDirectionRef.current = 'none';
      swipeXRef.current = 0;
      isSwipingRef.current = false;
      setSwipeX(0);
      setIsSwiping(false);
      setSwipeDirection('none');
      longPressTriggeredRef.current = false;
      currentX.current = startX.current;
      currentY.current = startY.current;
    };

    // Attach native passive listeners
    card.addEventListener('touchstart', onTouchStart, { passive: true });
    card.addEventListener('touchmove', onTouchMove, { passive: true });
    card.addEventListener('touchend', onTouchEnd, { passive: true });
    card.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      card.removeEventListener('touchstart', onTouchStart);
      card.removeEventListener('touchmove', onTouchMove);
      card.removeEventListener('touchend', onTouchEnd);
      card.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [cancelLongPressOnMovement, clearLongPress, handleDelete, onToggleSelection, selectionMode, startLongPress, touchSwipeEnabled, feed.id]);

  // Format functions (pure, no state)
  const formatReleaseDate = (dateString: string) => {
    return formatCalendarDate(dateString);
  };

  const formatFetchedDateTime = (dateString?: string) => {
    if (!dateString) return 'Unavailable';
    return formatDateTime(dateString, 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ONLY valid models: Today, Weekly, Monthly, Anniversary
  // NEVER return tmdb_upcoming or any invalid source
  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'tmdb_today': return 'Today';
      case 'tmdb_weekly': return 'Weekly';
      case 'tmdb_monthly': return 'Monthly';
      case 'tmdb_anniversary': return 'Anniversary';
      default:
        // Invalid source - log warning and fallback to Today
        console.warn(`[TMDbFeedCard] Invalid source: ${source}, defaulting to Today`);
        return 'Today';
    }
  };

  const getImageBadgeLabel = () => {
    if (Array.isArray(feed.imageTypes) && feed.imageTypes.length > 1) {
      if (feed.imageTypes[0] === 'poster' && feed.imageTypes[1] === 'backdrop') {
        return 'Poster + Backdrop';
      }

      if (feed.imageTypes[0] === 'backdrop' && feed.imageTypes[1] === 'logo') {
        return 'Backdrop + Logo';
      }

      return `${feed.imageTypes.length} Images`;
    }

    if (feed.imageType === 'logo') {
      return 'Logo';
    }

    return feed.imageType === 'poster' ? 'Poster' : 'Backdrop';
  };

  const handleSelectionToggle = (e: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    haptics.light();
    onToggleSelection(feed.id);
  };

  const handleCardMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    startLongPress(e.clientX, e.clientY, e.target);
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    cancelLongPressOnMovement(e.clientX, e.clientY);
  };

  const handleCardMouseUp = () => {
    clearLongPress();
  };

  const handleCardMouseLeave = () => {
    clearLongPress();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Background delete button revealed on swipe */}
      <div className={`absolute inset-0 flex justify-end items-center rounded-2xl bg-[#ec1e24] ${selectionMode ? 'hidden' : ''}`}>
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

      <div
        ref={cardRef}
        className={`bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-[#333333] shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] overflow-hidden group touch-pan-y select-none ${selected ? 'ring-2 ring-[#ec1e24] bg-[#ec1e24]/5' : selectionMode ? 'ring-1 ring-[#ec1e24]/30' : ''}`}
        style={{
          transform: `translateX(${selectionMode ? 0 : swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
        onMouseDown={handleCardMouseDown}
        onMouseMove={handleCardMouseMove}
        onMouseUp={handleCardMouseUp}
        onMouseLeave={handleCardMouseLeave}
      >
        {selectionMode && (
          <button
            type="button"
            aria-label={selected ? 'Unselect feed card' : 'Select feed card'}
            aria-pressed={selected}
            data-prevent-card-selection="true"
            className="absolute right-3 top-3 z-10"
            onClick={handleSelectionToggle}
          >
            <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? 'border-[#ec1e24] bg-[#ec1e24] text-white' : 'border-gray-300 bg-white/95 text-transparent dark:border-[#333333] dark:bg-[#050505]/95'}`}>
              <Check className="h-3.5 w-3.5" />
            </div>
          </button>
        )}
        <div className="flex flex-col sm:flex-row">
          {/* Image Section */}
          <div
            className="sm:w-48 h-48 sm:h-auto relative flex-shrink-0 bg-gray-100 dark:bg-[#1A1A1A] cursor-pointer hover:opacity-90 transition-opacity"
            onClick={handleImageClick}
          >
            <img
              src={feed.imageUrl}
              alt={feed.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/80 text-white px-2 py-1 rounded-lg text-xs">
              {getImageBadgeLabel()}
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 p-4">
            {/* Header with title, badge, menu */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {/* MOVIE / TV Label - MUST BE FIRST */}
                  {/* Badge-style: small radius rectangle (~4-6px), not pill */}
                  {/* White bg + black text in dark mode, black bg + white text in light mode */}
                  <span className="text-xs px-2 py-0.5 rounded bg-black dark:bg-white text-white dark:text-black font-medium uppercase">
                    {feed.mediaType === 'movie' ? 'MOVIE' : 'TV'}
                  </span>
                  {/* Model Label (Today/Weekly/Monthly/Anniversary) - red bg */}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#ec1e24] text-white">
                    {getSourceLabel(feed.source)}
                  </span>
                </div>
                {/* Title includes year in parentheses - no separate year label */}
                <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                  {feed.title} ({feed.year})
                </h2>
              </div>

              {/* Desktop hover delete button */}
              {!selectionMode && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    className="hidden lg:flex h-9 w-9 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 dark:text-gray-400 hover:text-[#ec1e24] dark:hover:text-[#ec1e24]"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 bg-transparent border border-gray-200 dark:border-[#333333]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      haptics.selection();
                      setIsMenuOpen(true);
                    }}
                  >
                    <MoreVertical className="w-4 h-4 text-gray-900 dark:text-white" />
                  </Button>
                </>
              )}

              {/* Menu BottomSheet */}
              <BottomSheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <BottomSheetHeader>
                  <BottomSheetTitle>Options</BottomSheetTitle>
                </BottomSheetHeader>
                <BottomSheetBody>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeMenuThen(handleEditCaption);
                      }}
                      className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                    >
                      Edit Caption
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeMenuThen(handleChangeImage);
                      }}
                      className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                    >
                      Change Image
                    </button>
                  </div>
                  {/* Action Divider - Full Width */}
                  <div className="my-4 -mx-6 border-t border-gray-200 dark:border-[#333333]" />
                  {/* Cancel Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      haptics.light();
                      setIsMenuOpen(false);
                    }}
                    className="w-full mb-2 py-2 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                  >
                    Cancel
                  </button>
                </BottomSheetBody>
              </BottomSheet>
            </div>

            {/* Caption */}
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl p-4 mb-4">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="text-gray-900 dark:text-white mb-1">
                    {feed.caption}
                  </p>
                  <span className="text-xs text-gray-500 dark:text-[#6B7280]">
                    {feed.caption.length}/200 characters
                  </span>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
                <span className="truncate">{feed.cast.join(', ')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
                <span>Release: {formatReleaseDate(feed.releaseDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
                <span>Fetched: {formatFetchedDateTime(feed.createdAt || feed.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
                <span>TMDb ID: {feed.tmdbId}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
                <span>Popularity: {feed.popularity.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            {!selectionMode && (
              <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-[#333333]">
                <Button
                  onClick={handlePostNow}
                  variant="outline"
                  className="flex-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]"
                >
                  Publish
                </Button>
                <Button
                  onClick={handleSchedule}
                  className="flex-1"
                >
                  Schedule
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom equality check - only re-render if feed data actually changes
function areEqual(prevProps: TMDbFeedCardProps, nextProps: TMDbFeedCardProps) {
  const prev = prevProps.feed;
  const next = nextProps.feed;

  return (
    prevProps.selected === nextProps.selected &&
    prevProps.selectionMode === nextProps.selectionMode &&
    prev.id === next.id &&
    prev.caption === next.caption &&
    prev.imageUrl === next.imageUrl &&
    prev.imageType === next.imageType &&
    JSON.stringify(prev.imageUrls || []) === JSON.stringify(next.imageUrls || []) &&
    JSON.stringify(prev.imageTypes || []) === JSON.stringify(next.imageTypes || []) &&
    prev.scheduledTime === next.scheduledTime &&
    prev.releaseDate === next.releaseDate &&
    prev.createdAt === next.createdAt &&
    prev.updatedAt === next.updatedAt
  );
}

export const TMDbFeedCard = memo(TMDbFeedCardComponent, areEqual);
