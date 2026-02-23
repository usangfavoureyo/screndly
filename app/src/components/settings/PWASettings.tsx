import { useState, useEffect } from 'react';
import { Smartphone, Wifi, WifiOff, Trash2, Bell, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  isPWAInstalled,
  isInstallPromptAvailable,
  showInstallPrompt,
  clearAllCaches,
  getCacheSize,
  isOffline,
  requestNotificationPermission,
  registerServiceWorker,
  unregisterServiceWorker,
} from '../../utils/pwa';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";

interface PWASettingsProps {
  onBack: () => void;
}

export function PWASettings({ onBack }: PWASettingsProps) {
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [offline, setOffline] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isClearing, setIsClearing] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    // Check installation status
    setIsInstalled(isPWAInstalled());
    setCanInstall(isInstallPromptAvailable());
    setOffline(isOffline());

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // Check service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        setSwRegistered(!!reg);
      });
    }

    // Get cache size
    updateCacheSize();

    // Listen for online/offline events
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check if in development environment
  const isDevelopment = window.location.hostname.includes('figma.site') || 
                       window.location.hostname === 'localhost';

  const updateCacheSize = async () => {
    const size = await getCacheSize();
    setCacheSize(size);
  };

  const handleInstall = async () => {
    haptics.light();
    const result = await showInstallPrompt();
    
    if (result === 'accepted') {
      toast.success('App installed successfully!');
      setIsInstalled(true);
      setCanInstall(false);
    } else if (result === 'dismissed') {
      toast.info('Installation cancelled');
    } else {
      toast.error('Installation not available');
    }
  };

  const handleClearCache = async () => {
    haptics.light();
    setIsClearing(true);

    try {
      await clearAllCaches();
      await updateCacheSize();
      toast.success('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('Failed to clear cache');
    } finally {
      setIsClearing(false);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    haptics.light();

    if (enabled) {
      const permission = await requestNotificationPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        toast.success('Notifications enabled');
      } else {
        toast.error('Notification permission denied');
      }
    } else {
      toast.info('Notifications disabled in browser settings');
    }
  };

  const handleReinstallServiceWorker = async () => {
    haptics.light();

    try {
      await unregisterServiceWorker();
      const registration = await registerServiceWorker();
      setSwRegistered(!!registration);
      
      if (registration) {
        toast.success('Service Worker reinstalled');
      } else {
        toast.error('Failed to reinstall Service Worker');
      }
    } catch (error) {
      console.error('Failed to reinstall service worker:', error);
      toast.error('Failed to reinstall Service Worker');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3">
        <button 
          className="text-gray-900 dark:text-white p-1" 
          onClick={() => {
            haptics.light();
            onBack();
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7"/>
          </svg>
        </button>
        <h2 className="text-gray-900 dark:text-white text-xl">Progressive Web App</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Development Notice */}
        {isDevelopment && (
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-[#ec1e24] mt-1" />
              <div className="flex-1">
                <h4 className="text-sm text-gray-900 dark:text-white mb-2">
                  Development Mode
                </h4>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-3">
                  You're viewing Screndly in a development/preview environment. Full PWA features (Service Worker, offline support) will be available when you deploy to a production server.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">
                  Features available now: Install prompts, push notifications, cache clearing, and network detection.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Installation Status */}
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl p-4">
          <div className="flex items-start gap-3">
            {isInstalled ? (
              <CheckCircle className="w-5 h-5 text-[#ec1e24]" />
            ) : (
              <Smartphone className="w-5 h-5 text-[#ec1e24]" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-gray-900 dark:text-white">
                  {isInstalled ? 'App Installed' : 'Install App'}
                </Label>
              </div>
              <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-3">
                {isInstalled 
                  ? 'Screndly is installed on your device'
                  : 'Install Screndly for a native app experience'
                }
              </p>
              {!isInstalled && canInstall && (
                <Button
                  onClick={handleInstall}
                  size="sm"
                  className="bg-[#ec1e24] hover:bg-[#d01a20] text-white"
                >
                  Install Now
                </Button>
              )}
              {!isInstalled && !canInstall && (
                <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                  Installation is only available on supported browsers (Chrome, Edge, Safari)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Network Status */}
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl p-4">
          <div className="flex items-start gap-3">
            {offline ? (
              <WifiOff className="w-5 h-5 text-[#ec1e24]" />
            ) : (
              <Wifi className="w-5 h-5 text-[#ec1e24]" />
            )}
            <div className="flex-1">
              <Label className="text-gray-900 dark:text-white">
                {offline ? 'Offline Mode' : 'Online'}
              </Label>
              <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">
                {offline 
                  ? 'Working with cached content'
                  : 'Connected to the internet'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Bell className="w-5 h-5 text-[#ec1e24] mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="pwa-notifications" className="text-gray-900 dark:text-white cursor-pointer">
                  Push Notifications
                </Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">
                  Receive notifications even when app is closed
                </p>
              </div>
            </div>
            <Switch
              id="pwa-notifications"
              checked={notificationPermission === 'granted'}
              onCheckedChange={handleNotificationToggle}
              disabled={notificationPermission === 'denied'}
            />
          </div>
          {notificationPermission === 'denied' && (
            <p className="text-xs text-red-500 mt-2 ml-[52px]">
              Notifications blocked. Enable in browser settings.
            </p>
          )}
        </div>

        {/* Cache Management */}
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-[#ec1e24]" />
            <div className="flex-1">
              <Label className="text-gray-900 dark:text-white">
                Clear Cache
              </Label>
              <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-3">
                Cached data: {formatBytes(cacheSize)}
              </p>
              <Button
                onClick={handleClearCache}
                size="sm"
                variant="outline"
                disabled={isClearing}
                className="bg-white dark:bg-black border-gray-200 dark:border-[#333333]"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    Clear Cache
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Service Worker Status */}
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-[#ec1e24]" />
            <div className="flex-1">
              <Label className="text-gray-900 dark:text-white">
                Service Worker
              </Label>
              <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-3">
                {swRegistered 
                  ? 'Service Worker is active'
                  : 'Service Worker not registered'
                }
              </p>
              <Button
                onClick={handleReinstallServiceWorker}
                size="sm"
                variant="outline"
                className="bg-white dark:bg-black border-gray-200 dark:border-[#333333]"
              >
                {swRegistered ? 'Reinstall' : 'Install'} Service Worker
              </Button>
            </div>
          </div>
        </div>

        {/* PWA Info */}
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl p-4">
          <h4 className="text-sm text-gray-900 dark:text-white mb-2">
            What is a PWA?
          </h4>
          <ul className="space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ec1e24] mt-1.5 flex-shrink-0" />
              <span><strong>Offline Support:</strong> Works without internet connection</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ec1e24] mt-1.5 flex-shrink-0" />
              <span><strong>Fast Loading:</strong> Cached content loads instantly</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ec1e24] mt-1.5 flex-shrink-0" />
              <span><strong>Native Experience:</strong> Runs in fullscreen mode</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ec1e24] mt-1.5 flex-shrink-0" />
              <span><strong>Push Notifications:</strong> Stay updated with alerts</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ec1e24] mt-1.5 flex-shrink-0" />
              <span><strong>Home Screen Icon:</strong> Access like a native app</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}