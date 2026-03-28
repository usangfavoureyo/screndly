import { Plus } from 'lucide-react';
import { useKeyboard } from '../contexts/KeyboardContext';
import { useScrollDirection } from '../utils/useScrollDirection';
import { haptics } from '../utils/haptics';

interface CreateFabProps {
  currentPage: string;
  isPostFlowOpen: boolean;
  isSettingsOpen: boolean;
  isNotificationsOpen: boolean;
  onOpenPostFlow: () => void;
}

const HIDDEN_PAGES = new Set(['pad-workspace']);

export function CreateFab({
  currentPage,
  isPostFlowOpen,
  isSettingsOpen,
  isNotificationsOpen,
  onOpenPostFlow,
}: CreateFabProps) {
  const { isInputFocused } = useKeyboard();
  const { scrollDirection } = useScrollDirection();

  const isHidden =
    HIDDEN_PAGES.has(currentPage) ||
    isPostFlowOpen ||
    isSettingsOpen ||
    isNotificationsOpen ||
    isInputFocused;

  return (
    <button
      type="button"
      onClick={() => {
        haptics.medium();
        onOpenPostFlow();
      }}
      aria-label="Open Posts"
      className={`fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6.4rem)] z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-[#ec1e24] text-white shadow-[0_18px_36px_rgba(236,30,36,0.34)] transition-all duration-300 hover:bg-[#d11b20] lg:right-8 lg:bottom-8 ${
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
