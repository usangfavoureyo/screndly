import { LayoutDashboard, ChannelsIcon, Share2, Rss, Film, GripVertical, Image } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { useScrollDirection } from '../utils/useScrollDirection';
import { useState, useEffect, useRef } from 'react';

interface MobileBottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

interface NavItem {
  id: string;
  icon: any;
  label: string;
}

export function MobileBottomNav({ currentPage, onNavigate, onDragStateChange }: MobileBottomNavProps) {
  const defaultNavItems: NavItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'channels', icon: ChannelsIcon, label: 'Channels' },
    { id: 'platforms', icon: Share2, label: 'Platforms' },
    { id: 'feeds', icon: Rss, label: 'Feeds' },
    { id: 'design-studio', icon: Image, label: 'Design Studio' },
    { id: 'video-studio', icon: Film, label: 'Video Studio' },
  ];

  const reconcileNavItems = (orderIds: string[]): NavItem[] => {
    const seen = new Set<string>();
    const orderedItems = orderIds
      .map((id) => defaultNavItems.find((item) => item.id === id))
      .filter((item): item is NavItem => Boolean(item))
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

    const missingItems = defaultNavItems.filter((item) => !seen.has(item.id));
    return [...orderedItems, ...missingItems];
  };

  // Load saved order from localStorage or use default
  const [navItems, setNavItems] = useState<NavItem[]>(() => {
    const savedOrder = localStorage.getItem('bottomNavOrder');
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        if (Array.isArray(orderIds)) {
          return reconcileNavItems(orderIds);
        }
      } catch {
        return [...defaultNavItems];
      }
    }
    return [...defaultNavItems];
  });

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Save order to localStorage whenever it changes (debounced to avoid blocking)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const orderIds = navItems.map(item => item.id);
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          localStorage.setItem('bottomNavOrder', JSON.stringify(orderIds));
        });
      } else {
        localStorage.setItem('bottomNavOrder', JSON.stringify(orderIds));
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [navItems]);

  const handleNavigation = (pageId: string) => {
    // Don't navigate if we're in drag mode
    if (isDragging) return;

    haptics.light();

    // If clicking the already active page, scroll to top
    if (currentPage === pageId) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      onNavigate(pageId);
    }
  };

  // Long press handlers
  const handleTouchStart = (index: number) => {
    if (isDragging) return;

    longPressTimerRef.current = setTimeout(() => {
      haptics.medium();
      setIsDragging(true);
      setDraggedIndex(index);
      if (onDragStateChange) {
        onDragStateChange(true);
      }
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isDragging && draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      // Perform the reorder
      const newItems = [...navItems];
      const [draggedItem] = newItems.splice(draggedIndex, 1);
      newItems.splice(dragOverIndex, 0, draggedItem);
      setNavItems(newItems);
      haptics.success();
    }

    setIsDragging(false);
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (onDragStateChange) {
      onDragStateChange(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || draggedIndex === null) return;

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    if (element) {
      const navButton = element.closest('[data-nav-index]');
      if (navButton) {
        const index = parseInt(navButton.getAttribute('data-nav-index') || '0');
        if (index !== dragOverIndex) {
          setDragOverIndex(index);
          haptics.light();
        }
      }
    }
  };

  const { scrollDirection } = useScrollDirection();

  return (
    <nav
      className={`lg:hidden fixed left-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 overflow-hidden rounded-[999px] border border-black/10 bg-white/90 shadow-[0_22px_46px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-transform duration-300 dark:border-white/10 dark:bg-[#050505]/88 dark:shadow-[0_22px_50px_rgba(0,0,0,0.54)] ${scrollDirection === 'down' ? 'translate-y-[calc(100%+1.75rem)]' : 'translate-y-0'
        }`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.9rem)' }}
      aria-label="Main navigation"
      role="navigation"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Drag mode indicator */}
      {isDragging && (
        <div className="absolute top-0 left-0 right-0 bg-[#ec1e24] text-white text-center py-1 text-xs animate-pulse">
          Drag to reorder • Release to save
        </div>
      )}

      <div className={`flex items-center justify-between px-2 ${isDragging ? 'pt-6 pb-2.5' : 'py-2.5'}`}>
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const isBeingDragged = isDragging && draggedIndex === index;
          const isDragOver = isDragging && dragOverIndex === index && draggedIndex !== index;

          return (
            <button
              key={item.id}
              data-nav-index={index}
              onClick={() => handleNavigation(item.id)}
              onTouchStart={() => handleTouchStart(index)}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 transition-all duration-300 hover:scale-[1.03] active:scale-95 ${isActive ? 'transform -translate-y-1' : ''
                } ${isBeingDragged ? 'opacity-50 scale-110 z-50' : ''
                } ${isDragOver ? 'scale-90 opacity-70' : ''
                }`}
              aria-label={`Navigate to ${item.label}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Drag handle indicator (shows during drag mode) */}
              {isDragging && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </div>
              )}

              <Icon
                size={item.id === 'channels' ? 32 : 28}
                className={`stroke-1 shrink-0 transition-all duration-300 ${isActive
                  ? 'text-[#ec1e24]'
                  : 'text-gray-700 dark:text-gray-200'
                  } ${isBeingDragged ? 'animate-bounce' : ''
                  }`}
                aria-hidden="true"
              />

              {/* Visual indicator for drag position */}
              {isDragOver && draggedIndex !== null && draggedIndex < index && (
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#ec1e24] rounded-full" />
              )}
              {isDragOver && draggedIndex !== null && draggedIndex > index && (
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#ec1e24] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
