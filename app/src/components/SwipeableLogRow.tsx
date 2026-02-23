import { useState, useRef } from 'react';
import { Trash2, Video, Rss, Clapperboard, Film, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';
import { getPlatformConnection, PlatformType } from '../utils/platformConnections';

interface LogEntry {
  id: string;
  videoTitle: string;
  platform: string;
  status: 'success' | 'failed';
  timestamp: string;
  error?: string;
  errorDetails?: string;
  type: 'video' | 'rss' | 'tmdb' | 'videostudio';
}

interface SwipeableLogRowProps {
  log: LogEntry;
  onDelete: (id: string) => void;
  onRetry: (logId: string, videoTitle: string) => void;
  platformUrls: Record<string, string>;
}

export function SwipeableLogRow({
  log,
  onDelete,
  onRetry,
  platformUrls
}: SwipeableLogRowProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);

  // Get platform URL - returns user's connected account if available, otherwise Screen Render's URL
  const getPlatformUrl = (platformName: string): string => {
    const connection = getPlatformConnection(platformName as PlatformType);
    return connection.profileUrl || platformUrls[platformName];
  };

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
        // Limit swipe distance - increased to show delete label better
        const maxSwipe = 150;
        const clampedDiff = Math.max(-maxSwipe, diff);
        
        setSwipeX(clampedDiff);
      }
    }
  };

  const handleTouchEnd = () => {
    // Only process swipe action if it was a horizontal swipe
    if (swipeDirection === 'horizontal') {
      const threshold = 110; // Increased from 90 to make it less aggressive
      
      // Swipe left (delete)
      if (swipeX < -threshold) {
        haptics.medium();
        onDelete(log.id);
      }
    }
    
    // Reset state
    setIsSwiping(false);
    setSwipeDirection('none');
    setSwipeX(0);
  };

  return (
    <tr 
      className="relative border-b border-gray-200 dark:border-[#374151] last:border-0 transition-colors duration-200 group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        // Background delete layer using CSS
        background: swipeX < 0 
          ? '#ec1e24'
          : 'transparent',
      }}
    >
      {/* Content cell with delete indicator */}
      <td 
        className="relative p-4 text-gray-900 dark:text-white bg-white dark:bg-[#000000]"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Delete indicator - positioned to appear on red background when swiping */}
        {swipeX < 0 && (
          <div 
            className="flex flex-col items-center justify-center gap-1 text-white pointer-events-none lg:hidden absolute"
            style={{
              top: '50%',
              right: '-100px',
              transform: 'translateY(-50%)',
              opacity: Math.min(Math.abs(swipeX) / 60, 1),
              zIndex: 10,
            }}
          >
            <Trash2 className="w-5 h-5" />
            <span className="text-xs font-medium whitespace-nowrap">Delete</span>
          </div>
        )}
        {log.videoTitle}
      </td>

      {/* Source cell */}
      <td 
        className="p-4 bg-white dark:bg-[#000000]"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div className="flex items-center gap-2">
          {log.type === 'video' && (
            <>
              <Video className="w-4.5 h-4.5 text-[#ec1e24]" aria-hidden="true" />
              <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">Video</span>
            </>
          )}
          {log.type === 'rss' && (
            <>
              <Rss className="w-4 h-4 text-[#ec1e24]" aria-hidden="true" />
              <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">RSS</span>
            </>
          )}
          {log.type === 'tmdb' && (
            <>
              <Clapperboard className="w-4 h-4 text-[#ec1e24]" aria-hidden="true" />
              <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">TMDb</span>
            </>
          )}
          {log.type === 'videostudio' && (
            <>
              <Film className="w-6 h-6 text-[#ec1e24]" aria-hidden="true" />
              <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">Video Studio</span>
            </>
          )}
        </div>
      </td>

      {/* Platform cell */}
      <td 
        className="p-4 bg-white dark:bg-[#000000]"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          position: 'relative',
          zIndex: 1
        }}
      >
        <a
          href={getPlatformUrl(log.platform)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault();
            haptics.light();
            window.open(getPlatformUrl(log.platform), '_blank', 'noopener,noreferrer');
          }}
          className="inline-block px-3 py-1 bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF] rounded-full hover:bg-gray-300 dark:hover:bg-[#2a2a2a] transition-colors cursor-pointer"
          aria-label={`View ${log.platform} profile`}
        >
          {log.platform}
        </a>
      </td>

      {/* Status cell */}
      <td 
        className="p-4 bg-white dark:bg-[#000000]"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          position: 'relative',
          zIndex: 1
        }}
      >
        <span
          className={`px-3 py-1 rounded-full ${
            log.status === 'success'
              ? 'bg-[#D1FAE5] dark:bg-[#065F46] text-[#065F46] dark:text-[#D1FAE5]'
              : 'bg-[#FEE2E2] dark:bg-[#991B1B] text-[#991B1B] dark:text-[#FEE2E2]'
          }`}
        >
          {log.status}
        </span>
      </td>

      {/* Timestamp cell */}
      <td 
        className="p-4 text-[#6B7280] dark:text-[#9CA3AF] bg-white dark:bg-[#000000]"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          position: 'relative',
          zIndex: 1
        }}
      >
        {log.timestamp}
      </td>

      {/* Error cell */}
      <td 
        className="p-4 bg-white dark:bg-[#000000]"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          position: 'relative',
          zIndex: 1
        }}
      >
        {log.error ? (
          <div>
            <p className="text-[#EF4444]">{log.error}</p>
            {log.errorDetails && (
              <p className="text-[#6B7280] dark:text-[#9CA3AF] text-xs mt-1">{log.errorDetails}</p>
            )}
          </div>
        ) : (
          <span className="text-[#6B7280] dark:text-[#9CA3AF]">-</span>
        )}
      </td>

      {/* Action cell */}
      <td 
        className="p-4 bg-white dark:bg-[#000000]"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div className="flex items-center gap-3">
          {log.status === 'failed' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRetry(log.id, log.videoTitle)}
              className="gap-2 bg-white dark:bg-black"
              aria-label={`Retry upload for ${log.videoTitle}`}
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Retry
            </Button>
          ) : (
            <span className="text-[#6B7280] dark:text-[#9CA3AF]">-</span>
          )}
          
          {/* Delete button - visible on desktop */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              haptics.medium();
              onDelete(log.id);
            }}
            className="hidden lg:group-hover:flex absolute bottom-2 right-2 items-center justify-center hover:text-[#ec1e24] text-gray-600 dark:text-gray-400 transition-colors"
            title="Delete log entry"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}