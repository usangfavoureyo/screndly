import React from 'react';
import { Button } from '../ui/button';
import { haptics } from '../../utils/haptics';

interface VideoStudioHeaderProps {
    activeModule: 'review' | 'monthly' | 'scenes';
    setActiveModule: (module: 'review' | 'monthly' | 'scenes') => void;
    onNavigate: (page: string) => void;
}

export function VideoStudioHeader({
    activeModule,
    setActiveModule,
    onNavigate
}: VideoStudioHeaderProps) {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-gray-900 dark:text-white mb-2">Video Studio</h1>
                    <p className="text-[#6B7280] dark:text-[#9CA3AF]">Create and manage video content</p>
                </div>
                <Button
                    onClick={() => {
                        haptics.light();
                        onNavigate('video-studio-activity');
                    }}
                    variant="outline"
                    className="text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
                >
                    View Activity
                </Button>
            </div>

            {/* Module Selector */}
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-2">
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => {
                            haptics.light();
                            setActiveModule('review');
                        }}
                        className={`px-2 sm:px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-center ${activeModule === 'review'
                            ? 'bg-[#ec1e24] text-white'
                            : 'text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                            }`}
                    >
                        <span>Review</span>
                    </button>
                    <button
                        onClick={() => {
                            haptics.light();
                            setActiveModule('monthly');
                        }}
                        className={`px-2 sm:px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-center ${activeModule === 'monthly'
                            ? 'bg-[#ec1e24] text-white'
                            : 'text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                            }`}
                    >
                        <span>Releases</span>
                    </button>
                    <button
                        onClick={() => {
                            haptics.light();
                            setActiveModule('scenes');
                        }}
                        className={`px-2 sm:px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-center ${activeModule === 'scenes'
                            ? 'bg-[#ec1e24] text-white'
                            : 'text-gray-600 dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                            }`}
                    >
                        <span>Scenes</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
