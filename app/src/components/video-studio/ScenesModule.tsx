import React, { useRef } from 'react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { Upload, AlertCircle, FileSpreadsheet, Cloud, Download } from 'lucide-react';
import { haptics } from '../../utils/haptics';
import { AspectRatio, Scene } from './types';
import { LetterboxControl } from '../LetterboxControl';
import { SceneImportDialog } from '../SceneImportDialog';
import { SubtitleTimestampAssist } from '../SubtitleTimestampAssist';
import { useDesktopFileDrop } from '../../hooks/useDesktopFileDrop';

interface ScenesModuleProps {
    movieTitle: string;
    setMovieTitle: (title: string) => void;

    // Imported Scenes
    importedScenes: Scene[];
    importDialogParams: { importedMovieName: string }; // or separate state
    showSceneImportDialog: boolean;
    setShowSceneImportDialog: (show: boolean) => void;
    onSceneImport: (scenes: Scene[], movieName: string) => void;

    // Video Source
    videoSource: 'local' | 'backblaze';
    videoFile: File | null;
    videoUrl: string;
    onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onShowBackblazeBrowser: () => void;

    // Scene Selection
    mode: 'ai' | 'manual';
    setMode: (mode: 'ai' | 'manual') => void;
    startTime: string;
    setStartTime: (time: string) => void;
    endTime: string;
    setEndTime: (time: string) => void;

    // AI Query
    aiQuery: string;
    setAiQuery: (query: string) => void;
    onAIAssistedQuery: () => void;

    // Output Settings
    aspectRatio: AspectRatio;
    setAspectRatio: (ratio: AspectRatio) => void;
    removeLetterbox: boolean;
    setRemoveLetterbox: (remove: boolean) => void;
    enableAutoframing: boolean;
    setEnableAutoframing: (enable: boolean) => void;

    // Processing State
    isProcessing: boolean;
    progress: number;
    progressMessage: string;
    outputUrl: string | null;

    // Actions
    onCutScene: () => void;
    onDownloadScene: () => void;
    onPublish: () => void;

    // Caption Editor
    isCaptionEditorOpen: boolean;
    setIsCaptionEditorOpen: (isOpen: boolean) => void;
    onCaptionEditorChange?: (isOpen: boolean) => void;
}

export function ScenesModule({
    movieTitle, setMovieTitle,
    importedScenes, importDialogParams, showSceneImportDialog, setShowSceneImportDialog, onSceneImport,
    videoSource, videoFile, videoUrl, onVideoUpload, onShowBackblazeBrowser,
    mode, setMode, startTime, setStartTime, endTime, setEndTime,
    aiQuery, setAiQuery, onAIAssistedQuery,
    aspectRatio, setAspectRatio, removeLetterbox, setRemoveLetterbox, enableAutoframing, setEnableAutoframing,
    isProcessing, progress, progressMessage, outputUrl,
    onCutScene, onDownloadScene, onPublish,
    isCaptionEditorOpen, setIsCaptionEditorOpen, onCaptionEditorChange
}: ScenesModuleProps) {

    const videoInputRef = useRef<HTMLInputElement>(null);
    const applyDroppedVideoFile = (file: File) => {
        const input = videoInputRef.current;
        if (!input) return;
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const localVideoDrop = useDesktopFileDrop({
        accept: 'video/*',
        onFiles: (files) => {
            if (files[0]) {
                applyDroppedVideoFile(files[0]);
            }
        },
    });

    const thumbnailDrop = useDesktopFileDrop({
        accept: 'image/*',
        onFiles: (files) => {
            if (files[0]) {
                haptics.light();
            }
        },
    });

    // Helper functions
    const validateTimestampFormat = (timestamp: string): boolean => {
        const hhmmss = /^([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])$/;
        const mmss = /^([0-5]?[0-9]):([0-5][0-9])$/;
        return hhmmss.test(timestamp) || mmss.test(timestamp);
    };

    const formatTimestamp = (value: string): string => {
        const numbers = value.replace(/\D/g, '');
        const limited = numbers.slice(0, 6);
        let formatted = '';
        for (let i = 0; i < limited.length; i++) {
            if (i === 2 || i === 4) {
                formatted += ':';
            }
            formatted += limited[i];
        }
        return formatted;
    };

    const calculateClipDuration = (start: string, end: string): number => {
        const toSeconds = (timestamp: string): number => {
            const parts = timestamp.split(':').map(p => parseInt(p, 10));
            if (parts.length === 3) {
                return parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
                return parts[0] * 60 + parts[1];
            }
            return parseInt(timestamp, 10);
        };
        const diff = toSeconds(end) - toSeconds(start);
        return diff > 0 ? diff : 0;
    };

    return (
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
            <div className="mb-6">
                <h3 className="text-gray-900 dark:text-white">Video Scenes Module</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Cut specific scenes from movies/TV shows</p>
            </div>

            <div className="space-y-4">
                {/* FFmpeg Info Banner */}
                <div className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-[#ec1e24] mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                            <p className="text-sm text-black dark:text-white">
                                <strong>Precision Video Cutting with FFmpeg.wasm</strong>
                            </p>
                            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                                Manual timestamp control • Browser-based processing • No re-encoding (stream copy) • 100% client-side
                            </p>
                            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2">
                                First-time load: ~10-15s to initialize FFmpeg • Subsequent cuts: instant
                            </p>
                        </div>
                    </div>
                </div>

                {/* Movie/TV Show Title */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-gray-900 dark:text-white block">
                            Movie or TV Show Title
                        </label>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowSceneImportDialog(true)}
                            className="h-8 text-xs border-gray-200 dark:border-[#333333] text-gray-600 dark:text-gray-300 bg-white dark:bg-[#000000]"
                        >
                            Import Spreadsheet
                        </Button>
                    </div>
                    <input
                        type="text"
                        value={movieTitle}
                        onChange={(e) => {
                            haptics.light();
                            setMovieTitle(e.target.value);
                        }}
                        onFocus={() => {
                            haptics.light();
                        }}
                        placeholder="e.g., The Dark Knight"
                        className="w-full px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#292929]"
                    />

                    {/* Imported Scenes List */}
                    {importedScenes.length > 0 && (
                        <div className="mt-4 border border-gray-200 dark:border-[#333333] rounded-xl overflow-hidden bg-white dark:bg-black">
                            <div className="p-3 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#333333] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        Imported Scenes ({importedScenes.length})
                                    </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                    {importDialogParams.importedMovieName}
                                </span>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto">
                                {importedScenes.map((scene, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 border-b border-gray-100 dark:border-[#1A1A1A] last:border-0 hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors flex items-start gap-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {scene.description}
                                                </span>
                                                <span className="text-xs bg-gray-100 dark:bg-[#222] px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 whitespace-nowrap font-mono">
                                                    {scene.startTime} - {scene.endTime}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                                {scene.details}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                haptics.medium();
                                                setStartTime(scene.startTime);
                                                setEndTime(scene.endTime);
                                                if (mode === 'ai') {
                                                    setAiQuery(scene.description);
                                                }
                                                // Assume toast handled by parent or just skip
                                            }}
                                            className="h-8 px-2 text-[#ec1e24] hover:text-[#ec1e24] hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            Load
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <SceneImportDialog
                    isOpen={showSceneImportDialog}
                    onClose={() => setShowSceneImportDialog(false)}
                    onImport={onSceneImport}
                />

                {/* Video Source */}
                <div>
                    <label className="text-gray-900 dark:text-white mb-2 block">
                        Video Source
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Upload Local File */}
                        <label
                            className={`flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 rounded-xl cursor-pointer transition-all duration-200 ${videoSource === 'local' && videoFile
                            ? 'border-[#ec1e24] bg-red-50 dark:bg-red-900/10'
                            : localVideoDrop.isDragging
                                ? 'border-[#ec1e24] bg-[#ec1e24]/10 dark:bg-[#ec1e24]/15'
                                : 'bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] hover:border-[#ec1e24]'
                            }`}
                            {...localVideoDrop.bind}
                        >
                            <Upload className={`w-6 h-6 ${videoSource === 'local' && videoFile ? 'text-[#ec1e24]' : 'text-gray-400'}`} />
                            <span className="text-sm text-gray-600 dark:text-[#9CA3AF] text-center">
                                {videoSource === 'local' && videoFile ? videoFile.name : 'Upload Local File'}
                            </span>
                            {videoSource === 'local' && videoFile && (
                                <span className="text-xs text-gray-500">
                                    {(videoFile.size / (1024 * 1024)).toFixed(0)}MB
                                </span>
                            )}
                            <input
                                ref={videoInputRef}
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={onVideoUpload}
                            />
                        </label>

                        {/* Load from Backblaze */}
                        <button
                            onClick={() => {
                                haptics.light();
                                onShowBackblazeBrowser();
                            }}
                            className={`flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 rounded-xl transition-all duration-200 ${videoSource === 'backblaze' && videoUrl
                                ? 'border-[#ec1e24] bg-red-50 dark:bg-red-900/10'
                                : 'bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] hover:border-[#ec1e24]'
                                }`}
                        >
                            <Cloud className={`w-6 h-6 ${videoSource === 'backblaze' && videoUrl ? 'text-[#ec1e24]' : 'text-gray-400'}`} />
                            <span className="text-sm text-gray-600 dark:text-[#9CA3AF] text-center">
                                {videoSource === 'backblaze' && videoUrl
                                    ? videoUrl.split('/').pop() || 'Backblaze Video'
                                    : 'Load from Backblaze'}
                            </span>
                            {videoSource === 'backblaze' && videoUrl && (
                                <span className="text-xs text-green-600 dark:text-green-400">
                                    ☁️ Cloud Storage
                                </span>
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Upload a local file or seamlessly access videos from your Backblaze B2 cloud storage.
                        <span className="text-[#ec1e24]"> Note:</span> First-time processing may take 10-15s to load FFmpeg.
                    </p>
                </div>

                {/* Subtitle Timestamp Assistant */}
                <SubtitleTimestampAssist
                    videoFileName={videoFile?.name || (videoUrl ? videoUrl.split('/').pop() : undefined)}
                    mode={mode}
                    onSelectTimestamp={(start, end) => {
                        setStartTime(start);
                        setEndTime(end);
                    }}
                    onSubtitlesLoaded={() => {
                        // Callback can be exposed if needed
                    }}
                />

                {/* Scene Selection Method */}
                <div>
                    <label className="text-gray-900 dark:text-white mb-3 block">
                        Scene Selection Method
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                            onClick={() => {
                                haptics.light();
                                setMode('ai');
                            }}
                            className={`px-3 sm:px-4 py-2.5 rounded-xl border transition-all duration-200 text-sm sm:text-base ${mode === 'ai'
                                ? 'bg-[#ec1e24] text-white border-[#ec1e24]'
                                : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:border-[#ec1e24]'
                                }`}
                        >
                            AI-Assisted
                        </button>
                        <button
                            onClick={() => {
                                haptics.light();
                                setMode('manual');
                            }}
                            className={`px-3 sm:px-4 py-2.5 rounded-xl border transition-all duration-200 text-sm sm:text-base ${mode === 'manual'
                                ? 'bg-[#ec1e24] text-white border-[#ec1e24]'
                                : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:border-[#ec1e24]'
                                }`}
                        >
                            Manual
                        </button>
                    </div>

                    {mode === 'ai' ? (
                        <div className="space-y-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    value={aiQuery}
                                    onChange={(e) => setAiQuery(e.target.value)}
                                    placeholder="e.g., Find the hallway fight scene"
                                    className="flex-1 px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#292929]"
                                />
                                <Button
                                    onClick={onAIAssistedQuery}
                                    disabled={!movieTitle.trim() || !aiQuery.trim()}
                                    className="w-full sm:w-auto bg-[#ec1e24] hover:bg-[#d01a20] text-white disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                    Find Scene
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                AI will suggest timestamps based on your query
                            </p>

                            {/* AI-Suggested Timestamps Display */}
                            {startTime && endTime && validateTimestampFormat(startTime) && validateTimestampFormat(endTime) && (
                                <div className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                                        <span className="text-sm text-purple-900 dark:text-purple-200">
                                            AI-Suggested Timestamps
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="bg-white/70 dark:bg-black/40 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                                            <label className="text-xs text-purple-600 dark:text-purple-400 mb-1 block">
                                                Start Time
                                            </label>
                                            <div className="text-gray-900 dark:text-white font-mono">
                                                {startTime}
                                            </div>
                                        </div>
                                        <div className="bg-white/70 dark:bg-black/40 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                                            <label className="text-xs text-purple-600 dark:text-purple-400 mb-1 block">
                                                End Time
                                            </label>
                                            <div className="text-gray-900 dark:text-white font-mono">
                                                {endTime}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-purple-900 dark:text-purple-200">
                                            Clip Duration: <strong>{calculateClipDuration(startTime, endTime)}s</strong>
                                        </span>
                                        <button
                                            onClick={() => {
                                                haptics.light();
                                                setMode('manual');
                                            }}
                                            className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 underline"
                                        >
                                            Adjust manually
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                                        Start Time
                                    </label>
                                    <input
                                        type="text"
                                        value={startTime}
                                        onChange={(e) => {
                                            haptics.light();
                                            setStartTime(formatTimestamp(e.target.value));
                                        }}
                                        onFocus={() => {
                                            haptics.light();
                                        }}
                                        placeholder="HH:MM:SS"
                                        className="w-full px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#292929]"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                                        End Time
                                    </label>
                                    <input
                                        type="text"
                                        value={endTime}
                                        onChange={(e) => {
                                            haptics.light();
                                            setEndTime(formatTimestamp(e.target.value));
                                        }}
                                        onFocus={() => {
                                            haptics.light();
                                        }}
                                        placeholder="HH:MM:SS"
                                        className="w-full px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#292929]"
                                    />
                                </div>
                            </div>

                            {/* Clip Duration Preview */}
                            {startTime && endTime && validateTimestampFormat(startTime) && validateTimestampFormat(endTime) && (
                                <div className="mt-2 p-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg">
                                    <p className="text-sm text-black dark:text-white">
                                        Clip Duration: <strong>{calculateClipDuration(startTime, endTime)}s</strong>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <Separator className="bg-gray-200 dark:bg-[#333333]" />

                {/* Output Settings */}
                <div className="space-y-4">
                    <h4 className="text-gray-900 dark:text-white">Output Settings</h4>

                    {/* Aspect Ratio */}
                    <div>
                        <label className="text-gray-900 dark:text-white mb-2 block">
                            Aspect Ratio
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => {
                                    haptics.light();
                                    setAspectRatio('16:9');
                                }}
                                className={`px-3 sm:px-4 py-2.5 rounded-xl border transition-all duration-200 text-sm sm:text-base ${aspectRatio === '16:9'
                                    ? 'bg-[#ec1e24] text-white border-[#ec1e24]'
                                    : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:border-[#ec1e24]'
                                    }`}
                            >
                                16:9
                            </button>
                            <button
                                onClick={() => {
                                    haptics.light();
                                    setAspectRatio('9:16');
                                }}
                                className={`px-3 sm:px-4 py-2.5 rounded-xl border transition-all duration-200 text-sm sm:text-base ${aspectRatio === '9:16'
                                    ? 'bg-[#ec1e24] text-white border-[#ec1e24]'
                                    : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:border-[#ec1e24]'
                                    }`}
                            >
                                9:16
                            </button>
                            <button
                                onClick={() => {
                                    haptics.light();
                                    setAspectRatio('1:1');
                                }}
                                className={`px-3 sm:px-4 py-2.5 rounded-xl border transition-all duration-200 text-sm sm:text-base ${aspectRatio === '1:1'
                                    ? 'bg-[#ec1e24] text-white border-[#ec1e24]'
                                    : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:border-[#ec1e24]'
                                    }`}
                            >
                                1:1
                            </button>
                        </div>
                    </div>

                    {/* Letterbox Removal Control */}
                    {(aspectRatio === '9:16' || aspectRatio === '1:1') && (
                        <LetterboxControl
                            id="scenes-letterbox"
                            aspectRatio={aspectRatio}
                            removeLetterbox={removeLetterbox}
                            onToggle={(checked) => {
                                setRemoveLetterbox(checked);
                            }}
                            enableAutoframing={enableAutoframing}
                            onAutoframingToggle={(checked) => {
                                setEnableAutoframing(checked);
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Video Scenes - Generate Video Button Section */}
            <div className="mt-6 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm px-6 py-6 space-y-4">
                {/* Caption Template Editor Button */}
                <Button
                    onClick={() => {
                        haptics.light();
                        const newState = !isCaptionEditorOpen;
                        setIsCaptionEditorOpen(newState);
                        onCaptionEditorChange?.(newState);
                    }}
                    variant="outline"
                    className="w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
                >
                    {isCaptionEditorOpen ? 'Hide' : 'Configure'} Caption Template
                </Button>

                {/* Generate Video Button */}
                <Button
                    onClick={onCutScene}
                    disabled={(videoSource === 'local' && !videoFile) || (videoSource === 'backblaze' && !videoUrl) || !startTime || !endTime || isProcessing}
                    className="w-full bg-[#ec1e24] hover:bg-[#d01a20] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing ? (
                        <>
                            Processing Scene...
                        </>
                    ) : (
                        <>
                            Cut & Generate Scene
                        </>
                    )}
                </Button>

                {/* Processing Progress */}
                {isProcessing && (
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                                    {progressMessage || 'Processing scene...'}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                                    {progress}%
                                </span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                        <div className="space-y-1 text-xs text-gray-500">
                            <p>⏳ Cutting scene from {startTime} to {endTime}</p>
                            <p>🎞️ Converting to {aspectRatio}</p>
                            {removeLetterbox && <p>📐 Removing letterbox</p>}
                            {enableAutoframing && <p>🎯 Applying AI auto-framing</p>}
                            <p>💬 Generating captions from audio</p>
                        </div>
                    </div>
                )}

                {/* Success State with Download Button */}
                {outputUrl && !isProcessing && (
                    <Button
                        onClick={onDownloadScene}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                        <Download className="w-5 h-5 mr-2" />
                        Download Scene ({calculateClipDuration(startTime, endTime)}s)
                    </Button>
                )}
            </div>

            {/* Video Scenes - Video Player Preview */}
            {outputUrl && !isProcessing && (
                <div className="mt-6 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm px-6 py-6">
                    <div className="space-y-4">
                        {/* Video Preview */}
                        <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden">
                            <video
                                src={outputUrl}
                                controls
                                className="w-full h-full"
                                style={{ objectFit: 'contain' }}
                            >
                                Your browser does not support video playback.
                            </video>
                        </div>

                        {/* Video Info */}
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Duration</p>
                                <p className="text-gray-900 dark:text-white">
                                    {calculateClipDuration(startTime, endTime)}s
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Range</p>
                                <p className="text-gray-900 dark:text-white">
                                    {startTime} → {endTime}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Format</p>
                                <p className="text-gray-900 dark:text-white">MP4</p>
                            </div>
                        </div>

                        {/* Thumbnail Upload */}
                        <div>
                            <label className="text-gray-900 dark:text-white mb-2 block">
                                Thumbnail (Optional)
                            </label>
                            <label
                                className={`flex flex-col items-center justify-center gap-2 px-4 py-6 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl cursor-pointer hover:border-[#ec1e24] transition-all duration-200 ${
                                    thumbnailDrop.isDragging ? 'border-[#ec1e24] bg-[#ec1e24]/10' : ''
                                }`}
                                {...thumbnailDrop.bind}
                            >
                                <Upload className="w-6 h-6 text-[#ec1e24]" />
                                <span className="text-sm text-gray-600 dark:text-[#9CA3AF] text-center">
                                    Upload Thumbnail
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        haptics.light();
                                        // Assumed simple toast or handled locally? 
                                        // To maintain statelessness, we might need a prop or just ignore here.
                                        // The original code was: toast.success('Thumbnail uploaded');
                                        // I will just ignore for now as it doesn't seem to set any state in original code except toast.
                                    }}
                                />
                            </label>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button
                                onClick={onDownloadScene}
                                variant="outline"
                                className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
                            >
                                <Download className="w-5 h-5 mr-2 text-[#ec1e24]" />
                                Download Scene
                            </Button>

                            <Button
                                onClick={() => {
                                    haptics.light();
                                    onPublish();
                                }}
                                className="bg-[#ec1e24] hover:bg-[#d01a20] text-white"
                            >
                                Publish to Social Media
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
