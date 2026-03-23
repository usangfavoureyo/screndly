import { useEffect, useRef, useState } from 'react';

const TOP_REVEAL_OFFSET = 24;
const HIDE_START_OFFSET = 80;
const DIRECTION_THRESHOLD = 12;

export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up');
  const lastScrollYRef = useRef(0);
  const accumulatedDeltaRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const updateScrollDirection = () => {
      const scrollY = Math.max(window.scrollY, 0);
      const delta = scrollY - lastScrollYRef.current;
      lastScrollYRef.current = scrollY;
      tickingRef.current = false;

      if (scrollY <= TOP_REVEAL_OFFSET) {
        accumulatedDeltaRef.current = 0;
        setScrollDirection('up');
        return;
      }

      if (Math.abs(delta) < 2) {
        return;
      }

      const currentDirection = delta > 0 ? 'down' : 'up';
      const previousDirection = accumulatedDeltaRef.current > 0
        ? 'down'
        : accumulatedDeltaRef.current < 0
          ? 'up'
          : null;

      accumulatedDeltaRef.current =
        previousDirection === currentDirection
          ? accumulatedDeltaRef.current + delta
          : delta;

      if (currentDirection === 'down' && scrollY > HIDE_START_OFFSET && accumulatedDeltaRef.current >= DIRECTION_THRESHOLD) {
        setScrollDirection('down');
        accumulatedDeltaRef.current = DIRECTION_THRESHOLD;
        return;
      }

      if (currentDirection === 'up' && Math.abs(accumulatedDeltaRef.current) >= DIRECTION_THRESHOLD) {
        setScrollDirection('up');
        accumulatedDeltaRef.current = -DIRECTION_THRESHOLD;
      }
    };

    const onScroll = () => {
      if (tickingRef.current) {
        return;
      }

      tickingRef.current = true;
      window.requestAnimationFrame(updateScrollDirection);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return scrollDirection;
}
