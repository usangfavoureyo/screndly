import { useEffect, useRef, useState } from 'react';

const TOP_REVEAL_OFFSET = 24;
const HIDE_START_OFFSET = 80;
const DIRECTION_THRESHOLD = 12;
const IDLE_REVEAL_DELAY_MS = 180;

export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up');
  const [isNearTop, setIsNearTop] = useState(true);
  const lastScrollYRef = useRef(0);
  const accumulatedDeltaRef = useRef(0);
  const tickingRef = useRef(false);
  const idleRevealTimerRef = useRef<number | null>(null);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const updateScrollDirection = () => {
      const scrollY = Math.max(window.scrollY, 0);
      const delta = scrollY - lastScrollYRef.current;
      lastScrollYRef.current = scrollY;
      tickingRef.current = false;

      if (scrollY <= TOP_REVEAL_OFFSET) {
        accumulatedDeltaRef.current = 0;
        setIsNearTop(true);
        setScrollDirection('up');
        return;
      }

      setIsNearTop(false);

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
      if (idleRevealTimerRef.current !== null) {
        window.clearTimeout(idleRevealTimerRef.current);
      }

      idleRevealTimerRef.current = window.setTimeout(() => {
        if (window.scrollY > TOP_REVEAL_OFFSET) {
          accumulatedDeltaRef.current = 0;
          setScrollDirection('up');
        }
      }, IDLE_REVEAL_DELAY_MS);

      if (tickingRef.current) {
        return;
      }

      tickingRef.current = true;
      window.requestAnimationFrame(updateScrollDirection);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (idleRevealTimerRef.current !== null) {
        window.clearTimeout(idleRevealTimerRef.current);
      }

      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return { scrollDirection, isNearTop };
}
