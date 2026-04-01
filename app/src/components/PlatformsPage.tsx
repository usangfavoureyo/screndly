import { useCallback, useEffect, useState } from 'react';
import { PlatformCard } from './PlatformCard';
import { PlatformConnectionModal } from './PlatformConnectionModal';
import { PlatformTestPublishModal } from './PlatformTestPublishModal';
import {
  getPlatformConnections,
  PlatformType,
  getConnectionStatus,
  formatLastConnection,
  disconnectPlatform,
  syncPlatformConnectionsFromBackend,
} from '../utils/platformConnections';
import { haptics } from '../utils/haptics';
import { updateSetting } from '../lib/api/settings';
import { apiClient } from '../lib/api/client';
import { toast } from "sonner";

interface Platform {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  autoPost: boolean;
  autoThumbnail: boolean;
  autoCaption: boolean;
  autoHashtag: boolean;
  commentAutomation: boolean;
  status: 'valid' | 'expiring' | 'invalid' | 'disconnected';
  statusMessage?: string;
  lastPost?: string;
}

interface BackendPlatformStatus {
  connected: boolean;
  username?: string;
  lastPost?: string;
  profileUrl?: string;
  expiresAt?: string;
  error?: string;
}

const OAUTH_REFRESH_KEY = 'screndly_oauth_refresh_platform';

interface PlatformsTabContentProps {
  showHeader?: boolean;
}

export function PlatformsTabContent({ showHeader = false }: PlatformsTabContentProps) {
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(null);
  const [testPublishModalOpen, setTestPublishModalOpen] = useState(false);
  const [selectedTestPlatform, setSelectedTestPlatform] = useState<PlatformType | null>(null);

  // Map platform IDs to PlatformType
  const getPlatformType = (id: string): PlatformType | null => {
    const mapping: Record<string, PlatformType> = {
      instagram: 'Instagram',
      facebook: 'Facebook',
      tiktok: 'TikTok',
      threads: 'Threads',
      x: 'X',
      youtube: 'YouTube',
      pinterest: 'Pinterest',
    };
    return mapping[id] || null;
  };

  const createInitialPlatforms = (): Platform[] => {
    return [
      {
        id: 'instagram',
        name: 'Instagram',
        icon: '📷',
        connected: false,
        autoPost: true,
        autoThumbnail: true,
        autoCaption: true,
        autoHashtag: true,
        commentAutomation: true,
        status: 'disconnected' as const,
        lastPost: undefined
      },
      {
        id: 'facebook',
        name: 'Facebook',
        icon: '👤',
        connected: false,
        autoPost: true,
        autoThumbnail: true,
        autoCaption: false,
        autoHashtag: true,
        commentAutomation: false,
        status: 'disconnected' as const,
        lastPost: undefined
      },
      {
        id: 'tiktok',
        name: 'TikTok',
        icon: '🎵',
        connected: false,
        autoPost: true,
        autoThumbnail: true,
        autoCaption: true,
        autoHashtag: true,
        commentAutomation: true,
        status: 'disconnected' as const,
        lastPost: undefined
      },
      {
        id: 'threads',
        name: 'Threads',
        icon: '🧵',
        connected: false,
        autoPost: false,
        autoThumbnail: true,
        autoCaption: true,
        autoHashtag: false,
        commentAutomation: false,
        status: 'disconnected' as const,
        lastPost: undefined
      },
      {
        id: 'x',
        name: 'X (Twitter)',
        icon: '𝕏',
        connected: false,
        autoPost: true,
        autoThumbnail: true,
        autoCaption: true,
        autoHashtag: true,
        commentAutomation: true,
        status: 'disconnected' as const,
        lastPost: undefined
      },
      {
        id: 'youtube',
        name: 'YouTube',
        icon: '▶️',
        connected: false,
        autoPost: false,
        autoThumbnail: false,
        autoCaption: false,
        autoHashtag: false,
        commentAutomation: false,
        status: 'disconnected' as const,
        lastPost: undefined
      },
      {
        id: 'pinterest',
        name: 'Pinterest',
        icon: '📌',
        connected: false,
        autoPost: true,
        autoThumbnail: true,
        autoCaption: true,
        autoHashtag: true,
        commentAutomation: true,
        status: 'disconnected' as const,
        lastPost: undefined
      },
    ];
  };

  const buildPlatforms = (connections = getPlatformConnections()): Platform[] => {
    const initialPlatforms = createInitialPlatforms();

    try {
      // Load saved platform settings from localStorage
      const savedSettings = localStorage.getItem('screndly_platformSettings');
      const platformSettings = savedSettings ? JSON.parse(savedSettings) : {};

      return initialPlatforms.map(platform => {
        const platformType = getPlatformType(platform.id);

        if (!platformType) return platform;

        const connection = connections[platformType];
        const status = getConnectionStatus(platformType);

        // Restore saved settings if they exist
        const savedPlatform = platformSettings[platform.id];

        return {
          ...platform,
          ...(savedPlatform || {}), // Restore saved autoPost, autoThumbnail, etc.
          connected: connection?.connected || false,
          status: status.health === 'healthy' ? 'valid' as const :
            status.health === 'warning' ? 'expiring' as const :
              status.health === 'error' ? 'invalid' as const : 'disconnected' as const,
          statusMessage: status.message,
          lastPost: connection?.connected ? formatLastConnection(connection) : undefined,
        };
      });
    } catch (error) {
      console.error('Error initializing connection status:', error);
      return initialPlatforms;
    }
  };

  const [platforms, setPlatforms] = useState<Platform[]>(() => buildPlatforms());

  const loadConnectionStatus = useCallback(async () => {
    try {
      const response = await apiClient.get<Record<string, BackendPlatformStatus>>('/api/platforms/status');
      if (response.success && response.data) {
        const connections = syncPlatformConnectionsFromBackend(
          response.data as Partial<Record<PlatformType, BackendPlatformStatus>>
        );
        setPlatforms(buildPlatforms(connections));
        return;
      }

      setPlatforms(buildPlatforms());
    } catch (error) {
      console.error('Error loading connection status:', error);
      setPlatforms(buildPlatforms());
    }
  }, []);

  useEffect(() => {
    void loadConnectionStatus();
  }, [loadConnectionStatus]);

  useEffect(() => {
    const refreshPlatform = sessionStorage.getItem(OAUTH_REFRESH_KEY);
    if (!refreshPlatform) return;

    sessionStorage.removeItem(OAUTH_REFRESH_KEY);
    toast.success(`${refreshPlatform} connected successfully`);

    const timeoutId = window.setTimeout(() => {
      void loadConnectionStatus();
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [loadConnectionStatus]);

  useEffect(() => {
    const handleFocus = () => {
      void loadConnectionStatus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadConnectionStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadConnectionStatus]);

  const updatePlatform = (id: string, updates: Partial<Platform>) => {
    setPlatforms(prevPlatforms => {
      const updated = prevPlatforms.map(p => p.id === id ? { ...p, ...updates } : p);

      // Save platform settings to localStorage and Backend
      const platformSettings: Record<string, any> = {};
      let existingPlatformSettings: Record<string, any> = {};
      try {
        const savedSettings = localStorage.getItem('screndly_platformSettings');
        existingPlatformSettings = savedSettings ? JSON.parse(savedSettings) : {};
      } catch {
        existingPlatformSettings = {};
      }
      updated.forEach(platform => {
        const existingSaved =
          existingPlatformSettings[platform.id] && typeof existingPlatformSettings[platform.id] === 'object'
            ? existingPlatformSettings[platform.id]
            : {};

        platformSettings[platform.id] = {
          ...existingSaved,
          autoPost: platform.autoPost,
          autoThumbnail: platform.autoThumbnail,
          autoCaption: platform.autoCaption,
          autoHashtag: platform.autoHashtag,
          commentAutomation: platform.commentAutomation,
        };
      });

      try {
        localStorage.setItem('screndly_platformSettings', JSON.stringify(platformSettings));
        // Sync to backend for automation service
        updateSetting('platformSettings', platformSettings);
      } catch (error) {
        console.error('Failed to save platform settings:', error);
      }

      return updated;
    });
  };

  const handleOpenConnectionModal = (platformId: string) => {
    const platformType = getPlatformType(platformId);

    if (platformType) {
      setSelectedPlatform(platformType);
      setConnectionModalOpen(true);
      haptics.light();
    }
  };

  const handleDisconnect = async (platformId: string) => {
    const platformType = getPlatformType(platformId);

    if (platformType) {
      try {
        await apiClient.delete(`/api/platforms/${platformType}`);
      } catch (error) {
        console.error('Failed to disconnect platform on backend:', error);
      }

      disconnectPlatform(platformType);
      haptics.light();
      toast.success(`Disconnected from ${platformType}`);
      await loadConnectionStatus();
    }
  };

  const handleConnectionSuccess = () => {
    void loadConnectionStatus();
  };

  const handleCloseConnectionModal = () => {
    setConnectionModalOpen(false);
    setSelectedPlatform(null);
    void loadConnectionStatus();
  };

  const handleCloseTestPublishModal = () => {
    setTestPublishModalOpen(false);
    setSelectedTestPlatform(null);
  };

  const handleOpenTestPublishModal = (platformId: string) => {
    const platformType = getPlatformType(platformId);
    if (!platformType) return;

    setSelectedTestPlatform(platformType);
    setTestPublishModalOpen(true);
    haptics.light();
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <div>
          <h1 className="text-gray-900 dark:text-white mb-2">Platforms</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">Connect and manage your social media platforms.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform) => (
          <PlatformCard
            key={platform.id}
            platform={platform}
            onUpdate={updatePlatform}
            onConnect={handleOpenConnectionModal}
            onDisconnect={handleDisconnect}
            onTestPublish={handleOpenTestPublishModal}
          />
        ))}
      </div>

      {selectedPlatform && (
        <PlatformConnectionModal
          platform={selectedPlatform}
          isOpen={connectionModalOpen}
          onClose={handleCloseConnectionModal}
        />
      )}

      {selectedTestPlatform && (
        <PlatformTestPublishModal
          platform={selectedTestPlatform}
          isOpen={testPublishModalOpen}
          onClose={handleCloseTestPublishModal}
          onPublished={handleConnectionSuccess}
        />
      )}
    </div>
  );
}

export function PlatformsPage() {
  return <PlatformsTabContent showHeader />;
}
