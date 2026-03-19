import { useEffect, useRef, useState } from 'react';

export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const prevScrollYRef = useRef(0);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    prevScrollYRef.current = window.scrollY;

    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      const delta = scrollY - prevScrollYRef.current;

      if (Math.abs(delta) < 5) {
        return;
      }

      prevScrollYRef.current = scrollY;
      setScrollDirection(delta > 0 ? 'down' : 'up');

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }

      hideTimerRef.current = window.setTimeout(() => {
        setScrollDirection(null);
        hideTimerRef.current = null;
      }, 180);
    };

    const onScroll = () => {
      window.requestAnimationFrame(updateScrollDirection);
    };

    window.addEventListener('scroll', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return scrollDirection;
}
