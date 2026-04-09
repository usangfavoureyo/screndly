/**
 * Analytics Self-Optimization Settings
 *
 * Reusable component for per-platform optimization toggles.
 * Used in Video Settings, RSS Settings, TMDb Settings, Design Studio Settings, Video Studio Settings.
 * Matches Screndly brand aesthetic - pure black/white, no gray backgrounds.
 */

import React from 'react';
import { Switch } from '../ui/switch';
import { ChevronDownIcon } from 'lucide-react';
import { haptics } from '../../utils/haptics';
import { analyticsIngester } from '../../lib/optimization/analyticsIngester';

// Platform icons (using existing Screndly platform icons - named exports)
import { XIcon } from '../icons/XIcon';
import { FacebookIcon } from '../icons/FacebookIcon';
import { InstagramIcon } from '../icons/InstagramIcon';
import { YouTubeIcon } from '../icons/YouTubeIcon';
import { ThreadsIcon } from '../icons/ThreadsIcon';
import { TikTokIcon } from '../icons/TikTokIcon';
import { PinterestIcon } from '../icons/PinterestIcon';

// Platform configuration with existing Screndly icons and custom sizes
const PLATFORMS = [
    { id: 'instagram', name: 'Instagram', Icon: InstagramIcon, iconClass: 'w-5 h-5' },
    { id: 'facebook', name: 'Facebook', Icon: FacebookIcon, iconClass: 'w-5.5 h-5.5' },
    { id: 'threads', name: 'Threads', Icon: ThreadsIcon, iconClass: 'w-5 h-5' },
    { id: 'youtube', name: 'YouTube', Icon: YouTubeIcon, iconClass: 'w-5.5 h-5.5' },
    { id: 'pinterest', name: 'Pinterest', Icon: PinterestIcon, iconClass: 'w-5 h-5' },
    { id: 'tiktok', name: 'TikTok', Icon: TikTokIcon, iconClass: 'w-7 h-7' },
    { id: 'x', name: 'X', Icon: XIcon, iconClass: 'w-4 h-4' },
] as const;

type PlatformId = typeof PLATFORMS[number]['id'];

interface AnalyticsSelfOptimizationProps {
    /** Storage key prefix for this settings page */
    storageKey: string;
    /** Optional callback when settings change */
    onChange?: (settings: Record<PlatformId, boolean>) => void;
    /** Optional description text */
    description?: string;
}

interface OptimizationState {
    enabled: Record<PlatformId, boolean>;
}

function createDefaultEnabledState(): Record<PlatformId, boolean> {
    return PLATFORMS.reduce((acc, p) => {
        acc[p.id] = true;
        return acc;
    }, {} as Record<PlatformId, boolean>);
}

function normalizeOptimizationState(raw: unknown): OptimizationState {
    const defaultEnabled = createDefaultEnabledState();

    if (!raw || typeof raw !== 'object') {
        return { enabled: defaultEnabled };
    }

    const candidateEnabled = (raw as { enabled?: unknown }).enabled;
    if (!candidateEnabled || typeof candidateEnabled !== 'object') {
        return { enabled: defaultEnabled };
    }

    const normalizedEnabled = PLATFORMS.reduce((acc, platform) => {
        const value = (candidateEnabled as Record<string, unknown>)[platform.id];
        acc[platform.id] = typeof value === 'boolean' ? value : defaultEnabled[platform.id];
        return acc;
    }, {} as Record<PlatformId, boolean>);

    return { enabled: normalizedEnabled };
}

/**
 * Load optimization settings from localStorage
 */
function loadSettings(storageKey: string): OptimizationState {
    try {
        const stored = localStorage.getItem(`${storageKey}_optimization`);
        if (stored) {
            return normalizeOptimizationState(JSON.parse(stored));
        }
    } catch (_e) {
        // Use defaults
    }

    // Default: all platforms enabled
    return {
        enabled: createDefaultEnabledState(),
    };
}

/**
 * Save optimization settings to localStorage
 */
function saveSettings(storageKey: string, state: OptimizationState): void {
    try {
        const normalizedState = normalizeOptimizationState(state);
        localStorage.setItem(`${storageKey}_optimization`, JSON.stringify(normalizedState));

        // Also update global optimization platform config
        const globalConfig = PLATFORMS.reduce((acc, p) => {
            acc[p.id] = normalizedState.enabled[p.id];
            return acc;
        }, {} as Record<string, boolean>);

        const existing = localStorage.getItem('screndly_optimization_platforms');
        const merged = existing
            ? { ...JSON.parse(existing), ...globalConfig }
            : globalConfig;
        localStorage.setItem('screndly_optimization_platforms', JSON.stringify(merged));
    } catch (_e) {
        console.error('Failed to save optimization settings');
    }
}

/**
 * Analytics Self-Optimization Settings Component
 * Redesigned to match RSS Feeds Settings page style
 */
export function AnalyticsSelfOptimization({
    storageKey,
    onChange,
    description,
}: AnalyticsSelfOptimizationProps) {
    const [state, setState] = React.useState<OptimizationState>(() => loadSettings(storageKey));
    const [isExpanded, setIsExpanded] = React.useState(false);

    // Handle toggle change
    const handleToggle = (platformId: PlatformId) => {
        setState(prev => {
            const newState = {
                ...prev,
                enabled: {
                    ...prev.enabled,
                    [platformId]: !prev.enabled[platformId],
                },
            };

            saveSettings(storageKey, newState);

            // Track change
            analyticsIngester.trackSettingChange(
                `${storageKey}.${platformId}`,
                !prev.enabled[platformId],
                prev.enabled[platformId],
                'AnalyticsSelfOptimization'
            );

            onChange?.(newState.enabled);

            return newState;
        });
    };

    // Toggle all platforms
    const handleToggleAll = (enabled: boolean) => {
        const newEnabled = PLATFORMS.reduce((acc, p) => {
            acc[p.id] = enabled;
            return acc;
        }, {} as Record<PlatformId, boolean>);

        const newState = { enabled: newEnabled };
        setState(newState);
        saveSettings(storageKey, newState);

        // Track change
        analyticsIngester.trackSettingChange(
            `${storageKey}.all`,
            enabled,
            !enabled,
            'AnalyticsSelfOptimization'
        );

        onChange?.(newEnabled);
    };

    // Count enabled platforms
    const enabledCount = Object.values(state.enabled).filter(Boolean).length;
    const allEnabled = enabledCount === PLATFORMS.length;
    const noneEnabled = enabledCount === 0;

    return (
        <div className="space-y-4">
            {/* Header - Collapsible */}
            <button
                onClick={() => {
                    haptics.light();
                    setIsExpanded(!isExpanded);
                }}
                className="w-full flex items-center justify-between"
            >
                <div>
                    <h3 className="text-gray-900 dark:text-white mb-1 text-left">Analytics-Driven Self-Optimization</h3>
                    <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] text-left">
                        {enabledCount}/{PLATFORMS.length} platforms enabled
                    </p>
                </div>

                <ChevronDownIcon
                    className={`w-5 h-5 text-gray-500 dark:text-[#6B7280] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="space-y-4">
                    {/* Description */}
                    <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                        {description ||
                            'Enable AI-powered optimization to automatically improve captions, posting times, and content selection based on performance analytics.'}
                    </p>

                    {/* Quick Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleAll(true);
                            }}
                            disabled={allEnabled}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${allEnabled
                                ? 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-400 dark:text-[#6B7280] cursor-not-allowed'
                                : 'bg-[#ec1e24] hover:bg-[#d01a20] text-white cursor-pointer'
                                }`}
                        >
                            Enable All
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleAll(false);
                            }}
                            disabled={noneEnabled}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${noneEnabled
                                ? 'border-gray-200 dark:border-[#333333] text-gray-400 dark:text-[#6B7280] cursor-not-allowed'
                                : 'border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] cursor-pointer'
                                }`}
                        >
                            Disable All
                        </button>
                    </div>

                    {/* Platform Toggles */}
                    <div className="space-y-3">
                        {PLATFORMS.map(platform => {
                            const { Icon, iconClass } = platform;
                            const isEnabled = state.enabled[platform.id];

                            return (
                                <div
                                    key={platform.id}
                                    className="flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Fixed-width icon container for alignment */}
                                        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                                            <Icon className={`${iconClass} text-gray-600 dark:text-gray-400`} />
                                        </div>
                                        <span className="text-sm text-gray-900 dark:text-white">
                                            {platform.name}
                                        </span>
                                    </div>

                                    <Switch
                                        checked={isEnabled}
                                        onCheckedChange={() => {
                                            haptics.light();
                                            handleToggle(platform.id);
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AnalyticsSelfOptimization;
