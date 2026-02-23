import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { haptics } from '../../utils/haptics';

interface CleanupSettingsProps {
  settings: any;
  updateSetting: (key: string, value: any) => void;
  onBack: () => void;
}

export function CleanupSettings({ settings, updateSetting, onBack }: CleanupSettingsProps) {
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
            <path d="M22 12H2M9 19l-7-7 7-7"/>
          </svg>
        </button>
        <h2 className="text-gray-900 dark:text-white text-xl">Cleanup</h2>
      </div>

      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[#9CA3AF]">Auto Cleanup</span>
          <Switch
            checked={settings.cleanupEnabled}
            onCheckedChange={(checked) => updateSetting('cleanupEnabled', checked)}
          />
        </div>

        {/* Videos Section */}
        <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-gray-900 dark:text-white">Videos</h3>
          
          <div>
            <Label className="text-[#9CA3AF]">Cleanup Interval</Label>
            <Select
              value={settings.videoCleanupInterval || settings.cleanupInterval || 'daily'}
              onValueChange={(value) => updateSetting('videoCleanupInterval', value)}
            >
              <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[#9CA3AF]">Storage Retention (hours)</Label>
            <Input
              type="number"
              value={settings.videoStorageRetention || settings.storageRetention || '48'}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoStorageRetention', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Applies to downloaded YouTube trailers
            </p>
          </div>
        </div>

        {/* Images Section */}
        <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-gray-900 dark:text-white">Images</h3>
          
          <div>
            <Label className="text-[#9CA3AF]">Cleanup Interval</Label>
            <Select
              value={settings.imageCleanupInterval || settings.cleanupInterval || 'daily'}
              onValueChange={(value) => updateSetting('imageCleanupInterval', value)}
            >
              <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[#9CA3AF]">Storage Retention (hours)</Label>
            <Input
              type="number"
              value={settings.imageStorageRetention || settings.storageRetention || '48'}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('imageStorageRetention', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Applies to all images: Google images, Serper images (RSS Feeds), TMDb posters, and TMDb backdrops
            </p>
          </div>
        </div>

        {/* Video Studio Section */}
        <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-gray-900 dark:text-white">Video Studio</h3>
          
          <div>
            <Label className="text-[#9CA3AF]">Cleanup Interval</Label>
            <Select
              value={settings.videoStudioCleanupInterval || settings.cleanupInterval || 'daily'}
              onValueChange={(value) => updateSetting('videoStudioCleanupInterval', value)}
            >
              <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[#9CA3AF]">Storage Retention (hours)</Label>
            <Input
              type="number"
              value={settings.videoStudioStorageRetention || settings.storageRetention || '48'}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('videoStudioStorageRetention', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Applies to generated videos in Review, Releases, and Scenes
            </p>
          </div>
        </div>

        {/* Logs Section */}
        <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-gray-900 dark:text-white">Logs</h3>
          
          <div>
            <Label className="text-[#9CA3AF]">Log Retention (hours)</Label>
            <Input
              type="number"
              value={settings.logsRetention || '168'}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('logsRetention', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Automatically remove log entries older than this period (Default: 168 hours / 7 days)
            </p>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-gray-900 dark:text-white">Recent Activity</h3>
          
          <div>
            <Label className="text-[#9CA3AF]">Activity Retention (hours)</Label>
            <Input
              type="number"
              value={settings.recentActivityRetention || '24'}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('recentActivityRetention', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Automatically remove combined activity history older than this period (Default: 24 hours / 1 day)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}