import { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface Activity {
  id: string;
  title: string;
  platform: string;
  status: 'success' | 'failed';
  time: string;
  type: 'video' | 'videostudio' | 'rss' | 'tmdb';
  timestamp: number;
}

interface SwipeableActivityItemProps {
  activity: Activity;
  onDelete: (id: string) => void;
}

export function SwipeableActivityItem({ activity, onDelete }: SwipeableActivityItemProps) {
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
        const maxSwipe = 150;
        const clampedDiff = Math.max(-maxSwipe, diff);
        
        setSwipeX(clampedDiff);
      }
    }
  };

  const handleTouchEnd = () => {
    // Only process swipe action if it was a horizontal swipe
    if (swipeDirection === 'horizontal') {
      const threshold = 110;
      
      // Swipe left (delete)
      if (swipeX < -threshold) {
        haptics.medium();
        onDelete(activity.id);
      }
    }
    
    // Reset state
    setIsSwiping(false);
    setSwipeDirection('none');
    setSwipeX(0);
  };

  return (
    <div
      className="relative group overflow-hidden rounded-xl"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        background: swipeX < 0 ? '#ec1e24' : 'transparent',
      }}
    >
      {/* Delete indicator - positioned in the red background area */}
      {swipeX < 0 && (
        <div
          className="absolute top-0 right-0 bottom-0 flex flex-col items-center justify-center gap-1 text-white pointer-events-none lg:hidden px-6"
          style={{
            opacity: Math.min(Math.abs(swipeX) / 60, 1),
          }}
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-xs font-medium whitespace-nowrap">Delete</span>
        </div>
      )}

      {/* Main content container */}
      <div
        onClick={() => haptics.light()}
        className="w-full flex items-center justify-between p-3 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer bg-white dark:bg-[#000000] relative"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {/* Desktop delete button - positioned at bottom right */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.medium();
            onDelete(activity.id);
          }}
          className="hidden lg:flex absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center hover:text-[#ec1e24] text-gray-600 dark:text-gray-400 z-10"
          title="Delete activity"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="flex-1 text-left">
          <p className="text-gray-900 dark:text-white">{activity.title}</p>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">{activity.platform}</p>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`px-3 py-1 rounded-full ${
              activity.status === 'success'
                ? 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]'
                : 'bg-[#FEE2E2] dark:bg-[#991B1B] text-[#991B1B] dark:text-[#FEE2E2]'
            }`}
          >
            {activity.status}
          </span>
          <span className="text-[#6B7280] dark:text-[#9CA3AF] min-w-[80px] text-right">{activity.time}</span>
        </div>
      </div>
    </div>
  );
}