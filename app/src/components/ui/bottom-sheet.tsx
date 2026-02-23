"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./utils";
import { haptics } from "../../utils/haptics";
import { useBackNavigation } from "../../contexts/BackNavigationContext";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /**
   * Height mode: 
   * - 'auto': Content determines height (max 90vh)
   * - 'half': 50vh fixed height
   * - 'full': 100vh - safe area
   */
  heightMode?: 'auto' | 'half' | 'full';
  /**
   * Show drag handle at top
   */
  showHandle?: boolean;
  /**
   * Disable swipe to dismiss
   */
  disableSwipe?: boolean;
  /**
   * Custom className for sheet content
   */
  className?: string;
  /**
   * Disable backdrop click to close
   */
  disableBackdropClose?: boolean;
  /**
   * Unique ID for back navigation tracking
   */
  sheetId?: string;
}

// Physics constants
const SPRING_CONFIG = {
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

const DISMISS_THRESHOLD = 80; // pixels - easy to reach with direct tracking
const DISMISS_VELOCITY_THRESHOLD = 0.25; // pixels per ms - lower for easier fast swipes
const ELASTIC_RESISTANCE = 0.55; // Rubber band effect multiplier

export function BottomSheet({
  open,
  onOpenChange,
  children,
  heightMode = 'auto',
  showHandle = true,
  disableSwipe = false,
  className,
  disableBackdropClose = false,
  sheetId,
}: BottomSheetProps) {
  const [mounted, setMounted] = React.useState(false);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isDismissing, setIsDismissing] = React.useState(false); // Prevents snap-back during dismissal
  const [dragY, setDragY] = React.useState(0); // Display value (with elastic)
  const [rawDragY, setRawDragY] = React.useState(0); // Raw distance for threshold check
  const [startY, setStartY] = React.useState(0);
  const [startTime, setStartTime] = React.useState(0);
  const [velocity, setVelocity] = React.useState(0);
  const lastYRef = React.useRef(0);
  const lastTimeRef = React.useRef(0);
  const animationFrameRef = React.useRef<number>();

  // Generate unique ID if not provided
  const uniqueId = React.useMemo(() => sheetId || `sheet-${Date.now()}-${Math.random().toString(36).slice(2)}`, [sheetId]);

  // Keep onOpenChange ref updated for stable close handler
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  // Mount/unmount handling
  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // BackNavigationContext integration
  const { registerBottomSheetWithCloseHandler, unregisterBottomSheet } = useBackNavigation();

  // Register with context when open
  React.useEffect(() => {
    if (open) {
      // Register this sheet with the context so the back button closes it
      // The context handles priority (closing top-most sheet first)
      registerBottomSheetWithCloseHandler(uniqueId, () => {
        if (typeof onOpenChangeRef.current === 'function') {
          onOpenChangeRef.current(false);
        }
      });

      // Push history state so back button doesn't exit app immediately
      // The context's popstate listener will intercept the back press and call our close handler
      if (!window.history.state?.bottomSheetId) {
        window.history.pushState({ bottomSheetId: uniqueId }, '');
      }
    }

    return () => {
      // Clean up when closed or unmounted
      if (!open) {
        unregisterBottomSheet(uniqueId);
      }
    };
  }, [open, uniqueId, registerBottomSheetWithCloseHandler, unregisterBottomSheet]);

  // Reset dismissing state when sheet closes
  React.useEffect(() => {
    if (!open) {
      setIsDismissing(false);
      setDragY(0);
      setRawDragY(0);
      setIsDragging(false);
      setVelocity(0);
    }
  }, [open]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close handler
  const handleClose = React.useCallback(() => {
    haptics.light();
    if (typeof onOpenChange === 'function') {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  // Backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (disableBackdropClose) return;
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Touch/Mouse event handlers
  const handleDragStart = (clientY: number) => {
    if (disableSwipe) return;

    // Check if user is interacting with scrollable content
    const target = document.elementFromPoint(clientY, clientY);
    const scrollableParent = target?.closest('[data-scrollable]');

    if (scrollableParent) {
      const isScrolledToTop = scrollableParent.scrollTop <= 0;
      if (!isScrolledToTop) {
        // Don't start drag if content is scrollable and not at top
        return;
      }
    }

    setIsDragging(true);
    setStartY(clientY);
    setStartTime(Date.now());
    lastYRef.current = clientY;
    lastTimeRef.current = Date.now();
    haptics.light();
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;

    const deltaY = clientY - startY;
    const now = Date.now();
    const timeDelta = now - lastTimeRef.current;

    // Calculate velocity
    if (timeDelta > 0) {
      const vel = (clientY - lastYRef.current) / timeDelta;
      setVelocity(vel);
    }

    lastYRef.current = clientY;
    lastTimeRef.current = now;

    if (deltaY > 0) {
      // Dragging down - allow with elastic resistance
      const elasticDrag = deltaY * ELASTIC_RESISTANCE;
      setDragY(elasticDrag);
      setRawDragY(deltaY);
    } else {
      // Dragging up - high resistance (rubber band)
      const resistance = Math.abs(deltaY) * 0.2;
      setDragY(-resistance);
      setRawDragY(deltaY);
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;

    const shouldDismiss =
      rawDragY > DISMISS_THRESHOLD ||
      velocity > DISMISS_VELOCITY_THRESHOLD;

    if (shouldDismiss) {
      // Start dismissal - animate sheet fully off-screen
      setIsDismissing(true);
      // Move sheet to full screen height to ensure it's completely off-screen
      const sheetHeight = sheetRef.current?.offsetHeight || 1000;
      setDragY(sheetHeight);

      // Close after animation completes
      setTimeout(() => {
        handleClose();
      }, 350); // Match exit animation duration
    } else {
      // Snap back with spring animation
      setDragY(0);
      setRawDragY(0);
      haptics.light();
    }

    setIsDragging(false);
    setVelocity(0);
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Mouse events (for desktop testing)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientY);
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startY]);

  // Keyboard support
  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, handleClose]);

  // NOTE: Android back button is handled by BackNavigationContext
  // The sheet registers itself via registerBottomSheetWithCloseHandler when open
  // Do NOT add a separate popstate listener here - it causes double handling

  if (!mounted) return null;

  // Calculate height based on mode
  const getHeightClass = () => {
    switch (heightMode) {
      case 'half':
        return 'h-[50vh]';
      case 'full':
        return 'h-[100vh] sm:h-[calc(100vh-env(safe-area-inset-top))]';
      case 'auto':
      default:
        return 'max-h-[90vh]';
    }
  };

  // Animation states
  const getTransform = () => {
    if (!open) {
      return 'translate3d(0, 100%, 0)';
    }
    // Keep sheet in dragged position during active drag OR dismissal animation
    if (isDragging || isDismissing) {
      return `translate3d(0, ${dragY}px, 0)`;
    }
    return 'translate3d(0, 0, 0)';
  };

  const getTransition = () => {
    if (isDragging) {
      return 'none';
    }
    if (!open || isDismissing) {
      // Smooth slide-down on exit/dismissal
      return 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
    }
    // Bounce entrance animation
    return 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
  };

  const content = (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 cursor-pointer",
          open && !isDismissing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleBackdropClick}
        onTouchEnd={(e) => {
          if (disableBackdropClose) return;
          e.preventDefault();
          handleClose();
        }}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
      >
        <div
          ref={contentRef}
          className={cn(
            "bg-white dark:bg-[#000000] rounded-t-3xl pointer-events-auto will-change-transform",
            "border-t border-l border-r border-gray-200 dark:border-[#333333]",
            getHeightClass(),
            className
          )}
          style={{
            transform: getTransform(),
            transition: getTransition(),
          }}
        >
          {/* Drag Handle */}
          {showHandle && (
            <div
              className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
            >
              <div className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
            </div>
          )}

          {/* Content */}
          <div
            className={cn(
              "overflow-y-auto",
              heightMode === 'full' && 'flex flex-col',
              heightMode === 'auto' ? 'max-h-[calc(90vh-4rem)]' : 'h-[calc(100%-4rem)]'
            )}
            data-scrollable
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}

// Header component
export function BottomSheetHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // Get drag handlers from parent BottomSheet context if needed
  // For now, headers are just visual - dragging happens on the handle
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-6 pb-4 border-b border-gray-200 dark:border-[#333333]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Title component
export function BottomSheetTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      id="bottom-sheet-title"
      className={cn(
        "text-lg text-gray-900 dark:text-white",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

// Description component
export function BottomSheetDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-gray-600 dark:text-gray-400", className)}
      {...props}
    >
      {children}
    </p>
  );
}

// Footer component
export function BottomSheetFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 px-6 pt-4 pb-0 border-t border-gray-200 dark:border-[#333333] sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Close button component
export function BottomSheetClose({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "absolute top-4 right-4 rounded-full p-2 opacity-70 transition-opacity hover:opacity-100",
        "focus:outline-none focus:ring-2 focus:ring-[#ec1e24] focus:ring-offset-2",
        className
      )}
      onClick={(e) => {
        haptics.light();
        onClick?.(e);
      }}
      {...props}
    >
      <X className="w-5 h-5" />
      <span className="sr-only">Close</span>
    </button>
  );
}

// Body component (for content padding)
export function BottomSheetBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-6 py-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}