import { LayoutDashboard, Youtube, Share2, Bell, Settings, LogOut, Rss, Film, Image, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import { haptics } from '../utils/haptics';
import { useScrollDirection } from '../utils/useScrollDirection';
import brandIcon from '../assets/brand-icon.png';
import { cn } from './ui/utils';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'channels', label: 'Channels', icon: Youtube },
  { id: 'platforms', label: 'Platforms', icon: Share2 },
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarHovered, setIsDesktopSidebarHovered] = useState(false);
  const scrollDirection = useScrollDirection();
  const desktopSidebarWidth = isDesktopSidebarCollapsed ? '5rem' : '16rem';

  const handleNavClick = (page: string) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  const NavContent = ({ isCollapsed, isDesktop }: { isCollapsed: boolean; isDesktop: boolean }) => (
    <>
      <div className={cn(
        'border-b border-gray-200 dark:border-[#333333]',
        isCollapsed && isDesktop ? 'px-3 py-5' : 'p-6',
      )}>
        <div className={cn('flex items-center', isCollapsed && isDesktop ? 'justify-center' : 'justify-between gap-3')}>
          <div className={cn('relative flex items-center', isCollapsed && isDesktop ? 'justify-center' : 'gap-3')}>
            <button
              onClick={() => handleNavClick('dashboard')}
              className={cn(
                'cursor-pointer flex items-center transition-transform duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none',
                isCollapsed && isDesktop ? 'justify-center' : 'gap-3',
                isDesktop && isDesktopSidebarHovered && 'opacity-0 pointer-events-none',
              )}
              aria-label="Go to dashboard"
            >
              <img src={brandIcon} alt="Screndly" className="h-10 w-10 rounded-md object-contain transition-transform duration-300" />
            </button>

            {isDesktop && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={onToggleDesktopSidebar}
                className={cn(
                  'absolute inset-0 hidden h-10 w-10 items-center justify-center p-0 text-gray-600 opacity-0 transition-all duration-200 hover:text-[#ec1e24] dark:text-[#9CA3AF] lg:flex',
                  isDesktopSidebarHovered && 'opacity-100',
                )}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-pressed={isCollapsed}
              >
                {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </Button>
            )}
          </div>

          {isDesktop && !isCollapsed && <div className="h-10 w-10 shrink-0" aria-hidden="true" />}
        </div>
      </div>

      <nav className={cn('flex-1 space-y-1', isCollapsed && isDesktop ? 'px-3 py-4' : 'p-4')} aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const button = (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
                  handleNavClick(item.id);
                }
              }}
              className={cn(
                'group relative cursor-pointer w-full overflow-hidden rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec1e24]/40',
                isCollapsed && isDesktop ? 'flex h-12 items-center justify-center px-0 py-0' : 'flex items-center gap-3 px-4 py-3 text-left',
                isActive
                  ? 'bg-[#ec1e24] text-white shadow-[0_10px_24px_rgba(236,30,36,0.22)]'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-[#9CA3AF] dark:hover:bg-[#1A1A1A] dark:hover:text-white',
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={isCollapsed && isDesktop ? item.label : undefined}
            >
              <Icon className={cn('h-5 w-5 shrink-0 transition-transform duration-200', !isActive && 'group-hover:scale-110')} />
              {(!isCollapsed || !isDesktop) && (
                <span className="min-w-0 truncate whitespace-nowrap">{item.label}</span>
              )}
            </button>
          );

          return <div key={item.id}>{button}</div>;
        })}
      </nav>

      <div className={cn('border-t border-gray-200 dark:border-[#333333]', isCollapsed && isDesktop ? 'px-3 py-4' : 'p-4')}>
        <Button
          type="button"
          onClick={onLogout}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
              onLogout();
            }
          }}
          variant="ghost"
          className={cn(
            'cursor-pointer rounded-xl text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:text-[#ec1e24] dark:text-[#9CA3AF] dark:hover:bg-[#1A1A1A]',
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
      {/* Desktop/Mobile Header */}
      <div
        className={`fixed left-0 right-0 h-16 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] z-40 flex items-center justify-between px-4 transition-[padding,transform] duration-200 ease-in-out lg:pl-[var(--desktop-sidebar-width)] ${scrollDirection === 'down' ? '-translate-y-full' : 'translate-y-0'
          }`}
        style={{ top: 0, ["--desktop-sidebar-width" as string]: desktopSidebarWidth }}
      >
        {/* Logo on mobile/tablet, sidebar on desktop */}
        <div className="flex items-center lg:flex-1">
          <img src={brandIcon} alt="Screndly" className="w-8 h-8 lg:hidden rounded-sm object-contain" />
        </div>

        <div className="flex items-center gap-2">
          <button
            className="text-gray-900 dark:text-white p-1 relative transition-all duration-300 hover:scale-110 active:scale-95 hover:text-[#ec1e24]"
            onClick={() => {
              haptics.light();
              onToggleNotifications();
            }}
            aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
            aria-expanded={false}
          >
            <Bell className="w-[26px] h-[26px] stroke-1 transition-transform duration-300" aria-hidden="true" />
            {unreadNotifications > 0 && (
              <div
                className="absolute -top-1 -right-1 bg-[#ec1e24] text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse-slow"
                aria-label={`${unreadNotifications} unread notifications`}
              >
                {unreadNotifications}
              </div>
            )}
          </button>
          <button
            className="text-gray-900 dark:text-white p-1 transition-all duration-300 hover:scale-110 active:scale-95 hover:text-[#ec1e24]"
            onClick={() => {
              haptics.light();
              onToggleSettings();
            }}
            aria-label="Open settings"
            aria-expanded={false}
          >
            <Settings className="w-[26px] h-[26px] stroke-1 transition-transform duration-300 hover:rotate-90" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay and Drawer */}
      {isMobileMenuOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Mobile Menu Drawer */}
          <aside className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#000000] border-r border-gray-200 dark:border-[#333333] flex-col z-50 lg:hidden flex">
            <NavContent isCollapsed={false} isDesktop={false} />
          </aside>
        </>
      )}

      {/* Sidebar - Desktop Only (lg and above) */}
      <aside
        className="pointer-events-auto fixed top-0 left-0 z-50 hidden h-full flex-col border-r border-gray-200 bg-white transition-[width] duration-200 ease-in-out dark:border-[#333333] dark:bg-[#000000] lg:flex"
        style={{ isolation: 'isolate', width: desktopSidebarWidth }}
        onMouseEnter={() => setIsDesktopSidebarHovered(true)}
        onMouseLeave={() => setIsDesktopSidebarHovered(false)}
      >
        <NavContent isCollapsed={isDesktopSidebarCollapsed} isDesktop />
      </aside>

      {/* Spacer for fixed header */}
      <div className="h-16" />
    </>
  );
}
