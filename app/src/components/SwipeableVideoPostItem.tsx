import { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface VideoPost {
  id: string;
  title: string;
  platform: string;
  time: string;
  timestamp: number;
}

interface SwipeableVideoPostItemProps {
  post: VideoPost;
  onDelete: (id: string) => void;
}

export function SwipeableVideoPostItem({ post, onDelete }: SwipeableVideoPostItemProps) {
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
        onDelete(post.id);
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
          className="flex flex-col items-center justify-center gap-1 text-white pointer-events-none lg:hidden absolute inset-y-0 right-0"
          style={{
            width: `${Math.abs(swipeX)}px`,
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
        className="flex items-center gap-4 p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] hover:border-[#ec1e24] dark:hover:border-[#ec1e24] transition-all cursor-pointer relative"
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
            onDelete(post.id);
          }}
          className="hidden lg:flex absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center hover:text-[#ec1e24] text-gray-600 dark:text-gray-400 z-10"
          title="Delete post"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="w-2 h-2 rounded-full bg-black dark:bg-white"></div>
        <div className="flex-1">
          <p className="text-gray-900 dark:text-white mb-1">{post.title}</p>
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-[#9CA3AF]">
            <span>{post.platform}</span>
            <span>•</span>
            <span>{post.time}</span>
          </div>
        </div>
      </div>
    </div>
  );
}