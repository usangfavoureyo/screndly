import { useEffect } from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { useBackNavigation } from '../contexts/BackNavigationContext';
import { useTransientHistoryState } from '../hooks/useTransientHistoryState';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  const { registerModalWithCloseHandler, unregisterModal } = useBackNavigation();

  useTransientHistoryState(isOpen, 'shortcuts-help', 'shortcuts-help');

  useEffect(() => {
    if (!isOpen) {
      unregisterModal('shortcuts-help');
      return;
    }

    registerModalWithCloseHandler('shortcuts-help', onClose);

    return () => {
      unregisterModal('shortcuts-help');
    };
  }, [isOpen, onClose, registerModalWithCloseHandler, unregisterModal]);

  if (!isOpen) return null;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: [`${modKey}+1`], description: 'Go to Dashboard' },
        { keys: [`${modKey}+2`], description: 'Go to Channels' },
        { keys: [`${modKey}+3`], description: 'Go to Platforms' },
        { keys: [`${modKey}+4`], description: 'Go to RSS Feeds' },
        { keys: [`${modKey}+5`], description: 'Go to TMDb Feeds' },
        { keys: [`${modKey}+6`], description: 'Go to Video Studio' },
        { keys: ['←', '→'], description: 'Navigate between pages' },
        { keys: ['Two-finger swipe'], description: 'Navigate (trackpad)' },
      ],
    },
    {
      category: 'Quick Actions',
      items: [
        { keys: [`${modKey}+,`], description: 'Open Settings' },
        { keys: [`${modKey}+N`], description: 'Open Notifications' },
        { keys: [`${modKey}+L`], description: 'Open Logs' },
        { keys: [`${modKey}+U`], description: 'Open Upload Manager' },
        { keys: ['Esc'], description: 'Close panels' },
      ],
    },
    {
      category: 'Gmail-style (G + Key)',
      items: [
        { keys: ['G', 'D'], description: 'Go to Dashboard' },
        { keys: ['G', 'C'], description: 'Go to Channels' },
        { keys: ['G', 'P'], description: 'Go to Platforms' },
        { keys: ['G', 'R'], description: 'Go to RSS Feeds' },
        { keys: ['G', 'T'], description: 'Go to TMDb Feeds' },
        { keys: ['G', 'V'], description: 'Go to Video Studio' },
        { keys: ['G', 'L'], description: 'Go to Logs' },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={() => {
          haptics.light();
          onClose();
        }}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white dark:bg-black border-2 border-gray-200 dark:border-[#333333] rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-black border-b border-gray-200 dark:border-[#333333] p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ec1e24]/10 flex items-center justify-center">
                <Keyboard className="w-5 h-5 text-[#ec1e24]" />
              </div>
              <div>
                <h2 className="text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                  Power user shortcuts for faster navigation
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                haptics.light();
                onClose();
              }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-[#9CA3AF]" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="text-sm text-[#ec1e24] mb-4 uppercase tracking-wider">
                  {section.category}
                </h3>
                <div className="space-y-3">
                  {section.items.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1A1A1A] rounded-xl hover:bg-gray-100 dark:hover:bg-[#222222] transition-colors"
                    >
                      <span className="text-sm text-gray-900 dark:text-white">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-2">
                        {shortcut.keys.map((key, keyIndex) => (
                          <div key={keyIndex} className="flex items-center gap-1">
                            {keyIndex > 0 && (
                              <span className="text-xs text-gray-500 dark:text-[#9CA3AF] mx-1">
                                then
                              </span>
                            )}
                            <kbd className="px-2 py-1 bg-white dark:bg-black border border-gray-300 dark:border-[#333333] rounded-lg text-sm text-gray-700 dark:text-gray-300 font-mono shadow-sm">
                              {key}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 dark:bg-[#1A1A1A] border-t border-gray-200 dark:border-[#333333] p-6">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-[#9CA3AF]">
              <div className="w-8 h-8 rounded-lg bg-[#ec1e24]/10 flex items-center justify-center flex-shrink-0">
                <Command className="w-4 h-4 text-[#ec1e24]" />
              </div>
              <p>
                <strong className="text-gray-900 dark:text-white">Pro tip:</strong> Shortcuts are disabled when typing in text fields
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
