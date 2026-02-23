import { useState, useCallback } from 'react';

interface BottomSheetConfig {
  heightMode?: 'auto' | 'half' | 'full';
  showHandle?: boolean;
  disableSwipe?: boolean;
  disableBackdropClose?: boolean;
}

/**
 * Hook to manage bottom sheet state
 * 
 * @example
 * const { isOpen, open, close, toggle } = useBottomSheet();
 * 
 * <BottomSheet open={isOpen} onOpenChange={toggle}>
 *   <BottomSheetHeader>
 *     <BottomSheetTitle>Title</BottomSheetTitle>
 *   </BottomSheetHeader>
 *   <BottomSheetBody>Content</BottomSheetBody>
 * </BottomSheet>
 */
export function useBottomSheet(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback((value?: boolean) => {
    setIsOpen((prev) => value !== undefined ? value : !prev);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
    setIsOpen,
  };
}
