/**
 * X (Twitter) Settings Component
 * 
 * Provides UI for:
 * - OAuth connection
 * - Account tier selection
 * - Token status
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
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
  TrendingUp,
} from 'lucide-react';
import { xAuth } from '../../utils/xAuth';
import { xAdapter, AccountTier } from '../../adapters/xAdapter';
import { haptics } from '../../utils/haptics';

interface XSettingsProps {
  onSave?: () => void;
}

export function XSettings({ onSave }: XSettingsProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [quotas, setQuotas] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accountTier, setAccountTier] = useState<AccountTier>('free');
  
  // Test publish state
  const [testText, setTestText] = useState('Testing Screndly X integration 🎬 #Screndly');
  const [testVideoUrl, setTestVideoUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishLogs, setPublishLogs] = useState<string[]>([]);
  const [lastPublishResult, setLastPublishResult] = useState<any>(null);

  // Settings
  const [settings, setSettings] = useState({
    autoPublish: true,
    includeHashtags: true,
    mentionAccount: '',
  });

  useEffect(() => {
    loadXStatus();
    loadQuotas();
  }, []);

  useEffect(() => {
    if (accountTier) {
      xAdapter.setTier(accountTier);
      loadQuotas();
    }
  }, [accountTier]);

  const loadXStatus = async () => {
    const authenticated = await xAuth.isAuthenticated();
    setIsConnected(authenticated);

    if (authenticated) {
      const info = await xAuth.getTokenInfo();
      setTokenInfo(info);
    }
  };

  const loadQuotas = async () => {
    const usage = await xAdapter.getQuotaUsage();
    setQuotas(usage);
  };

  const handleConnect = async () => {
    haptics.medium();
    const authUrl = await xAuth.getAuthorizationUrl('/settings');
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    haptics.medium();
    if (confirm('Are you sure you want to disconnect your X account? This will stop all X automation.')) {
      await xAuth.revokeToken();
      setIsConnected(false);
      setTokenInfo(null);
    }
  };

  const handleRefreshToken = async () => {
    haptics.light();
    setIsRefreshing(true);
    try {
      const refreshed = await xAuth.refreshTokenIfNeeded();
      if (refreshed) {
        await loadXStatus();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTestPublish = async () => {
    if (!testText.trim()) {
      alert('Please enter tweet text');
      return;
    }

    haptics.medium();
    setIsPublishing(true);
    setPublishLogs([]);
    setLastPublishResult(null);

    try {
      const result = await xAdapter.post({
        text: testText,
        videoUrl: testVideoUrl || undefined,
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
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  };

  const formatResetTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = timestamp - now;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d`;
    }
    return `${hours}h ${minutes}m`;
  };

  const getQuotaPercentage = (used: number, limit: number): number => {
    return Math.round((used / limit) * 100);
  };

  const getTierColor = (tier: AccountTier): string => {
    switch (tier) {
      case 'free': return 'bg-gray-500';
      case 'basic': return 'bg-blue-500';
      case 'pro': return 'bg-purple-500';
      case 'enterprise': return 'bg-[#ec1e24]';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-gray-900 dark:text-white mb-2">X (Twitter)</h3>
        <p className="text-sm text-gray-500 dark:text-[#6B7280]">
          Connect your X account to automate trailer posting with video support
        </p>
      </div>

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
              {isConnected && tokenInfo && (
                <p className="text-xs text-gray-500 dark:text-[#6B7280]">
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
                Connect X
              </Button>
            )}
          </div>
        </div>

        {/* Account Tier Selection */}
        {isConnected && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333333]">
            <Label className="text-sm text-gray-600 dark:text-[#9CA3AF] mb-2 block">
              Account Tier
            </Label>
            <div className="flex items-center gap-3">
              <Select
                value={accountTier}
                onValueChange={(value) => {
                  haptics.light();
                  setAccountTier(value as AccountTier);
                }}
              >
                <SelectTrigger className="w-40 !bg-gray-100 dark:!bg-[#000000] !text-gray-900 dark:!text-white text-sm border-gray-300 dark:border-[#333333]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
              <Badge className={`${getTierColor(accountTier)} text-white text-xs`}>
                {accountTier.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-2">
              Select your X API tier to enforce correct rate limits
            </p>
          </div>
        )}
      </Card>

      {/* Setup Instructions */}
      {!isConnected && (
        <Alert className="border-[#000000]/20 bg-[#000000]/5 dark:bg-[#000000]/30">
          <AlertCircle className="h-4 w-4 text-[#000000] dark:text-white" />
          <AlertDescription className="text-sm text-gray-900 dark:text-white ml-2">
            <strong className="block mb-2">Before connecting, ensure you have:</strong>
            <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600 dark:text-[#9CA3AF]">
              <li>An X Developer account at <a href="https://developer.twitter.com" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline inline-flex items-center gap-1">developer.twitter.com <ExternalLink className="w-3 h-3" /></a></li>
              <li>A Project and App created in the Developer Portal</li>
              <li>OAuth 2.0 enabled with Read and Write permissions</li>
              <li>Callback URL configured: {process.env.X_REDIRECT_URI || 'http://localhost:3000/auth/x/callback'}</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {/* Quota Monitoring */}
      {isConnected && quotas && (
        <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#ec1e24]" />
            <h4 className="text-sm text-gray-900 dark:text-white">Tweet Quotas</h4>
          </div>
          
          <div className="space-y-4">
            {/* Daily Quota */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">Daily Tweets</span>
                <span className="text-xs text-gray-900 dark:text-white">
                  {quotas.daily.used} / {quotas.daily.limit.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={getQuotaPercentage(quotas.daily.used, quotas.daily.limit)} 
                className="h-1.5"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Resets in {formatResetTime(quotas.daily.resetAt)}
              </p>
            </div>

            {/* Monthly Quota */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">Monthly Tweets</span>
                <span className="text-xs text-gray-900 dark:text-white">
                  {quotas.monthly.used} / {quotas.monthly.limit.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={getQuotaPercentage(quotas.monthly.used, quotas.monthly.limit)} 
                className="h-1.5"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                Resets in {formatResetTime(quotas.monthly.resetAt)}
              </p>
            </div>
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
                Tweet Text (required)
              </Label>
              <Textarea
                value={testText}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  setTestText(e.target.value);
                }}
                placeholder="Enter your tweet text..."
                className="!bg-gray-100 dark:!bg-[#000000] !text-gray-900 dark:!text-white text-sm border-gray-300 dark:border-[#333333] min-h-[80px]"
                maxLength={280}
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                {testText.length} / 280 characters
              </p>
            </div>

            <div>
              <Label className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2 block">
                Video URL (optional)
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
                Max {accountTier === 'free' || accountTier === 'basic' ? '2:20' : '10:00'} minutes, 512MB
              </p>
            </div>

            <Button
              onClick={handleTestPublish}
              disabled={isPublishing || !testText.trim()}
              className="w-full bg-[#000000] hover:bg-[#000000]/90 text-white"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  Test Publish
                </>
              )}
            </Button>
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
                    <strong>Tweet published successfully!</strong>
                    {lastPublishResult.tweetId && (
                      <div className="mt-1 text-xs">
                        Tweet ID: {lastPublishResult.tweetId}
                      </div>
                    )}
                    {lastPublishResult.processingTime && (
                      <div className="text-xs text-gray-500 dark:text-[#9CA3AF]">
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
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Auto-publish to X</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Automatically post trailers to X
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
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Include Hashtags</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Add relevant hashtags to tweets
                </p>
              </div>
              <Switch
                checked={settings.includeHashtags}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, includeHashtags: checked });
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
            href="https://developer.twitter.com/en/docs/twitter-api"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            X API Documentation
          </a>
          <a
            href="https://developer.twitter.com/en/docs/twitter-api/v1/media/upload-media/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Media Upload Guide
          </a>
          <a
            href="https://developer.twitter.com/en/docs/twitter-api/rate-limits"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Rate Limits by Tier
          </a>
        </div>
      </Card>
    </div>
  );
}