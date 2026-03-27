import { useState, useEffect } from 'react';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";
import { BackIconButton } from '../BackIconButton';

interface TimezoneSettingsProps {
  onBack: () => void;
}

const defaultTimezone = 'Africa/Lagos';

export function TimezoneSettings({ onBack }: TimezoneSettingsProps) {
  const [timezone, setTimezone] = useState(defaultTimezone);

  // Load settings on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tmdbSettings');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.timezone) {
            setTimezone(parsed.timezone);
          }
        } catch (err) {
          console.error('Error parsing timezone settings:', err);
        }
      }
    } catch (e) {
      console.error('Failed to access localStorage:', e);
    }
  }, []);

  // Save timezone to local storage and TMDb settings
  const handleTimezoneChange = (value: string) => {
    setTimezone(value);
    
    try {
      // Save to TMDb settings
      const stored = localStorage.getItem('tmdbSettings');
      let tmdbSettings = {};
      if (stored) {
        try {
          tmdbSettings = JSON.parse(stored);
        } catch (err) {
          console.error('Error parsing TMDb settings:', err);
        }
      }
      
      const updated = { ...tmdbSettings, timezone: value };
      localStorage.setItem('tmdbSettings', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save timezone to localStorage:', e);
    }
    
    haptics.selection();
    toast.success('Timezone updated');
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3">
        <BackIconButton
          onClick={() => {
            onBack();
          }}
        />
        <h2 className="text-gray-900 dark:text-white text-xl">Timezone</h2>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Timezone Selector */}
        <div>
          <Label htmlFor="timezone" className="text-[#9CA3AF]">Application Timezone</Label>
          <Select
            value={timezone}
            onValueChange={handleTimezoneChange}
          >
            <SelectTrigger id="timezone" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Africa/Lagos">Africa/Lagos (WAT)</SelectItem>
              <SelectItem value="America/New_York">America/New_York (EST/EDT)</SelectItem>
              <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</SelectItem>
              <SelectItem value="America/Chicago">America/Chicago (CST/CDT)</SelectItem>
              <SelectItem value="America/Denver">America/Denver (MST/MDT)</SelectItem>
              <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
              <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
              <SelectItem value="Europe/Berlin">Europe/Berlin (CET/CEST)</SelectItem>
              <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
              <SelectItem value="Asia/Shanghai">Asia/Shanghai (CST)</SelectItem>
              <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
              <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
              <SelectItem value="Australia/Sydney">Australia/Sydney (AEDT/AEST)</SelectItem>
              <SelectItem value="Pacific/Auckland">Pacific/Auckland (NZDT/NZST)</SelectItem>
              <SelectItem value="UTC">UTC</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Additional Info */}
        <div className="space-y-3">
          <h3 className="text-sm text-gray-900 dark:text-white">Affected Features</h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-[#ec1e24] mt-1">•</span>
              <span>TMDb Feeds (Today's Releases, Weekly Releases, Monthly Previews, Anniversaries)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#ec1e24] mt-1">•</span>
              <span>RSS Feed scheduled posts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#ec1e24] mt-1">•</span>
              <span>Video Studio scheduled content</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#ec1e24] mt-1">•</span>
              <span>All time-based automation and scheduling</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
