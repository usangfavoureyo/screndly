import { useRef, useState } from 'react';
import {
  Trash2,
  Check,
  CheckCheck,
  AlertCircle,
  Settings as SettingsIcon,
  Film,
  Rss,
} from 'lucide-react';
import { haptics } from '../utils/haptics';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  source?:
    | 'tmdb'
    | 'rss'
    | 'upload'
    | 'videostudio'
    | 'system'
    | 'design_studio'
    | 'youtube'
    | 'comment';
  actions?: any[];
}

interface SwipeableNotificationCardProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onActionClick?: (notificationId: string, actionType: string, e: React.MouseEvent) => void;
  onOpen?: (notification: Notification) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onEnterSelectionMode?: (id?: string) => void;
  onToggleSelection?: (id?: string) => void;
}

export function SwipeableNotificationCard({
  notification,
  onMarkAsRead,
  onDelete,
  onActionClick,
  onOpen,
  selectionMode = false,
  selected = false,
  onEnterSelectionMode,
  onToggleSelection,
}: SwipeableNotificationCardProps) {
  const touchSwipeEnabled = true;
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const swipeXRef = useRef(0);
  const swipeDirectionRef = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const hasDraggedRef = useRef(false);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);

  const LONG_PRESS_MS = 450;
  const MOVE_CANCEL_THRESHOLD = 10;

  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(
      target.closest(
        'button, a, input, textarea, select, [role="button"], [data-prevent-card-selection="true"]',
      ),
    );

  const clearLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    pressOriginRef.current = null;
  };

  const resetSwipeState = () => {
    swipeDirectionRef.current = 'none';
    swipeXRef.current = 0;
    setIsSwiping(false);
    setSwipeDirection('none');
    setSwipeX(0);
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
      onEnterSelectionMode(notification.id);
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
    if (!touchSwipeEnabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = e.touches[0].clientX;
    currentY.current = e.touches[0].clientY;
    swipeDirectionRef.current = 'none';
    swipeXRef.current = 0;
    hasDraggedRef.current = false;
    setSwipeDirection('none');
    startLongPress(e.touches[0].clientX, e.touches[0].clientY, e.target);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchSwipeEnabled) return;

    cancelLongPressOnMovement(e.touches[0].clientX, e.touches[0].clientY);

    if (selectionMode || longPressTriggeredRef.current) {
      return;
    }

    currentX.current = e.touches[0].clientX;
    currentY.current = e.touches[0].clientY;

    const deltaX = currentX.current - startX.current;
    const deltaY = currentY.current - startY.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaX > 6 || absDeltaY > 6) {
      hasDraggedRef.current = true;
    }

    if (swipeDirectionRef.current === 'none') {
      if (absDeltaY >= 10 && absDeltaY > absDeltaX) {
        swipeDirectionRef.current = 'vertical';
        setSwipeDirection('vertical');
        return;
      }

      if (absDeltaX >= 24 && absDeltaX > absDeltaY * 2) {
        swipeDirectionRef.current = 'horizontal';
        setSwipeDirection('horizontal');
        setIsSwiping(true);
      } else {
        return;
      }
    }

    if (swipeDirectionRef.current === 'horizontal') {
      e.stopPropagation();
      e.preventDefault();

      const maxSwipe = 120;
      const clampedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));

      swipeXRef.current = clampedDiff;
      setSwipeX(clampedDiff);
    }
  };

  const handleTouchEnd = () => {
    if (!touchSwipeEnabled) return;

    clearLongPress();

    if (selectionMode || longPressTriggeredRef.current) {
      resetSwipeState();
      longPressTriggeredRef.current = false;
      currentX.current = startX.current;
      currentY.current = startY.current;
      return;
    }

    if (swipeDirectionRef.current === 'horizontal') {
      const threshold = 90;

      if (swipeXRef.current < -threshold) {
        haptics.medium();
        onDelete(notification.id);
      } else if (swipeXRef.current > threshold) {
        haptics.medium();
        if (!notification.read) {
          onMarkAsRead(notification.id);
        }
      }
    }

    resetSwipeState();
    currentX.current = startX.current;
    currentY.current = startY.current;
  };

  const handleTouchCancel = () => {
    clearLongPress();
    resetSwipeState();
    longPressTriggeredRef.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startLongPress(e.clientX, e.clientY, e.target);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    cancelLongPressOnMovement(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    clearLongPress();
  };

  const handleMouseLeave = () => {
    clearLongPress();
  };

  const handleSelectionToggle = (
    e: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    haptics.light();
    onToggleSelection?.(notification.id);
  };

  const handleClick = () => {
    if (selectionMode || longPressTriggeredRef.current) {
      return;
    }

    if (!hasDraggedRef.current && Math.abs(swipeXRef.current) < 5) {
      if (!notification.read) {
        onMarkAsRead(notification.id);
      }
      onOpen?.(notification);
    }
  };

  const getIcon = (currentNotification: Notification) => {
    if (currentNotification.source === 'rss' || currentNotification.source === 'tmdb') {
      return <Rss className="w-5 h-5 text-[#ec1e24]" />;
    }

    if (currentNotification.source === 'videostudio') {
      return <Film className="w-5 h-5 text-[#ec1e24]" />;
    }

    switch (currentNotification.type) {
      case 'success':
        return <CheckCheck className="w-5 h-5 text-[#ec1e24]" />;
      case 'error':
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-[#ec1e24]" />;
      default:
        return <SettingsIcon className="w-5 h-5 text-[#ec1e24]" />;
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className={`absolute inset-0 flex ${selectionMode ? 'hidden' : ''}`}>
        <div
          className="flex items-center justify-start px-6 bg-[#f3f4f6] dark:bg-[#1a1a1a] text-gray-700 dark:text-white transition-opacity"
          style={{
            opacity: swipeX > 0 ? 1 : 0,
            width: '120px',
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <Check className="w-5 h-5" />
            <span className="text-xs whitespace-nowrap">Mark as Read</span>
          </div>
        </div>

        <div className="flex-1" />

        <div
          className="flex items-center justify-end px-6 bg-[#ec1e24] text-white transition-opacity"
          style={{
            opacity: swipeX < 0 ? 1 : 0,
            width: '120px',
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <Trash2 className="w-5 h-5" />
            <span className="text-xs whitespace-nowrap">Delete</span>
          </div>
        </div>
      </div>

      <div
        className={`relative w-full rounded-lg border p-4 text-left shadow-sm transition-shadow select-none group touch-pan-y dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] ${
          selected
            ? 'border-[#ec1e24]/40 bg-[#ec1e24]/5 ring-2 ring-[#ec1e24]'
            : selectionMode
              ? 'bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] ring-1 ring-[#ec1e24]/30'
              : notification.read
                ? 'bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]'
                : 'bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] !border-l-4 !border-l-[#ec1e24]'
        }`}
        style={{
          transform: `translateX(${selectionMode ? 0 : swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={touchSwipeEnabled ? handleTouchStart : undefined}
        onTouchMove={touchSwipeEnabled ? handleTouchMove : undefined}
        onTouchEnd={touchSwipeEnabled ? handleTouchEnd : undefined}
        onTouchCancel={touchSwipeEnabled ? handleTouchCancel : undefined}
        onClick={handleClick}
      >
        {selectionMode && (
          <button
            type="button"
            aria-label={selected ? 'Unselect notification' : 'Select notification'}
            aria-pressed={selected}
            data-prevent-card-selection="true"
            className="absolute right-3 top-3 z-10"
            onClick={handleSelectionToggle}
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                selected
                  ? 'border-[#ec1e24] bg-[#ec1e24] text-white'
                  : 'border-gray-300 bg-white/95 text-transparent dark:border-[#333333] dark:bg-[#050505]/95'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
            </div>
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.medium();
            onDelete(notification.id);
          }}
          data-prevent-card-selection="true"
          className={`absolute bottom-4 right-4 items-center justify-center text-gray-600 transition-opacity hover:text-[#ec1e24] dark:text-gray-400 ${
            selectionMode ? 'hidden' : 'hidden lg:flex opacity-0 group-hover:opacity-100'
          }`}
          title="Delete notification"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="flex gap-3">
          <div className="mt-0.5 flex-shrink-0">{getIcon(notification)}</div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex items-start justify-between gap-2">
              <h4
                className={`text-sm ${
                  notification.read ? 'text-gray-600 dark:text-[#9CA3AF]' : 'text-gray-900 dark:text-white'
                }`}
              >
                {notification.title}
              </h4>
              {!notification.read && (
                <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#ec1e24]"></div>
              )}
            </div>
            <p className="mb-2 text-xs text-[#9CA3AF]">{notification.message}</p>
            <p className="text-xs text-[#6B7280]">{notification.timestamp}</p>
            {!selectionMode && notification.actions && (
              <div className="mt-2 flex gap-2">
                {notification.actions.map((action) => (
                  <button
                    key={action.id}
                    data-prevent-card-selection="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionClick?.(notification.id, action.type, e);
                    }}
                    className="text-xs text-[#ec1e24] hover:text-[#ec1e24]/80"
                  >
                    {action.icon ? <action.icon className="w-4 h-4" /> : action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
