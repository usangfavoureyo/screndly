/**
 * Accessibility utilities for Screndly
 * Provides helpers for ARIA labels, keyboard navigation, and screen reader support
 */

/**
 * Generate a unique ID for ARIA relationships
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.classList.add('sr-only');
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Check if element is keyboard focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  
  return focusableSelectors.some(selector => element.matches(selector));
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  
  return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
}

/**
 * Trap focus within a container (useful for modals/dialogs)
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  if (event.shiftKey) {
    // Shift + Tab
    if (document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
    }
  } else {
    // Tab
    if (document.activeElement === lastElement) {
      event.preventDefault();
      firstElement?.focus();
    }
  }
}

/**
 * Format relative time for screen readers
 */
export function formatTimeForScreenReader(timestamp: string): string {
  // Convert relative time like "2 hours ago" to more descriptive format
  return `Posted ${timestamp}`;
}

/**
 * Get accessible label for platform
 */
export function getPlatformAccessibleLabel(platform: string): string {
  const labels: Record<string, string> = {
    'YouTube': 'YouTube platform',
    'Instagram': 'Instagram platform',
    'TikTok': 'TikTok platform',
    'Twitter': 'Twitter platform',
    'Facebook': 'Facebook platform',
  };
  
  return labels[platform] || `${platform} platform`;
}

/**
 * Get accessible label for status
 */
export function getStatusAccessibleLabel(status: string): string {
  const labels: Record<string, string> = {
    'success': 'Successfully published',
    'failed': 'Failed to publish',
    'pending': 'Pending publication',
    'scheduled': 'Scheduled for publication',
    'draft': 'Saved as draft',
  };
  
  return labels[status] || status;
}
