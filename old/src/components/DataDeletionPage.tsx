/**
 * Data Deletion Instructions Page
 * 
 * Required for Meta and TikTok API verification
 * Provides instructions for users to request data deletion
 */

import { ExternalLink, Trash2, Shield, Info } from 'lucide-react';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { haptics } from '../utils/haptics';

interface DataDeletionPageProps {
  onNavigate: (page: string) => void;
  isAuthenticated?: boolean;
}

export function DataDeletionPage({ onNavigate, isAuthenticated = false }: DataDeletionPageProps) {
  const handleBack = () => {
    haptics.light();
    onNavigate(isAuthenticated ? 'settings' : 'login');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] flex flex-col">
      <div className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="flex items-start gap-4 mb-8">
          <button
            onClick={handleBack}
            className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12H2M9 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-gray-900 dark:text-white mb-2">Data Deletion Instructions</h1>
            <p className="text-sm text-gray-500 dark:text-[#6B7280]">
              How to request deletion of your data from Screndly
            </p>
          </div>
        </div>

        {/* Overview */}
        <Alert className="mb-6 border-[#ec1e24]/20 bg-[#ec1e24]/5 dark:bg-[#ec1e24]/10">
          <Info className="h-4 w-4 text-[#ec1e24]" />
          <AlertDescription className="text-sm text-gray-900 dark:text-white ml-2">
            <strong>Your Data Rights:</strong> You have the right to request deletion of your personal data at any time. This page explains how to delete data from Screndly and our connected social media platforms.
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {/* Screndly Data Deletion */}
          <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
            <div className="flex items-start gap-3 mb-4">
              <Trash2 className="w-5 h-5 text-[#ec1e24] mt-0.5" />
              <div>
                <h2 className="text-gray-900 dark:text-white mb-1">Screndly Account & Data Deletion</h2>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  Delete your Screndly account and all associated data
                </p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-gray-700 dark:text-[#D1D5DB]">
              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Method 1: Delete from Dashboard</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Log in to your Screndly account at <a href="https://screndly.com/login" className="text-[#ec1e24] hover:underline">screndly.com</a></li>
                  <li>Navigate to <strong>Settings</strong></li>
                  <li>Scroll to the bottom and click <strong>"Delete Account"</strong></li>
                  <li>Confirm deletion when prompted</li>
                  <li>You will receive a confirmation email within 24 hours</li>
                </ol>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Method 2: Email Request</h3>
                <p className="mb-2">If you cannot access your account, send an email to:</p>
                <div className="bg-gray-100 dark:bg-[#0a0a0a] p-4 rounded-lg border border-gray-200 dark:border-[#333333]">
                  <p className="text-[#ec1e24] break-all">privacy@screndly.com</p>
                </div>
                <p className="mt-3 mb-2">Include the following information:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Email address associated with your account</li>
                  <li>Account username (if applicable)</li>
                  <li>Subject line: "Data Deletion Request"</li>
                  <li>Brief description of your request</li>
                </ul>
                <p className="mt-3 text-xs text-gray-500 dark:text-[#6B7280]">
                  We will process your request within <strong>30 days</strong> as required by GDPR and CCPA.
                </p>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">What Gets Deleted</h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600 dark:text-[#9CA3AF]">
                  <li>Your account information and credentials</li>
                  <li>All RSS feed configurations</li>
                  <li>Platform connection tokens (Meta, X, TikTok)</li>
                  <li>Usage logs and activity history</li>
                  <li>Automation settings and preferences</li>
                  <li>All personally identifiable information</li>
                </ul>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Data Retention</h3>
                <p className="text-gray-600 dark:text-[#9CA3AF]">
                  Some data may be retained for legal compliance:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600 dark:text-[#9CA3AF]">
                  <li>Transaction records (7 years for tax compliance)</li>
                  <li>Fraud prevention logs (as required by law)</li>
                  <li>Aggregated, anonymized analytics (no personal data)</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Meta Platform Data Deletion */}
          <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="w-5 h-5 text-[#1877F2] mt-0.5" />
              <div>
                <h2 className="text-gray-900 dark:text-white mb-1">Meta (Facebook & Instagram) Data Deletion</h2>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  Disconnect and delete data from Meta platforms
                </p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-gray-700 dark:text-[#D1D5DB]">
              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Step 1: Disconnect from Screndly</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Log in to Screndly</li>
                  <li>Go to <strong>Settings</strong> → <strong>Meta</strong></li>
                  <li>Click <strong>"Disconnect"</strong></li>
                  <li>Confirm disconnection</li>
                </ol>
                <p className="mt-2 text-xs text-gray-500 dark:text-[#6B7280]">
                  This immediately revokes Screndly's access to your Facebook and Instagram accounts and deletes stored access tokens.
                </p>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Step 2: Remove App from Facebook</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Go to <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline inline-flex items-center gap-1">Facebook Business Integrations <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Find <strong>"Screndly"</strong> in the list</li>
                  <li>Click <strong>"Remove"</strong></li>
                  <li>Confirm removal</li>
                </ol>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Step 3: Request Data Deletion from Meta</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Visit <a href="https://www.facebook.com/help/contact/1638046109617856" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline inline-flex items-center gap-1">Meta Data Deletion Request <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Select <strong>"Request deletion of data shared with Screndly"</strong></li>
                  <li>Follow Meta's verification process</li>
                  <li>Submit request</li>
                </ol>
                <p className="mt-2 text-xs text-gray-500 dark:text-[#6B7280]">
                  Meta will process your request within 90 days as per their data policy.
                </p>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">What Data Screndly Stores from Meta</h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600 dark:text-[#9CA3AF]">
                  <li>Facebook Page ID and name</li>
                  <li>Instagram Business Account ID and username</li>
                  <li>Access tokens (encrypted, automatically deleted on disconnect)</li>
                  <li>Publishing activity logs (deleted with account)</li>
                  <li>No follower data, messages, or personal content</li>
                </ul>
              </div>

              <Alert className="border-[#1877F2]/20 bg-[#1877F2]/5 dark:bg-[#1877F2]/10 mt-4">
                <Info className="h-4 w-4 text-[#1877F2]" />
                <AlertDescription className="text-xs text-gray-900 dark:text-white ml-2">
                  <strong>Note:</strong> Content you posted to Facebook/Instagram through Screndly remains on those platforms. To delete posts, use Facebook/Instagram's native deletion tools.
                </AlertDescription>
              </Alert>
            </div>
          </Card>

          {/* X (Twitter) Data Deletion */}
          <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="w-5 h-5 text-[#000000] dark:text-white mt-0.5" />
              <div>
                <h2 className="text-gray-900 dark:text-white mb-1">X (Twitter) Data Deletion</h2>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  Disconnect and delete data from X
                </p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-gray-700 dark:text-[#D1D5DB]">
              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Step 1: Disconnect from Screndly</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Log in to Screndly</li>
                  <li>Go to <strong>Settings</strong> → <strong>X (Twitter)</strong></li>
                  <li>Click <strong>"Disconnect"</strong></li>
                  <li>Confirm disconnection</li>
                </ol>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Step 2: Revoke App Access on X</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Go to <a href="https://twitter.com/settings/connected_apps" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline inline-flex items-center gap-1">X Connected Apps <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Find <strong>"Screndly"</strong></li>
                  <li>Click <strong>"Revoke access"</strong></li>
                  <li>Confirm revocation</li>
                </ol>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">What Data Screndly Stores from X</h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600 dark:text-[#9CA3AF]">
                  <li>X account ID and username</li>
                  <li>Access tokens (encrypted, deleted on disconnect)</li>
                  <li>Tweet posting activity logs</li>
                  <li>Daily/monthly usage quota tracking</li>
                  <li>No follower data, DMs, or personal tweets</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* TikTok Data Deletion */}
          <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="w-5 h-5 text-[#000000] dark:text-white mt-0.5" />
              <div>
                <h2 className="text-gray-900 dark:text-white mb-1">TikTok Data Deletion</h2>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  Disconnect and delete data from TikTok
                </p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-gray-700 dark:text-[#D1D5DB]">
              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Step 1: Disconnect from Screndly</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Log in to Screndly</li>
                  <li>Go to <strong>Settings</strong> → <strong>TikTok</strong></li>
                  <li>Click <strong>"Disconnect"</strong></li>
                  <li>Confirm disconnection</li>
                </ol>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Step 2: Revoke App Access on TikTok</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Go to <a href="https://www.tiktok.com/setting/privacy-and-safety" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline inline-flex items-center gap-1">TikTok Privacy Settings <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Find <strong>"Apps and websites"</strong> section</li>
                  <li>Locate <strong>"Screndly"</strong></li>
                  <li>Click <strong>"Remove access"</strong></li>
                  <li>Confirm removal</li>
                </ol>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Step 3: Request Data Deletion from TikTok</h3>
                <p className="mb-2">Send a data deletion request to TikTok:</p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Visit <a href="https://www.tiktok.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline inline-flex items-center gap-1">TikTok Privacy Policy <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Scroll to <strong>"Your Rights"</strong> section</li>
                  <li>Click <strong>"Submit a request"</strong></li>
                  <li>Select <strong>"Delete my data shared with third-party apps"</strong></li>
                  <li>Mention <strong>"Screndly"</strong> in your request</li>
                  <li>Submit and wait for TikTok's confirmation</li>
                </ol>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">What Data Screndly Stores from TikTok</h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600 dark:text-[#9CA3AF]">
                  <li>TikTok Open ID and display name</li>
                  <li>Access tokens (encrypted, deleted on disconnect)</li>
                  <li>Video publishing activity logs</li>
                  <li>Daily/hourly posting quota tracking</li>
                  <li>No follower data, comments, or personal videos</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* YouTube Data Deletion */}
          <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="w-5 h-5 text-[#FF0000] mt-0.5" />
              <div>
                <h2 className="text-gray-900 dark:text-white mb-1">YouTube Data Deletion</h2>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  Disconnect and delete data from YouTube
                </p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-gray-700 dark:text-[#D1D5DB]">
              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Step 1: Disconnect from Screndly</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Log in to Screndly</li>
                  <li>Go to <strong>Settings</strong> → <strong>YouTube</strong></li>
                  <li>Click <strong>"Disconnect"</strong></li>
                  <li>Confirm disconnection</li>
                </ol>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Step 2: Revoke App Access on Google Account</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Go to <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline inline-flex items-center gap-1">Google Account Permissions <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Find <strong>"Screndly"</strong> in the list of third-party apps</li>
                  <li>Click on the app name</li>
                  <li>Click <strong>"Remove access"</strong></li>
                  <li>Confirm removal</li>
                </ol>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">Step 3: Request Data Deletion from Google</h3>
                <p className="mb-2">Request deletion of data shared with Screndly:</p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Visit <a href="https://support.google.com/accounts/answer/3024190" target="_blank" rel="noopener noreferrer" className="text-[#ec1e24] hover:underline inline-flex items-center gap-1">Google Data Deletion Help <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Select <strong>"Delete data from a third-party app"</strong></li>
                  <li>Choose <strong>"Screndly"</strong> from the dropdown</li>
                  <li>Select which data categories to delete</li>
                  <li>Submit deletion request</li>
                  <li>Wait for confirmation email</li>
                </ol>
                <p className="mt-2 text-xs text-gray-500 dark:text-[#6B7280]">
                  Google will process your request within 30 days as per their data policy.
                </p>
              </div>

              <div>
                <h3 className="text-gray-900 dark:text-white mb-2">What Data Screndly Stores from YouTube</h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600 dark:text-[#9CA3AF]">
                  <li>YouTube channel ID, name, and profile information</li>
                  <li>Access tokens (encrypted, deleted on disconnect)</li>
                  <li>Video upload activity logs</li>
                  <li>API quota usage tracking (daily uploads count)</li>
                  <li>Video metadata (titles, descriptions, tags)</li>
                  <li>No subscriber data, comments, or analytics</li>
                </ul>
              </div>

              <Alert className="border-[#FF0000]/20 bg-[#FF0000]/5 dark:bg-[#FF0000]/10 mt-4">
                <Info className="h-4 w-4 text-[#FF0000]" />
                <AlertDescription className="text-xs text-gray-900 dark:text-white ml-2">
                  <strong>Note:</strong> Videos you uploaded to YouTube through Screndly remain on YouTube. To delete videos, use YouTube Studio's video management tools.
                </AlertDescription>
              </Alert>
            </div>
          </Card>

          {/* Timeline */}
          <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
            <h2 className="text-gray-900 dark:text-white mb-4">Data Deletion Timeline</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-24 flex-shrink-0 text-gray-500 dark:text-[#6B7280]">Immediate</div>
                <div className="text-gray-700 dark:text-[#D1D5DB]">
                  Access tokens revoked when you disconnect platforms
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-24 flex-shrink-0 text-gray-500 dark:text-[#6B7280]">24 hours</div>
                <div className="text-gray-700 dark:text-[#D1D5DB]">
                  Cached data and temporary files deleted from Screndly servers
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-24 flex-shrink-0 text-gray-500 dark:text-[#6B7280]">30 days</div>
                <div className="text-gray-700 dark:text-[#D1D5DB]">
                  All personal data permanently deleted from Screndly (GDPR/CCPA compliance)
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-24 flex-shrink-0 text-gray-500 dark:text-[#6B7280]">90 days</div>
                <div className="text-gray-700 dark:text-[#D1D5DB]">
                  Platform-specific data deletion (Meta, X, TikTok process their own requests)
                </div>
              </div>
            </div>
          </Card>

          {/* Support */}
          <Card className="p-6 border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]">
            <h2 className="text-gray-900 dark:text-white mb-4">Need Help?</h2>
            <div className="space-y-3 text-sm text-gray-700 dark:text-[#D1D5DB]">
              <p>If you have questions about data deletion or encounter any issues:</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-[#6B7280]">Email:</span>
                  <a href="mailto:privacy@screndly.com" className="text-[#ec1e24] hover:underline">
                    privacy@screndly.com
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-[#6B7280]">Response Time:</span>
                  <span>Within 48 hours</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-4">
                We take your privacy seriously and are committed to processing all data deletion requests promptly and completely.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-[#374151] py-8 px-6 mt-12">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex flex-wrap gap-2 justify-center text-sm text-gray-600 dark:text-[#9CA3AF]">
            <button onClick={() => onNavigate('privacy')} className="hover:text-[#ec1e24]">Privacy</button>
            <span>•</span>
            <button onClick={() => onNavigate('terms')} className="hover:text-[#ec1e24]">Terms</button>
            <span>•</span>
            <button onClick={() => onNavigate('data-deletion')} className="hover:text-[#ec1e24]">Data Deletion</button>
            <span>•</span>
            <button onClick={() => onNavigate('contact')} className="hover:text-[#ec1e24]">Contact</button>
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-[#9CA3AF]">
            ©️ 2026, Screndly. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}