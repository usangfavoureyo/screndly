import { useEffect, useRef } from 'react';

interface UseSwipeNavigationProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  minSwipeDistance?: number;
  increasedMinSwipeDistance?: number;
  disableOnScrollable?: boolean;
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 100, // Increased from 50 to 100 for less sensitivity
  increasedMinSwipeDistance,
  disableOnScrollable = true,
}: UseSwipeNavigationProps) {
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchStartElement = useRef<HTMLElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchEndX.current = null;
      touchEndY.current = null;
      touchStartElement.current = e.target as HTMLElement;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndX.current = e.touches[0].clientX;
      touchEndY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = () => {
      if (!touchStartX.current || !touchEndX.current || !touchStartElement.current) return;
      if (!touchStartY.current || !touchEndY.current) return;

      // Check if touch started on an interactive form element
      const element = touchStartElement.current;
      const tagName = element.tagName.toLowerCase();
      const isInteractiveElement = 
        tagName === 'input' || 
        tagName === 'textarea' || 
        tagName === 'select' || 
        tagName === 'button' ||
        element.closest('input') !== null ||
        element.closest('textarea') !== null ||
        element.closest('select') !== null;
      
      if (isInteractiveElement) {
        touchStartX.current = null;
        touchEndX.current = null;
        touchStartY.current = null;
        touchEndY.current = null;
        touchStartElement.current = null;
        return; // Don't trigger page swipe on interactive form elements
      }

      // Check if the touch started on a scrollable element
      if (disableOnScrollable) {
        let element: HTMLElement | null = touchStartElement.current;
        while (element) {
          const style = window.getComputedStyle(element);
          const overflowX = style.overflowX;
          
          // If element has horizontal scroll and content is wider than container
          if ((overflowX === 'auto' || overflowX === 'scroll') && element.scrollWidth > element.clientWidth) {
            touchStartX.current = null;
            touchEndX.current = null;
            touchStartY.current = null;
            touchEndY.current = null;
            touchStartElement.current = null;
            return; // Don't trigger page swipe on scrollable elements
          }
          
          element = element.parentElement;
        }
      }

      const distanceX = touchStartX.current - touchEndX.current;
      const distanceY = Math.abs(touchStartY.current - touchEndY.current);
      const effectiveMinDistance = increasedMinSwipeDistance || minSwipeDistance;
      
      // Only trigger swipe if horizontal movement is much greater than vertical
      // This prevents accidental swipes while scrolling vertically
      const isHorizontalSwipe = Math.abs(distanceX) > distanceY * 2;
      
      if (isHorizontalSwipe) {
        const isLeftSwipe = distanceX > effectiveMinDistance;
        const isRightSwipe = distanceX < -effectiveMinDistance;

        if (isLeftSwipe) {
          onSwipeLeft();
        } else if (isRightSwipe) {
          onSwipeRight();
        }
      }

      touchStartX.current = null;
      touchEndX.current = null;
      touchStartY.current = null;
      touchEndY.current = null;
      touchStartElement.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, minSwipeDistance, increasedMinSwipeDistance, disableOnScrollable]);
}