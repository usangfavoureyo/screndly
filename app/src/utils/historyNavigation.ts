type AppBackHandler = {
  handleAppBack: (fallback?: () => void) => boolean;
};

export function navigateBackWithFallback(
  handlerOrFallback: AppBackHandler | (() => void),
  fallback?: () => void,
) {
  const appBackHandler = typeof handlerOrFallback === 'function' ? null : handlerOrFallback;
  const resolvedFallback = typeof handlerOrFallback === 'function' ? handlerOrFallback : fallback;

  if (appBackHandler) {
    return appBackHandler.handleAppBack(resolvedFallback);
  }

  if (typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back();
    return true;
  }

  resolvedFallback?.();
  return Boolean(resolvedFallback);
}
