import { Plus } from 'lucide-react';
import { useKeyboard } from '../contexts/KeyboardContext';
import { useScrollDirection } from '../utils/useScrollDirection';
import { haptics } from '../utils/haptics';

interface CreateFabProps {
  currentPage: string;
  isSettingsOpen: boolean;
  isNotificationsOpen: boolean;
  onNavigate: (page: string, fromPage?: string) => void;
}

const HIDDEN_PAGES = new Set(['create', 'compose-editor', 'compose-activity', 'pad-workspace']);

export function CreateFab({
  currentPage,
  isSettingsOpen,
  isNotificationsOpen,
  onNavigate,
}: CreateFabProps) {
  const { isInputFocused } = useKeyboard();
  const scrollDirection = useScrollDirection();

  const isHidden =
    HIDDEN_PAGES.has(currentPage) ||
    isSettingsOpen ||
    isNotificationsOpen ||
    isInputFocused;

  return (
    <button
      type="button"
      onClick={() => {
        haptics.medium();
        onNavigate('create', currentPage);
      }}
      aria-label="Open Create"
      className={`fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-[#ec1e24] text-white shadow-none transition-all duration-300 hover:bg-[#d11b20] lg:right-8 lg:bottom-8 ${
        isHidden
          ? 'pointer-events-none translate-y-24 opacity-0'
          : scrollDirection === 'down'
            ? 'translate-y-24 opacity-0'
            : 'translate-y-0 opacity-100'
      }`}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
