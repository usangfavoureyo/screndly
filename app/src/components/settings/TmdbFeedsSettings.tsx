import { useEffect, useRef, useState } from 'react';
import { toast } from "sonner";
import { RefreshCw } from 'lucide-react';
import { haptics } from '../../utils/haptics';
import { apiClient } from '../../lib/api/client';
import { fetchSettings } from '../../lib/api/settings';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { TMDbScheduler } from '../tmdb/TMDbScheduler';
import { TMDbSettings } from './TMDbSettings';
import { AnalyticsSelfOptimization } from './AnalyticsSelfOptimization';
import { BackIconButton } from '../BackIconButton';

interface TmdbFeedsSettingsProps {
  onBack: () => void;
}

export function TmdbFeedsSettings({ onBack }: TmdbFeedsSettingsProps) {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Checking whether the backend can reach TMDb...');
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const response = await apiClient.get<{ configured: boolean; message?: string }>('/api/tmdb/status');
        if (cancelled) {
          return;
        }

        if (response.success && response.data) {
          setIsConfigured(response.data.configured);
          setStatusMessage(
            response.data.message ||
            (response.data.configured
              ? 'TMDb API key is configured on the backend.'
              : 'TMDb API key is not configured on the backend.')
          );
          return;
        }

        setIsConfigured(false);
        setStatusMessage(response.error?.message || 'Failed to load TMDb status');
      } catch (error: any) {
        if (cancelled) {
          return;
        }
        setIsConfigured(false);
        setStatusMessage(error?.message || 'Failed to load TMDb status');
      }
    };

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefreshNow = async () => {
    haptics.light();
    setIsRefreshing(true);
    try {
      const settingsResponse = await fetchSettings();
      const settings = settingsResponse.success ? settingsResponse.data : undefined;
      const response = await apiClient.post<{ added: number; errors?: string[]; message?: string }>(
        '/api/tmdb/refresh',
        { settings }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'TMDb refresh failed');
      }

      const errorCount = response.data.errors?.length || 0;
      toast.success(
        errorCount > 0
          ? `TMDb refresh added ${response.data.added} posts with ${errorCount} issues`
          : `TMDb refresh added ${response.data.added} posts`
      );
    } catch (error: any) {
      toast.error(error?.message || 'Failed to refresh TMDb feeds');
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <div
      className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto overscroll-y-contain touch-pan-y"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] flex items-center gap-3 z-10">
        <BackIconButton
          onClick={() => {
            onBack();
          }}
        />
        <h2 className="text-gray-900 dark:text-white text-xl">TMDb Feeds</h2>
      </div>

      <div className="space-y-6 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-6">
        <AnalyticsSelfOptimization
          storageKey="tmdb_settings"
          description="Enable AI-powered optimization to automatically improve captions, posting times, and model selection for TMDb content based on performance analytics."
        />

        <div className="border-t border-gray-200 dark:border-[#333333]" />

        <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div>
                <h3 className="text-gray-900 dark:text-white mb-1">Manual Refresh</h3>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  Use this when you want to pull the latest TMDb feed immediately. Regular feed refreshes already run automatically on the schedule below.
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                {statusMessage}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${
                  isConfigured === null
                    ? 'bg-gray-200 dark:bg-[#111111] text-gray-700 dark:text-[#9CA3AF]'
                    : isConfigured
                      ? 'bg-[#10B981] text-white'
                      : 'bg-gray-200 dark:bg-[#111111] text-gray-700 dark:text-[#9CA3AF]'
                }`}
              >
                {isConfigured === null ? 'Checking connection' : isConfigured ? 'Configured' : 'Not configured'}
              </span>

              <Button
                onClick={() => void handleRefreshNow()}
                disabled={isRefreshing || isConfigured === false}
                className="bg-[#ec1e24] hover:bg-[#ec1e24]/90 text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Sync TMDb Now
              </Button>
            </div>
          </div>
        </Card>

        <TMDbScheduler />
        <TMDbSettings />
      </div>
    </div>
  );
}
