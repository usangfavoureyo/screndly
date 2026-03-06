import { useState } from 'react';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { Button } from './ui/button';
import { Loader2, CheckCircle2, Shield, Key } from 'lucide-react';
import { PlatformType } from '../utils/platformConnections';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { InstagramIcon } from './icons/InstagramIcon';
import { FacebookIcon } from './icons/FacebookIcon';
import { ThreadsIcon } from './icons/ThreadsIcon';
import { TikTokIcon } from './icons/TikTokIcon';
import { XIcon } from './icons/XIcon';
import { YouTubeIcon } from './icons/YouTubeIcon';
import { PinterestIcon } from './icons/PinterestIcon';

interface PlatformConnectionModalProps {
  platform: PlatformType;
  isOpen: boolean;
  onClose: () => void;
}

export function PlatformConnectionModal({
  platform,
  isOpen,
  onClose
}: PlatformConnectionModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<'info' | 'connecting' | 'success'>('info');

  const platformInfo = {
    Instagram: {
      name: 'Instagram',
      icon: <InstagramIcon className="w-7 h-7" />,
      color: '#E4405F',
      description: 'Connect your Instagram account to auto-post trailers and engage with your audience.',
      permissions: [
        'Post photos and videos',
        'Read engagement metrics',
        'Access basic profile info',
      ],
    },
    Facebook: {
      name: 'Facebook',
      icon: <FacebookIcon className="w-7 h-7" />,
      color: '#1877F2',
      description: 'Connect your Facebook Page to reach a wider audience with your content.',
      permissions: [
        'Manage page posts',
        'Upload photos and videos',
        'View page insights',
      ],
    },
    Threads: {
      name: 'Threads',
      icon: <ThreadsIcon className="w-6 h-6" />,
      color: '#000000',
      description: 'Connect your Threads account to share movie content with your community.',
      permissions: [
        'Create and publish threads',
        'Upload images and videos',
        'Access basic profile info',
      ],
    },
    TikTok: {
      name: 'TikTok',
      icon: <TikTokIcon className="w-9 h-9" />,
      color: '#000000',
      description: 'Connect your TikTok account to share short-form trailer content.',
      permissions: [
        'Upload videos',
        'Read video analytics',
        'Access basic account info',
      ],
    },
    X: {
      name: 'X (Twitter)',
      icon: <XIcon className="w-5 h-5" />,
      color: '#000000',
      description: 'Connect your X account to auto-post trailers and engage with your audience.',
      permissions: [
        'Post tweets and media',
        'Read engagement metrics',
        'Access basic profile info',
      ],
    },
    YouTube: {
      name: 'YouTube',
      icon: <YouTubeIcon className="w-8 h-8" />,
      color: '#FF0000',
      description: 'Connect your YouTube channel to upload and manage trailer videos.',
      permissions: [
        'Upload videos',
        'Manage video metadata',
        'View channel analytics',
      ],
    },
    Pinterest: {
      name: 'Pinterest',
      icon: <PinterestIcon className="w-6 h-6" />,
      color: '#E60023',
      description: 'Connect your Pinterest account to share movie posters, trailers, and visual content.',
      permissions: [
        'Create and publish pins',
        'Upload images and videos',
        'Access board information',
        'Read engagement analytics',
      ],
    },
  };

  const info = platformInfo[platform];

  const handleConnect = async () => {
    setIsConnecting(true);
    setStep('connecting');
    haptics.medium();

    try {
      const { apiClient } = await import('../lib/api/client');
      const response = await apiClient.get<{ url?: string }>(`/api/platforms/auth/${platform}`);

      if (response.success && response.data?.url) {
        localStorage.setItem('screndly_oauth_platform', platform);
        window.location.href = response.data.url;
      } else {
        throw new Error(response.error?.message || 'Failed to get OAuth URL');
      }
    } catch (error) {
      console.error('Connection error:', error);
      haptics.error();
      const errorMessage = error instanceof Error ? error.message : `Failed to connect to ${info.name}`;
      toast.error(errorMessage);
      setStep('info');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    if (!isConnecting) {
      haptics.light();
      onClose();
      setStep('info');
    }
  };

  return (
    <BottomSheet
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      disableSwipe={isConnecting} // Prevent accidental dismissal during connection
    >
      <BottomSheetHeader>
        <BottomSheetTitle className="flex items-center gap-2">
          <span className="w-10 h-10 flex items-center justify-center">
            {info.icon}
          </span>
          Connect {info.name}
        </BottomSheetTitle>
        <BottomSheetDescription>
          {info.description}
        </BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody>
        {step === 'info' && (
          <div className="space-y-6">
            {/* Permissions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                <Shield className="w-4 h-4" />
                <span>Screndly will be able to:</span>
              </div>
              <ul className="space-y-2 ml-6 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4">
                {info.permissions.map((permission, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-[#9CA3AF]">
                    <CheckCircle2 className="w-4 h-4 text-[#ec1e24] mt-0.5 flex-shrink-0" />
                    <span>{permission}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Security Note */}
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4">
              <div className="flex gap-3">
                <Key className="w-5 h-5 text-[#ec1e24] flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    Secure Connection
                  </p>
                  <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">
                    Your credentials are encrypted and stored securely. You can disconnect at any time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'connecting' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-[#ec1e24] animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-gray-900 dark:text-white">
                Connecting to {info.name}...
              </p>
              <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                Please wait while we establish a secure connection
              </p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-[#ec1e24]" />
            <div className="text-center space-y-2">
              <p className="text-gray-900 dark:text-white">
                Successfully Connected!
              </p>
              <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                Your {info.name} account is now connected
              </p>
            </div>
          </div>
        )}
      </BottomSheetBody>

      {step === 'info' && (
        <BottomSheetFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 bg-white dark:bg-[#000000] border-gray-300 dark:border-[#333333] hover:bg-gray-50 dark:hover:bg-[#111111]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            className="flex-1 bg-[#ec1e24] hover:bg-[#d11b20] text-white"
          >
            Connect {info.name}
          </Button>
        </BottomSheetFooter>
      )}
    </BottomSheet>
  );
}
