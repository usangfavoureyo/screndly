import { haptics } from '../utils/haptics';

interface BackIconButtonProps {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
}

export function BackIconButton({
  onClick,
  className = 'text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2',
  ariaLabel = 'Go back',
}: BackIconButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        haptics.light();
        onClick();
      }}
      className={className}
      aria-label={ariaLabel}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12H2M9 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
