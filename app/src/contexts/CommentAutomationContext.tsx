import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '../lib/api/client';

interface CommentReply {
  comment: string;
  reply: string;
  time: string;
}

interface PlatformCommentData {
  platform: string;
  color: string;
  repliesToday: number;
  successRate: string;
  recentReplies: CommentReply[];
  enabled: boolean;
}

interface CommentAutomationContextType {
  platformData: PlatformCommentData[];
  updatePlatformData: (platform: string, data: Partial<PlatformCommentData>) => void;
  togglePlatform: (platform: string, enabled: boolean) => void;
}

const CommentAutomationContext = createContext<CommentAutomationContextType | undefined>(undefined);

const PLATFORM_COLORS: Record<string, string> = {
  X: '#000000',
  Instagram: '#E4405F',
  TikTok: '#000000',
  Facebook: '#1877F2',
  YouTube: '#FF0000',
  Threads: '#000000',
  Pinterest: '#E60023',
};

const ALL_PLATFORMS = ['X', 'Instagram', 'TikTok', 'Facebook', 'YouTube', 'Threads', 'Pinterest'];

function createEmptyPlatformData(platform: string): PlatformCommentData {
  return {
    platform,
    color: PLATFORM_COLORS[platform] || '#000000',
    repliesToday: 0,
    successRate: '0%',
    recentReplies: [],
    enabled: true,
  };
}

export function CommentAutomationProvider({ children }: { children: ReactNode }) {
  const [platformData, setPlatformData] = useState<PlatformCommentData[]>(ALL_PLATFORMS.map(createEmptyPlatformData));

  useEffect(() => {
    const fetchCommentData = async () => {
      try {
        const response = await apiClient.get<any[]>('/api/comments/automation/stats');

        if (!response.success || !Array.isArray(response.data)) {
          throw new Error(response.error?.message || 'Failed to fetch comment stats');
        }

        const mapped = ALL_PLATFORMS.map((platform) => {
          const item = response.data.find((entry: any) => entry.platform === platform);
          if (!item) {
            return createEmptyPlatformData(platform);
          }

          return {
            platform,
            color: PLATFORM_COLORS[platform] || '#000000',
            repliesToday: item.repliesToday || 0,
            successRate: `${item.successRate || 0}%`,
            recentReplies: Array.isArray(item.recentReplies)
              ? item.recentReplies.map((reply: any) => ({
                comment: reply.comment || '',
                reply: reply.reply || '',
                time: reply.time || '',
              }))
              : [],
            enabled: true,
          };
        });

        setPlatformData(mapped);
      } catch (error) {
        console.error('Error fetching comment automation data:', error);
        setPlatformData(ALL_PLATFORMS.map(createEmptyPlatformData));
      }
    };

    fetchCommentData();
  }, []);

  const updatePlatformData = (platform: string, data: Partial<PlatformCommentData>) => {
    setPlatformData((prev) =>
      prev.map((item) => (item.platform === platform ? { ...item, ...data } : item))
    );
  };

  const togglePlatform = (platform: string, enabled: boolean) => {
    updatePlatformData(platform, { enabled });
  };

  return (
    <CommentAutomationContext.Provider
      value={{
        platformData,
        updatePlatformData,
        togglePlatform,
      }}
    >
      {children}
    </CommentAutomationContext.Provider>
  );
}

export function useCommentAutomation() {
  const context = useContext(CommentAutomationContext);
  if (!context) {
    throw new Error('useCommentAutomation must be used within CommentAutomationProvider');
  }
  return context;
}
