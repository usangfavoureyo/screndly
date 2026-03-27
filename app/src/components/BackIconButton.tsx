import { haptics } from '../utils/haptics';
import { cn } from './ui/utils';

interface BackIconButtonProps {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
}

export function BackIconButton({
  onClick,
  className,
  ariaLabel = 'Go back',
}: BackIconButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        haptics.light();
        onClick();
      }}
      className={cn(
        '!m-0 !p-0 shrink-0 flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-white/90 text-gray-900 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-[transform,background-color,color] duration-200 hover:scale-[1.03] hover:text-[#ec1e24] active:scale-95 dark:border-white/10 dark:bg-[#050505]/88 dark:text-white dark:shadow-[0_16px_38px_rgba(0,0,0,0.46)]',
        className,
      )}
      aria-label={ariaLabel}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12H2M9 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
