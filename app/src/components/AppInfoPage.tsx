/**
 * App Information Page
 * 
 * Required for Meta and TikTok API verification
 * Explains what Screndly does, how it works, and data usage
 */

import { Play, CheckCircle2, ExternalLink } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { haptics } from '../utils/haptics';

interface AppInfoPageProps {
  onNavigate: (page: string) => void;
}

export function AppInfoPage({ onNavigate }: AppInfoPageProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-[#000000]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#ec1e24] rounded-2xl mb-4">
            <Play className="w-8 h-8 text-white" fill="white" />
          </div>
          <h1 className="text-gray-900 dark:text-white mb-3">Screndly</h1>
          <p className="text-lg text-gray-600 dark:text-[#9CA3AF] mb-2">
            Automated Movie & TV Trailer Distribution Platform
          </p>
          <Badge className="bg-[#ec1e24] text-white">
            by Screen Render
          </Badge>
        </div>

        {/* What is Screndly */}
        <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] mb-6">
          <h2 className="text-gray-900 dark:text-white mb-4">What is Screndly?</h2>
          <div className="space-y-3 text-sm text-gray-700 dark:text-[#D1D5DB]">
            <p>
              Screndly is an automation platform that helps content creators, production studios, and media companies distribute movie and TV show trailers across social media platforms efficiently.
            </p>
            <p>
              Instead of manually uploading trailers to each social platform separately, Screndly automates the entire process—monitoring RSS feeds for new content, processing videos to meet platform requirements, and posting to Facebook, Instagram, X (Twitter), TikTok, YouTube, and Pinterest with optimized captions and hashtags.
            </p>
            <p>
              Built by Screen Render, a video production company, Screndly solves the challenge of managing multi-platform trailer distribution at scale.
            </p>
          </div>
        </Card>

        {/* How It Works */}
        <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] mb-6">
          <h2 className="text-gray-900 dark:text-white mb-4">How Screndly Works</h2>
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#ec1e24] text-white rounded-full flex items-center justify-center text-sm">
                1
              </div>
              <div>
                <h3 className="text-gray-900 dark:text-white text-sm mb-1">Connect Social Accounts</h3>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  Users connect their Facebook Pages, Instagram Business accounts, X accounts, TikTok accounts, YouTube channels, and Pinterest accounts through OAuth 2.0 authentication.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#ec1e24] text-white rounded-full flex items-center justify-center text-sm">
                2
              </div>
              <div>
                <h3 className="text-gray-900 dark:text-white text-sm mb-1">Configure RSS Feeds</h3>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  Users add RSS feed URLs from trailer distribution services (e.g., Apple Trailers, YouTube channels, custom feeds). Screndly monitors these feeds for new trailer releases.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#ec1e24] text-white rounded-full flex items-center justify-center text-sm">
                3
              </div>
              <div>
                <h3 className="text-gray-900 dark:text-white text-sm mb-1">Automatic Detection</h3>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  When a new trailer appears in an RSS feed, Screndly automatically detects it and queues it for processing.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#ec1e24] text-white rounded-full flex items-center justify-center text-sm">
                4
              </div>
              <div>
                <h3 className="text-gray-900 dark:text-white text-sm mb-1">Video Processing</h3>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  Trailers are validated and optimized for each platform's requirements (aspect ratio, duration, file size, format).
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#ec1e24] text-white rounded-full flex items-center justify-center text-sm">
                5
              </div>
              <div>
                <h3 className="text-gray-900 dark:text-white text-sm mb-1">Multi-Platform Publishing</h3>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  Screndly posts the trailer to all connected platforms simultaneously with platform-optimized captions, hashtags, and metadata.
                </p>
              </div>
            </div>

            {/* Step 6 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#ec1e24] text-white rounded-full flex items-center justify-center text-sm">
                6
              </div>
              <div>
                <h3 className="text-gray-900 dark:text-white text-sm mb-1">Activity Logging</h3>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  All publishing activity, errors, and metrics are logged in the dashboard for review and troubleshooting.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Platform Integrations */}
        <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] mb-6">
          <h2 className="text-gray-900 dark:text-white mb-4">Platform Integrations</h2>
          
          <div className="space-y-6">
            {/* Meta */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-[#1877F2] rounded flex items-center justify-center">
                  <span className="text-white text-xs">f</span>
                </div>
                <h3 className="text-gray-900 dark:text-white">Meta (Facebook & Instagram)</h3>
              </div>
              <div className="ml-10 space-y-2 text-sm">
                <div>
                  <strong className="text-gray-900 dark:text-white">Permissions Used:</strong>
                  <ul className="list-disc list-inside text-gray-600 dark:text-[#9CA3AF] ml-4 mt-1 space-y-0.5">
                    <li>pages_show_list - View connected Facebook Pages</li>
                    <li>pages_manage_posts - Publish video posts to Pages</li>
                    <li>instagram_basic - Access Instagram Business profile</li>
                    <li>instagram_content_publish - Publish videos to Instagram</li>
                    <li>publish_video - Upload video files</li>
                  </ul>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">What We Access:</strong>
                  <p className="text-gray-600 dark:text-[#9CA3AF]">
                    Only your Facebook Page ID/name and Instagram Business Account ID/username. We do NOT access personal profiles, followers, messages, or any user-generated content.
                  </p>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">What We Post:</strong>
                  <p className="text-gray-600 dark:text-[#9CA3AF]">
                    Movie/TV trailers from RSS feeds you configure, with captions you approve.
                  </p>
                </div>
              </div>
            </div>

            {/* X (Twitter) */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-[#000000] dark:bg-white rounded flex items-center justify-center">
                  <span className="text-white dark:text-black text-xs">𝕏</span>
                </div>
                <h3 className="text-gray-900 dark:text-white">X (Twitter)</h3>
              </div>
              <div className="ml-10 space-y-2 text-sm">
                <div>
                  <strong className="text-gray-900 dark:text-white">Scopes Used:</strong>
                  <ul className="list-disc list-inside text-gray-600 dark:text-[#9CA3AF] ml-4 mt-1 space-y-0.5">
                    <li>tweet.read - View account information</li>
                    <li>tweet.write - Post tweets with video</li>
                    <li>users.read - Access basic profile</li>
                    <li>offline.access - Maintain connection</li>
                  </ul>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">What We Access:</strong>
                  <p className="text-gray-600 dark:text-[#9CA3AF]">
                    Only your X account ID and username. We do NOT access followers, DMs, or read any tweets.
                  </p>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">Rate Limiting:</strong>
                  <p className="text-gray-600 dark:text-[#9CA3AF]">
                    We enforce your API tier limits (Free: 50/day, Basic: 3K/day, Pro: 10K/day) to prevent quota issues.
                  </p>
                </div>
              </div>
            </div>

            {/* TikTok */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-[#000000] dark:bg-white rounded flex items-center justify-center">
                  <span className="text-xs">🎵</span>
                </div>
                <h3 className="text-gray-900 dark:text-white">TikTok</h3>
              </div>
              <div className="ml-10 space-y-2 text-sm">
                <div>
                  <strong className="text-gray-900 dark:text-white">Scopes Used:</strong>
                  <ul className="list-disc list-inside text-gray-600 dark:text-[#9CA3AF] ml-4 mt-1 space-y-0.5">
                    <li>user.info.basic - View profile information</li>
                    <li>video.upload - Upload video files</li>
                    <li>video.publish - Publish videos to account</li>
                  </ul>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">What We Access:</strong>
                  <p className="text-gray-600 dark:text-[#9CA3AF]">
                    Only your TikTok Open ID and display name. We do NOT access followers, comments, or any user content.
                  </p>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">Posting Limits:</strong>
                  <p className="text-gray-600 dark:text-[#9CA3AF]">
                    We enforce TikTok's recommended limits: maximum 5 posts/day, 1-hour spacing between posts to avoid spam detection.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Data We Collect */}
        <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] mb-6">
          <div className="mb-4">
            <h2 className="text-gray-900 dark:text-white">Data We Collect & Store</h2>
          </div>
          
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="text-gray-900 dark:text-white mb-2">Account Information</h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-[#9CA3AF] ml-4 space-y-1">
                <li>Email address (for login)</li>
                <li>Username (user-chosen)</li>
                <li>Password (hashed and encrypted)</li>
                <li>Account creation date</li>
              </ul>
            </div>

            <div>
              <h3 className="text-gray-900 dark:text-white mb-2">Platform Connection Data</h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-[#9CA3AF] ml-4 space-y-1">
                <li>OAuth access tokens (encrypted with AES-256-GCM)</li>
                <li>Platform IDs (Page ID, Account ID, Open ID)</li>
                <li>Connection timestamps</li>
                <li>Token expiration dates</li>
              </ul>
            </div>

            <div>
              <h3 className="text-gray-900 dark:text-white mb-2">Usage & Activity Logs</h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-[#9CA3AF] ml-4 space-y-1">
                <li>RSS feed URLs configured</li>
                <li>Publishing activity (timestamp, platform, status)</li>
                <li>Error logs and diagnostics</li>
                <li>Video processing metadata</li>
                <li>Rate limit tracking (daily/monthly counts)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-gray-900 dark:text-white mb-2">Video Metadata</h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-[#9CA3AF] ml-4 space-y-1">
                <li>Trailer titles and descriptions</li>
                <li>Video URLs from RSS feeds</li>
                <li>Thumbnail images</li>
                <li>Platform-specific captions</li>
              </ul>
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-2">
                <strong>Note:</strong> We do NOT store actual video files. Videos are uploaded directly to each platform's servers.
              </p>
            </div>
          </div>
        </Card>

        {/* Data We DO NOT Collect */}
        <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] mb-6">
          <div className="mb-4">
            <h2 className="text-gray-900 dark:text-white">Data We DO NOT Collect</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 dark:text-[#9CA3AF]">Follower or fan data</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 dark:text-[#9CA3AF]">Direct messages or comments</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 dark:text-[#9CA3AF]">Personal profile information</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 dark:text-[#9CA3AF]">User-generated content</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 dark:text-[#9CA3AF]">Engagement metrics beyond our posts</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 dark:text-[#9CA3AF]">Financial information</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 dark:text-[#9CA3AF]">Location data</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
              <span className="text-gray-600 dark:text-[#9CA3AF]">Device information</span>
            </div>
          </div>
        </Card>

        {/* Use Case */}
        <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] mb-6">
          <div className="mb-4">
            <h2 className="text-gray-900 dark:text-white">Who Uses Screndly?</h2>
          </div>
          
          <div className="space-y-4 text-sm text-gray-700 dark:text-[#D1D5DB]">
            <div>
              <strong className="text-gray-900 dark:text-white">Film Production Studios</strong>
              <p className="text-gray-600 dark:text-[#9CA3AF] mt-1">
                Distribute movie trailers across all social platforms simultaneously without manual uploads.
              </p>
            </div>
            <div>
              <strong className="text-gray-900 dark:text-white">TV Networks & Streaming Services</strong>
              <p className="text-gray-600 dark:text-[#9CA3AF] mt-1">
                Automate promotion of new shows and season releases across multiple social accounts.
              </p>
            </div>
            <div>
              <strong className="text-gray-900 dark:text-white">Content Creators & Influencers</strong>
              <p className="text-gray-600 dark:text-[#9CA3AF] mt-1">
                Share trailer content efficiently across their established social media presence.
              </p>
            </div>
            <div>
              <strong className="text-gray-900 dark:text-white">Marketing Agencies</strong>
              <p className="text-gray-600 dark:text-[#9Ca3AF] mt-1">
                Manage trailer distribution for multiple clients from a single dashboard.
              </p>
            </div>
          </div>
        </Card>

        {/* Security */}
        <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] mb-6">
          <div className="mb-4">
            <h2 className="text-gray-900 dark:text-white">Security & Privacy</h2>
          </div>
          
          <div className="space-y-3 text-sm text-gray-700 dark:text-[#D1D5DB]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#10B981] mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-gray-900 dark:text-white">AES-256-GCM Encryption</strong>
                <p className="text-gray-600 dark:text-[#9CA3AF]">
                  All OAuth tokens are encrypted using industry-standard AES-256-GCM encryption
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#10B981] mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-gray-900 dark:text-white">OAuth 2.0 Authentication</strong>
                <p className="text-gray-600 dark:text-[#9CA3AF]">
                  We never see your social media passwords. All authentication uses OAuth 2.0
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#10B981] mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-gray-900 dark:text-white">Minimal Permissions</strong>
                <p className="text-gray-600 dark:text-[#9CA3AF]">
                  We only request the minimum permissions needed for video publishing
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#10B981] mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-gray-900 dark:text-white">GDPR & CCPA Compliant</strong>
                <p className="text-gray-600 dark:text-[#9CA3AF]">
                  Full compliance with data protection regulations. Data deletion within 30 days
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#10B981] mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-gray-900 dark:text-white">Activity Logging</strong>
                <p className="text-gray-600 dark:text-[#9CA3AF]">
                  All actions are logged for security auditing and troubleshooting
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Links */}
        <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
          <h2 className="text-gray-900 dark:text-white mb-4">Legal & Documentation</h2>
          <div className="space-y-2">
            <a
              onClick={() => {
                haptics.light();
                onNavigate('privacy');
              }}
              className="flex items-center gap-2 text-sm text-[#ec1e24] hover:underline cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              Privacy Policy (Full Details)
            </a>
            <a
              onClick={() => {
                haptics.light();
                onNavigate('terms');
              }}
              className="flex items-center gap-2 text-sm text-[#ec1e24] hover:underline cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              Terms of Service
            </a>
            <a
              onClick={() => {
                haptics.light();
                onNavigate('data-deletion');
              }}
              className="flex items-center gap-2 text-sm text-[#ec1e24] hover:underline cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              Data Deletion Instructions
            </a>
            <a
              onClick={() => {
                haptics.light();
                onNavigate('contact');
              }}
              className="flex items-center gap-2 text-sm text-[#ec1e24] hover:underline cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              Contact Support
            </a>
          </div>
        </Card>

        {/* Contact */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-[#9CA3AF]">
          <p className="mb-2">Questions about Screndly or our platform integrations?</p>
          <p>
            Contact us at <a href="mailto:support@screndly.com" className="text-[#ec1e24] hover:underline">support@screndly.com</a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-[#374151] py-8 px-6 mt-12">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-600 dark:text-[#9CA3AF]">
          <p>©️ 2026, Screndly by Screen Render. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}