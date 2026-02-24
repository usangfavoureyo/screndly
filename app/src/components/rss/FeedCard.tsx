import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Trash2, Globe } from 'lucide-react';
import { InstagramIcon } from '../icons/InstagramIcon';
import { FacebookIcon } from '../icons/FacebookIcon';
import { ThreadsIcon } from '../icons/ThreadsIcon';
import { XIcon } from '../icons/XIcon';
import { PinterestIcon } from '../icons/PinterestIcon';
import { haptics } from '../../utils/haptics';

export interface Feed {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  interval: number;
  imageCount: '1' | '2' | '3' | 'random';
  platformImageCounts?: { x?: number; threads?: number; facebook?: number };
  dedupeDays: number;
  filters: {
    scope: 'title' | 'body' | 'title_or_body' | 'title_and_body';
    required: Array<{
      text: string;
      matchType: 'contains' | 'exact';
      caseSensitive: boolean;
      active: boolean;
    }>;
    blocked: Array<{
      text: string;
      matchType: 'contains' | 'exact';
      caseSensitive: boolean;
      active: boolean;
    }>;
  };
  serperPriority: boolean;
  rehostImages: boolean;
  lastProcessedAt?: string;
  nextRunAt?: string;
  platformsEnabled?: { x: boolean; threads: boolean; facebook: boolean; pinterest: boolean };
  autoPost: boolean;
  status: 'active' | 'paused' | 'error';
  favicon?: string;
}

interface FeedCardProps {
  feed: Feed;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (id: string) => void;
  onTest: (id: string) => Promise<void>;
  onTogglePlatform: (feedId: string, platform: string, enabled: boolean) => void;
  onToggleEnabled: (feedId: string, enabled: boolean) => void;
  onRunNow: (feedId: string) => void;
}

export function FeedCard({
  feed,
  onEdit,
  onDelete,
  onPreview,
  onTest,
  onTogglePlatform,
  onToggleEnabled,
  onRunNow
}: FeedCardProps) {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
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
          onDelete(feed.id);
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
  }, [feed.id, onDelete]);

  const handleTest = async () => {
    haptics.medium();
    setIsTestRunning(true);
    try {
      await onTest(feed.id);
    } finally {
      setIsTestRunning(false);
    }
  };

  const getStatusColor = () => {
    switch (feed.status) {
      case 'active':
        return 'bg-[#D1FAE5] dark:bg-[#065F46] text-[#065F46] dark:text-[#D1FAE5]';
      case 'paused':
        return 'bg-gray-200 dark:bg-[#374151] text-gray-600 dark:text-[#9CA3AF]';
      case 'error':
        return 'bg-[#FEE2E2] dark:bg-[#991B1B] text-[#991B1B] dark:text-[#FEE2E2]';
    }
  };

  const platformIcons: Record<string, React.ComponentType<any>> = {
    x: XIcon,
    threads: ThreadsIcon,
    facebook: FacebookIcon,
    instagram: InstagramIcon,
    pinterest: PinterestIcon,
  };

  let domain = '';
  try {
    domain = new URL(feed.url).hostname.replace('www.', '');
  } catch (e) {
    // Invalid URL, use empty string or fallback
    domain = feed.url || '';
  }

  return (
    <div className="relative overflow-hidden rounded-2xl group">
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
        ref={cardRef}
        className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200 touch-pan-y"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {feed.favicon && !faviconError ? (
              <img
                src={feed.favicon}
                alt=""
                className="w-5 h-5 rounded flex-shrink-0 mt-0.5"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <div className="w-5 h-5 rounded flex-shrink-0 mt-0.5 bg-gray-200 dark:bg-[#374151] flex items-center justify-center">
                <Globe className="w-3 h-3 text-gray-500 dark:text-[#6B7280]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-gray-900 dark:text-white truncate mb-1">{feed.name}</h3>
              <div className="flex items-center gap-2">
                <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm truncate">{domain}</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${getStatusColor()}`}>
                  {feed.status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Desktop Delete Button - Shows on hover */}
            <button
              onClick={() => {
                haptics.medium();
                onDelete(feed.id);
              }}
              className="hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity duration-200 items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a1a] text-gray-600 dark:text-[#9CA3AF] hover:text-[#ec1e24] dark:hover:text-[#ec1e24]"
              aria-label="Delete feed"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <Switch
              checked={feed.enabled}
              onCheckedChange={(checked) => {
                haptics.light();
                onToggleEnabled(feed.id, checked);
              }}
              className="flex-shrink-0"
            />
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-1.5 mb-4 text-sm">
          <div className="flex items-center justify-between text-[#6B7280] dark:text-[#9CA3AF]">
            <span>Next run:</span>
            <span>{feed.nextRunAt || 'Not scheduled'}</span>
          </div>
          <div className="flex items-center justify-between text-[#6B7280] dark:text-[#9CA3AF]">
            <span>Last item:</span>
            <span>{feed.lastProcessedAt || 'Never'}</span>
          </div>
        </div>

        {/* Platform Toggles */}
        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-[#1F1F1F]">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-xs mb-2">Platforms</p>
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(feed.platformsEnabled || {}).map(([platform, enabled]) => {
              const Icon = platformIcons[platform];
              return Icon ? (
                <button
                  key={platform}
                  onClick={() => {
                    haptics.light();
                    onTogglePlatform(feed.id, platform, !enabled);
                  }}
                  className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${enabled
                    ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                    : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                    }`}
                  title={platform}
                >
                  <Icon className={platform === 'x' ? 'w-4 h-4' : platform === 'instagram' || platform === 'facebook' ? 'w-6 h-6' : 'w-5 h-5'} />
                </button>
              ) : null;
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              haptics.light();
              onPreview(feed.id);
            }}
            className="!bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white text-xs border-gray-300 dark:border-[#333333]"
          >
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isTestRunning}
            className="!bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white text-xs border-gray-300 dark:border-[#333333]"
          >
            {isTestRunning ? 'Testing...' : 'Test'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              haptics.light();
              onEdit(feed.id);
            }}
            className="!bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white text-xs border-gray-300 dark:border-[#333333]"
          >
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}