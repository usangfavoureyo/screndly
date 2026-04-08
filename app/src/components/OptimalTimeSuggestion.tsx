/**
 * Optimal Posting Time Suggestion Component
 * Shows analytics-derived optimal posting times for selected platforms
 * Matches Screndly brand aesthetic
 */

import { useState, useEffect, useMemo } from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import { postTimeOptimizer } from '../lib/optimization';
import type { Platform } from '../lib/optimization/types';
import arrowDownIcon from '../public/icons/icons/hugeroundedicons/arrow-down-01-stroke-rounded.svg';

interface OptimalTimeSuggestionProps {
    selectedPlatforms: string[];
    onTimeSelect?: (date: Date) => void;
    className?: string;
}

interface TimeRecommendation {
    platform: string;
    hour: number;
    dayOfWeek: number;
    confidence: number;
    formattedTime: string;
    recommendedAt: Date;
}

const PLATFORM_MAP: Record<string, Platform> = {
    x: 'x',
    threads: 'threads',
    facebook: 'facebook',
    youtube: 'youtube',
    instagram: 'instagram',
    pinterest: 'pinterest',
    tiktok: 'tiktok',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function OptimalTimeSuggestion({
    selectedPlatforms,
    onTimeSelect,
    className = '',
}: OptimalTimeSuggestionProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [recommendations, setRecommendations] = useState<TimeRecommendation[]>([]);

    // Get recommendations for selected platforms
    useEffect(() => {
        const recs: TimeRecommendation[] = [];

        for (const platformId of selectedPlatforms) {
            const platform = PLATFORM_MAP[platformId];
            if (!platform) continue;

            const optimal = postTimeOptimizer.getOptimalPostTime(platform);
            if (optimal instanceof Date && !Number.isNaN(optimal.getTime())) {
                const hour = optimal.getHours();
                const period = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                const { confidence } = postTimeOptimizer.getHeatmap(platform);

                recs.push({
                    platform: platformId,
                    hour,
                    dayOfWeek: optimal.getDay(),
                    confidence,
                    formattedTime: `${displayHour}:00 ${period}`,
                    recommendedAt: optimal,
                });
            }
        }

        setRecommendations(recs);
    }, [selectedPlatforms]);

    // Calculate the best overall time (highest confidence)
    const bestTime = useMemo(() => {
        if (recommendations.length === 0) return null;

        // Find highest confidence recommendation
        const best = recommendations.reduce((prev, curr) =>
            curr.confidence > prev.confidence ? curr : prev
        );

        return best;
    }, [recommendations]);

    // Calculate next occurrence of the best time
    const nextOptimalDate = useMemo(() => {
        if (!bestTime) return null;
        return new Date(bestTime.recommendedAt);
    }, [bestTime]);

    const handleApplyTime = () => {
        if (nextOptimalDate && onTimeSelect) {
            onTimeSelect(nextOptimalDate);
        }
    };

    // Don't show if no platforms selected or no recommendations
    if (selectedPlatforms.length === 0 || recommendations.length === 0) {
        return null;
    }

    const avgConfidence = recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length;

    return (
        <div className={`rounded-lg border border-gray-200 dark:border-[#333333] overflow-hidden ${className}`}>
            {/* Header - Always Visible */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-[#111111] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="text-left">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                            Optimal Posting Time
                        </span>
                        {bestTime && (
                            <span className="ml-2 text-xs text-[#ec1e24]">
                                {bestTime.formattedTime} ({DAY_NAMES[bestTime.dayOfWeek]?.slice(0, 3) ?? 'Day'})
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {avgConfidence >= 50 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#ec1e24]/10 text-[#ec1e24]">
                            {Math.round(avgConfidence)}% confident
                        </span>
                    )}
                    <img
                        src={arrowDownIcon}
                        alt=""
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        style={{ filter: 'brightness(0) invert(1)' }}
                    />
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 py-3 bg-white dark:bg-[#0a0a0a] space-y-3 border-t border-gray-200 dark:border-[#333333]">
                    {/* Per-Platform Breakdown */}
                    <div className="space-y-2">
                        <p className="text-xs text-gray-500 dark:text-[#9CA3AF] flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Based on your analytics data
                        </p>

                        <div className="grid gap-2">
                            {recommendations.map((rec) => (
                                <div
                                    key={rec.platform}
                                    className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-gray-50 dark:bg-[#111111]"
                                >
                                    <span className="text-gray-700 dark:text-gray-300 capitalize">
                                        {rec.platform}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-[#6B7280]" />
                                        <span className="text-gray-900 dark:text-white font-medium">
                                            {rec.formattedTime}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-[#9CA3AF]">
                                            {DAY_NAMES[rec.dayOfWeek]?.slice(0, 3) ?? 'Day'}
                                        </span>
                                        <span
                                            className={`text-xs px-1.5 py-0.5 rounded ${rec.confidence >= 70
                                                    ? 'bg-[#ec1e24]/10 text-[#ec1e24]'
                                                    : rec.confidence >= 40
                                                        ? 'bg-gray-200 dark:bg-[#333333] text-gray-600 dark:text-gray-400'
                                                        : 'bg-gray-100 dark:bg-[#222222] text-gray-500 dark:text-[#6B7280]'
                                                }`}
                                        >
                                            {Math.round(rec.confidence)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Apply Button */}
                    {onTimeSelect && nextOptimalDate && (
                        <button
                            type="button"
                            onClick={handleApplyTime}
                            className="w-full py-2.5 rounded-lg bg-[#ec1e24] hover:bg-[#d01a20] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Clock className="w-4 h-4" />
                            Schedule for {nextOptimalDate.toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                            })} at {bestTime?.formattedTime}
                        </button>
                    )}

                    {/* Info Text */}
                    <p className="text-xs text-gray-400 dark:text-[#6B7280] text-center">
                        Recommendations improve as more posts are analyzed
                    </p>
                </div>
            )}
        </div>
    );
}
