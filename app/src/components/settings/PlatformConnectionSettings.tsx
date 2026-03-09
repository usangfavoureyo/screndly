import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw, Unplug } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { haptics } from '../../utils/haptics';
import {
  beginManagedPlatformOAuth,
  disconnectManagedPlatform,
  fetchManagedPlatformStatuses,
  ManagedPlatform,
  ManagedPlatformStatus,
} from '../../lib/api/platformIntegrations';

interface PlatformRowConfig {
  platform: ManagedPlatform;
  label: string;
  connectLabel?: string;
}

interface PlatformConnectionSettingsProps {
  title: string;
  description: string;
  platforms: PlatformRowConfig[];
  note?: string;
  onSave?: () => void;
}

function formatExpiry(expiresAt?: string): string | null {
  if (!expiresAt) return null;

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;

  return expiry.toLocaleString();
}

function getStatusCopy(status: ManagedPlatformStatus): string {
  if (!status.connected) return 'Not connected';
  if (status.error) return status.error;
  if (status.username) return `Connected as ${status.username}`;
  return 'Connected';
}

export function PlatformConnectionSettings({
  title,
  description,
  platforms,
  note,
  onSave,
}: PlatformConnectionSettingsProps) {
  const [statuses, setStatuses] = useState<Record<ManagedPlatform, ManagedPlatformStatus> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<ManagedPlatform | null>(null);
  const [error, setError] = useState('');

  const isAnyConnected = useMemo(
    () => platforms.some(({ platform }) => statuses?.[platform]?.connected),
    [platforms, statuses]
  );

  const loadStatuses = async () => {
    setIsLoading(true);
    setError('');
    try {
      const nextStatuses = await fetchManagedPlatformStatuses();
      setStatuses(nextStatuses);
    } catch (err: any) {
      setError(err?.message || 'Failed to load platform status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStatuses();
  }, []);

  const handleConnect = async (platform: ManagedPlatform) => {
    haptics.medium();
    setActivePlatform(platform);
    setError('');
    try {
      await beginManagedPlatformOAuth(platform);
    } catch (err: any) {
      setError(err?.message || `Failed to connect ${platform}`);
      setActivePlatform(null);
      haptics.error();
    }
  };

  const handleDisconnect = async (platform: ManagedPlatform) => {
    haptics.medium();
    const confirmed = window.confirm(
      `Disconnect ${platform}? This stops new automated publishing until you reconnect it.`
    );
    if (!confirmed) return;

    setActivePlatform(platform);
    setError('');
    try {
      await disconnectManagedPlatform(platform);
      haptics.success();
      await loadStatuses();
      onSave?.();
    } catch (err: any) {
      setError(err?.message || `Failed to disconnect ${platform}`);
      haptics.error();
    } finally {
      setActivePlatform(null);
    }
  };

  const handleRefresh = async () => {
    haptics.light();
    await loadStatuses();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-[#6B7280]">{description}</p>
      </div>

      {note && (
        <Alert className="border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <AlertCircle className="h-4 w-4 text-[#ec1e24]" />
          <AlertDescription className="ml-2 text-sm text-gray-900 dark:text-white">
            {note}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="border-[#ef4444]/20 bg-[#ef4444]/10">
          <AlertCircle className="h-4 w-4 text-[#ef4444]" />
          <AlertDescription className="ml-2 text-sm text-gray-900 dark:text-white">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {platforms.map(({ platform, label, connectLabel }) => {
          const status = statuses?.[platform] || { connected: false };
          const expiryCopy = formatExpiry(status.expiresAt);
          const busy = activePlatform === platform;

          return (
            <Card
              key={platform}
              className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {status.connected ? (
                      <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-[#9CA3AF]" />
                    )}
                    <span className="text-sm text-gray-900 dark:text-white">{label}</span>
                    <Badge
                      className={
                        status.connected
                          ? 'bg-[#10B981] text-white text-xs'
                          : 'bg-gray-200 dark:bg-[#111111] text-gray-700 dark:text-[#9CA3AF] text-xs'
                      }
                    >
                      {status.connected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-[#6B7280] break-words">
                    {getStatusCopy(status)}
                  </p>

                  {expiryCopy && (
                    <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                      Token expiry: {expiryCopy}
                    </p>
                  )}

                  {status.profileUrl && (
                    <a
                      href={status.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-[#ec1e24] hover:underline"
                    >
                      Open profile
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRefresh()}
                    disabled={isLoading || busy}
                    className="h-8"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${(isLoading || busy) ? 'animate-spin' : ''}`} />
                  </Button>

                  {status.connected ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDisconnect(platform)}
                      disabled={busy}
                      className="h-8 text-[#EF4444] hover:text-[#EF4444]"
                    >
                      <Unplug className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => void handleConnect(platform)}
                      size="sm"
                      disabled={busy}
                      className="h-8 bg-[#ec1e24] hover:bg-[#ec1e24]/90 text-white"
                    >
                      {connectLabel || `Connect ${label}`}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
        <p className="text-sm text-gray-900 dark:text-white mb-1">Backend-managed connections</p>
        <p className="text-xs text-gray-500 dark:text-[#6B7280]">
          OAuth and token storage are now handled through the backend connection flow. After a successful
          connection, the app returns to the Platforms callback screen and syncs the saved status from the server.
        </p>
        {isAnyConnected && (
          <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-2">
            Any advanced test-publish actions should be run from the real posting flows after the platform is connected.
          </p>
        )}
      </Card>
    </div>
  );
}
