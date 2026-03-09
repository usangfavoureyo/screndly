import { useEffect, useState } from 'react';
import { toast } from "sonner";
import { RefreshCw } from 'lucide-react';
import { haptics } from '../../utils/haptics';
import { apiClient } from '../../lib/api/client';
import { fetchSettings } from '../../lib/api/settings';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { TMDbScheduler } from '../tmdb/TMDbScheduler';
import { TMDbSettings } from './TMDbSettings';
import { AnalyticsSelfOptimization } from './AnalyticsSelfOptimization';

interface TmdbFeedsSettingsProps {
  onSave: () => void;
  onBack: () => void;
}

export function TmdbFeedsSettings({ onSave, onBack }: TmdbFeedsSettingsProps) {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Checking TMDb backend status...');

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await apiClient.get<{ configured: boolean; message?: string }>('/api/tmdb/status');
        if (response.success && response.data) {
          setIsConfigured(response.data.configured);
          setStatusMessage(response.data.message || (response.data.configured ? 'TMDb is configured' : 'TMDb is not configured'));
          return;
        }

        setIsConfigured(false);
        setStatusMessage(response.error?.message || 'Failed to load TMDb status');
      } catch (error: any) {
        setIsConfigured(false);
        setStatusMessage(error?.message || 'Failed to load TMDb status');
      }
    };

    void loadStatus();
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
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
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
        <AnalyticsSelfOptimization
          storageKey="tmdb_settings"
          description="Enable AI-powered optimization to automatically improve captions, posting times, and model selection for TMDb content based on performance analytics."
        />

        <div className="border-t border-gray-200 dark:border-[#333333]" />

        <Alert className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <AlertDescription className="text-sm text-gray-900 dark:text-white">
            TMDb feed generation and scheduling are backend-managed. This screen now reflects the real backend status and
            lets you request an immediate refresh without relying on the old browser-only scheduler.
          </AlertDescription>
        </Alert>

        <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] space-y-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Backend Feed Status</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{statusMessage}</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${
                isConfigured
                  ? 'bg-[#10B981] text-white'
                  : 'bg-gray-200 dark:bg-[#111111] text-gray-700 dark:text-[#9CA3AF]'
              }`}
            >
              {isConfigured ? 'Configured' : 'Not configured'}
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
        </Card>

        <TMDbScheduler />
        <TMDbSettings onSave={onSave} />
      </div>
    </div>
  );
}
