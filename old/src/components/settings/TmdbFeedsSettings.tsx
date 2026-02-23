import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";
import { TMDbScheduler } from '../tmdb/TMDbScheduler';
import { TMDbSettings } from './TMDbSettings';
import { useState, useEffect } from 'react';
import { autopostEngine } from '../../lib/autopost/autopostEngine';
import { postQueue } from '../../lib/autopost/postQueue';
import { tmdbFeedScheduler } from '../../lib/autopost/tmdbFeedScheduler';
import { AnalyticsSelfOptimization } from './AnalyticsSelfOptimization';

interface TmdbFeedsSettingsProps {
  onSave: () => void;
  onBack: () => void;
}

export function TmdbFeedsSettings({ onSave, onBack }: TmdbFeedsSettingsProps) {
  const [engineStatus, setEngineStatus] = useState(autopostEngine.getStatus());
  const [queueStats, setQueueStats] = useState(postQueue.getStats());
  const [rateConfig, setRateConfig] = useState(postQueue.getRateConfig());
  const [schedulerStatus, setSchedulerStatus] = useState(tmdbFeedScheduler.getStatus());

  // Update status every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setEngineStatus(autopostEngine.getStatus());
      setQueueStats(postQueue.getStats());
      setSchedulerStatus(tmdbFeedScheduler.getStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleEngine = (enabled: boolean) => {
    haptics.light();
    if (enabled) {
      autopostEngine.start();
    } else {
      autopostEngine.stop();
    }
    setEngineStatus(autopostEngine.getStatus());
    toast.success(enabled ? 'Autopost engine started' : 'Autopost engine stopped');
  };

  const handleUpdateTickInterval = (value: string) => {
    haptics.light();
    const interval = parseInt(value);
    if (interval >= 5 && interval <= 1440) {
      autopostEngine.updateConfig({ tickInterval: interval });
      setEngineStatus(autopostEngine.getStatus());
    }
  };

  const handleUpdateRateConfig = (key: string, value: number) => {
    haptics.light();
    postQueue.updateRateConfig({ [key]: value });
    setRateConfig(postQueue.getRateConfig());
    toast.success('Rate limit updated');
  };

  const handleForceExecute = async () => {
    haptics.light();
    toast.info('Triggering immediate post check...');
    await autopostEngine.forceExecute();
    setQueueStats(postQueue.getStats());
  };

  const handleCleanupQueue = () => {
    haptics.light();
    postQueue.cleanup();
    setQueueStats(postQueue.getStats());
    toast.success('Queue cleaned up');
  };

  const handleToggleScheduler = (enabled: boolean) => {
    haptics.light();
    if (enabled) {
      tmdbFeedScheduler.start();
    } else {
      tmdbFeedScheduler.stop();
    }
    setSchedulerStatus(tmdbFeedScheduler.getStatus());
    toast.success(enabled ? 'Scheduler started' : 'Scheduler stopped');
  };

  const handleForceRefreshScheduler = async () => {
    haptics.light();
    toast.info('Refreshing TMDb feeds and feeding to queue...');
    await tmdbFeedScheduler.forceRefresh();
    setSchedulerStatus(tmdbFeedScheduler.getStatus());
    setQueueStats(postQueue.getStats());
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3 z-10">
        <button
          className="text-gray-900 dark:text-white p-1"
          onClick={() => {
            haptics.light();
            onBack();
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-gray-900 dark:text-white text-xl">TMDb Feeds</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Analytics-Driven Self-Optimization */}
        <AnalyticsSelfOptimization
          storageKey="tmdb_settings"
          description="Enable AI-powered optimization to automatically improve captions, posting times, and model selection for TMDb content based on performance analytics."
        />

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-[#333333]"></div>

        {/* TMDb Scheduler Section */}
        <TMDbScheduler />

        {/* TMDb Settings Section */}
        <TMDbSettings onSave={onSave} />

        {/* Queue Statistics */}
        <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-6">
          <h3 className="text-gray-900 dark:text-white mb-4">Post Queue</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
              <div className="text-2xl text-gray-900 dark:text-white">{queueStats.total}</div>
              <div className="text-sm text-gray-600 dark:text-[#9CA3AF]">Total in Queue</div>
            </div>

            <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
              <div className="text-2xl text-green-500">{queueStats.byStatus.queued || 0}</div>
              <div className="text-sm text-gray-600 dark:text-[#9CA3AF]">Queued</div>
            </div>

            <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
              <div className="text-2xl text-blue-500">{queueStats.byStatus.posted || 0}</div>
              <div className="text-sm text-gray-600 dark:text-[#9CA3AF]">Posted</div>
            </div>

            <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
              <div className="text-2xl text-red-500">{queueStats.byStatus.failed || 0}</div>
              <div className="text-sm text-gray-600 dark:text-[#9CA3AF]">Failed</div>
            </div>
          </div>

          {/* Priority Breakdown */}
          <div className="space-y-2">
            <h4 className="text-sm text-gray-600 dark:text-[#9CA3AF]">By Priority</h4>
            <div className="grid grid-cols-4 gap-2">
              {(['P1', 'P2', 'P3', 'P4'] as const).map(priority => (
                <div
                  key={priority}
                  className="bg-white dark:bg-[#000000] rounded-lg p-3 border border-gray-200 dark:border-[#333333] text-center"
                >
                  <div className="text-lg text-gray-900 dark:text-white">
                    {queueStats.byPriority[priority]}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-[#9CA3AF]">{priority}</div>
                </div>
              ))}
            </div>
          </div>

          {queueStats.nextPostEligibleIn !== undefined && (
            <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Next post eligible in {queueStats.nextPostEligibleIn} minutes
              </p>
            </div>
          )}
        </div>

        {/* Rate Governor Configuration */}
        <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-6 space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Rate Governor</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              Global posting limits to prevent spam and maintain quality
            </p>
          </div>

          {/* Min Gap Between Posts */}
          <div>
            <Label htmlFor="min-gap" className="text-[#9CA3AF]">
              Minimum Gap Between Posts (minutes)
            </Label>
            <Input
              id="min-gap"
              type="number"
              min="30"
              max="1440"
              value={rateConfig.minGapBetweenPosts}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                handleUpdateRateConfig('minGapBetweenPosts', parseInt(e.target.value));
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">
              Enforced spacing between ANY posts (default: 180 minutes / 3 hours)
            </p>
          </div>

          {/* Max Posts Per Day */}
          <div>
            <Label htmlFor="max-posts" className="text-[#9CA3AF]">
              Max Posts Per Day (per platform)
            </Label>
            <Input
              id="max-posts"
              type="number"
              min="1"
              max="50"
              value={rateConfig.maxPostsPerDay}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                handleUpdateRateConfig('maxPostsPerDay', parseInt(e.target.value));
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">
              Maximum posts allowed per platform per day (default: 6)
            </p>
          </div>

          {/* Quiet Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quiet-start" className="text-[#9CA3AF]">
                Quiet Hours Start
              </Label>
              <Input
                id="quiet-start"
                type="number"
                min="0"
                max="23"
                value={rateConfig.quietHoursStart}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  handleUpdateRateConfig('quietHoursStart', parseInt(e.target.value));
                }}
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
              />
            </div>

            <div>
              <Label htmlFor="quiet-end" className="text-[#9CA3AF]">
                Quiet Hours End
              </Label>
              <Input
                id="quiet-end"
                type="number"
                min="0"
                max="23"
                value={rateConfig.quietHoursEnd}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  handleUpdateRateConfig('quietHoursEnd', parseInt(e.target.value));
                }}
                className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">
            No posts will be made during quiet hours (24-hour format, default: 0-7 = midnight to 7am)
          </p>
        </div>

        {/* Execution Interval */}
        <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-6">
          <h3 className="text-gray-900 dark:text-white mb-4">Execution Interval</h3>

          <div>
            <Label htmlFor="tick-interval" className="text-[#9CA3AF]">
              Check Interval (minutes)
            </Label>
            <Input
              id="tick-interval"
              type="number"
              min="5"
              max="1440"
              value={engineStatus.config.tickInterval}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                handleUpdateTickInterval(e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">
              How often the engine checks for eligible posts (default: 15 minutes)
            </p>
          </div>
        </div>

        {/* Architecture Info */}
        <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-6">
          <h3 className="text-gray-900 dark:text-white mb-4">How It Works</h3>
          <div className="space-y-3 text-sm text-gray-600 dark:text-[#9CA3AF]">
            <div className="flex items-start gap-2">
              <span className="text-[#ec1e24] mt-0.5">1.</span>
              <div>
                <span className="text-gray-900 dark:text-white">Feeds Curate:</span> Today/Weekly/Monthly/Anniversary feeds independently decide what's eligible
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#ec1e24] mt-0.5">2.</span>
              <div>
                <span className="text-gray-900 dark:text-white">Queue Collects:</span> All eligible items flow into single unified queue with priority ranking
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#ec1e24] mt-0.5">3.</span>
              <div>
                <span className="text-gray-900 dark:text-white">Engine Posts:</span> Every {engineStatus.config.tickInterval} minutes, highest-priority item posts if rate limits allow
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#ec1e24] mt-0.5">4.</span>
              <div>
                <span className="text-gray-900 dark:text-white">No Flooding:</span> Strict {rateConfig.minGapBetweenPosts}-minute gaps and {rateConfig.maxPostsPerDay} posts/day limits enforced globally
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}