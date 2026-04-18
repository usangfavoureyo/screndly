import { useState, useRef, ReactNode } from 'react';
import { Bookmark, Check, Trash2 } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface HoverAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: (id?: string) => void;
}

interface SwipeableActivityCardProps {
  id?: string;
  onDelete: (id?: string) => void;
  onSwipeRight?: (id?: string) => void;
  children: ReactNode;
  className?: string;
  isScheduled?: boolean;
  deleteLabel?: string;
  rightSwipeLabel?: string;
  rightSwipeIcon?: ReactNode;
  selectionMode?: boolean;
  selected?: boolean;
  onEnterSelectionMode?: (id?: string) => void;
  onToggleSelection?: (id?: string) => void;
  showHoverDelete?: boolean;
  hoverActions?: HoverAction[];
}

export function SwipeableActivityCard({
  id,
  onDelete,
  onSwipeRight,
  children,
  className = '',
  isScheduled: _isScheduled = false,
  deleteLabel = 'Delete',
  rightSwipeLabel = 'Save for Later',
  rightSwipeIcon,
  selectionMode = false,
  selected = false,
  onEnterSelectionMode,
  onToggleSelection,
  showHoverDelete = true,
  hoverActions,
}: SwipeableActivityCardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const mouseSwipeActiveRef = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);

  const LONG_PRESS_MS = 450;
  const MOVE_CANCEL_THRESHOLD = 10;

  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(target.closest('button, a, input, textarea, select, [role="button"], [data-prevent-card-selection="true"]'));

  const clearLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    pressOriginRef.current = null;
  };

  const startLongPress = (clientX: number, clientY: number, target: EventTarget | null) => {
    clearLongPress();
    longPressTriggeredRef.current = false;

    if (selectionMode || !onEnterSelectionMode || isInteractiveTarget(target)) {
      return;
    }

    pressOriginRef.current = { x: clientX, y: clientY };
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      haptics.medium();
      onEnterSelectionMode(id);
    }, LONG_PRESS_MS);
  };

  const cancelLongPressOnMovement = (clientX: number, clientY: number) => {
    if (!pressOriginRef.current) return;

    const deltaX = Math.abs(clientX - pressOriginRef.current.x);
    const deltaY = Math.abs(clientY - pressOriginRef.current.y);
    if (deltaX > MOVE_CANCEL_THRESHOLD || deltaY > MOVE_CANCEL_THRESHOLD) {
      clearLongPress();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = e.touches[0].clientX;
    currentY.current = e.touches[0].clientY;
    setSwipeDirection('none');
    startLongPress(e.touches[0].clientX, e.touches[0].clientY, e.target);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    cancelLongPressOnMovement(e.touches[0].clientX, e.touches[0].clientY);

    if (selectionMode || longPressTriggeredRef.current) {
      return;
    }

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
    
    // Only handle horizontal swipe
    if (swipeDirection === 'horizontal') {
      e.stopPropagation();
      e.preventDefault(); // Prevent scrolling while swiping horizontally
      
      const diff = currentX.current - startX.current;
      const maxSwipe = 120;
      const minSwipe = onSwipeRight ? -maxSwipe : -maxSwipe;
      const maxAllowed = onSwipeRight ? maxSwipe : 0;
      const clampedDiff = Math.min(maxAllowed, Math.max(minSwipe, diff));
      setSwipeX(clampedDiff);
    }
  };

  const handleTouchEnd = () => {
    clearLongPress();

    if (selectionMode) {
      longPressTriggeredRef.current = false;
      mouseSwipeActiveRef.current = false;
      setIsSwiping(false);
      setSwipeDirection('none');
      setSwipeX(0);
      currentX.current = startX.current;
      currentY.current = startY.current;
      return;
    }

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      mouseSwipeActiveRef.current = false;
      setIsSwiping(false);
      setSwipeDirection('none');
      setSwipeX(0);
      currentX.current = startX.current;
      currentY.current = startY.current;
      return;
    }

    // Only process swipe action if it was a horizontal swipe
    if (swipeDirection === 'horizontal') {
      const threshold = 90;
      
      // Swipe left (delete)
      if (swipeX < -threshold) {
        haptics.medium();
        onDelete(id);
      } else if (swipeX > threshold && onSwipeRight) {
        haptics.medium();
        onSwipeRight(id);
      }
    }
    
    // Reset state
    mouseSwipeActiveRef.current = false;
    setIsSwiping(false);
    setSwipeDirection('none');
    setSwipeX(0);
    currentX.current = startX.current;
    currentY.current = startY.current;
  };

  const handleTouchCancel = () => {
    clearLongPress();
    mouseSwipeActiveRef.current = false;
    setIsSwiping(false);
    setSwipeDirection('none');
    setSwipeX(0);
    longPressTriggeredRef.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (selectionMode || e.button !== 0) {
      return;
    }

    startX.current = e.clientX;
    startY.current = e.clientY;
    currentX.current = e.clientX;
    currentY.current = e.clientY;
    setSwipeDirection('none');
    mouseSwipeActiveRef.current = !isInteractiveTarget(e.target);
    startLongPress(e.clientX, e.clientY, e.target);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    cancelLongPressOnMovement(e.clientX, e.clientY);

    if (selectionMode || longPressTriggeredRef.current || !mouseSwipeActiveRef.current || (e.buttons & 1) !== 1) {
      return;
    }

    currentX.current = e.clientX;
    currentY.current = e.clientY;

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
      e.preventDefault();

      const diff = currentX.current - startX.current;
      const maxSwipe = 120;
      const minSwipe = onSwipeRight ? -maxSwipe : -maxSwipe;
      const maxAllowed = onSwipeRight ? maxSwipe : 0;
      const clampedDiff = Math.min(maxAllowed, Math.max(minSwipe, diff));
      setSwipeX(clampedDiff);
    }
  };

  const handleMouseUp = () => {
    clearLongPress();
    if (mouseSwipeActiveRef.current || swipeDirection === 'horizontal') {
      if (swipeX < -90 && !selectionMode && !longPressTriggeredRef.current) {
        haptics.medium();
        onDelete(id);
      } else if (swipeX > 90 && onSwipeRight && !selectionMode && !longPressTriggeredRef.current) {
        haptics.medium();
        onSwipeRight(id);
      }
      mouseSwipeActiveRef.current = false;
      setIsSwiping(false);
      setSwipeDirection('none');
      setSwipeX(0);
      currentX.current = startX.current;
      currentY.current = startY.current;
      return;
    }
  };

  const handleMouseLeave = () => {
    clearLongPress();
    if (mouseSwipeActiveRef.current || swipeDirection === 'horizontal') {
      mouseSwipeActiveRef.current = false;
      setIsSwiping(false);
      setSwipeDirection('none');
      setSwipeX(0);
    }
  };

  const handleSelectionToggle = (e: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    haptics.light();
    onToggleSelection?.(id);
  };

  const resolvedHoverActions: HoverAction[] = hoverActions ?? (
    showHoverDelete
      ? [{
          key: 'delete',
          label: deleteLabel,
          icon: <Trash2 className="h-4 w-4" />,
          onClick: onDelete,
        }]
      : []
  );

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Swipe background actions */}
      <div className={`absolute inset-0 flex items-center justify-between rounded-2xl ${selectionMode ? 'hidden' : ''}`}>
        <div className="h-full flex-1 rounded-l-2xl bg-[#16a34a]">
          <div
            className="flex h-full items-center justify-center px-6 text-white transition-opacity"
            style={{
              opacity: swipeX > 0 ? 1 : 0,
              width: '120px',
            }}
          >
            <div className="flex flex-col items-center gap-1">
              {rightSwipeIcon || <Bookmark className="w-5 h-5" />}
              <span className="text-xs whitespace-nowrap">{rightSwipeLabel}</span>
            </div>
          </div>
        </div>
        <div className="h-full flex-1 rounded-r-2xl bg-[#ec1e24]">
          <div
            className="ml-auto flex h-full items-center justify-center px-6 text-white transition-opacity"
            style={{
              opacity: swipeX < 0 ? 1 : 0,
              width: '120px',
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <Trash2 className="w-5 h-5" />
              <span className="text-xs whitespace-nowrap">{deleteLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div
        className={`${className} group relative select-none ${selected ? 'ring-2 ring-[#ec1e24] bg-[#ec1e24]/5' : selectionMode ? 'ring-1 ring-[#ec1e24]/30' : ''}`}
        style={{
          transform: `translateX(${selectionMode ? 0 : swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {!selectionMode && hoverActions && resolvedHoverActions.length > 0 ? (
          <div className="absolute right-3 top-3 z-10 hidden items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 lg:flex">
            {resolvedHoverActions.map((action) => (
              <button
                key={action.key}
                type="button"
                aria-label={action.label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/95 p-0 text-gray-600 transition-colors hover:text-[#ec1e24] dark:border-[#333333] dark:bg-[#050505]/95 dark:text-[#9CA3AF] dark:hover:text-[#ec1e24]"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  haptics.medium();
                  action.onClick(id);
                }}
              >
                {action.icon}
              </button>
            ))}
          </div>
        ) : null}
        {!selectionMode && !hoverActions && showHoverDelete && (
          <button
            type="button"
            aria-label={deleteLabel}
            className="absolute right-14 top-12 z-10 hidden h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/95 p-0 text-gray-600 opacity-0 transition-opacity hover:text-[#ec1e24] group-hover:opacity-100 dark:border-[#333333] dark:bg-[#050505]/95 dark:text-[#9CA3AF] dark:hover:text-[#ec1e24] lg:flex"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              haptics.medium();
              onDelete(id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {selectionMode && (
          <button
            type="button"
            aria-label={selected ? 'Unselect card' : 'Select card'}
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
        {children}
      </div>
    </div>
  );
}
