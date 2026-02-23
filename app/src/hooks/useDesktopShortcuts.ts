import { useEffect, useRef } from 'react';
import { haptics } from '../utils/haptics';

interface DesktopShortcutsConfig {
  onNavigate: (page: string) => void;
  onToggleSettings: () => void;
  onToggleNotifications: () => void;
  currentPage: string;
  isSettingsOpen: boolean;
  isNotificationsOpen: boolean;
  onCloseSettings: () => void;
  onCloseNotifications: () => void;
}

const mainPages = ['dashboard', 'channels', 'platforms', 'rss', 'tmdb', 'video-studio'];

export function useDesktopShortcuts(config: DesktopShortcutsConfig) {
  const {
    onNavigate,
    onToggleSettings,
    onToggleNotifications,
    currentPage,
    isSettingsOpen,
    isNotificationsOpen,
    onCloseSettings,
    onCloseNotifications,
  } = config;

  // Track if we're on desktop (has mouse/trackpad)
  const isDesktop = useRef(true);

  useEffect(() => {
    // Detect if device has touch capability
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    isDesktop.current = !hasTouch;
  }, []);

  // Trackpad gesture detection (two-finger swipe)
  useEffect(() => {
    if (!isDesktop.current) return;

    let startX = 0;
    let startY = 0;
    let isTrackpadSwipe = false;

    const handleWheel = (e: WheelEvent) => {
      // Detect trackpad swipe (horizontal scroll with ctrlKey on some systems, or just horizontal deltaX)
      // Trackpad swipes typically have larger deltaX values and are smoother
      const isHorizontalSwipe = Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 10;
      
      if (!isHorizontalSwipe) return;

      // Don't interfere with text input or textarea scrolling
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Don't navigate when settings or notifications are open
      if (isSettingsOpen || isNotificationsOpen) {
        return;
      }

      const currentIndex = mainPages.indexOf(currentPage);
      if (currentIndex === -1) return;

      // Swipe left (negative deltaX) = next page
      if (e.deltaX < -40) {
        if (currentIndex < mainPages.length - 1) {
          e.preventDefault();
          haptics.light();
          onNavigate(mainPages[currentIndex + 1]);
        }
      }
      // Swipe right (positive deltaX) = previous page
      else if (e.deltaX > 40) {
        if (currentIndex > 0) {
          e.preventDefault();
          haptics.light();
          onNavigate(mainPages[currentIndex - 1]);
        }
      }
    };

    // Use passive: false to allow preventDefault
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [currentPage, isSettingsOpen, isNotificationsOpen, onNavigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // ESC - Close settings or notifications
      if (e.key === 'Escape') {
        if (isSettingsOpen) {
          haptics.light();
          onCloseSettings();
          e.preventDefault();
        } else if (isNotificationsOpen) {
          haptics.light();
          onCloseNotifications();
          e.preventDefault();
        }
        return;
      }

      // Cmd/Ctrl + Number keys - Direct navigation to main pages
      if (modKey && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case '1':
            haptics.light();
            onNavigate('dashboard');
            e.preventDefault();
            break;
          case '2':
            haptics.light();
            onNavigate('channels');
            e.preventDefault();
            break;
          case '3':
            haptics.light();
            onNavigate('platforms');
            e.preventDefault();
            break;
          case '4':
            haptics.light();
            onNavigate('rss');
            e.preventDefault();
            break;
          case '5':
            haptics.light();
            onNavigate('tmdb');
            e.preventDefault();
            break;
          case '6':
            haptics.light();
            onNavigate('video-studio');
            e.preventDefault();
            break;
          case ',': // Cmd/Ctrl + , for Settings (common pattern)
            haptics.light();
            onToggleSettings();
            e.preventDefault();
            break;
          case 'n': // Cmd/Ctrl + N for Notifications
          case 'N':
            haptics.light();
            onToggleNotifications();
            e.preventDefault();
            break;
          case 'l': // Cmd/Ctrl + L for Logs
          case 'L':
            haptics.light();
            onNavigate('logs');
            e.preventDefault();
            break;
          case 'u': // Cmd/Ctrl + U for Upload Manager
          case 'U':
            haptics.light();
            onNavigate('upload-manager');
            e.preventDefault();
            break;
        }
        return;
      }

      // Arrow key navigation (when not in settings/notifications)
      // Also check if user is not interacting with form elements
      if (!isSettingsOpen && !isNotificationsOpen && !modKey) {
        // Don't trigger arrow navigation when focused on interactive elements
        const activeElement = document.activeElement as HTMLElement;
        const isInteractingWithElement = 
          activeElement?.tagName === 'INPUT' || 
          activeElement?.tagName === 'TEXTAREA' || 
          activeElement?.tagName === 'SELECT' ||
          activeElement?.isContentEditable ||
          activeElement?.getAttribute('role') === 'slider';
        
        if (!isInteractingWithElement) {
          const currentIndex = mainPages.indexOf(currentPage);
          
          if (e.key === 'ArrowLeft' && currentIndex > 0) {
            haptics.light();
            onNavigate(mainPages[currentIndex - 1]);
            e.preventDefault();
          } else if (e.key === 'ArrowRight' && currentIndex < mainPages.length - 1) {
            haptics.light();
            onNavigate(mainPages[currentIndex + 1]);
            e.preventDefault();
          }
        }
      }

      // G + Key shortcuts (Gmail-style)
      // Press 'g' then another key quickly for navigation
      if (e.key === 'g' && !modKey) {
        const handleGShortcut = (ev: KeyboardEvent) => {
          if (ev.key === 'd') {
            haptics.light();
            onNavigate('dashboard');
            ev.preventDefault();
          } else if (ev.key === 'c') {
            haptics.light();
            onNavigate('channels');
            ev.preventDefault();
          } else if (ev.key === 'p') {
            haptics.light();
            onNavigate('platforms');
            ev.preventDefault();
          } else if (ev.key === 'r') {
            haptics.light();
            onNavigate('rss');
            ev.preventDefault();
          } else if (ev.key === 't') {
            haptics.light();
            onNavigate('tmdb');
            ev.preventDefault();
          } else if (ev.key === 'v') {
            haptics.light();
            onNavigate('video-studio');
            ev.preventDefault();
          } else if (ev.key === 'l') {
            haptics.light();
            onNavigate('logs');
            ev.preventDefault();
          }
          
          window.removeEventListener('keydown', handleGShortcut);
        };

        window.addEventListener('keydown', handleGShortcut, { once: true });
        
        // Remove listener after 1 second if second key not pressed
        setTimeout(() => {
          window.removeEventListener('keydown', handleGShortcut);
        }, 1000);
      }

      // ? key to show keyboard shortcuts help
      if (e.key === '?' && !modKey && !e.shiftKey) {
        haptics.light();
        onNavigate('shortcuts-help');
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    currentPage,
    isSettingsOpen,
    isNotificationsOpen,
    onNavigate,
    onToggleSettings,
    onToggleNotifications,
    onCloseSettings,
    onCloseNotifications,
  ]);
}