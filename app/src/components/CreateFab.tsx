import { Plus } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
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
const FAB_ENTER_SPRING = {
  type: 'spring' as const,
  stiffness: 480,
  damping: 28,
  mass: 0.9,
  restSpeed: 0.06,
  restDelta: 0.12,
};

const FAB_EXIT_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 34,
  mass: 0.92,
  restSpeed: 0.08,
  restDelta: 0.18,
};

const FAB_VARIANTS = {
  initial: {
    y: 18,
    scale: 0.97,
  },
  hidden: {
    y: 104,
    scale: 0.97,
  },
  visible: {
    y: 0,
    scale: 1,
  },
};

export function CreateFab({
  currentPage,
  isPostFlowOpen,
  isSettingsOpen,
  isNotificationsOpen,
  onOpenPostFlow,
}: CreateFabProps) {
  const { isInputFocused } = useKeyboard();
  const prefersReducedMotion = useReducedMotion();
  const { scrollDirection } = useScrollDirection();

  const isHidden =
    HIDDEN_PAGES.has(currentPage) ||
    isPostFlowOpen ||
    isSettingsOpen ||
    isNotificationsOpen ||
    isInputFocused;
  const shouldShowFab = !isHidden && scrollDirection !== 'down';

  return (
    <motion.button
      type="button"
      onClick={() => {
        haptics.medium();
        onOpenPostFlow();
      }}
      aria-label="Open Posts"
      initial="initial"
      animate={shouldShowFab ? 'visible' : 'hidden'}
      variants={FAB_VARIANTS}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : shouldShowFab
            ? FAB_ENTER_SPRING
            : FAB_EXIT_SPRING
      }
      whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
      className={`fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6.4rem)] z-[45] flex h-14 w-14 transform-gpu items-center justify-center rounded-full bg-[#ec1e24] text-white shadow-[0_18px_36px_rgba(236,30,36,0.34)] [backface-visibility:hidden] [transform:translateZ(0)] will-change-transform hover:bg-[#d11b20] lg:right-8 lg:bottom-8 ${
        shouldShowFab ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      // Match the tight X/Twitter compose FAB reveal: quick rise, one subtle overshoot, immediate settle.
    >
      <Plus className="h-6 w-6" />
    </motion.button>
  );
}
