import { useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { haptics } from '../../utils/haptics';
import { clearAuth, getToken, setToken } from '../../lib/api/authToken';

interface ApiKeysSettingsProps {
  settings: any;
  updateSetting: (key: string, value: any) => void;
  onBack: () => void;
}

export function ApiKeysSettings({ settings, updateSetting, onBack }: ApiKeysSettingsProps) {
  const [authToken, setAuthToken] = useState('');

  useEffect(() => {
    setAuthToken(getToken() || '');
  }, []);

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3">
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
        <h2 className="text-gray-900 dark:text-white text-xl">API Keys</h2>
      </div>

      <div className="p-6 space-y-3">
        {/* Admin Authentication */}
        <div>
          <Label className="text-gray-600 dark:text-[#9CA3AF]">Admin Secret (Required for Posting)</Label>
          <Input
            type="password"
            value={authToken}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              const nextValue = e.target.value;
              setAuthToken(nextValue);

              if (nextValue.trim()) {
                setToken(nextValue.trim(), true);
              } else {
                clearAuth();
              }
            }}
            placeholder="Enter your ADMIN_SECRET"
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 border-[#ec1e24] focus:ring-[#ec1e24]"
          />
          <p className="text-xs text-gray-500 mt-1">This key is required to authenticate with the backend.</p>
        </div>
        <div>
          <Label className="text-gray-600 dark:text-[#9CA3AF]">OpenAI API Key</Label>
          <Input
            type="password"
            value={settings.openaiKey || ''}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('openaiKey', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
        </div>
        <div>
          <Label className="text-gray-600 dark:text-[#9CA3AF]">Serper API Key</Label>
          <Input
            type="password"
            value={settings.serperKey || ''}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('serperKey', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
        </div>
        <div>
          <Label className="text-gray-600 dark:text-[#9CA3AF]">TMDb API Key</Label>
          <Input
            type="password"
            value={settings.tmdbKey || ''}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('tmdbKey', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
        </div>
        <div>
          <Label className="text-gray-600 dark:text-[#9CA3AF]">Flash 3 API Key (Gemini)</Label>
          <Input
            type="password"
            value={settings.flash3Key || ''}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('flash3Key', e.target.value);
            }}
            placeholder="Google AI / Gemini API Key"
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
        </div>
        <div>
          <Label className="text-gray-600 dark:text-[#9CA3AF]">Google Video Intelligence API Key</Label>
          <Input
            type="password"
            value={settings.googleVideoIntelligenceKey || ''}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('googleVideoIntelligenceKey', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
        </div>
        <div>
          <Label className="text-gray-600 dark:text-[#9CA3AF]">Shotstack API Key</Label>
          <Input
            type="password"
            value={settings.shotstackKey || ''}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('shotstackKey', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
        </div>
        <div>
          <Label className="text-gray-600 dark:text-[#9CA3AF]">Google Search API Key</Label>
          <Input
            type="password"
            value={settings.videoGoogleSearchApiKey || ''}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('videoGoogleSearchApiKey', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
        </div>
        <div>
          <Label className="text-gray-600 dark:text-[#9CA3AF]">Google Custom Search Engine ID (CX)</Label>
          <Input
            type="password"
            value={settings.videoGoogleSearchCx || ''}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('videoGoogleSearchCx', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
        </div>

        {/* Backblaze B2 Section - General Bucket */}
        <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-gray-900 dark:text-white">Backblaze B2 - General Storage</h3>
          <p className="text-xs text-[#6B7280]">
            For trailers and general uploads
          </p>

          <div>
            <Label className="text-gray-600 dark:text-[#9CA3AF]">Key ID</Label>
            <Input
              type="password"
              value={settings.backblazeKeyId || ''}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('backblazeKeyId', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-600 dark:text-[#9CA3AF]">Application Key</Label>
            <Input
              type="password"
              value={settings.backblazeApplicationKey || ''}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('backblazeApplicationKey', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-600 dark:text-[#9CA3AF]">Bucket Name</Label>
            <Input
              value={settings.backblazeBucketName || ''}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('backblazeBucketName', e.target.value);
              }}
              placeholder="my-screndly-bucket"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
        </div>

        {/* Backblaze B2 Section - Videos Bucket */}
        <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-gray-900 dark:text-white">Backblaze B2 - Videos Bucket</h3>
          <p className="text-xs text-[#6B7280]">
            For movies and TV shows (Video Scenes Module)
          </p>

          <div>
            <Label className="text-gray-600 dark:text-[#9CA3AF]">Key ID</Label>
            <Input
              type="password"
              value={settings.backblazeVideosKeyId || ''}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('backblazeVideosKeyId', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-600 dark:text-[#9CA3AF]">Application Key</Label>
            <Input
              type="password"
              value={settings.backblazeVideosApplicationKey || ''}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('backblazeVideosApplicationKey', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-600 dark:text-[#9CA3AF]">Bucket Name</Label>
            <Input
              value={settings.backblazeVideosBucketName || ''}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('backblazeVideosBucketName', e.target.value);
              }}
              placeholder="screndly-videos"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
        </div>

        {/* Backblaze B2 Section - Design Bucket */}
        <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-gray-900 dark:text-white">Backblaze B2 - Design Bucket</h3>
          <p className="text-xs text-[#6B7280]">
            For static creatives and design assets (Design Studio)
          </p>

          <div>
            <Label className="text-gray-600 dark:text-[#9CA3AF]">Key ID</Label>
            <Input
              type="password"
              value={settings.backblazeDesignKeyId || ''}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('backblazeDesignKeyId', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-600 dark:text-[#9CA3AF]">Application Key</Label>
            <Input
              type="password"
              value={settings.backblazeDesignApplicationKey || ''}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('backblazeDesignApplicationKey', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-600 dark:text-[#9CA3AF]">Bucket Name</Label>
            <Input
              value={settings.backblazeDesignBucketName || ''}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('backblazeDesignBucketName', e.target.value);
              }}
              placeholder="screndly-design"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
