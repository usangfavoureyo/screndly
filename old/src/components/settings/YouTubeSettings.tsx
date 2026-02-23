/**
 * YouTube Settings Component
 * 
 * Provides UI for:
 * - OAuth connection
 * - API verification status
 * - Token management
 * - Quota monitoring
 * - Test upload functionality
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Unplug,
  Loader2,
  BarChart3,
  Shield,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { youtubeAuth } from '../../utils/youtubeAuth';
import { youtubeAdapter, VIDEO_CATEGORIES } from '../../adapters/youtubeAdapter';
import { haptics } from '../../utils/haptics';

interface YouTubeSettingsProps {
  onSave?: () => void;
}

export function YouTubeSettings({ onSave }: YouTubeSettingsProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [quotaUsage, setQuotaUsage] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [channelInfo, setChannelInfo] = useState<any>(null);
  
  // Test upload state
  const [testTitle, setTestTitle] = useState('Amazing Movie Trailer 2026 🎬');
  const [testDescription, setTestDescription] = useState('Official trailer for the upcoming blockbuster film.\n\n#Movies #Trailer #Film #Cinema');
  const [testTags, setTestTags] = useState('movies, trailer, film, cinema, 2026');
  const [testVideoUrl, setTestVideoUrl] = useState('');
  const [testCategory, setTestCategory] = useState(VIDEO_CATEGORIES.ENTERTAINMENT);
  const [testPrivacy, setTestPrivacy] = useState<'public' | 'private' | 'unlisted'>('unlisted');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadLogs, setUploadLogs] = useState<string[]>([]);
  const [lastUploadResult, setLastUploadResult] = useState<any>(null);

  // Settings
  const [settings, setSettings] = useState({
    autoUpload: true,
    defaultPrivacy: 'private' as const,
    defaultCategory: VIDEO_CATEGORIES.ENTERTAINMENT,
    madeForKids: false,
    notifySubscribers: true,
  });

  useEffect(() => {
    loadYouTubeStatus();
    loadQuotaUsage();
  }, []);

  const loadYouTubeStatus = async () => {
    const authenticated = await youtubeAuth.isAuthenticated();
    setIsConnected(authenticated);

    if (authenticated) {
      const info = await youtubeAuth.getTokenInfo();
      setTokenInfo(info);

      try {
        const channel = await youtubeAdapter.getChannelInfo();
        setChannelInfo(channel);
      } catch (error) {
        console.error('Failed to load channel info:', error);
      }
    }
  };

  const loadQuotaUsage = async () => {
    const usage = await youtubeAdapter.getQuotaUsage();
    setQuotaUsage(usage);
  };

  const handleConnect = async () => {
    haptics.medium();
    const authUrl = await youtubeAuth.getAuthorizationUrl('/settings');
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    haptics.medium();
    if (confirm('Are you sure you want to disconnect your YouTube channel? This will stop all YouTube automation.')) {
      await youtubeAuth.revokeToken();
      setIsConnected(false);
      setTokenInfo(null);
      setChannelInfo(null);
    }
  };

  const handleRefreshToken = async () => {
    haptics.light();
    setIsRefreshing(true);
    try {
      const refreshed = await youtubeAuth.refreshTokenIfNeeded();
      if (refreshed) {
        await loadYouTubeStatus();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTestUpload = async () => {
    if (!testTitle.trim()) {
      alert('Please enter a title');
      return;
    }

    if (!testVideoUrl.trim()) {
      alert('Please enter a video URL');
      return;
    }

    haptics.medium();
    setIsUploading(true);
    setUploadLogs([]);
    setLastUploadResult(null);

    try {
      const tagsArray = testTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

      const result = await youtubeAdapter.upload({
        videoUrl: testVideoUrl,
        title: testTitle,
        description: testDescription,
        tags: tagsArray,
        categoryId: testCategory,
        privacyStatus: testPrivacy,
        madeForKids: settings.madeForKids,
        notifySubscribers: settings.notifySubscribers,
      });

      setUploadLogs(result.logs);
      setLastUploadResult(result);

      if (result.success) {
        haptics.success();
        await loadQuotaUsage();
      } else {
        haptics.error();
      }
    } catch (error: any) {
      haptics.error();
      setUploadLogs([...uploadLogs, `[ERROR] ${error.message}`]);
      setLastUploadResult({ success: false, error: error.message, logs: uploadLogs });
    } finally {
      setIsUploading(false);
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

  const canUpload = quotaUsage && quotaUsage.remaining >= 1600;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-gray-900 dark:text-white mb-2">YouTube</h3>
        <p className="text-sm text-gray-500 dark:text-[#6B7280]">
          Connect your YouTube channel to automate trailer uploads
        </p>
      </div>

      {/* API Verification Status */}
      {!isConnected && (
        <Alert className="border-[#FF0000]/20 bg-[#FF0000]/10">
          <Shield className="h-4 w-4 text-[#FF0000]" />
          <AlertDescription className="text-sm text-gray-900 dark:text-white ml-2">
            <strong className="block mb-2">⚠️ YouTube API Requires Google Cloud Setup</strong>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2">
              Before connecting, you need to set up a Google Cloud project:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600 dark:text-[#9CA3AF] ml-2">
              <li>Create project at <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline">Google Cloud Console</a></li>
              <li>Enable YouTube Data API v3</li>
              <li>Configure OAuth consent screen</li>
              <li>Create OAuth 2.0 credentials</li>
              <li>Submit for verification (for public use)</li>
            </ol>
            <Button
              onClick={() => window.open('https://console.cloud.google.com/', '_blank')}
              size="sm"
              className="mt-3 bg-[#FF0000] hover:bg-[#FF0000]/90 text-white h-7 text-xs"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Go to Google Cloud Console
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
              {isConnected && channelInfo && (
                <>
                  <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                    {channelInfo.snippet?.title}
                  </p>
                  {channelInfo.statistics && (
                    <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                      {parseInt(channelInfo.statistics.subscriberCount).toLocaleString()} subscribers • {channelInfo.statistics.videoCount} videos
                    </p>
                  )}
                </>
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
                className="bg-[#FF0000] hover:bg-[#FF0000]/90 text-white h-8"
              >
                <Play className="w-3.5 h-3.5 mr-1" fill="white" />
                Connect YouTube
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Setup Instructions */}
      {!isConnected && (
        <Alert className="border-[#FF0000]/20 bg-[#FF0000]/5 dark:bg-[#FF0000]/10">
          <AlertCircle className="h-4 w-4 text-[#FF0000]" />
          <AlertDescription className="text-sm text-gray-900 dark:text-white ml-2">
            <strong className="block mb-2">Google Cloud Setup Required</strong>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2">
              Complete these steps to enable YouTube integration:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-600 dark:text-[#9CA3AF]">
              <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="w-3 h-3" /></a></li>
              <li>Create new project or select existing</li>
              <li>Enable YouTube Data API v3</li>
              <li>Configure OAuth consent screen:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                  <li>App name: Screndly</li>
                  <li>Scopes: youtube.upload, youtube, youtube.force-ssl</li>
                  <li>Test users (before verification)</li>
                </ul>
              </li>
              <li>Create OAuth 2.0 Client ID (Web application)</li>
              <li>Add redirect URL: {process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/auth/youtube/callback'}</li>
              <li>For public use, submit OAuth consent screen for verification</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {/* Quota Monitoring */}
      {isConnected && quotaUsage && (
        <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#ec1e24]" />
            <h4 className="text-sm text-gray-900 dark:text-white">API Quota Usage</h4>
          </div>
          
          <div className="space-y-4">
            {/* Daily Quota */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">Daily Quota</span>
                <span className="text-xs text-gray-900 dark:text-white">
                  {quotaUsage.used.toLocaleString()} / {quotaUsage.limit.toLocaleString()} units
                </span>
              </div>
              <Progress 
                value={quotaUsage.percentUsed} 
                className="h-1.5"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                {quotaUsage.remaining.toLocaleString()} units remaining • Resets in {formatResetTime(quotaUsage.resetAt)}
              </p>
            </div>

            {/* Upload Capacity */}
            <div className="pt-3 border-t border-gray-200 dark:border-[#333333]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">Uploads Remaining Today:</span>
                <Badge className={`text-xs ${canUpload ? 'bg-[#10B981]' : 'bg-[#F59E0B]'} text-white`}>
                  {Math.floor(quotaUsage.remaining / 1600)} videos
                </Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                Each upload costs 1,600 units
              </p>
            </div>
          </div>

          {/* Quota Tips */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333333]">
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2">
              💡 Quota Management Tips:
            </p>
            <ul className="text-xs text-gray-500 dark:text-[#6B7280] space-y-1">
              <li>• Default: 10,000 units/day (~6 uploads)</li>
              <li>• Quota resets midnight Pacific Time</li>
              <li>• Request increase for higher limits</li>
              <li>• Plan uploads strategically</li>
            </ul>
            <Button
              onClick={() => window.open('https://console.cloud.google.com/', '_blank')}
              variant="ghost"
              size="sm"
              className="mt-2 h-7 text-xs text-[#ec1e24] hover:text-[#ec1e24]"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Request Quota Increase
            </Button>
          </div>
        </Card>
      )}

      {/* Test Upload */}
      {isConnected && (
        <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <h4 className="text-sm text-gray-900 dark:text-white mb-4">Test Upload</h4>
          
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2 block">
                Title (required, max 100 characters)
              </Label>
              <Input
                value={testTitle}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  setTestTitle(e.target.value);
                }}
                placeholder="Enter video title..."
                className="!bg-gray-100 dark:!bg-[#000000] !text-gray-900 dark:!text-white text-sm border-gray-300 dark:border-[#333333]"
                maxLength={100}
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                {testTitle.length} / 100 characters
              </p>
            </div>

            <div>
              <Label className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2 block">
                Description (max 5000 characters)
              </Label>
              <Textarea
                value={testDescription}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  setTestDescription(e.target.value);
                }}
                placeholder="Enter video description..."
                className="!bg-gray-100 dark:!bg-[#000000] !text-gray-900 dark:!text-white text-sm border-gray-300 dark:border-[#333333] min-h-[100px]"
                maxLength={5000}
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                {testDescription.length} / 5000 characters
              </p>
            </div>

            <div>
              <Label className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2 block">
                Tags (comma-separated, max 500 chars total)
              </Label>
              <Input
                value={testTags}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  setTestTags(e.target.value);
                }}
                placeholder="tag1, tag2, tag3"
                className="!bg-gray-100 dark:!bg-[#000000] !text-gray-900 dark:!text-white text-sm border-gray-300 dark:border-[#333333]"
              />
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                {testTags.length} / 500 characters
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2 block">
                  Category
                </Label>
                <Select value={testCategory} onValueChange={setTestCategory}>
                  <SelectTrigger className="!bg-gray-100 dark:!bg-[#000000] border-gray-300 dark:border-[#333333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VIDEO_CATEGORIES.ENTERTAINMENT}>Entertainment</SelectItem>
                    <SelectItem value={VIDEO_CATEGORIES.FILM_ANIMATION}>Film & Animation</SelectItem>
                    <SelectItem value={VIDEO_CATEGORIES.GAMING}>Gaming</SelectItem>
                    <SelectItem value={VIDEO_CATEGORIES.MUSIC}>Music</SelectItem>
                    <SelectItem value={VIDEO_CATEGORIES.SCIENCE_TECH}>Science & Tech</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2 block">
                  Privacy
                </Label>
                <Select value={testPrivacy} onValueChange={(value: any) => setTestPrivacy(value)}>
                  <SelectTrigger className="!bg-gray-100 dark:!bg-[#000000] border-gray-300 dark:border-[#333333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                Supports: MP4, MOV, AVI, WEBM • Max 256 GB • 1080p+ recommended
              </p>
            </div>

            <Button
              onClick={handleTestUpload}
              disabled={isUploading || !testTitle.trim() || !testVideoUrl.trim() || !canUpload}
              className="w-full bg-[#FF0000] hover:bg-[#FF0000]/90 text-white"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : !canUpload ? (
                <>
                  Quota Exceeded
                </>
              ) : (
                <>
                  Test Upload (1,600 units)
                </>
              )}
            </Button>

            {!canUpload && quotaUsage && (
              <Alert className="border-[#F59E0B]/20 bg-[#F59E0B]/10">
                <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                <AlertDescription className="text-xs text-gray-900 dark:text-white ml-2">
                  Daily quota exceeded. Quota resets in {formatResetTime(quotaUsage.resetAt)} at midnight Pacific Time.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Upload Logs */}
          {uploadLogs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333333]">
              <Label className="text-xs text-gray-600 dark:text-[#9CA3AF] mb-2 block">
                Upload Logs
              </Label>
              <div className="bg-gray-900 dark:bg-[#0a0a0a] p-3 rounded-lg text-xs font-mono max-h-48 overflow-y-auto">
                {uploadLogs.map((log, index) => (
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

          {/* Upload Result */}
          {lastUploadResult && (
            <div className="mt-4">
              {lastUploadResult.success ? (
                <Alert className="border-green-500/20 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-sm text-gray-900 dark:text-white ml-2">
                    <strong>Video uploaded successfully!</strong>
                    {lastUploadResult.videoId && (
                      <div className="mt-1">
                        <a 
                          href={lastUploadResult.videoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-[#ec1e24] hover:underline inline-flex items-center gap-1"
                        >
                          View on YouTube <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {lastUploadResult.quotaUsed && (
                      <div className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-1">
                        Quota used: {lastUploadResult.quotaUsed} units
                      </div>
                    )}
                    {lastUploadResult.processingTime && (
                      <div className="text-xs text-gray-500 dark:text-[#9CA3AF]">
                        Processing time: {lastUploadResult.processingTime}ms
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-500/20 bg-red-500/10">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-sm text-gray-900 dark:text-white ml-2">
                    <strong>Upload failed</strong>
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {lastUploadResult.error}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Upload Settings */}
      {isConnected && (
        <Card className="p-4 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <h4 className="text-sm text-gray-900 dark:text-white mb-4">Upload Settings</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Auto-upload to YouTube</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Automatically upload trailers to YouTube
                </p>
              </div>
              <Switch
                checked={settings.autoUpload}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, autoUpload: checked });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Made for Kids</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Mark videos as made for kids (COPPA)
                </p>
              </div>
              <Switch
                checked={settings.madeForKids}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, madeForKids: checked });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF] text-sm">Notify Subscribers</Label>
                <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
                  Send notification when uploading
                </p>
              </div>
              <Switch
                checked={settings.notifySubscribers}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setSettings({ ...settings, notifySubscribers: checked });
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
            href="https://console.cloud.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Google Cloud Console
          </a>
          <a
            href="https://developers.google.com/youtube/v3/getting-started"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            YouTube Data API Guide
          </a>
          <a
            href="https://developers.google.com/youtube/v3/guides/uploading_a_video"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Video Upload Guide
          </a>
          <a
            href="https://support.google.com/youtube/answer/1722171"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#ec1e24] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Recommended Upload Settings
          </a>
        </div>
      </Card>
    </div>
  );
}