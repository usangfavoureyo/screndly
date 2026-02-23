import { Calendar } from 'lucide-react';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";

interface TMDbStatsPanelProps {
  feeds: Array<{
    id: string;
    scheduledTime: string;
    cacheHit: boolean;
    caption: string;
  }>;
  onFilterChange?: (filter: 'all' | 'today' | 'weekly' | 'monthly' | 'anniversary') => void;
}

export function TMDbStatsPanel({ feeds, onFilterChange }: TMDbStatsPanelProps) {
  // Calculate real statistics from feeds
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  
  // Ready to post: feeds scheduled within next 24 hours
  const readyCount = feeds.filter(feed => {
    const scheduledDate = new Date(feed.scheduledTime);
    return scheduledDate >= now && scheduledDate < todayEnd;
  }).length;
  
  // Find next feed scheduled after now
  const upcomingFeeds = feeds
    .filter(feed => new Date(feed.scheduledTime) >= now)
    .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  
  const nextFeed = upcomingFeeds[0];
  const nextGeneration = nextFeed 
    ? getTimeUntil(new Date(nextFeed.scheduledTime))
    : 'No upcoming';
  
  // Cache hit rate
  const cacheHitCount = feeds.filter(feed => feed.cacheHit).length;
  const cacheHitRate = feeds.length > 0 ? Math.round((cacheHitCount / feeds.length) * 100) : 0;
  
  // Token estimation: ~3 tokens per word, average caption ~30 words = ~90 tokens per feed
  const tokensUsed = feeds.length * 90;
  const tokensLimit = 10000;
  
  // TMDb API calls (1 per feed for metadata, 1 for image)
  const tmdbCalls = feeds.length * 2;
  const tmdbLimit = 1000;

  const stats = {
    readyCount,
    nextGeneration,
    cacheHitRate,
    tokensUsed,
    tokensLimit,
    tmdbCalls,
    tmdbLimit,
  };

  function getTimeUntil(date: Date): string {
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      return `${days}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m`;
    } else if (diffMins > 0) {
      return `${diffMins}m`;
    } else {
      return 'Soon';
    }
  }

  const handleReadyClick = () => {
    haptics.light();
    onFilterChange?.('today');
    toast.success(`Showing ${readyCount} feeds ready to post`);
  };

  const handleCacheClick = () => {
    haptics.light();
    toast.info(`${cacheHitCount} of ${feeds.length} feeds used cached data`, {
      description: 'Cached feeds load faster and reduce API costs',
    });
  };

  const handleTokensClick = () => {
    haptics.light();
    const remaining = tokensLimit - tokensUsed;
    toast.info(`${tokensUsed.toLocaleString()} tokens used today`, {
      description: `${remaining.toLocaleString()} tokens remaining`,
    });
  };

  const handleApiCallsClick = () => {
    haptics.light();
    const remaining = tmdbLimit - tmdbCalls;
    toast.info(`${tmdbCalls} TMDb API calls today`, {
      description: `${remaining} calls remaining`,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Ready Items */}
      <div 
        className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-xl dark:hover:shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition-all text-left"
      >
        <div className="flex items-center justify-between mb-2">
          <Calendar className="w-5 h-5 text-[#ec1e24]" />
        </div>
        <div className="text-2xl text-gray-900 dark:text-white mb-1">
          {stats.readyCount}
        </div>
        <div className="text-sm text-gray-600 dark:text-[#9CA3AF]">
          Ready to Post
        </div>
        <div className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
          Next: {stats.nextGeneration}
        </div>
      </div>
    </div>
  );
}