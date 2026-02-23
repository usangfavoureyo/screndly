import { haptics } from '../../utils/haptics';

interface ErrorHandlingSettingsProps {
  onBack: () => void;
}

export function ErrorHandlingSettings({ onBack }: ErrorHandlingSettingsProps) {
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