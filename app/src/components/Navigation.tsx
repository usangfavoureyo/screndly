import { LayoutDashboard, ChannelsIcon, Share2, Bell, Settings, LogOut, Rss, Film, Image, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from './ui/button';
import { useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { haptics } from '../utils/haptics';
import { useScrollDirection } from '../utils/useScrollDirection';
import brandIcon from '../assets/brand-icon.png';
import { cn } from './ui/utils';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'channels', label: 'Channels', icon: ChannelsIcon },
  { id: 'platforms', label: 'Platforms', icon: Share2 },
  { id: 'feeds', label: 'Feeds', icon: Rss },
  { id: 'design-studio', label: 'Design Studio', icon: Image },
  { id: 'video-studio', label: 'Video Studio', icon: Film },
] as const;

const TOP_BAR_AVATAR_SPRING = {
  type: 'spring' as const,
  stiffness: 540,
  damping: 32,
  mass: 0.82,
  restSpeed: 0.08,
  restDelta: 0.12,
};

const TOP_BAR_AVATAR_VARIANTS = {
  hidden: {
    y: 8,
    scale: 0.94,
  },
  visible: {
    y: 0,
    scale: 1,
  },
};

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onToggleSettings: () => void;
  onToggleNotifications: () => void;
  onLogout: () => void;
  unreadNotifications: number;
  isDesktopSidebarCollapsed: boolean;
  onToggleDesktopSidebar: () => void;
}

export function Navigation({
  currentPage,
  onNavigate,
  onToggleSettings,
  onToggleNotifications,
  onLogout,
  unreadNotifications,
  isDesktopSidebarCollapsed,
  onToggleDesktopSidebar,
}: NavigationProps) {
  const pendingPointerActivationRef = useRef<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollDirection, isNearTop } = useScrollDirection();
  const desktopSidebarWidth = isDesktopSidebarCollapsed ? '5rem' : '16rem';
  const floatingSurfaceClasses = 'border border-black/10 bg-white/90 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#050505]/88 dark:shadow-[0_16px_38px_rgba(0,0,0,0.46)]';
  const handleNavClick = (page: string) => {
    onNavigate(page);
  };

  const armPointerActivation = (activationId: string, callback: () => void) => (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch' || event.button !== 0) {
      return;
    }

    pendingPointerActivationRef.current = activationId;
    event.preventDefault();
    event.stopPropagation();
    callback();
  };

  const shouldSkipClick = (activationId: string) => {
    if (pendingPointerActivationRef.current !== activationId) {
      return false;
    }

    pendingPointerActivationRef.current = null;
    return true;
  };

  const NavContent = ({ isCollapsed, isDesktop }: { isCollapsed: boolean; isDesktop: boolean }) => (
    <>
      <div className={cn(
        'border-b border-gray-200 dark:border-[#333333]',
        isCollapsed && isDesktop ? 'px-3 py-5' : 'p-6',
      )}>
        <div className={cn('relative z-10 flex items-center', isCollapsed && isDesktop ? 'justify-center' : 'justify-between gap-3')}>
          <div className={cn(isCollapsed && isDesktop ? 'relative h-10 w-10' : 'flex items-center gap-3')}>
            <button
              type="button"
              onClick={() => {
                if (shouldSkipClick('brand-dashboard')) {
                  return;
                }

                if (!isCollapsed || !isDesktop) {
                  handleNavClick('dashboard');
                }
              }}
              onPointerUp={!isCollapsed || !isDesktop ? armPointerActivation('brand-dashboard', () => handleNavClick('dashboard')) : undefined}
              className={cn(
                'relative z-10 flex cursor-pointer items-center touch-manipulation transition-transform duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none',
                isCollapsed && isDesktop
                  ? 'h-10 w-10 justify-center opacity-100 pointer-events-none group-hover/sidebar:opacity-0'
                  : 'gap-3',
              )}
              aria-label="Go to dashboard"
            >
              <img src={brandIcon} alt="Screndly" className="h-9 w-9 rounded-md object-contain transition-transform duration-300" />
            </button>

            {isDesktop && isCollapsed && (
              <Button
                type="button"
                onClick={onToggleDesktopSidebar}
                onPointerUp={armPointerActivation('toggle-sidebar-collapsed', onToggleDesktopSidebar)}
                className={cn(
                  'absolute inset-0 z-20 hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md p-0 text-gray-600 opacity-0 transition-all duration-150 pointer-events-none group-hover/sidebar:opacity-100 group-hover/sidebar:pointer-events-auto hover:text-[#ec1e24] dark:text-[#9CA3AF] lg:inline-flex',
                )}
                size="icon"
                variant="ghost"
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-pressed={isCollapsed}
              >
                {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </Button>
            )}
          </div>

          {isDesktop && !isCollapsed && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => {
                if (shouldSkipClick('toggle-sidebar-expanded')) {
                  return;
                }

                onToggleDesktopSidebar();
              }}
              onPointerUp={armPointerActivation('toggle-sidebar-expanded', onToggleDesktopSidebar)}
              className="hidden h-10 w-10 shrink-0 items-center justify-center p-0 text-gray-600 transition-colors duration-200 hover:text-[#ec1e24] dark:text-[#9CA3AF] lg:inline-flex"
              aria-label="Collapse sidebar"
              aria-pressed={false}
            >
              <PanelLeftClose className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <nav className={cn('relative z-10 flex-1 space-y-1', isCollapsed && isDesktop ? 'px-3 py-4' : 'p-4')} aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const button = (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (shouldSkipClick(`nav-${item.id}`)) {
                  return;
                }

                handleNavClick(item.id);
              }}
              onPointerUp={armPointerActivation(`nav-${item.id}`, () => handleNavClick(item.id))}
              className={cn(
                'group relative z-10 w-full cursor-pointer overflow-hidden rounded-xl text-sm font-medium touch-manipulation transition-[background-color,color,box-shadow] duration-150 pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec1e24]/40',
                isCollapsed && isDesktop ? 'flex h-12 items-center justify-center px-0 py-0' : 'flex items-center gap-3 px-4 py-3 text-left',
                isActive
                  ? 'bg-[#ec1e24] text-white shadow-[0_10px_24px_rgba(236,30,36,0.22)]'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-[#9CA3AF] dark:hover:bg-[#1A1A1A] dark:hover:text-white',
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={isCollapsed && isDesktop ? item.label : undefined}
            >
              <Icon
                size={item.id === 'channels' ? 24 : 20}
                className={cn(
                  'shrink-0 transition-transform duration-200',
                  !isActive && 'group-hover:scale-110',
                )}
              />
              {(!isCollapsed || !isDesktop) && (
                <span className="min-w-0 truncate whitespace-nowrap">{item.label}</span>
              )}
            </button>
          );

          return <div key={item.id}>{button}</div>;
        })}
      </nav>

      <div className={cn('relative z-10 border-t border-gray-200 dark:border-[#333333]', isCollapsed && isDesktop ? 'px-3 py-4' : 'p-4')}>
        <Button
          type="button"
          onClick={onLogout}
          variant="ghost"
          className={cn(
            'cursor-pointer rounded-xl text-gray-600 transition-[background-color,color,box-shadow] duration-150 hover:bg-gray-100 hover:text-[#ec1e24] dark:text-[#9CA3AF] dark:hover:bg-[#1A1A1A]',
            isCollapsed && isDesktop ? 'h-12 w-full justify-center px-0' : 'w-full justify-start gap-3 px-4 py-3',
          )}
          aria-label={isCollapsed && isDesktop ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0 transition-transform duration-200" />
          {(!isCollapsed || !isDesktop) && <span className="truncate">Logout</span>}
        </Button>
      </div>
    </>
  );

  return (
    <>
      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 z-40 transition-transform duration-300 ease-out',
          scrollDirection === 'down' ? '-translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
        )}
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)', ['--desktop-sidebar-width' as string]: desktopSidebarWidth }}
      >
        <div className="relative h-14">
          <div
            className={cn(
              'absolute left-4 lg:hidden',
              isNearTop
                ? 'pointer-events-auto'
                : 'pointer-events-none',
            )}
          >
            <motion.button
              type="button"
              initial="hidden"
              animate={isNearTop ? 'visible' : 'hidden'}
              variants={TOP_BAR_AVATAR_VARIANTS}
              transition={prefersReducedMotion ? { duration: 0 } : TOP_BAR_AVATAR_SPRING}
              onClick={() => {
                haptics.light();
                handleNavClick('dashboard');
              }}
              className="flex items-center justify-center [backface-visibility:hidden] [transform:translateZ(0)] will-change-transform"
              aria-label="Go to dashboard"
              // Match X/Twitter's top-bar avatar reveal: compact spring rise, tiny overshoot, immediate settle.
            >
              <img src={brandIcon} alt="Screndly" className="h-10 w-10 object-contain" />
            </motion.button>
          </div>

          <div className="pointer-events-auto absolute right-4 lg:right-8">
            <div className={cn('flex items-center gap-1 rounded-full p-1', floatingSurfaceClasses)}>
              <button
                className="relative flex h-11 w-11 items-center justify-center rounded-full text-gray-900 transition-[transform,background-color,color] duration-200 hover:scale-[1.03] hover:bg-black/[0.04] active:scale-95 dark:text-white dark:hover:bg-white/[0.06]"
                onClick={() => {
                  haptics.light();
                  onToggleNotifications();
                }}
                aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
                aria-expanded={false}
              >
                <Bell className="h-[22px] w-[22px] stroke-[1.75]" aria-hidden="true" />
                {unreadNotifications > 0 && (
                  <div
                    className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ec1e24] px-1 text-[10px] font-semibold text-white"
                    aria-label={`${unreadNotifications} unread notifications`}
                  >
                    {unreadNotifications}
                  </div>
                )}
              </button>
              <button
                className="flex h-11 w-11 items-center justify-center rounded-full text-gray-900 transition-[transform,background-color,color] duration-200 hover:scale-[1.03] hover:bg-black/[0.04] active:scale-95 dark:text-white dark:hover:bg-white/[0.06]"
                onClick={() => {
                  haptics.light();
                  onToggleSettings();
                }}
                aria-label="Open settings"
                aria-expanded={false}
              >
                <Settings className="h-[22px] w-[22px] stroke-[1.75] transition-transform duration-300 hover:rotate-90" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Desktop Only (lg and above) */}
      <aside
        className="group/sidebar pointer-events-auto fixed top-0 left-0 z-[60] hidden h-full isolate flex-col border-r border-gray-200 bg-white transition-[width] duration-200 ease-in-out dark:border-[#333333] dark:bg-[#000000] lg:flex"
        style={{ width: desktopSidebarWidth }}
      >
        <NavContent isCollapsed={isDesktopSidebarCollapsed} isDesktop />
      </aside>
    </>
  );
}
