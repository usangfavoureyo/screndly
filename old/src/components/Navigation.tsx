import { LayoutDashboard, Youtube, Share2, Bell, Settings, LogOut, Rss, Film, Image } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import { haptics } from '../utils/haptics';
import { useScrollDirection } from '../utils/useScrollDirection';
import screndlyLogo from 'figma:asset/aa914b18f567f6825fda46e6657ced11e5c34887.png';

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onToggleSettings: () => void;
  onToggleNotifications: () => void;
  onLogout: () => void;
  unreadNotifications: number;
}

export function Navigation({ currentPage, onNavigate, onToggleSettings, onToggleNotifications, onLogout, unreadNotifications }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const scrollDirection = useScrollDirection();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'channels', label: 'Channels', icon: Youtube },
    { id: 'platforms', label: 'Platforms', icon: Share2 },
    { id: 'feeds', label: 'Feeds', icon: Rss },
    { id: 'design-studio', label: 'Design Studio', icon: Image },
    { id: 'video-studio', label: 'Video Studio', icon: Film },
  ];

  const NavContent = () => (
    <>
      <div className="p-6 border-b border-gray-200 dark:border-[#333333]">
        <button
          onClick={() => {
            onNavigate('dashboard');
            setIsMobileMenuOpen(false);
          }}
          className="cursor-pointer flex items-center gap-3 w-full transition-transform duration-300 hover:scale-105 active:scale-95"
        >
          <img src={screndlyLogo} alt="Screndly" className="w-10 h-10 transition-transform duration-300" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setIsMobileMenuOpen(false);
              }}
              onPointerDown={(e) => {
                // Fallback: capture mouse/pen events at pointer level
                if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
                  onNavigate(item.id);
                  setIsMobileMenuOpen(false);
                }
              }}
              className={`cursor-pointer w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive
                ? 'bg-[#ec1e24] text-white'
                : 'text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#1A1A1A] hover:translate-x-1'
                }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? '' : 'group-hover:scale-110'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-[#333333]">
        <Button
          onClick={onLogout}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
              onLogout();
            }
          }}
          variant="ghost"
          className="cursor-pointer w-full justify-start gap-3 text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#1A1A1A] rounded-xl transition-all duration-300 hover:translate-x-1 hover:text-[#ec1e24]"
        >
          <LogOut className="w-5 h-5 transition-transform duration-300" />
          <span>Logout</span>
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop/Mobile Header */}
      <div
        className={`fixed left-0 right-0 h-16 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] z-40 flex items-center justify-between px-4 lg:pl-64 transition-transform duration-300 ${scrollDirection === 'down' ? '-translate-y-full' : 'translate-y-0'
          }`}
        style={{ top: 0 }}
      >
        {/* Logo on mobile/tablet, spacer on desktop */}
        <div className="flex items-center lg:flex-1">
          <img src={screndlyLogo} alt="Screndly" className="w-8 h-8 lg:hidden" />
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
            <NavContent />
          </aside>
        </>
      )}

      {/* Sidebar - Desktop Only (lg and above) */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#000000] border-r border-gray-200 dark:border-[#333333] flex-col z-50 pointer-events-auto" style={{ isolation: 'isolate' }}>
        <NavContent />
      </aside>

      {/* Spacer for fixed header */}
      <div className="h-16" />
    </>
  );
}