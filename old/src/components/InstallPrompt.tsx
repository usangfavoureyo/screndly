import { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { showInstallPrompt, isInstallPromptAvailable, isPWAInstalled } from '../utils/pwa';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Check if already installed
    const installed = isPWAInstalled();
    setIsInstalled(installed);

    // Don't show prompt if already installed
    if (installed) {
      return;
    }

    // Check if user has dismissed the prompt before
    try {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (dismissed) {
        return;
      }
    } catch (e) {
      // localStorage not available (private browsing, etc.)
      console.error('localStorage access failed:', e);
    }

    // Wait a bit before showing the prompt (better UX)
    const timer = setTimeout(() => {
      const canInstallNow = isInstallPromptAvailable();
      setCanInstall(canInstallNow);
      setShowPrompt(canInstallNow);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    haptics.light();
    const result = await showInstallPrompt();

    if (result === 'accepted') {
      toast.success('App installed successfully!');
      setShowPrompt(false);
      setIsInstalled(true);
    } else if (result === 'dismissed') {
      toast.info('Installation cancelled');
      handleDismiss();
    } else {
      toast.error('Installation not available');
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    haptics.light();
    setShowPrompt(false);
    try {
      localStorage.setItem('pwa-install-dismissed', 'true');
    } catch (e) {
      // localStorage not available
      console.error('Failed to save dismiss state:', e);
    }
  };

  // Don't render if already installed or can't install
  if (isInstalled || !showPrompt || !canInstall) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white dark:bg-black border-2 border-[#ec1e24] rounded-2xl shadow-lg overflow-hidden">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-gray-500 dark:text-[#9CA3AF]" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#ec1e24]/10 mb-4">
            <Smartphone className="w-6 h-6 text-[#ec1e24]" />
          </div>

          {/* Content */}
          <h3 className="text-gray-900 dark:text-white mb-2">
            Install Screndly
          </h3>
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF] mb-4">
            Install Screndly on your device for faster access, offline support, and a native app experience.
          </p>

          {/* Benefits */}
          <ul className="space-y-2 mb-6">
            <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ec1e24] mt-1.5 flex-shrink-0" />
              <span>Works offline with cached content</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ec1e24] mt-1.5 flex-shrink-0" />
              <span>Faster loading and performance</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ec1e24] mt-1.5 flex-shrink-0" />
              <span>Push notifications support</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ec1e24] mt-1.5 flex-shrink-0" />
              <span>Runs in fullscreen mode</span>
            </li>
          </ul>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A]"
            >
              Not Now
            </Button>
            <Button
              onClick={handleInstall}
              className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white"
            >
              Install
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}