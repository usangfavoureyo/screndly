import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { haptics } from '../../utils/haptics';

interface AppearanceSettingsProps {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  updateSetting: (key: string, value: any) => void;
  onBack: () => void;
}

export function AppearanceSettings({ theme, setTheme, updateSetting, onBack }: AppearanceSettingsProps) {
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
        <h2 className="text-gray-900 dark:text-white text-xl">Appearance</h2>
      </div>

      <div className="p-6">
        <div>
          <Label className="text-[#9CA3AF]">Theme</Label>
          <Select
            value={theme}
            onOpenChange={(open) => {
              if (open) haptics.light();
            }}
            onValueChange={(value: 'dark' | 'light') => {
              haptics.light();
              updateSetting('darkMode', value === 'dark');
              setTheme(value);
            }}
          >
            <SelectTrigger className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark Mode</SelectItem>
              <SelectItem value="light">Light Mode</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}