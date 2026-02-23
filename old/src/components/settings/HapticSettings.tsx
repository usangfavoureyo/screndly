import { Switch } from '../ui/switch';
import { haptics, setHapticsEnabled } from '../../utils/haptics';

interface HapticSettingsProps {
  settings: any;
  updateSetting: (key: string, value: any) => void;
  onBack: () => void;
}

export function HapticSettings({ settings, updateSetting, onBack }: HapticSettingsProps) {
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
        <h2 className="text-gray-900 dark:text-white text-xl">Haptic Feedback</h2>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[#9CA3AF]">Enable Haptic Feedback</span>
          <Switch
            checked={settings.hapticsEnabled}
            onCheckedChange={(checked) => {
              updateSetting('hapticsEnabled', checked);
              setHapticsEnabled(checked);
              // Give immediate feedback when toggling
              if (checked) {
                try {
                  if ('vibrate' in navigator) {
                    navigator.vibrate(15);
                  }
                } catch (e) {
                  // Silently fail
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}