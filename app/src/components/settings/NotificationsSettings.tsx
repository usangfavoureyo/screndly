import { Switch } from '../ui/switch';
import { Check, WifiNoSignal } from 'lucide-react';
import { haptics } from '../../utils/haptics';
import { desktopNotifications } from '../../utils/desktopNotifications';
import { Label } from '../ui/label';
import {
  BottomSheet,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet';
import { Button } from '../ui/button';
import { useState } from 'react';
import { BackIconButton } from '../BackIconButton';

interface NotificationsSettingsProps {
  settings: any;
  updateSetting: (key: string, value: any) => void;
  onBack: () => void;
}

export function NotificationsSettings({ settings, updateSetting, onBack }: NotificationsSettingsProps) {
  const [isDurationSheetOpen, setIsDurationSheetOpen] = useState(false);

  const handleDesktopNotificationToggle = async (checked: boolean) => {
    haptics.medium();

    if (checked) {
      // Request permission
      const granted = await desktopNotifications.requestPermission();
      if (granted) {
        updateSetting('desktopNotifications', true);
        // Send test notification
        desktopNotifications.sendTyped(
          'success',
          'Desktop Notifications Enabled',
          'You\'ll now receive notifications on your desktop'
        );
      } else {
        // Permission denied
        updateSetting('desktopNotifications', false);
      }
    } else {
      updateSetting('desktopNotifications', false);
    }
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3 z-10">
        <BackIconButton
          onClick={() => {
            onBack();
          }}
        />
        <h2 className="text-gray-900 dark:text-white text-xl">Notifications</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* General Settings */}
        <div>
          <h3 className="text-black dark:text-white mb-4">General</h3>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">In-App Notifications</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Show notifications in the app
                </p>
              </div>
              <Switch
                checked={settings.inAppNotifications ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('inAppNotifications', checked);
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">Desktop Notifications</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Push notifications to your desktop
                </p>
              </div>
              <Switch
                checked={settings.desktopNotifications ?? false}
                onCheckedChange={handleDesktopNotificationToggle}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">Sound</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Play sound for notifications
                </p>
              </div>
              <Switch
                checked={settings.notificationSound ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('notificationSound', checked);
                }}
              />
            </div>
          </div>
        </div>

        {/* Notification Categories */}
        <div className="pt-6 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-black dark:text-white mb-4">Categories</h3>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">Upload Notifications</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Video uploads and processing
                </p>
              </div>
              <Switch
                checked={settings.notifyUploads ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('notifyUploads', checked);
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">RSS Feeds Notifications</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  New trailer feeds detected
                </p>
              </div>
              <Switch
                checked={settings.notifyRSS ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('notifyRSS', checked);
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-1 items-start gap-3">
                <WifiNoSignal className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ec1e24]" />
                <div className="flex-1">
                  <Label className="text-[#9CA3AF]">TMDb Feeds Notifications</Label>
                  <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                    Movie/TV updates from TMDb
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.notifyTMDb ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('notifyTMDb', checked);
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">Video Studio Notifications</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Video generation and processing
                </p>
              </div>
              <Switch
                checked={settings.notifyVideoStudio ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('notifyVideoStudio', checked);
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">Design Studio Notifications</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Design export and publishing updates
                </p>
              </div>
              <Switch
                checked={settings.notifyDesignStudio ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('notifyDesignStudio', checked);
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">Design Export Completed</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Notify when design export finishes
                </p>
              </div>
              <Switch
                checked={settings.notifyDesignExportCompleted ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('notifyDesignExportCompleted', checked);
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">Design Export Failed</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Alert when design export fails
                </p>
              </div>
              <Switch
                checked={settings.notifyDesignExportFailed ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('notifyDesignExportFailed', checked);
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">Manual Publish Confirmation</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Require confirmation before publishing designs
                </p>
              </div>
              <Switch
                checked={settings.notifyDesignManualPublish ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('notifyDesignManualPublish', checked);
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">Design Ready for Posting</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Notify when design is ready to post
                </p>
              </div>
              <Switch
                checked={settings.notifyDesignReadyForPosting ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('notifyDesignReadyForPosting', checked);
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">System Notifications</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  App updates and maintenance
                </p>
              </div>
              <Switch
                checked={settings.notifySystem ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('notifySystem', checked);
                }}
              />
            </div>
          </div>
        </div>

        {/* Notification Timing */}
        <div className="pt-6 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-black dark:text-white mb-4">Timing</h3>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">Auto-dismiss Toasts</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Automatically close toast notifications
                </p>
              </div>
              <Switch
                checked={settings.autoDismissToasts ?? true}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('autoDismissToasts', checked);
                }}
              />
            </div>

            <div>
              <Label className="text-[#9CA3AF] mb-2 block">
                Toast Duration
              </Label>
              <Button
                variant="outline"
                onClick={() => {
                  haptics.light();
                  setIsDurationSheetOpen(true);
                }}
                className="w-full justify-between bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
              >
                <span>
                  {settings.toastDuration === 3000 && '3 seconds'}
                  {settings.toastDuration === 5000 && '5 seconds'}
                  {settings.toastDuration === 7000 && '7 seconds'}
                  {settings.toastDuration === 10000 && '10 seconds'}
                  {!settings.toastDuration && '5 seconds'}
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-50">
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>

              <BottomSheet
                open={isDurationSheetOpen}
                onOpenChange={setIsDurationSheetOpen}
                heightMode="auto"
              >
                <BottomSheetHeader>
                  <BottomSheetTitle>Toast Duration</BottomSheetTitle>
                </BottomSheetHeader>
                <div className="p-4 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      haptics.light();
                      updateSetting('toastDuration', 3000);
                      setIsDurationSheetOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-colors ${(settings.toastDuration ?? 5000) === 3000
                        ? 'bg-red-50 dark:bg-red-500/10 text-[#ec1e24]'
                        : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]'
                      }`}
                  >
                    <span className="font-medium">3 seconds</span>
                    {(settings.toastDuration ?? 5000) === 3000 && <Check className="w-5 h-5 flex-shrink-0" />}
                  </button>
                  <button
                    onClick={() => {
                      haptics.light();
                      updateSetting('toastDuration', 5000);
                      setIsDurationSheetOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-colors ${(settings.toastDuration ?? 5000) === 5000
                        ? 'bg-red-50 dark:bg-red-500/10 text-[#ec1e24]'
                        : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]'
                      }`}
                  >
                    <span className="font-medium">5 seconds</span>
                    {(settings.toastDuration ?? 5000) === 5000 && <Check className="w-5 h-5 flex-shrink-0" />}
                  </button>
                  <button
                    onClick={() => {
                      haptics.light();
                      updateSetting('toastDuration', 7000);
                      setIsDurationSheetOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-colors ${(settings.toastDuration ?? 5000) === 7000
                        ? 'bg-red-50 dark:bg-red-500/10 text-[#ec1e24]'
                        : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]'
                      }`}
                  >
                    <span className="font-medium">7 seconds</span>
                    {(settings.toastDuration ?? 5000) === 7000 && <Check className="w-5 h-5 flex-shrink-0" />}
                  </button>
                  <button
                    onClick={() => {
                      haptics.light();
                      updateSetting('toastDuration', 10000);
                      setIsDurationSheetOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-colors ${(settings.toastDuration ?? 5000) === 10000
                        ? 'bg-red-50 dark:bg-red-500/10 text-[#ec1e24]'
                        : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]'
                      }`}
                  >
                    <span className="font-medium">10 seconds</span>
                    {(settings.toastDuration ?? 5000) === 10000 && <Check className="w-5 h-5 flex-shrink-0" />}
                  </button>
                </div>
              </BottomSheet>
            </div>
          </div>
        </div>

        {/* Do Not Disturb */}
        <div className="pt-6 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-black dark:text-white mb-4">Do Not Disturb</h3>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-[#9CA3AF]">Enable Do Not Disturb</Label>
                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                  Mute all notifications during set hours
                </p>
              </div>
              <Switch
                checked={settings.doNotDisturb ?? false}
                onCheckedChange={(checked) => {
                  haptics.light();
                  updateSetting('doNotDisturb', checked);
                }}
              />
            </div>

            {settings.doNotDisturb && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-900 dark:text-white block mb-2">Start Time</Label>
                  <input
                    type="time"
                    value={settings.dndStartTime ?? '22:00'}
                    onFocus={() => haptics.light()}
                    onChange={(e) => {
                      haptics.light();
                      updateSetting('dndStartTime', e.target.value);
                    }}
                    className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-900 dark:text-white block mb-2">End Time</Label>
                  <input
                    type="time"
                    value={settings.dndEndTime ?? '08:00'}
                    onFocus={() => haptics.light()}
                    onChange={(e) => {
                      haptics.light();
                      updateSetting('dndEndTime', e.target.value);
                    }}
                    className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
