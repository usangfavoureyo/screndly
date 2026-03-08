import { BackIconButton } from '../BackIconButton';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { haptics } from '../../utils/haptics';

interface ComposeSettingsProps {
  settings: any;
  updateSetting: (key: string, value: any) => void;
  onBack: () => void;
}

export function ComposeSettings({ settings, updateSetting, onBack }: ComposeSettingsProps) {
  return (
    <div className="fixed top-0 right-0 bottom-0 z-50 w-full overflow-y-auto bg-white dark:bg-[#000000] lg:w-[600px]">
      <div className="sticky top-0 border-b border-gray-200 bg-white p-4 dark:border-[#333333] dark:bg-[#000000]">
        <div className="flex items-start gap-4">
          <BackIconButton onClick={() => { haptics.light(); onBack(); }} className="mt-1 -ml-2 p-2 text-gray-900 hover:text-[#ec1e24] dark:text-white" />
          <div>
            <h2 className="text-gray-900 dark:text-white">Compose Settings</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Control the default scheduling time and local activity retention for Compose.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#333333] dark:bg-[#000000]">
          <Label className="text-gray-600 dark:text-[#9CA3AF]">Default Schedule Time</Label>
          <Input
            type="time"
            value={settings.composeDefaultScheduleTime || '09:00'}
            onChange={(event) => updateSetting('composeDefaultScheduleTime', event.target.value)}
            className="mt-2 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]"
          />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#333333] dark:bg-[#000000]">
          <Label className="text-gray-600 dark:text-[#9CA3AF]">Compose Activity Retention (days)</Label>
          <Input
            type="number"
            min="1"
            max="365"
            value={String(settings.composeActivityRetention || 30)}
            onChange={(event) => updateSetting('composeActivityRetention', Number(event.target.value || 30))}
            className="mt-2 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]"
          />
        </div>
      </div>
    </div>
  );
}
