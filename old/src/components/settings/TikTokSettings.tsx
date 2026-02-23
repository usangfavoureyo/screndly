/**
 * TikTok Settings Component
 * 
 * Provides UI for:
 * - OAuth connection
 * - API verification status
 * - Token management
 * - Quota monitoring
 * - Test publish functionality
 * - Detailed logs display
 */

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Unplug,
  Loader2,
  Clock,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { tiktokAuth } from '../../utils/tiktokAuth';
import { tiktokAdapter } from '../../adapters/tiktokAdapter';
import { haptics } from '../../utils/haptics';

interface TikTokSettingsProps {
  onSave?: () => void;
}

export function TikTokSettings({ onSave }: TikTokSettingsProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [quotas, setQuotas] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  
  // Test publish state
  const [testTitle, setTestTitle] = useState('Amazing movie trailer! 🎬 #Movies #Trailer');
  const [testVideoUrl, setTestVideoUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishLogs, setPublishLogs] = useState<string[]>([]);
  const [lastPublishResult, setLastPublishResult] = useState<any>(null);

  // Settings
  const [settings, setSettings] = useState({
    autoPublish: true,
    privacyLevel: 'PUBLIC_TO_EVERYONE' as const,
    disableComments: false,
    disableDuet: false,
    disableStitch: false,
  });

  useEffect(() => {
    loadTikTokStatus();
    loadQuotas();
  }, []);

  const loadTikTokStatus = async () => {
    const authenticated = await tiktokAuth.isAuthenticated();
    setIsConnected(authenticated);

    if (authenticated) {
      const info = await tiktokAuth.getTokenInfo();
      setTokenInfo(info);

      try {
        const user = await tiktokAdapter.getUserInfo();
        setUserInfo(user);
      } catch (error) {
        console.error('Failed to load user info:', error);
      }
    }
  };

  const loadQuotas = async () => {
    const usage = await tiktokAdapter.getQuotaUsage();
    setQuotas(usage);
  };

  const handleConnect = async () => {
    haptics.medium();
    const authUrl = await tiktokAuth.getAuthorizationUrl('/settings');
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    haptics.medium();
    if (confirm('Are you sure you want to disconnect your TikTok account? This will stop all TikTok automation.')) {
      await tiktokAuth.revokeToken();
      setIsConnected(false);
      setTokenInfo(null);
      setUserInfo(null);
    }
  };

  const handleRefreshToken = async () => {
    haptics.light();
    setIsRefreshing(true);
    try {
      const refreshed = await tiktokAuth.refreshTokenIfNeeded();
      if (refreshed) {
        await loadTikTokStatus();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTestPublish = async () => {
    if (!testTitle.trim()) {
      alert('Please enter a title');
      return;
    }

    if (!testVideoUrl.trim()) {
      alert('Please enter a video URL');
      return;
    }

    haptics.medium();
    setIsPublishing(true);
    setPublishLogs([]);
    setLastPublishResult(null);

    try {
      const result = await tiktokAdapter.post({
        videoUrl: testVideoUrl,
        title: testTitle,
        privacyLevel: settings.privacyLevel,
        disableComment: settings.disableComments,
        disableDuet: settings.disableDuet,
        disableStitch: settings.disableStitch,
      });

      setPublishLogs(result.logs);
      setLastPublishResult(result);

      if (result.success) {
        haptics.success();
        await loadQuotas();
      } else {
        haptics.error();
      }
    } catch (error: any) {
      haptics.error();
      setPublishLogs([...publishLogs, `[ERROR] ${error.message}`]);
      setLastPublishResult({ success: false, error: error.message, logs: publishLogs });
    } finally {
      setIsPublishing(false);
    }
  };

  const formatExpiresIn = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    } else {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  };

  const formatResetTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = timestamp - now;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatNextPostTime = (timestamp: number): string => {
    if (timestamp <= Date.now()) {
      return 'Now';
    }
    
    const diff = timestamp - Date.now();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const canPostNow = quotas && quotas.nextPostAllowed <= Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-gray-900 dark:text-white mb-2">TikTok</h3>
        <p className="text-sm text-gray-500 dark:text-[#6B7280]">
          Connect your TikTok account to automate trailer posting
        </p>
      </div>

      {/* API Verification Status */}
      {!isConnected && (
        <Alert className="border-[#FFA500]/20 bg-[#FFA500]/10">
          <Shield className="h-4 w-4 text-[#FFA500]" />
          <AlertDescription className="text-sm text-gray-900 dark:text-white ml-2">
            <strong className="block mb-2">⚠️ TikTok API Requires Verification</strong>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2">
              Before you can connect, your TikTok Developer App must be approved by TikTok:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600 dark:text-[#9CA3AF] ml-2">
              <li>Create app at <a href="https://developers.tiktok.com/" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline">developers.tiktok.com</a></li>
              <li>Request "Login Kit" and "Content Posting API" access</li>
              <li>Submit for review (3-5 business days)</li>
              <li>Provide use case documentation and demo video</li>
              <li>Wait for approval email from TikTok</li>
            </ol>
            <Button
              onClick={() => window.open('https://developers.tiktok.com/', '_blank')}
              size="sm"
              className="mt-3 bg-[#000000] hover:bg-[#000000]/90 text-white h-7 text-xs"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Go to TikTok Developers
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Status */}
      <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
        <div className="flex items-start justify-between mb-4">
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
              {isConnected && userInfo && (
                <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                  @{userInfo.display_name}
                </p>
              )}
              {isConnected && tokenInfo && (
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                  Token expires in {formatExpiresIn(tokenInfo.expiresIn)}
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
                className="bg-[#000000] hover:bg-[#000000]/90 text-white h-8"
              >
                Connect TikTok
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Setup Instructions */}
      {!isConnected && (
        <Alert className="border-[#000000]/20 bg-[#000000]/5 dark:bg-[#000000]/30">
          <AlertCircle className="h-4 w-4 text-[#000000] dark:text-white" />
          <AlertDescription className="text-sm text-gray-900 dark:text-white ml-2">
            <strong className="block mb-2">TikTok Developer Setup Required</strong>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2">
              Complete these steps to enable TikTok integration:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-600 dark:text-[#9CA3AF]">
              <li>Create TikTok Developer account at <a href="https://developers.tiktok.com" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline inline-flex items-center gap-1">developers.tiktok.com <ExternalLink className="w-3 h-3" /></a></li>
              <li>Create new app in Developer Portal</li>
              <li>Request "Login Kit" and "Content Posting API" scopes</li>
              <li>Add callback URL: {process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/auth/tiktok/callback'}</li>
              <li>Submit app for review with:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                  <li>Use case description (automated trailer posting)</li>
                  <li>Demo video showing integration</li>
                  <li>Screenshots of Screndly dashboard</li>
                </ul>
              </li>
              <li>Wait 3-5 business days for approval</li>
              <li>Once approved, return here to connect</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {/* Quota Monitoring */}
      {isConnected && quotas && (
        <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-[#ec1e24]" />
            <h4 className="text-sm text-gray-900 dark:text-white">Posting Quotas</h4>
          </div>
          
          <div className="space-y-4">
            {/* Daily Quota */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">Daily Posts</span>
                <span className="text-xs text-gray-900 dark:text-white">
                  {quotas.daily.used} / {quotas.daily.limit}
                </span>
              </div>
              <Progress 
                value={(quotas.daily.used / quotas.daily.limit) * 100} 
                className="h-1.5"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Resets in {formatResetTime(quotas.daily.resetAt)}
              </p>
            </div>

            {/* Hourly Quota */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">Hourly Posts</span>
                <span className="text-xs text-gray-900 dark:text-white">
                  {quotas.hourly.used} / {quotas.hourly.limit}
                </span>
              </div>
              <Progress 
                value={(quotas.hourly.used / quotas.hourly.limit) * 100} 
                className="h-1.5"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Resets in {formatResetTime(quotas.hourly.resetAt)}
              </p>
            </div>

            {/* Next Post Allowed */}
            <div className="pt-3 border-t border-gray-200 dark:border-[#333333]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">Next post allowed:</span>
                <Badge className={`text-xs ${canPostNow ? 'bg-[#10B981]' : 'bg-[#F59E0B]'} text-white`}>
                  {formatNextPostTime(quotas.nextPostAllowed)}
                </Badge>
              </div>
              {!canPostNow && (
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-2">
                  ⏰ TikTok recommends waiting 1 hour between posts
                </p>
              )}
            </div>
          </div>

          {/* TikTok Posting Tips */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333333]">
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2">
              📊 TikTok Best Practices:
            </p>
            <ul className="text-xs text-gray-500 dark:text-[#6B7280] space-y-1">
              <li>• Maximum 5 posts per day</li>
              <li>• Wait 1 hour between posts</li>
              <li>• Best times: 6-10 AM, 7-11 PM</li>
              <li>• Videos 15-60 seconds perform best</li>
            </ul>
          </div>
        </Card>
      )}

      {/* Test Publish */}
      {isConnected && (
        <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <h4 className="text-sm text-gray-900 dark:text-white mb-4">Test Publish</h4>
          
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2 block">
                Title (required, max 150 characters)
              </Label>
              <Textarea
                value={testTitle}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  setTestTitle(e.target.value);
                }}
                placeholder="Enter your TikTok caption..."
                className="!bg-gray-100 dark:!bg-[#000000] !text-gray-900 dark:!text-white text-sm border-gray-300 dark:border-[#333333] min-h-[80px]"
                maxLength={150}
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                {testTitle.length} / 150 characters
              </p>
            </div>

            <div>
              <Label className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2 block">
                Video URL (required)
              </Label>
              <Input
                value={testVideoUrl}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  setTestVideoUrl(e.target.value);
                }}
                placeholder="https://example.com/video.mp4"
                className="!bg-gray-100 dark:!bg-[#000000] !text-gray-900 dark:!text-white text-sm border-gray-300 dark:border-[#333333]"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                3s - 10min, max 4GB, 9:16 vertical recommended
              </p>
            </div>

            <Button
              onClick={handleTestPublish}
              disabled={isPublishing || !testTitle.trim() || !testVideoUrl.trim() || !canPostNow}
              className="w-full bg-[#000000] hover:bg-[#000000]/90 text-white"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : !canPostNow ? (
                <>
                  Wait {formatNextPostTime(quotas?.nextPostAllowed || 0)}
                </>
              ) : (
                <>
                  Test Publish
                </>
              )}
            </Button>

            {!canPostNow && (
              <Alert className="border-[#F59E0B]/20 bg-[#F59E0B]/10">
                <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                <AlertDescription className="text-xs text-gray-900 dark:text-white ml-2">
                  Please wait {formatNextPostTime(quotas?.nextPostAllowed || 0)} before posting again to comply with TikTok's rate limits.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Publish Logs */}
          {publishLogs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333333]">
              <Label className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2 block">
                Publish Logs
              </Label>
              <div className="bg-gray-900 dark:bg-[#0a0a0a] p-3 rounded-lg text-xs font-mono max-h-48 overflow-y-auto">
                {publishLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`${
                      log.includes('[ERROR]') || log.includes('Error')
                        ? 'text-red-400'
                        : log.includes('success') || log.includes('complete')
                        ? 'text-green-400'
                        : 'text-gray-300'
                    }`}
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Publish Result */}
          {lastPublishResult && (
            <div className="mt-4">
              {lastPublishResult.success ? (
                <Alert className="border-green-500/20 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-sm text-gray-900 dark:text-white ml-2">
                    <strong>Video published successfully!</strong>
                    {lastPublishResult.publishId && (
                      <div className="mt-1 text-xs">
                        Publish ID: {lastPublishResult.publishId}
                      </div>
                    )}
                    {lastPublishResult.shareUrl && (
                      <div className="mt-1">
                        <a 
                          href={lastPublishResult.shareUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-[#ec1e24] hover:underline inline-flex items-center gap-1"
                        >
                          View on TikTok <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {lastPublishResult.processingTime && (
                      <div className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-1">
                        Processing time: {lastPublishResult.processingTime}ms
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-500/20 bg-red-500/10">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-sm text-gray-900 dark:text-white ml-2">
                    <strong>Publish failed</strong>
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {lastPublishResult.error}
                    </div>
                    {lastPublishResult.retryAfter && (
                      <div className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-1">
                        Retry after {lastPublishResult.retryAfter} seconds
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Publishing Settings */}
      {isConnected && (
        <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <h4 className="text-sm text-gray-900 dark:text-white mb-4">Publishing Settings</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Auto-publish to TikTok</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Automatically post trailers to TikTok
                </p>
              </div>
              <Switch
                checked={settings.autoPublish}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, autoPublish: checked });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Disable Comments</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Turn off comments on videos
                </p>
              </div>
              <Switch
                checked={settings.disableComments}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, disableComments: checked });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Disable Duet</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Prevent others from duetting
                </p>
              </div>
              <Switch
                checked={settings.disableDuet}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, disableDuet: checked });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Disable Stitch</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Prevent others from stitching
                </p>
              </div>
              <Switch
                checked={settings.disableStitch}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, disableStitch: checked });
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
            href="https://developers.tiktok.com/doc/getting-started-create-an-app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Create TikTok App
          </a>
          <a
            href="https://developers.tiktok.com/doc/content-posting-api-get-started"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Content Posting API Guide
          </a>
          <a
            href="https://developers.tiktok.com/doc/app-review-process"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            App Review Process
          </a>
        </div>
      </Card>
    </div>
  );
}
