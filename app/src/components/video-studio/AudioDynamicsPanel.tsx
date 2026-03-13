import React from 'react';
import { Film, ChevronUp, ChevronDown, Play, Pause, Activity, CheckCircle } from 'lucide-react';
import { haptics } from '../../utils/haptics';
import { DuckingMode, duckingModes, PromptStatus } from './types';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { toast } from "sonner";
import { TrailerHooksPreview } from '../TrailerHooksPreview';
import { TrailerAnalysis, VideoMoment } from '../../lib/api/googleVideoIntelligence';
import { MonthlyTrailerAnalysis } from '../../lib/api/monthlyCompilation';
import { RedSpinner } from '../PageLoader';

interface AudioDynamicsPanelProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;

    // Auto Ducking
    enableAutoDucking: boolean;
    setEnableAutoDucking: (enable: boolean) => void;
    duckingMode: DuckingMode;
    setDuckingMode: (mode: DuckingMode) => void;
    duckLevel: number;
    setDuckLevel: (level: number) => void;
    attackMs: number;
    setAttackMs: (ms: number) => void;
    releaseMs: number;
    setReleaseMs: (ms: number) => void;

    // Trailer Audio Hooks
    enableTrailerAudioHooks: boolean;
    setEnableTrailerAudioHooks: (enable: boolean) => void;
    hookPlacements: string[];
    setHookPlacements: (placements: string[]) => void;
    hookDuration: number;
    setHookDuration: (duration: number) => void;
    isHookDurationAuto: boolean;
    setIsHookDurationAuto: (auto: boolean) => void;
    trailerAudioVolume: number;
    setTrailerAudioVolume: (volume: number) => void;
    crossfadeDuration: number;
    setCrossfadeDuration: (duration: number) => void;

    // Trailer Analysis
    activeModule: 'review' | 'monthly' | 'scenes';
    reviewVideoFiles: File[];
    monthlyVideoFiles: File[];
    reviewTrailerAnalysis: TrailerAnalysis | null;
    monthlyTrailerAnalyses: MonthlyTrailerAnalysis[];
    reviewIsAnalyzingTrailer: boolean;
    monthlyIsAnalyzingTrailer: boolean;
    onAnalyzeTrailer: (module: 'review' | 'monthly' | 'scenes') => void;
    onShowTrailerScenesDialog: () => void;

    // Custom Hooks
    customOpeningHook: VideoMoment | null;
    setCustomOpeningHook: (moment: VideoMoment | null) => void;
    customMidVideoHook: VideoMoment | null;
    setCustomMidVideoHook: (moment: VideoMoment | null) => void;
    customEndingHook: VideoMoment | null;
    setCustomEndingHook: (moment: VideoMoment | null) => void;

    // Audio Variety
    audioVariety: 'balanced' | 'heavy-voiceover' | 'heavy-trailer';
    setAudioVariety: (variety: 'balanced' | 'heavy-voiceover' | 'heavy-trailer') => void;

    // Preview
    onRenderAudioPreview: () => void;
    isAudioPreviewPlaying: boolean;
    audioPreviewCurrentSegment: string | null;
    audioPreviewProgress: number;

    // Helper
    setPromptStatus: (status: PromptStatus) => void;
}

export function AudioDynamicsPanel({
    isOpen, setIsOpen,
    enableAutoDucking, setEnableAutoDucking,
    duckingMode, setDuckingMode,
    duckLevel, setDuckLevel,
    attackMs, setAttackMs,
    releaseMs, setReleaseMs,
    enableTrailerAudioHooks, setEnableTrailerAudioHooks,
    hookPlacements, setHookPlacements,
    hookDuration, setHookDuration,
    isHookDurationAuto, setIsHookDurationAuto,
    trailerAudioVolume, setTrailerAudioVolume,
    crossfadeDuration, setCrossfadeDuration,
    activeModule,
    reviewVideoFiles, monthlyVideoFiles,
    reviewTrailerAnalysis, monthlyTrailerAnalyses,
    reviewIsAnalyzingTrailer, monthlyIsAnalyzingTrailer,
    onAnalyzeTrailer,
    onShowTrailerScenesDialog,
    customOpeningHook, setCustomOpeningHook,
    customMidVideoHook, setCustomMidVideoHook,
    customEndingHook, setCustomEndingHook,
    audioVariety, setAudioVariety,
    onRenderAudioPreview,
    isAudioPreviewPlaying, audioPreviewCurrentSegment, audioPreviewProgress,
    setPromptStatus
}: AudioDynamicsPanelProps) {

    const effectiveHookDuration = isHookDurationAuto ? 3.5 : hookDuration;

    return (
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-gray-900 dark:text-white">Audio Dynamics Controls</h3>
                    <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Configure audio ducking and mixing</p>
                </div>
                <button
                    onClick={() => {
                        haptics.light();
                        setIsOpen(!isOpen);
                    }}
                    className="text-gray-600 dark:text-[#9CA3AF] hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                >
                    {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {isOpen && (
                <div className="space-y-4">
                    {/* Info Banner for Trailer Audio Hooks */}
                    {enableTrailerAudioHooks && (
                        <div className="flex items-start gap-3 p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl">
                            <Film className="flex-shrink-0 w-5 h-5 text-[#ec1e24]" />
                            <div>
                                <p className="text-sm text-black dark:text-white mb-1">
                                    <strong>Cinematic Audio Hooks Enabled</strong>
                                </p>
                                <p className="text-xs text-gray-700 dark:text-gray-300">
                                    Your video will start with a hook-catching scene using the trailer's original audio (dialogue/voice), then transition to your voiceover with music. Mid-video and ending hooks can be added for dramatic effect.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Auto-Ducking Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl">
                        <span className="text-gray-900 dark:text-white">
                            Enable Auto-Ducking
                        </span>
                        <button
                            onClick={() => {
                                haptics.light();
                                setEnableAutoDucking(!enableAutoDucking);
                                setPromptStatus('outdated');
                            }}
                            className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${enableAutoDucking ? 'bg-[#ec1e24]' : 'bg-gray-300 dark:bg-[#333333]'
                                }`}
                        >
                            <div
                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${enableAutoDucking ? 'translate-x-6' : 'translate-x-0'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Ducking Mode */}
                    <div>
                        <label className="text-gray-900 dark:text-white mb-2 block">
                            Ducking Mode
                        </label>
                        <div className="flex gap-2">
                            {duckingModes.map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => {
                                        haptics.light();
                                        setDuckingMode(mode);
                                        setPromptStatus('outdated');
                                    }}
                                    className={`flex-1 px-4 py-2 rounded-xl transition-all duration-300 ${duckingMode === mode
                                        ? 'bg-[#ec1e24] text-white'
                                        : 'bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-[#ec1e24]'
                                        }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Numeric Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-gray-900 dark:text-white mb-2 block">
                                Duck Level (dB)
                            </label>
                            <input
                                type="number"
                                value={duckLevel}
                                onChange={(e) => {
                                    setDuckLevel(parseInt(e.target.value));
                                    setPromptStatus('outdated');
                                }}
                                className="w-full px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"
                            />
                        </div>

                        <div>
                            <label className="text-gray-900 dark:text-white mb-2 block">
                                Attack (ms)
                            </label>
                            <input
                                type="number"
                                value={attackMs}
                                onChange={(e) => {
                                    setAttackMs(parseInt(e.target.value));
                                    setPromptStatus('outdated');
                                }}
                                className="w-full px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"
                            />
                        </div>

                        <div>
                            <label className="text-gray-900 dark:text-white mb-2 block">
                                Release (ms)
                            </label>
                            <input
                                type="number"
                                value={releaseMs}
                                onChange={(e) => {
                                    setReleaseMs(parseInt(e.target.value));
                                    setPromptStatus('outdated');
                                }}
                                className="w-full px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"
                            />
                        </div>
                    </div>

                    <Separator className="bg-gray-200 dark:bg-[#333333]" />

                    {/* Trailer Audio Hooks Section */}
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-gray-900 dark:text-white mb-2">Trailer Audio Hooks</h4>
                            <p className="text-xs text-gray-500 dark:text-[#6B7280] mb-4">
                                Use original trailer audio (dialogue/voice) as cinematic hooks at key moments
                            </p>
                        </div>

                        {/* Enable Trailer Audio Hooks Toggle */}
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl">
                            <span className="text-gray-900 dark:text-white">
                                Enable Trailer Audio Hooks
                            </span>
                            <button
                                onClick={() => {
                                    haptics.light();
                                    setEnableTrailerAudioHooks(!enableTrailerAudioHooks);
                                    setPromptStatus('outdated');
                                }}
                                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${enableTrailerAudioHooks ? 'bg-[#ec1e24]' : 'bg-gray-300 dark:bg-[#333333]'
                                    }`}
                            >
                                <div
                                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${enableTrailerAudioHooks ? 'translate-x-6' : 'translate-x-0'
                                        }`}
                                />
                            </button>
                        </div>

                        {enableTrailerAudioHooks && (
                            <>
                                {/* Hook Placements */}
                                <div>
                                    <label className="text-gray-900 dark:text-white mb-2 block">
                                        Hook Placements
                                    </label>
                                    <div className="space-y-2">
                                        {[
                                            { value: 'opening', label: 'Opening Hook', desc: 'Start video with trailer audio' },
                                            { value: 'mid-video', label: 'Mid-Video Hook', desc: 'Before rating reveal' },
                                            { value: 'ending', label: 'Ending Hook', desc: 'Close with trailer audio' }
                                        ].map((placement) => (
                                            <div
                                                key={placement.value}
                                                className="flex items-start gap-3 p-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl"
                                            >
                                                <Checkbox
                                                    id={placement.value}
                                                    checked={hookPlacements.includes(placement.value)}
                                                    onCheckedChange={(checked) => {
                                                        haptics.light();
                                                        if (checked) {
                                                            setHookPlacements([...hookPlacements, placement.value]);
                                                        } else {
                                                            setHookPlacements(hookPlacements.filter(p => p !== placement.value));
                                                        }
                                                        setPromptStatus('outdated');
                                                    }}
                                                />
                                                <div className="flex-1">
                                                    <label
                                                        htmlFor={placement.value}
                                                        className="text-sm text-gray-900 dark:text-white cursor-pointer"
                                                    >
                                                        {placement.label}
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-[#6B7280]">
                                                        {placement.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Trailer Analysis - AI Selected Scenes */}
                                {(activeModule === 'review' && reviewVideoFiles.length > 0) || (activeModule === 'monthly' && monthlyVideoFiles.length > 0) ? (
                                    <div className="space-y-3">
                                        {!reviewTrailerAnalysis && monthlyTrailerAnalyses.length === 0 && !reviewIsAnalyzingTrailer && !monthlyIsAnalyzingTrailer && (
                                            <Button
                                                onClick={() => onAnalyzeTrailer(activeModule)}
                                                className="w-full bg-[#ec1e24] hover:bg-[#d11a20] text-white"
                                                size="sm"
                                            >
                                                {activeModule === 'review' ? 'Analyze Trailer with AI' : `Analyze ${monthlyVideoFiles.length} Trailers with AI`}
                                            </Button>
                                        )}

                                        {(reviewIsAnalyzingTrailer || monthlyIsAnalyzingTrailer) && (
                                            <div className="flex items-center justify-center gap-3 p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl">
                                                <div className="w-5 h-5 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
                                                <span className="text-sm text-black dark:text-white">
                                                    Analyzing trailer scenes...
                                                </span>
                                            </div>
                                        )}

                                        {(activeModule === 'review' ? reviewTrailerAnalysis : (monthlyTrailerAnalyses.length > 0)) && (
                                            activeModule === 'review' ? (
                                                <TrailerHooksPreview
                                                    analysis={reviewTrailerAnalysis!}
                                                    onShowAllMoments={onShowTrailerScenesDialog}
                                                    customOpeningHook={customOpeningHook}
                                                    customMidVideoHook={customMidVideoHook}
                                                    customEndingHook={customEndingHook}
                                                    onResetHook={(hookType) => {
                                                        switch (hookType) {
                                                            case 'opening':
                                                                setCustomOpeningHook(null);
                                                                toast.success('Opening hook reset to AI default');
                                                                break;
                                                            case 'midVideo':
                                                                setCustomMidVideoHook(null);
                                                                toast.success('Mid-video hook reset to AI default');
                                                                break;
                                                            case 'ending':
                                                                setCustomEndingHook(null);
                                                                toast.success('Ending hook reset to AI default');
                                                                break;
                                                        }
                                                        setPromptStatus('outdated');
                                                        haptics.light();
                                                    }}
                                                />
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                                            <h4 className="font-semibold text-green-900">
                                                                {monthlyTrailerAnalyses.length} Trailers Analyzed
                                                            </h4>
                                                        </div>
                                                        <p className="text-sm text-green-700">
                                                            Total scenes detected: {monthlyTrailerAnalyses.reduce((sum, t) => sum + t.analysis.moments.length, 0)}
                                                        </p>
                                                        <p className="text-xs text-green-600 mt-1">
                                                            Best moments selected from each trailer for compilation
                                                        </p>
                                                    </div>
                                                    {monthlyTrailerAnalyses.map((trailer, index) => (
                                                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h5 className="text-sm font-medium text-gray-900">{trailer.movieTitle}</h5>
                                                                <span className="text-xs text-gray-500">
                                                                    {trailer.analysis.moments.length} scenes
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-1 flex-wrap">
                                                                {trailer.bestMoments.slice(0, 3).map((moment, i) => (
                                                                    <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                                        {moment.type.replace(/_/g, ' ')}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        )}
                                    </div>
                                ) : null}

                                {/* Audio Variety */}
                                <div>
                                    <label className="text-gray-900 dark:text-white mb-2 block">
                                        Audio Variety Style
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { value: 'balanced', label: 'Balanced' },
                                            { value: 'heavy-voiceover', label: 'Heavy Voiceover' },
                                            { value: 'heavy-trailer', label: 'Heavy Trailer' }
                                        ].map((style) => (
                                            <button
                                                key={style.value}
                                                onClick={() => {
                                                    haptics.light();
                                                    setAudioVariety(style.value as any);
                                                    setPromptStatus('outdated');
                                                }}
                                                className={`px-3 py-2 rounded-xl text-sm transition-all duration-300 ${audioVariety === style.value
                                                    ? 'bg-[#ec1e24] text-white'
                                                    : 'bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-[#ec1e24]'
                                                    }`}
                                            >
                                                {style.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Hook Controls Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-gray-900 dark:text-white mb-2 block">
                                            Hook Duration (s)
                                        </label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsHookDurationAuto(!isHookDurationAuto);
                                                    setPromptStatus('outdated');
                                                }}
                                                className={`px-4 py-3 rounded-xl transition-all ${isHookDurationAuto
                                                    ? 'bg-[#ec1e24] text-white'
                                                    : 'bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]'
                                                    }`}
                                            >
                                                Auto
                                            </button>
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                step="0.5"
                                                value={hookDuration}
                                                disabled={isHookDurationAuto}
                                                onChange={(e) => {
                                                    setHookDuration(parseFloat(e.target.value));
                                                    setPromptStatus('outdated');
                                                }}
                                                className={`flex-1 px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929] ${isHookDurationAuto ? 'opacity-50 cursor-not-allowed' : ''
                                                    }`}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-gray-900 dark:text-white mb-2 block">
                                            Trailer Audio Volume (%)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={trailerAudioVolume}
                                            onChange={(e) => {
                                                setTrailerAudioVolume(parseInt(e.target.value));
                                                setPromptStatus('outdated');
                                            }}
                                            className="w-full px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-gray-900 dark:text-white mb-2 block">
                                            Crossfade Duration (s)
                                        </label>
                                        <input
                                            type="number"
                                            min="0.1"
                                            max="2"
                                            step="0.1"
                                            value={crossfadeDuration}
                                            onChange={(e) => {
                                                setCrossfadeDuration(parseFloat(e.target.value));
                                                setPromptStatus('outdated');
                                            }}
                                            className="w-full px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"
                                        />
                                    </div>
                                </div>

                                {/* Audio Segment Timeline */}
                                <div>
                                    <label className="text-gray-900 dark:text-white mb-2 block">
                                        Audio Segment Timeline
                                    </label>
                                    <div className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl">
                                        <div className="space-y-3">
                                            {/* Timeline Labels */}
                                            <div className="flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mb-1">
                                                <span>0:00</span>
                                                <span>0:15</span>
                                                <span>0:30</span>
                                            </div>

                                            {/* Visual Timeline */}
                                            <div className="relative h-16 bg-gray-100 dark:bg-[#1A1A1A] rounded-xl overflow-hidden">
                                                <div className="absolute inset-0 flex items-center px-2">
                                                    {hookPlacements.includes('opening') && (
                                                        <div
                                                            className="h-12 bg-blue-500/40 rounded flex items-center justify-center border-2 border-blue-500"
                                                            style={{ width: `${(effectiveHookDuration / 30) * 100}%` }}
                                                            title="Opening Trailer Hook"
                                                        >
                                                            <span className="text-xs text-white font-medium">🎬 Hook</span>
                                                        </div>
                                                    )}
                                                    <div
                                                        className="h-10 bg-[#ec1e24]/30 rounded flex items-center justify-center mx-1"
                                                        style={{ width: `${((12 - crossfadeDuration) / 30) * 100}%` }}
                                                        title="Voiceover + Music"
                                                    >
                                                        <span className="text-xs text-gray-600 dark:text-gray-400">🎤 Voiceover</span>
                                                    </div>
                                                    {hookPlacements.includes('mid-video') && (
                                                        <>
                                                            <div
                                                                className="h-12 bg-blue-500/40 rounded flex items-center justify-center border-2 border-blue-500 mx-1"
                                                                style={{ width: `${(effectiveHookDuration / 30) * 100}%` }}
                                                                title="Mid-Video Trailer Hook"
                                                            >
                                                                <span className="text-xs text-white font-medium">🎬</span>
                                                            </div>
                                                            <div
                                                                className="h-10 bg-[#ec1e24]/30 rounded flex items-center justify-center mx-1"
                                                                style={{ width: `${(8 / 30) * 100}%` }}
                                                                title="Rating Section"
                                                            >
                                                                <span className="text-xs text-gray-600 dark:text-gray-400">⭐</span>
                                                            </div>
                                                        </>
                                                    )}
                                                    {hookPlacements.includes('ending') && (
                                                        <div
                                                            className="h-12 bg-blue-500/40 rounded flex items-center justify-center border-2 border-blue-500 ml-auto"
                                                            style={{ width: `${(effectiveHookDuration / 30) * 100}%` }}
                                                            title="Ending Trailer Hook"
                                                        >
                                                            <span className="text-xs text-white font-medium">🎬 End</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Legend */}
                                            <div className="flex gap-4 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 bg-blue-500/40 border-2 border-blue-500 rounded"></div>
                                                    <span className="text-gray-600 dark:text-[#9CA3AF]">Trailer Audio</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 bg-[#ec1e24]/30 rounded"></div>
                                                    <span className="text-gray-600 dark:text-[#9CA3AF]">Voiceover + Music</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <Separator className="bg-gray-200 dark:bg-[#333333]" />

                    {/* Waveform Visualization */}
                    <div>
                        <label className="text-gray-900 dark:text-white mb-2 block">
                            Waveform Preview
                        </label>
                        <div className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl">
                            <div className="space-y-4">
                                {/* Combined Audio Visualization */}
                                {enableTrailerAudioHooks ? (
                                    <div>
                                        <span className="text-xs text-gray-500 dark:text-[#6B7280] mb-2 block">
                                            Layered Audio Mix (Trailer Hooks + Voiceover + Music)
                                        </span>
                                        <div className="h-16 bg-gray-100 dark:bg-[#1A1A1A] rounded-xl relative overflow-hidden">
                                            <div className="absolute inset-0 flex items-center px-2 gap-1">
                                                {/* Opening Hook */}
                                                {hookPlacements.includes('opening') && (
                                                    <div className="h-12 bg-blue-500/40 rounded border border-blue-500" style={{ width: `${(effectiveHookDuration / 30) * 100}%` }} />
                                                )}
                                                {/* First Voiceover */}
                                                <div className="h-10 bg-[#ec1e24]/30 rounded" style={{ width: '35%' }} />
                                                {/* Mid Hook */}
                                                {hookPlacements.includes('mid-video') && (
                                                    <div className="h-12 bg-blue-500/40 rounded border border-blue-500" style={{ width: `${(effectiveHookDuration / 30) * 100}%` }} />
                                                )}
                                                {/* Second Voiceover */}
                                                <div className="h-10 bg-[#ec1e24]/30 rounded" style={{ width: '25%' }} />
                                                {/* Ending Hook */}
                                                {hookPlacements.includes('ending') && (
                                                    <div className="h-12 bg-blue-500/40 rounded border border-blue-500 ml-auto" style={{ width: `${(effectiveHookDuration / 30) * 100}%` }} />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-3 text-xs mt-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 bg-blue-500/40 border border-blue-500 rounded"></div>
                                                <span className="text-gray-500 dark:text-[#6B7280]">Trailer Audio</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 bg-[#ec1e24]/30 rounded"></div>
                                                <span className="text-gray-500 dark:text-[#6B7280]">Voiceover</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Voice-over waveform */}
                                        <div>
                                            <span className="text-xs text-gray-500 dark:text-[#6B7280] mb-2 block">
                                                Voice-over Segments
                                            </span>
                                            <div className="h-12 bg-gray-100 dark:bg-[#1A1A1A] rounded-xl relative overflow-hidden">
                                                <div className="absolute inset-0 flex items-center px-2 gap-2">
                                                    <div className="h-8 bg-[#ec1e24]/30 rounded" style={{ width: '20%' }} />
                                                    <div className="h-8 bg-[#ec1e24]/30 rounded" style={{ width: '25%', marginLeft: '15%' }} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Trailer waveform */}
                                        <div>
                                            <span className="text-xs text-gray-500 dark:text-[#6B7280] mb-2 block">
                                                Trailer Dialog Segments
                                            </span>
                                            <div className="h-12 bg-gray-100 dark:bg-[#1A1A1A] rounded-xl relative overflow-hidden">
                                                <div className="absolute inset-0 flex items-center px-2">
                                                    <div className="h-8 bg-blue-500/30 rounded" style={{ width: '18%', marginLeft: '22%' }} />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-[#6B7280] italic mt-2">
                            Drag segment boundaries to manually adjust detection
                        </p>
                    </div>

                    {/* Audio Preview Button */}
                    <div className="space-y-3">
                        <Button
                            onClick={onRenderAudioPreview}
                            variant="outline"
                            className={`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000] ${isAudioPreviewPlaying ? 'bg-[#ec1e24]/10 dark:bg-[#ec1e24]/10 border-[#ec1e24]' : ''
                                }`}
                        >
                            {isAudioPreviewPlaying ? (
                                <Pause className="w-5 h-5 mr-2 text-[#ec1e24]" />
                            ) : (
                                <Play className="w-5 h-5 mr-2 text-[#ec1e24]" />
                            )}
                            {isAudioPreviewPlaying ? 'Stop Preview' : 'Render 15s Audio Preview'}
                        </Button>

                        {/* Preview Progress Indicator */}
                        {isAudioPreviewPlaying && (
                            <div className="space-y-2 p-4 bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-[#333333]">
                                <div className="flex items-center justify-between text-xs">
                                    {audioPreviewCurrentSegment ? (
                                        <span className="text-gray-600 dark:text-[#9CA3AF]">
                                            Playing: {audioPreviewCurrentSegment}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-2 text-gray-600 dark:text-[#9CA3AF]">
                                            <RedSpinner size="sm" label="Loading audio preview segment..." />
                                        </span>
                                    )}
                                    <span className="text-gray-900 dark:text-white font-medium">
                                        {Math.floor((audioPreviewProgress / 100) * 15)}s / 15s
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-[#333333] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#ec1e24] transition-all duration-100 ease-linear"
                                        style={{ width: `${audioPreviewProgress}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#6B7280]">
                                    <Activity className="w-3 h-3" />
                                    <span>Audio choreography simulation in progress...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
