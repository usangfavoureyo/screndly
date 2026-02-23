import { useEffect } from 'react';

export function useScrollLock(lock: boolean) {
    useEffect(() => {
        if (lock) {
            // Get original overflow style
            const originalStyle = window.getComputedStyle(document.body).overflow;
            // Lock scroll
            document.body.style.overflow = 'hidden';

            // Cleanup function to restore original style
            return () => {
                document.body.style.overflow = originalStyle;
            };
        }
    }, [lock]);
}
