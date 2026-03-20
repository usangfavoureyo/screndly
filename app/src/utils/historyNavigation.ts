export function navigateBackWithFallback(fallback: () => void) {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back();
    return;
  }

  fallback();
}
