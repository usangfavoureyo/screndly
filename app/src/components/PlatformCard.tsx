import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { CheckCircle, AlertCircle, XCircle, Send } from 'lucide-react';
import { InstagramIcon } from './icons/InstagramIcon';
import { FacebookIcon } from './icons/FacebookIcon';
import { TikTokIcon } from './icons/TikTokIcon';
import { YouTubeIcon } from './icons/YouTubeIcon';
import { ThreadsIcon } from './icons/ThreadsIcon';
import { XIcon } from './icons/XIcon';
import { PinterestIcon } from './icons/PinterestIcon';
import { getPlatformConnection, PlatformType } from '../utils/platformConnections';

interface Platform {
  id: string;
  name: string;
  icon: string;
  iconImage?: string;
  connected: boolean;
  autoPost: boolean;
  autoThumbnail: boolean;
  autoCaption: boolean;
  autoHashtag: boolean;
  commentAutomation: boolean;
  status: 'valid' | 'expiring' | 'invalid' | 'disconnected';
  lastPost?: string;
}

interface PlatformCardProps {
  platform: Platform;
  onUpdate: (id: string, updates: Partial<Platform>) => void;
  onConnect: (id: string) => void;
  onDisconnect?: (id: string) => void;
  onTestPublish?: (id: string) => void;
}

export function PlatformCard({ platform, onUpdate, onConnect, onDisconnect, onTestPublish }: PlatformCardProps) {
  const getStatusConfig = () => {
    switch (platform.status) {
      case 'valid':
        return {
          icon: CheckCircle,
          color: 'text-[#10B981]',
          bgColor: 'bg-[#D1FAE5]',
          label: 'Connected',
        };
      case 'expiring':
        return {
          icon: AlertCircle,
          color: 'text-[#F59E0B]',
          bgColor: 'bg-[#FEF3C7]',
          label: 'Token Expiring',
        };
      case 'invalid':
        return {
          icon: XCircle,
          color: 'text-[#EF4444]',
          bgColor: 'bg-[#FEE2E2]',
          label: 'Invalid',
        };
      default:
        return {
          icon: XCircle,
          color: 'text-[#9CA3AF]',
          bgColor: 'bg-[#374151]',
          label: 'Not Connected',
        };
    }
  };

  const platformUrls: Record<string, string> = {
    instagram: 'https://www.instagram.com/screenrender',
    threads: 'https://www.threads.com/@screenrender',
    facebook: 'https://www.facebook.com/share/1A9AkTvUBA/',
    tiktok: 'https://www.tiktok.com/@screenrender?_r=1&_t=ZS-91QmcxgxZy5',
    youtube: 'https://youtube.com/@screenrender?si=4iacQp4_QN8s5WaS',
    x: 'https://x.com/screenrender?t=KPASOaPQopdLqqmd-9JSuQ&s=09',
    pinterest: 'https://www.pinterest.com/screenrender',
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // Get the profile URL based on connection status
  const getProfileUrl = () => {
    if (platform.connected) {
      const platformTypeMap: Record<string, PlatformType> = {
        instagram: 'Instagram',
        facebook: 'Facebook',
        tiktok: 'TikTok',
        threads: 'Threads',
        x: 'X',
        youtube: 'YouTube',
        pinterest: 'Pinterest',
      };
      const platformType = platformTypeMap[platform.id];
      if (!platformType) {
        return platformUrls[platform.id];
      }
      const connection = getPlatformConnection(platformType);

      // Return user's profile URL if connected, otherwise fall back to Screen Render's URL
      return connection.profileUrl || platformUrls[platform.id];
    }
    // Return Screen Render's URL if not connected
    return platformUrls[platform.id];
  };

  const handleIconClick = () => {
    const url = getProfileUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4 sm:p-6 hover:shadow-xl dark:hover:shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition-all duration-300 hover:-translate-y-1 flex flex-col">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={handleIconClick}
            className="cursor-pointer hover:opacity-80 transition-all duration-300 hover:scale-110 active:scale-95 flex-shrink-0"
            title={`Visit ${platform.name} profile`}
          >
            {platform.id === 'instagram' ? (
              <InstagramIcon className="w-6 h-6 text-gray-900 dark:text-white transition-transform duration-300" />
            ) : platform.id === 'facebook' ? (
              <FacebookIcon className="w-[26px] h-[26px] text-gray-900 dark:text-white transition-transform duration-300" />
            ) : platform.id === 'tiktok' ? (
              <TikTokIcon className="w-[34px] h-[34px] text-gray-900 dark:text-white transition-transform duration-300" />
            ) : platform.id === 'youtube' ? (
              <YouTubeIcon className="w-[26px] h-[26px] text-gray-900 dark:text-white transition-transform duration-300" />
            ) : platform.id === 'threads' ? (
              <ThreadsIcon className="w-5.5 h-5.5 text-gray-900 dark:text-white transition-transform duration-300" />
            ) : platform.id === 'x' ? (
              <XIcon className="w-4.5 h-4.5 text-gray-900 dark:text-white transition-transform duration-300" />
            ) : platform.id === 'pinterest' ? (
              <PinterestIcon className="w-5.5 h-5.5 text-gray-900 dark:text-white transition-transform duration-300" />
            ) : platform.iconImage ? (
              <img src={platform.iconImage} alt={platform.name} className="w-8 h-8 transition-transform duration-300" />
            ) : (
              <div className="text-3xl transition-transform duration-300">{platform.icon}</div>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <h3 className="text-gray-900 dark:text-white transition-colors duration-200 truncate">{platform.name}</h3>
            <div className={`flex items-center gap-1.5 mt-1 ${statusConfig.color} transition-colors duration-200`}>
              <StatusIcon className="w-4 h-4 flex-shrink-0 transition-transform duration-200" />
              <span className="text-sm leading-none truncate">{statusConfig.label}</span>
            </div>
          </div>
        </div>

        {/* Connect/Disconnect Button - Top Right */}
        {!platform.connected && (
          <Button
            onClick={() => onConnect(platform.id)}
            variant="default"
            size="sm"
            className="transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0 bg-[#ec1e24] hover:bg-[#d11b20] text-white"
          >
            Connect
          </Button>
        )}

        {platform.connected && (
          <Button
            onClick={() => onDisconnect?.(platform.id)}
            variant="outline"
            size="sm"
            className="transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0 bg-white dark:bg-[#000000] text-black dark:text-white border-black dark:border-[#333333] hover:bg-gray-100 dark:hover:bg-[#333333] hover:border-gray-800 dark:hover:border-[#444444]"
          >
            Disconnect
          </Button>
        )}
      </div>

      <div>
        {platform.connected ? (
          <div className="space-y-3">
            {platform.lastPost && (
              <div className="text-[#6B7280] dark:text-[#9CA3AF] text-sm pb-2 border-b border-gray-200 dark:border-[#374151] transition-colors duration-200">
                Last post: {platform.lastPost}
              </div>
            )}

            <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#111111] p-2 rounded-lg transition-all duration-200">
              <span className="text-[#6B7280] dark:text-[#9CA3AF] text-sm">Auto-post</span>
              <Switch
                checked={platform.autoPost}
                onCheckedChange={(checked) => onUpdate(platform.id, { autoPost: checked })}
              />
            </div>

            <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#111111] p-2 rounded-lg transition-all duration-200">
              <span className="text-[#6B7280] dark:text-[#9CA3AF] text-sm">Auto-thumbnail</span>
              <Switch
                checked={platform.autoThumbnail}
                onCheckedChange={(checked) => onUpdate(platform.id, { autoThumbnail: checked })}
              />
            </div>

            <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#111111] p-2 rounded-lg transition-all duration-200">
              <span className="text-[#6B7280] dark:text-[#9CA3AF] text-sm">Auto-caption</span>
              <Switch
                checked={platform.autoCaption}
                onCheckedChange={(checked) => onUpdate(platform.id, { autoCaption: checked })}
              />
            </div>



            <Button
              variant="outline"
              style={{ backgroundColor: '#ec1e24', borderColor: '#ec1e24' }}
              className="w-full rounded-lg gap-2 mt-4 transition-all duration-300 hover:scale-105 active:scale-95 text-white hover:bg-[#d11b20] hover:border-[#d11b20] border-[#ec1e24]"
              onClick={() => onTestPublish?.(platform.id)}
            >
              <Send className="w-4 h-4 transition-transform duration-200" />
              Test Publish
            </Button>
          </div>
        ) : (
          <div className="text-center pt-2 pb-4 text-[#6B7280] dark:text-[#9CA3AF] text-sm transition-colors duration-200">
            Click "Connect" to enable automation features
          </div>
        )}
      </div>
    </div>
  );
}
