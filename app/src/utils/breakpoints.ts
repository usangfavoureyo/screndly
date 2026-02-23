/**
 * SCRENDLY RESPONSIVE BREAKPOINTS
 * 
 * Mobile-First Strategy: Base styles target mobile, then enhance with breakpoint prefixes
 * 
 * Breakpoint System (Tailwind):
 * - sm:  640px  - Small tablets, large phones in landscape
 * - md:  768px  - Tablets
 * - lg:  1024px - Laptops, desktops (sidebar becomes visible)
 * - xl:  1280px - Large desktops
 * - 2xl: 1536px - Extra large screens
 * 
 * Usage Examples:
 * - className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
 * - className="text-sm lg:text-base"
 * - className="p-4 lg:p-8"
 */

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Layout Patterns by Breakpoint:
 * 
 * Mobile (< 640px):
 * - Single column layouts
 * - Bottom navigation (fixed, 64px height)
 * - Full-width cards with 16px padding
 * - Stacked form fields
 * - Hamburger menus
 * 
 * Tablet (640px - 1024px):
 * - 2-column grids
 * - Condensed spacing (padding reduced slightly)
 * - Bottom navigation still visible
 * - Responsive typography scaling
 * 
 * Laptop/Desktop (>= 1024px):
 * - Left sidebar navigation (256px fixed width, `lg:ml-64` offset)
 * - 3-4 column grids
 * - No bottom navigation
 * - Optimal reading width maintained
 * - Settings panels become right-side overlays (450-600px)
 * 
 * Component-Specific Responsive Behavior:
 * 
 * Navigation:
 * - Mobile: Bottom fixed bar with 5 icons
 * - Desktop: Left sidebar (256px) with full labels
 * 
 * Settings Panel:
 * - Mobile: Full screen overlay
 * - Desktop: Right-side panel (600px width)
 * 
 * Notification Panel:
 * - Mobile: Full screen overlay
 * - Desktop: Right-side panel (450px width)
 * 
 * Cards & Content:
 * - Mobile: p-4 (16px padding)
 * - Tablet: p-6 (24px padding) via sm: prefix
 * - Desktop: p-8 (32px padding) via lg: prefix
 * 
 * Grids:
 * - Mobile: 1 column
 * - Tablet: 2 columns
 * - Laptop: 3 columns
 * - Desktop: 4 columns
 */

/**
 * Helper function to check if current viewport matches a breakpoint
 * @param breakpoint - The breakpoint to check (e.g., 'lg')
 * @returns boolean indicating if viewport is >= breakpoint
 */
export const isBreakpoint = (breakpoint: keyof typeof BREAKPOINTS): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= BREAKPOINTS[breakpoint];
};

/**
 * Hook for responsive behavior (use with useState/useEffect)
 * Example:
 * 
 * const [isMobile, setIsMobile] = useState(!isBreakpoint('lg'));
 * 
 * useEffect(() => {
 *   const handleResize = () => setIsMobile(!isBreakpoint('lg'));
 *   window.addEventListener('resize', handleResize);
 *   return () => window.removeEventListener('resize', handleResize);
 * }, []);
 */

/**
 * Z-Index Scale (from globals.css):
 * --z-base: 0        - Normal document flow
 * --z-dropdown: 10   - Dropdown menus
 * --z-sticky: 20     - Sticky headers
 * --z-fixed: 30      - Fixed navigation
 * --z-overlay: 40    - Modal overlays
 * --z-modal: 50      - Modal content (settings/notifications panels)
 * --z-popover: 60    - Popovers, tooltips
 * --z-toast: 70      - Toast notifications
 * --z-tooltip: 80    - Highest priority tooltips
 */

export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  overlay: 40,
  modal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
} as const;
