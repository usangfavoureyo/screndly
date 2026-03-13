type LoaderSize = 'sm' | 'md' | 'lg';

interface RedSpinnerProps {
  size?: LoaderSize;
  label?: string;
  className?: string;
}

interface PageLoaderProps {
  fullScreen?: boolean;
  size?: LoaderSize;
  label?: string;
  className?: string;
}

const SPINNER_SIZE_MAP: Record<LoaderSize, string> = {
  sm: 'h-4 w-4 border-[1.5px]',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-b-2',
};

export function RedSpinner({ size = 'lg', label = 'Loading...', className = '' }: RedSpinnerProps) {
  return (
    <>
      <div
        className={`${SPINNER_SIZE_MAP[size]} animate-spin rounded-full border-[#ec1e24] border-t-transparent ${className}`.trim()}
      />
      <span className="sr-only">{label}</span>
    </>
  );
}

export function PageLoader({
  fullScreen = false,
  size = 'lg',
  label = 'Loading...',
  className = '',
}: PageLoaderProps) {
  return (
    <div
      className={`flex items-center justify-center ${fullScreen ? 'min-h-screen bg-white dark:bg-[#000000]' : 'h-64'} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <RedSpinner size={size} label={label} />
    </div>
  );
}
