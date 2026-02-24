import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

// Mock data - replace with real API calls in production
const MOCK_PLATFORM_DATA: PlatformCommentData[] = [
  {
    platform: 'X',
    color: '#000000',
    repliesToday: 48,
    successRate: '92%',
    enabled: true,
    recentReplies: [
      { comment: 'Can\'t wait to see this!', reply: 'We\'re excited too! 🎬', time: '2 min ago' },
      { comment: 'When is the release date?', reply: 'Coming soon! Stay tuned for updates.', time: '15 min ago' },
      { comment: 'This looks incredible!', reply: 'Thanks for your support! 🙌', time: '1 hour ago' },
      { comment: 'Is this coming to IMAX?', reply: 'Yes! IMAX release confirmed. Check local theaters.', time: '2 hours ago' },
      { comment: 'The trailer gave me goosebumps', reply: 'We\'re thrilled you loved it! 🎥', time: '3 hours ago' },
    ]
  },
  {
    platform: 'Instagram',
    color: '#E4405F',
    repliesToday: 64,
    successRate: '91%',
    enabled: true,
    recentReplies: [
      { comment: 'This is fire! 🔥', reply: 'Thanks for the love! ❤️', time: '1 min ago' },
      { comment: 'When can we watch this?', reply: 'Coming to theaters soon! Check our bio for updates.', time: '12 min ago' },
      { comment: 'The cinematography looks insane', reply: 'Wait till you see it in theaters! 🎬', time: '35 min ago' },
      { comment: 'Is this based on a true story?', reply: 'It\'s inspired by real events! 🌟', time: '1 hour ago' },
      { comment: 'Who else is hyped?', reply: 'We\'re so excited to share it with you! 🙌', time: '2 hours ago' },
    ]
  },
  {
    platform: 'TikTok',
    color: '#000000',
    repliesToday: 92,
    successRate: '87%',
    enabled: true,
    recentReplies: [
      { comment: 'This is going to be epic!', reply: 'Can\'t wait for you to see it! 🎥', time: '3 min ago' },
      { comment: 'Already pre-ordered tickets', reply: 'You\'re amazing! See you in theaters! 🎟️', time: '18 min ago' },
      { comment: 'The soundtrack slaps', reply: 'The full soundtrack drops next week! 🎵', time: '40 min ago' },
      { comment: 'Is this a trilogy?', reply: 'This is the first of the series! Stay tuned. 📽️', time: '1 hour ago' },
      { comment: 'My most anticipated film', reply: 'We\'re honored! Thanks for your support! ❤️', time: '3 hours ago' },
    ]
  },
  {
    platform: 'Facebook',
    color: '#1877F2',
    repliesToday: 56,
    successRate: '88%',
    enabled: true,
    recentReplies: [
      { comment: 'Release date?', reply: 'Coming to theaters Nov 22!', time: '5 min ago' },
      { comment: 'Who is directing this?', reply: 'Directed by Christopher Nolan!', time: '20 min ago' },
      { comment: 'Will this be on streaming?', reply: 'Theatrical release first, streaming later!', time: '45 min ago' },
      { comment: 'The cast looks amazing!', reply: 'We have an incredible ensemble! 🌟', time: '1 hour ago' },
      { comment: 'Is there a post-credits scene?', reply: 'No spoilers! You\'ll have to watch to find out. 😉', time: '2 hours ago' },
    ]
  },
  {
    platform: 'YouTube',
    color: '#FF0000',
    repliesToday: 78,
    successRate: '90%',
    enabled: true,
    recentReplies: [
      { comment: 'This trailer is everything!', reply: 'We\'re so glad you loved it! 🎬', time: '4 min ago' },
      { comment: 'How long is the runtime?', reply: '2 hours 45 minutes of pure cinema! ⏱️', time: '22 min ago' },
      { comment: 'Will there be IMAX showings?', reply: 'Yes! Check your local IMAX theater. 🎥', time: '50 min ago' },
      { comment: 'The visual effects are stunning', reply: 'Practical effects combined with cutting-edge VFX! 🌟', time: '1 hour ago' },
      { comment: 'Already watched this 10 times', reply: 'You\'re a true fan! Can\'t wait for you to see the full film! ❤️', time: '4 hours ago' },
    ]
  },
  {
    platform: 'Threads',
    color: '#000000',
    repliesToday: 38,
    successRate: '85%',
    enabled: true,
    recentReplies: [
      { comment: 'Looks amazing!', reply: 'Thanks for your support! ❤️', time: '10 min ago' },
      { comment: 'Is this a sequel?', reply: 'It\'s a standalone story in the same universe!', time: '30 min ago' },
      { comment: 'The visuals are stunning!', reply: 'Wait till you see it on the big screen! 🎬', time: '1 hour ago' },
      { comment: 'Will there be a soundtrack release?', reply: 'Yes! Soundtrack drops next week. 🎵', time: '2 hours ago' },
      { comment: 'Any early screenings?', reply: 'Check our website for premiere event details!', time: '4 hours ago' },
    ]
  },
  {
    platform: 'Pinterest',
    color: '#E60023',
    repliesToday: 22,
    successRate: '93%',
    enabled: true,
    recentReplies: [
      { comment: 'Love this aesthetic! 📌', reply: 'Thanks for pinning! More visuals coming soon! ✨', time: '8 min ago' },
      { comment: 'Perfect for my movie board', reply: 'We\'re honored to be on your board! 🎬', time: '25 min ago' },
      { comment: 'Where can I find more posters?', reply: 'Check our Pinterest boards for exclusive content!', time: '1 hour ago' },
      { comment: 'The color palette is gorgeous', reply: 'Our design team will love hearing that! 🎨', time: '2 hours ago' },
      { comment: 'Saved to watch later!', reply: 'You won\'t regret it! Coming to theaters soon. 🍿', time: '3 hours ago' },
    ]
  }
];

export function CommentAutomationProvider({ children }: { children: ReactNode }) {
  const [platformData, setPlatformData] = useState<PlatformCommentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fallback styling settings if API doesn't provide them
  const platformColors: Record<string, string> = {
    X: '#000000',
    Instagram: '#E4405F',
    TikTok: '#000000',
    Facebook: '#1877F2',
    YouTube: '#FF0000',
    Threads: '#000000',
    Pinterest: '#E60023'
  };

  const fetchCommentData = async () => {
    try {
      const { apiClient } = await import('../lib/api/client');
      const data = await apiClient.get<any[]>('/api/comments/automation/stats');

      if (data.success && Array.isArray(data.data)) {
        // Map color and enabled state (using local defaults for UI)
        const mapped = data.data.map((item: any) => ({
          platform: item.platform,
          color: platformColors[item.platform] || '#000000',
          repliesToday: item.repliesToday,
          successRate: `${item.successRate}%`,
          recentReplies: [], // Expand with actual recent replies endpoint if needed
          enabled: true
        }));
        setPlatformData(mapped);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch comment stats');
      }
    } catch (err) {
      console.error('Error fetching comment automation data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // If error, use the mock data temporarily so UI doesn't break
      setPlatformData(MOCK_PLATFORM_DATA);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCommentData();
  }, []);

  const updatePlatformData = (platform: string, data: Partial<PlatformCommentData>) => {
    setPlatformData(prev =>
      prev.map(p =>
        p.platform === platform ? { ...p, ...data } : p
      )
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