import { LayoutDashboard, Share2, Bell, Settings, LogOut, Rss, Film, Image, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from './ui/button';
import { useRef } from 'react';
import { haptics } from '../utils/haptics';
import { useScrollDirection } from '../utils/useScrollDirection';
import brandIcon from '../assets/brand-icon.png';
import { cn } from './ui/utils';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'connections', label: 'Connections', icon: Share2 },
  { id: 'feeds', label: 'Feeds', icon: Rss },
  { id: 'design-studio', label: 'Design Studio', icon: Image },
  { id: 'video-studio', label: 'Video Studio', icon: Film },
] as const;

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
  const { scrollDirection, isNearTop } = useScrollDirection();
  const desktopSidebarWidth = isDesktopSidebarCollapsed ? '5rem' : '16rem';
  const floatingSurfaceClasses = 'border border-black/10 bg-white/90 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#050505]/88 dark:shadow-[0_16px_38px_rgba(0,0,0,0.46)]';
  const handleNavClick = (page: string) => {
    onNavigate(page);
  };
  const navigateToLandingPage = () => {
    haptics.light();
    window.location.href = '/';
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
        isCollapsed && isDesktop ? 'px-3 py-4' : 'px-4 py-4',
      )}>
        <div className="relative z-10 h-10">
          <div className="relative h-10">
            <button
              type="button"
              onClick={() => {
                if (shouldSkipClick('brand-dashboard')) {
                  return;
                }

                navigateToLandingPage();
              }}
              onPointerUp={!isCollapsed || !isDesktop ? armPointerActivation('brand-dashboard', navigateToLandingPage) : undefined}
              className={cn(
                'absolute top-0 z-10 flex h-10 w-10 cursor-pointer items-center justify-center touch-manipulation transition-[left,transform,opacity] duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none',
                isCollapsed && isDesktop
                  ? 'left-1/2 -translate-x-1/2 opacity-100 pointer-events-none group-hover/sidebar:opacity-0'
                  : 'left-0 translate-x-0 opacity-100',
              )}
              aria-label="Go to landing page"
            >
              <img src={brandIcon} alt="Screndly" className="h-9 w-9 rounded-md object-contain transition-transform duration-300" />
            </button>

            {isDesktop && isCollapsed && (
              <Button
                type="button"
                onClick={onToggleDesktopSidebar}
                onPointerUp={armPointerActivation('toggle-sidebar-collapsed', onToggleDesktopSidebar)}
                className={cn(
                  'absolute left-1/2 top-0 z-20 hidden h-10 w-10 -translate-x-1/2 shrink-0 cursor-pointer items-center justify-center rounded-md p-0 text-gray-600 opacity-0 transition-[opacity,color,transform] duration-150 pointer-events-none group-hover/sidebar:opacity-100 group-hover/sidebar:pointer-events-auto hover:text-[#ec1e24] dark:text-[#9CA3AF] lg:inline-flex',
                )}
                size="icon"
                variant="ghost"
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-pressed={isCollapsed}
              >
                {isCollapsed ? <PanelLeftOpen size={22} /> : <PanelLeftClose size={22} />}
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
              className="absolute right-0 top-0 hidden h-10 w-10 shrink-0 items-center justify-center p-0 text-gray-600 opacity-0 transition-[color,opacity] duration-150 pointer-events-none group-hover/sidebar:opacity-100 group-hover/sidebar:pointer-events-auto hover:text-[#ec1e24] dark:text-[#9CA3AF] lg:inline-flex"
              aria-label="Collapse sidebar"
              aria-pressed={false}
            >
              <PanelLeftClose size={22} />
            </Button>
          )}
        </div>
      </div>

      <nav className={cn('relative z-10 flex-1 space-y-1 px-3 py-4', !isCollapsed || !isDesktop ? 'sm:px-4' : '')} aria-label="Primary navigation">
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
                'group relative z-10 h-12 w-full cursor-pointer overflow-hidden rounded-xl text-sm font-medium touch-manipulation transition-[background-color,color,box-shadow] duration-150 pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec1e24]/40',
                isActive
                  ? 'bg-[#ec1e24] text-white shadow-[0_10px_24px_rgba(236,30,36,0.22)]'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-[#9CA3AF] dark:hover:bg-[#1A1A1A] dark:hover:text-white',
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={isCollapsed && isDesktop ? item.label : undefined}
            >
              <span
                className={cn(
                  'absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center transition-[left,transform] duration-200',
                  isCollapsed && isDesktop ? 'left-1/2 -translate-x-1/2' : 'left-3 translate-x-0',
                )}
              >
                <Icon
                  size={22}
                  className={cn(
                    'shrink-0 transition-transform duration-200',
                    !isActive && 'group-hover:scale-110',
                  )}
                />
              </span>
              <span
                aria-hidden={isCollapsed && isDesktop}
                className={cn(
                  'absolute right-3 top-1/2 min-w-0 -translate-y-1/2 truncate text-left transition-[left,opacity,transform] duration-200',
                  isCollapsed && isDesktop
                    ? 'pointer-events-none left-[calc(50%+0.75rem)] translate-x-2 opacity-0'
                    : 'left-11 translate-x-0 opacity-100',
                )}
              >
                {item.label}
              </span>
            </button>
          );

          return <div key={item.id}>{button}</div>;
        })}
      </nav>

      <div className={cn('relative z-10 border-t border-gray-200 px-3 py-4 dark:border-[#333333]', !isCollapsed || !isDesktop ? 'sm:px-4' : '')}>
        <Button
          type="button"
          onClick={onLogout}
          variant="ghost"
          className={cn(
            'relative h-12 w-full cursor-pointer overflow-hidden rounded-xl text-gray-600 transition-[background-color,color,box-shadow] duration-150 hover:bg-gray-100 hover:text-[#ec1e24] dark:text-[#9CA3AF] dark:hover:bg-[#1A1A1A]',
          )}
          aria-label={isCollapsed && isDesktop ? 'Logout' : undefined}
        >
          <span
            className={cn(
              'absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center transition-[left,transform] duration-200',
              isCollapsed && isDesktop ? 'left-1/2 -translate-x-1/2' : 'left-3 translate-x-0',
            )}
          >
            <LogOut className="h-[22px] w-[22px] shrink-0 transition-transform duration-200" />
          </span>
          <span
            aria-hidden={isCollapsed && isDesktop}
            className={cn(
              'absolute right-3 top-1/2 min-w-0 -translate-y-1/2 truncate text-left transition-[left,opacity,transform] duration-200',
              isCollapsed && isDesktop
                ? 'pointer-events-none left-[calc(50%+0.75rem)] translate-x-2 opacity-0'
                : 'left-11 translate-x-0 opacity-100',
            )}
          >
            Logout
          </span>
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
          {isNearTop && (
            <div className="pointer-events-auto absolute left-4 lg:hidden">
              <button
                type="button"
                onClick={() => {
                  navigateToLandingPage();
                }}
                className="flex items-center justify-center transition-transform duration-200 hover:scale-[1.03] active:scale-95"
                aria-label="Go to landing page"
              >
                <img src={brandIcon} alt="Screndly" className="h-10 w-10 object-contain" />
              </button>
            </div>
          )}

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
        className="group/sidebar pointer-events-auto fixed top-0 left-0 z-[60] hidden h-full isolate flex-col overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200 ease-in-out dark:border-[#333333] dark:bg-[#000000] lg:flex"
        style={{ width: desktopSidebarWidth }}
      >
        <NavContent isCollapsed={isDesktopSidebarCollapsed} isDesktop />
      </aside>
    </>
  );
}
