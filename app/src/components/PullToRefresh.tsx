
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface PullToRefreshProps {
    children: React.ReactNode;
    onRefresh?: () => Promise<void> | void;
    disabled?: boolean;
}

export function PullToRefresh({ children, onRefresh, disabled = false }: PullToRefreshProps) {
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    const threshold = 80; // Pull distance to trigger refresh
    const maxPull = 120; // Maximum visual pull distance

    // Use body scroll lock when pulling to prevent rubber banding interference
    useEffect(() => {
        if (isPulling) {
            document.body.style.overscrollBehaviorY = 'none';
            if (currentY > 0) {
                document.body.style.overflowY = 'hidden';
            }
        } else {
            document.body.style.overscrollBehaviorY = 'auto';
            document.body.style.overflowY = 'auto';
        }
        return () => {
            document.body.style.overscrollBehaviorY = 'auto';
            document.body.style.overflowY = 'auto';
        };
    }, [isPulling, currentY]);

    const handleTouchStart = (e: React.TouchEvent) => {
        // Only enable if at top of page and not disabled
        if (window.scrollY <= 5 && !disabled && !isRefreshing) {
            setStartY(e.touches[0].clientY);
            // Don't set isPulling yet, wait for move to confirm direction
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (isRefreshing || disabled) return;

        const y = e.touches[0].clientY;
        const diff = y - startY;

        // Check if we are pulling down and at the top
        if (diff > 0 && window.scrollY <= 5) {
            // If we haven't started pulling yet, set it now
            if (!isPulling && diff > 10) {
                setIsPulling(true);
            }

            if (isPulling) {
                // Add resistance/damping
                const dampedDiff = Math.min(diff * 0.5, maxPull);
                setCurrentY(dampedDiff);
            }
        } else {
            // If scrolling up or down page, reset
            if (isPulling) {
                setIsPulling(false);
                setCurrentY(0);
            }
        }
    };

    const handleTouchEnd = async () => {
        if (!isPulling || isRefreshing) {
            setStartY(0);
            return;
        }

        if (currentY >= threshold) {
            // Trigger refresh
            setIsRefreshing(true);
            setCurrentY(threshold); // Snap to threshold
            haptics.success(); // Haptic feedback

            try {
                if (onRefresh) {
                    await onRefresh();
                } else {
                    // Default: Full Page Reload
                    window.location.reload();
                }
            } catch (error) {
                console.error('Refresh failed', error);
            } finally {
                // If generic reload didn't happen (custom refresh), reset UI
                if (onRefresh) {
                    setTimeout(() => {
                        setIsRefreshing(false);
                        setCurrentY(0);
                        setIsPulling(false);
                        haptics.light();
                    }, 500);
                }
            }
        } else {
            // Spring back
            setCurrentY(0);
            setIsPulling(false);
        }
    };

    return (
        <div
            className="min-h-screen relative touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Refresh Indicator */}
            <div
                className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform duration-200 ease-out"
                style={{
                    transform: `translateY(${Math.max(0, currentY - 40)}px)`,
                    opacity: currentY > 0 ? 1 : 0
                }}
            >
                <div className="mt-4 rounded-full border border-white/10 bg-black/90 p-2 shadow-lg backdrop-blur-sm">
                    <Loader2
                        className={`h-5 w-5 text-white ${isRefreshing ? 'animate-spin' : ''}`}
                        style={{
                            transform: isRefreshing ? 'none' : `rotate(${currentY * 3}deg)`
                        }}
                    />
                </div>
            </div>

            {/* Content Container */}
            <div
                style={{
                    transform: `translateY(${currentY}px)`,
                    transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
                }}
                className="min-h-screen"
            >
                {children}
            </div>
        </div>
    );
}
