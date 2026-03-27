import { haptics } from '../../utils/haptics';
import { BackIconButton } from '../BackIconButton';

interface ErrorHandlingSettingsProps {
  onBack: () => void;
}

export function ErrorHandlingSettings({ onBack }: ErrorHandlingSettingsProps) {
  return (
    <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3">
        <BackIconButton
          onClick={() => {
            onBack();
          }}
        />
        <h2 className="text-gray-900 dark:text-white text-xl">Error Handling</h2>
      </div>

      <div className="p-6">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] p-4 rounded-lg">
          <p className="text-gray-600 dark:text-[#9CA3AF] text-sm">
            Automatic error reporting is enabled. API failures and rate limits are logged and monitored.
          </p>
        </div>
      </div>
    </div>
  );
}
