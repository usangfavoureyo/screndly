import { useCallback, useState, useRef, useEffect, memo } from 'react';
import { MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { haptics } from '../../utils/haptics';
import { useTMDbModalStore, TMDbFeed } from '../../stores/tmdbModalStore';
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
function TMDbFeedCardComponent({ feed }: Omit<TMDbFeedCardProps, 'onUpdate' | 'onDelete'>) {
  // Modal controls from Zustand store - NO local useState for modals!
  const openEditCaption = useTMDbModalStore(s => s.openEditCaption);
  const openChangeImage = useTMDbModalStore(s => s.openChangeImage);
  const openReschedule = useTMDbModalStore(s => s.openReschedule);
  const openDelete = useTMDbModalStore(s => s.openDelete);
  const openPlatformSelect = useTMDbModalStore(s => s.openPlatformSelect);
  const openImagePreview = useTMDbModalStore(s => s.openImagePreview);

  // Menu bottom sheet state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  // Card reference for native listeners
  const cardRef = useRef<HTMLDivElement>(null);

  // Stable handlers that don't change identity
  const handleImageClick = useCallback(() => {
    haptics.light();
    openImagePreview(feed);
  }, [feed, openImagePreview]);

  const handleEditCaption = useCallback(() => {
    haptics.light();
    openEditCaption(feed);
  }, [feed, openEditCaption]);

  const handleChangeImage = useCallback(() => {
    haptics.light();
    openChangeImage(feed);
  }, [feed, openChangeImage]);

  const handleSchedule = useCallback(() => {
    haptics.light();
    openReschedule(feed);
  }, [feed, openReschedule]);

  const handlePostNow = useCallback(() => {
    haptics.light();
    openPlatformSelect(feed, true);
  }, [feed, openPlatformSelect]);

  const handleDelete = useCallback(() => {
    haptics.light();
    openDelete(feed);
  }, [feed, openDelete]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      swipeDirectionRef.current = 'none';
    };

    const onTouchMove = (e: TouchEvent) => {
      // If we've already committed to a vertical scroll, ignore
      if (swipeDirectionRef.current === 'vertical') return;

      currentX.current = e.touches[0].clientX;
      currentY.current = e.touches[0].clientY;

      const deltaX = Math.abs(currentX.current - startX.current);
      const deltaY = Math.abs(currentY.current - startY.current);

      // Determine swipe direction on first significant movement
      if (swipeDirectionRef.current === 'none' && (deltaX > 10 || deltaY > 10)) {
        if (deltaX > deltaY * 1.5) {
          swipeDirectionRef.current = 'horizontal';
          isSwipingRef.current = true;
          setSwipeDirection('horizontal'); // Trigger re-render for UI state
          setIsSwiping(true);
        } else {
          swipeDirectionRef.current = 'vertical';
          setSwipeDirection('vertical');
        }
      }

      // Handle horizontal swipe
      if (swipeDirectionRef.current === 'horizontal') {
        const diff = currentX.current - startX.current;
        if (diff <= 0) {
          const maxSwipe = 120;
          const clampedDiff = Math.max(-maxSwipe, diff);
          swipeXRef.current = clampedDiff;
          setSwipeX(clampedDiff);
        }
      }
    };

    const onTouchEnd = () => {
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
    };

    // Attach native passive listeners
    card.addEventListener('touchstart', onTouchStart, { passive: true });
    card.addEventListener('touchmove', onTouchMove, { passive: true });
    card.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      card.removeEventListener('touchstart', onTouchStart);
      card.removeEventListener('touchmove', onTouchMove);
      card.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleDelete]);

  // Format functions (pure, no state)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
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

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Background delete button revealed on swipe */}
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

      <div
        ref={cardRef}
        className="bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-[#333333] shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] overflow-hidden group touch-pan-y"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
      >
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
              {feed.imageType === 'poster' ? 'Poster' : 'Backdrop'}
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

              {/* 3-dot Menu Button */}
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 bg-transparent border border-gray-200 dark:border-[#333333]"
                onClick={() => {
                  haptics.selection();
                  setIsMenuOpen(true);
                }}
              >
                <MoreVertical className="w-4 h-4 text-gray-900 dark:text-white" />
              </Button>

              {/* Menu BottomSheet */}
              <BottomSheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <BottomSheetHeader>
                  <BottomSheetTitle>Options</BottomSheetTitle>
                </BottomSheetHeader>
                <BottomSheetBody>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleEditCaption();
                      }}
                      className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                    >
                      Edit Caption
                    </button>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleChangeImage();
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
                    onClick={() => {
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
                <span>{formatDate(feed.scheduledTime)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
                <span>TMDb ID: {feed.tmdbId}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
                <span>Popularity: {feed.popularity.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
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
    prev.id === next.id &&
    prev.caption === next.caption &&
    prev.imageUrl === next.imageUrl &&
    prev.imageType === next.imageType &&
    prev.scheduledTime === next.scheduledTime
  );
}

export const TMDbFeedCard = memo(TMDbFeedCardComponent, areEqual);