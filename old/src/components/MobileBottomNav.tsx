import { LayoutDashboard, Youtube, Share2, Rss, Film, GripVertical, Image } from 'lucide-react';
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
    { id: 'channels', icon: Youtube, label: 'Channels' },
    { id: 'platforms', icon: Share2, label: 'Platforms' },
    { id: 'feeds', icon: Rss, label: 'Feeds' },
    { id: 'design-studio', icon: Image, label: 'Design Studio' },
    { id: 'video-studio', icon: Film, label: 'Video Studio' },
  ];

  // Load saved order from localStorage or use default
  const [navItems, setNavItems] = useState<NavItem[]>(() => {
    const savedOrder = localStorage.getItem('bottomNavOrder');
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        // Map saved IDs to nav items
        return orderIds.map((id: string) =>
          defaultNavItems.find(item => item.id === id)
        ).filter(Boolean);
      } catch {
        return defaultNavItems;
      }
    }
    return defaultNavItems;
  });

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [longPressedIndex, setLongPressedIndex] = useState<number | null>(null);

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
      setLongPressedIndex(index);
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
    setLongPressedIndex(null);
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

  const scrollDirection = useScrollDirection();

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#000000] opacity-100 border-t border-gray-200 dark:border-[#333333] z-50 transition-transform duration-300 shadow-none ring-0 backdrop-blur-none overflow-hidden ${scrollDirection === 'down' ? 'translate-y-full' : 'translate-y-0'
        }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
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

      <div className={`flex items-center justify-around ${isDragging ? 'pt-6 pb-3' : 'py-3'}`}>
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
              className={`relative flex flex-col items-center justify-center p-2 transition-all duration-300 hover:scale-110 active:scale-95 ${isActive ? 'transform -translate-y-1' : ''
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
                className={`w-7 h-7 stroke-1 transition-all duration-300 ${isActive
                  ? 'text-[#ec1e24]'
                  : 'text-black dark:text-white'
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