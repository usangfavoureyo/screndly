interface SegmentedTabOption<T extends string> {
  id: T;
  label: string;
}

interface SegmentedTabSwitcherProps<T extends string> {
  tabs: readonly SegmentedTabOption<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
}

export function SegmentedTabSwitcher<T extends string>({
  tabs,
  activeTab,
  onChange,
}: SegmentedTabSwitcherProps<T>) {
  return (
    <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-2">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-center ${
              activeTab === tab.id
                ? 'bg-[#ec1e24] text-white'
                : 'text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
            }`}
            aria-pressed={activeTab === tab.id}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
