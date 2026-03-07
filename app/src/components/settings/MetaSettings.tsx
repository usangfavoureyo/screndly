/**
 * Meta (Facebook/Instagram) Settings Component
 * 
 * Provides UI for:
 * - OAuth connection
 * - Account selection (Page & Instagram)
 * - Token status
 * - Quota monitoring
 * - Publishing preferences
 */

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Unplug } from 'lucide-react';
import { metaAuth } from '../../utils/metaAuth';
import { rateLimiter } from '../../utils/rateLimiter';
import { haptics } from '../../utils/haptics';

interface MetaSettingsProps {
  onSave?: () => void;
}

export function MetaSettings({ onSave }: MetaSettingsProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [quotas, setQuotas] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settings, setSettings] = useState({
    autoPublishInstagram: true,
    autoPublishFacebook: true,
    autoPublishThreads: false,
    preferReels: true,
    shareReelsToFeed: true,
    defaultImageCount: '1',
  });

  useEffect(() => {
    loadMetaStatus();
    loadQuotas();
  }, []);

  const loadMetaStatus = async () => {
    const authenticated = await metaAuth.isAuthenticated();
    setIsConnected(authenticated);

    if (authenticated) {
      const info = await metaAuth.getTokenInfo();
      setTokenInfo(info);
    }
  };

  const loadQuotas = async () => {
    const allQuotas = await rateLimiter.getAllQuotas();
    setQuotas(allQuotas);
  };

  const handleConnect = () => {
    haptics.medium();
    const authUrl = metaAuth.getAuthorizationUrl('/settings');
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    haptics.medium();
    if (confirm('Are you sure you want to disconnect your Meta account? This will stop all Instagram and Facebook automation.')) {
      await metaAuth.revokeToken();
      setIsConnected(false);
      setTokenInfo(null);
    }
  };

  const handleRefreshToken = async () => {
    haptics.light();
    setIsRefreshing(true);
    try {
      const refreshed = await metaAuth.refreshTokenIfNeeded();
      if (refreshed) {
        await loadMetaStatus();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatExpiresIn = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    if (days > 7) {
      return `${days} days`;
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} (refresh soon)`;
    } else {
      const hours = Math.floor(seconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} (expires soon!)`;
    }
  };

  const formatResetTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = timestamp - now;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const getQuotaPercentage = (used: number, limit: number): number => {
    return Math.round((used / limit) * 100);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-gray-900 dark:text-white mb-2">Meta (Facebook & Instagram)</h3>
        <p className="text-sm text-gray-500 dark:text-[#6B7280]">
          Connect your Facebook Page and Instagram Business account to automate trailer posting
        </p>
      </div>

      {/* Connection Status */}
      <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {isConnected ? (
              <CheckCircle2 className="w-5 h-5 text-[#10B981] mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#9CA3AF] mt-0.5" />
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-gray-900 dark:text-white">
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
                {isConnected && (
                  <Badge className="bg-[#10B981] text-white text-xs">Active</Badge>
                )}
              </div>
              {isConnected && tokenInfo && (
                <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                  Token expires in {formatExpiresIn(tokenInfo.expiresIn)}
                </p>
              )}
              {!isConnected && (
                <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                  Connect to start posting to Instagram and Facebook
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isConnected ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshToken}
                  disabled={isRefreshing}
                  className="h-8"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  className="h-8 text-[#EF4444] hover:text-[#EF4444]"
                >
                  <Unplug className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnect}
                size="sm"
                className="bg-[#ec1e24] hover:bg-[#ec1e24]/90 text-white h-8"
              >
                Connect Meta
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Setup Instructions */}
      {!isConnected && (
        <Alert className="border-[#ec1e24]/20 bg-[#ec1e24]/5 dark:bg-[#ec1e24]/10">
          <AlertCircle className="h-4 w-4 text-[#ec1e24]" />
          <AlertDescription className="text-sm text-gray-900 dark:text-white ml-2">
            <strong className="block mb-2">Before connecting, ensure you have:</strong>
            <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600 dark:text-[#9CA3AF]">
              <li>A Meta Developer App created at <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline inline-flex items-center gap-1">developers.facebook.com <ExternalLink className="w-3 h-3" /></a></li>
              <li>A Facebook Page created and connected to your app</li>
              <li>An Instagram Business account linked to your Facebook Page</li>
              <li>Required permissions approved in app review (see documentation)</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {/* Quota Monitoring */}
      {isConnected && quotas && (
        <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <h4 className="text-sm text-gray-900 dark:text-white mb-4">Daily Publishing Quotas</h4>
          <div className="space-y-4">
            {/* Instagram Feed */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">Instagram Feed</span>
                <span className="text-xs text-gray-900 dark:text-white">
                  {quotas.instagram_feed.used} / {quotas.instagram_feed.limit}
                </span>
              </div>
              <Progress 
                value={getQuotaPercentage(quotas.instagram_feed.used, quotas.instagram_feed.limit)} 
                className="h-1.5"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Resets in {formatResetTime(quotas.instagram_feed.resetAt)}
              </p>
            </div>

            {/* Instagram Reels */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">Instagram Reels</span>
                <span className="text-xs text-gray-900 dark:text-white">
                  {quotas.instagram_reels.used} / {quotas.instagram_reels.limit}
                </span>
              </div>
              <Progress 
                value={getQuotaPercentage(quotas.instagram_reels.used, quotas.instagram_reels.limit)} 
                className="h-1.5"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Resets in {formatResetTime(quotas.instagram_reels.resetAt)}
              </p>
            </div>

            {/* Facebook */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">Facebook Page</span>
                <span className="text-xs text-gray-900 dark:text-white">
                  {quotas.facebook.used} / {quotas.facebook.limit}
                </span>
              </div>
              <Progress 
                value={getQuotaPercentage(quotas.facebook.used, quotas.facebook.limit)} 
                className="h-1.5"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Resets in {formatResetTime(quotas.facebook.resetAt)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Publishing Settings */}
      {isConnected && (
        <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <h4 className="text-sm text-gray-900 dark:text-white mb-4">Publishing Settings</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Auto-publish to Instagram</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Automatically post trailers to Instagram
                </p>
              </div>
              <Switch
                checked={settings.autoPublishInstagram}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, autoPublishInstagram: checked });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Auto-publish to Facebook</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Automatically post trailers to Facebook Page
                </p>
              </div>
              <Switch
                checked={settings.autoPublishFacebook}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, autoPublishFacebook: checked });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Prefer Reels over Feed Posts</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Post as Reels when video meets requirements
                </p>
              </div>
              <Switch
                checked={settings.preferReels}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, preferReels: checked });
                }}
              />
            </div>

            {settings.preferReels && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-gray-200 dark:border-[#333333]">
                <div>
                  <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Share Reels to Feed</Label>
                  <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                    Also show Reels in main feed
                  </p>
                </div>
                <Switch
                  checked={settings.shareReelsToFeed}
                  onCheckedChange={(checked) => {
                    haptics.light();
                    setSettings({ ...settings, shareReelsToFeed: checked });
                  }}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Threads Integration</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Experimental - Check Meta docs for availability
                </p>
              </div>
              <Switch
                checked={settings.autoPublishThreads}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, autoPublishThreads: checked });
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Documentation Links */}
      <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
        <h4 className="text-sm text-gray-900 dark:text-white mb-3">Documentation</h4>
        <div className="space-y-2">
          <a
            href="https://developers.facebook.com/docs/instagram-api/guides/content-publishing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Instagram Content Publishing Guide
          </a>
          <a
            href="https://developers.facebook.com/docs/instagram-api/guides/reels"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Instagram Reels Publishing Guide
          </a>
          <a
            href="https://developers.facebook.com/docs/video-api"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Facebook Video API Documentation
          </a>
          <a
            href="/legal/privacy"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Privacy Policy
          </a>
          <a
            href="/legal/data-deletion"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Data Deletion Instructions
          </a>
        </div>
      </Card>
    </div>
  );
}
