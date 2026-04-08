import React from 'react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Upload, X, AlertCircle, Film, Play, Pause, Volume2, VolumeX, Maximize, ChevronUp, ChevronDown, CheckCircle, Clock } from 'lucide-react';
import { haptics } from '../../utils/haptics';
import { MusicGenre, AspectRatio, VideoTitleData, AudioFile, DetectedTitle, PromptStatus, musicGenres, aspectRatios } from './types';
import { AutoAssignTitlesDialog } from '../AutoAssignTitlesDialog';
import { LetterboxControl } from '../LetterboxControl';
import { useDesktopFileDrop } from '../../hooks/useDesktopFileDrop';
import { LowerThirdEditor, LowerThirdConfig } from '../LowerThirdEditor';

interface MonthlyModuleProps {
    filter: 'Movies' | 'TV Shows';
    setFilter: (filter: 'Movies' | 'TV Shows') => void;

    // Video Files State
    youtubeUrls: string[];
    setYoutubeUrls: (urls: string[]) => void;
    videoFiles: File[];
    setVideoFiles: (files: File[]) => void;
    videoTitles: Record<number, VideoTitleData>;
    setVideoTitles: (titles: Record<number, VideoTitleData>) => void;
    detectedTitles: DetectedTitle[];
    showAutoAssign: boolean;
    setShowAutoAssign: (show: boolean) => void;
    onAutoAssign: () => void;

    // Audio State
    voiceover: AudioFile | null;
    onVoiceoverUpload: (file: File) => void;
    music: AudioFile | null;
    onMusicUpload: (file: File | null) => void;
    musicGenre: MusicGenre;
    setMusicGenre: (genre: MusicGenre) => void;
    isAnalyzing: boolean;

    // Video Configuration
    aspectRatio: AspectRatio;
    setAspectRatio: (ratio: AspectRatio) => void;
    removeLetterbox: boolean;
    setRemoveLetterbox: (remove: boolean) => void;
    enableAutoframing: boolean;
    setEnableAutoframing: (enable: boolean) => void;
    videoLength: string;
    setVideoLength: (length: string) => void;

    // Prompt & Generation
    isPromptGenerated: boolean;
    isPromptPanelOpen: boolean;
    setIsPromptPanelOpen: (open: boolean) => void;
    promptStatus: PromptStatus;
    setPromptStatus: (status: PromptStatus) => void;
    showDiffMode: boolean;
    setShowDiffMode: (show: boolean) => void;
    jsonData: any;
    naturalPrompt: string;
    onRegenerateJSON: () => void;
    onCopyPrompt: () => void;

    // Lower Thirds
    lowerThirdConfig: LowerThirdConfig;
    setLowerThirdConfig: (config: LowerThirdConfig) => void;
    enableLowerThirds: boolean;
    setEnableLowerThirds: (enable: boolean) => void;

    // Generation & Playback
    isGenerating: boolean;
    progress: number;
    onGenerateVideo: () => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    isMuted: boolean;
    setIsMuted: (muted: boolean) => void;
    videoTime: number;
    setVideoTime: (time: number) => void;
    videoDuration: number;
    thumbnail: File | null;
    setThumbnail: (file: File | null) => void;
    onFullscreen: () => void;

    // Actions
    onDownloadVideo: () => void;
    onPublishVideo: () => void;

    // Caption Editor
    isCaptionEditorOpen: boolean;
    setIsCaptionEditorOpen: (isOpen: boolean) => void;
    onCaptionEditorChange?: (isOpen: boolean) => void;
}

export function MonthlyModule({
    filter, setFilter,
    youtubeUrls, setYoutubeUrls,
    videoFiles, setVideoFiles,
    videoTitles, setVideoTitles,
    detectedTitles, showAutoAssign, setShowAutoAssign, onAutoAssign,
    voiceover, onVoiceoverUpload,
    music, onMusicUpload,
    musicGenre, setMusicGenre,
    isAnalyzing,
    aspectRatio, setAspectRatio,
    removeLetterbox, setRemoveLetterbox,
    enableAutoframing, setEnableAutoframing,
    videoLength, setVideoLength,
    isPromptGenerated, isPromptPanelOpen, setIsPromptPanelOpen,
    promptStatus, setPromptStatus,
    showDiffMode, setShowDiffMode,
    jsonData, naturalPrompt,
    onRegenerateJSON, onCopyPrompt,
    lowerThirdConfig, setLowerThirdConfig,
    enableLowerThirds, setEnableLowerThirds,
    isGenerating, progress, onGenerateVideo,
    isPlaying, setIsPlaying,
    isMuted, setIsMuted,
    videoTime, setVideoTime, videoDuration,
    thumbnail, setThumbnail,
    onFullscreen,
    onDownloadVideo, onPublishVideo,
    isCaptionEditorOpen, setIsCaptionEditorOpen, onCaptionEditorChange
}: MonthlyModuleProps) {

    // Local Helpers
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const newTime = Math.floor(percentage * videoDuration);
        setVideoTime(newTime);
        haptics.light();
    };

    // Helper for voiceover upload wrapper
    const handleVoiceoverUploadWrapper = (file: File) => {
        onVoiceoverUpload(file);
    };

    const videoDrop = useDesktopFileDrop({
        accept: 'video/*',
        onFiles: (files) => {
            const remainingSlots = 10 - videoFiles.length;
            const filesToAdd = files.slice(0, remainingSlots);
            if (!filesToAdd.length) return;
            const newFiles = [...videoFiles, ...filesToAdd];
            setVideoFiles(newFiles);
            haptics.light();
            if (detectedTitles.length > 0 && newFiles.length === detectedTitles.length) {
                setShowAutoAssign(true);
            }
        },
    });

    const voiceoverDrop = useDesktopFileDrop({
        accept: 'audio/*',
        onFiles: (files) => {
            if (files[0]) {
                haptics.light();
                handleVoiceoverUploadWrapper(files[0]);
            }
        },
    });

    const musicDrop = useDesktopFileDrop({
        accept: 'audio/*',
        onFiles: (files) => {
            haptics.light();
            onMusicUpload(files[0] ?? null);
        },
    });

    const thumbnailDrop = useDesktopFileDrop({
        accept: 'image/*',
        onFiles: (files) => {
            if (files[0]) {
                setThumbnail(files[0]);
            }
        },
    });

    return (
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
            <div className="mb-6">
                <h3 className="text-gray-900 dark:text-white">Monthly Releases Module</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Create monthly compilation videos</p>
            </div>

            <div className="space-y-4">
                {/* Filter */}
                <div>
                    <label className="text-gray-900 dark:text-white mb-2 block">
                        Content Type
                    </label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                haptics.light();
                                setFilter('Movies');
                            }}
                            className={`flex-1 px-4 py-2 rounded-xl transition-all duration-300 ${filter === 'Movies'
                                ? 'bg-[#ec1e24] text-white'
                                : 'bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-[#ec1e24]'
                                }`}
                        >
                            Movies
                        </button>
                        <button
                            onClick={() => {
                                haptics.light();
                                setFilter('TV Shows');
                            }}
                            className={`flex-1 px-4 py-2 rounded-xl transition-all duration-300 ${filter === 'TV Shows'
                                ? 'bg-[#ec1e24] text-white'
                                : 'bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-[#ec1e24]'
                                }`}
                        >
                            TV Shows
                        </button>
                    </div>
                </div>

                {/* Info Banner */}
                {videoFiles.length > 0 && (
                    <div className="flex items-start gap-3 px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-[#ec1e24] flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-black dark:text-white mb-1">
                                <strong>Important:</strong> Add a title for each video
                            </p>
                            <p className="text-xs text-gray-700 dark:text-gray-300">
                                When uploading multiple trailers for different {filter === 'Movies' ? 'movies' : 'TV shows'} releasing this month, label each video with its title. This allows the AI to correctly match scenes to each title in the final monthly releases compilation.
                            </p>
                        </div>
                    </div>
                )}

                {/* YouTube URLs */}
                <div>
                    <label className="text-gray-900 dark:text-white mb-2 flex items-center justify-between">
                        <span>YouTube URLs</span>
                        <span className="text-sm text-gray-500 dark:text-[#6B7280]">
                            {youtubeUrls.length} / 10
                        </span>
                    </label>

                    {/* URL List */}
                    <div className="space-y-2">
                        {youtubeUrls.map((url, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => {
                                        const newUrls = [...youtubeUrls];
                                        newUrls[index] = e.target.value;
                                        setYoutubeUrls(newUrls);
                                    }}
                                    onFocus={() => {
                                        haptics.light();
                                    }}
                                    placeholder="https://youtube.com/watch?v=..."
                                    className="flex-1 px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"
                                />
                                {youtubeUrls.length > 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            haptics.light();
                                            setYoutubeUrls(youtubeUrls.filter((_, i) => i !== index));
                                        }}
                                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-[#111111] rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200"
                                    >
                                        <X className="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add URL Button */}
                    {youtubeUrls.length < 10 && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                haptics.light();
                                setYoutubeUrls([...youtubeUrls, '']);
                            }}
                            className="mt-2 w-full px-4 py-2 bg-white dark:bg-[#000000] border border-dashed border-gray-300 dark:border-[#333333] rounded-xl text-gray-600 dark:text-gray-400 hover:border-[#ec1e24] hover:text-[#ec1e24] transition-all duration-200"
                        >
                            + Add Another URL
                        </button>
                    )}

                    {/* Max Warning */}
                    {youtubeUrls.length >= 10 && (
                        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                            <span className="text-sm text-amber-700 dark:text-amber-400">
                                Maximum 10 URLs reached
                            </span>
                        </div>
                    )}
                </div>

                {/* Auto-Assign Dialog */}
                {showAutoAssign && detectedTitles.length > 0 && (
                    <AutoAssignTitlesDialog
                        detectedTitles={detectedTitles}
                        videoCount={videoFiles.length}
                        onAutoAssign={onAutoAssign}
                        onDismiss={() => setShowAutoAssign(false)}
                    />
                )}

                {/* Local Video Upload */}
                <div>
                    <label className="text-gray-900 dark:text-white mb-2 flex items-center justify-between">
                        <span>Video files</span>
                        <span className="text-sm text-gray-500 dark:text-[#6B7280]">
                            {videoFiles.length} / 10
                        </span>
                    </label>

                    {/* Uploaded Videos List */}
                    {videoFiles.length > 0 && (
                        <div className="mb-3 space-y-3">
                            {videoFiles.map((file, index) => (
                                <div
                                    key={index}
                                    className="px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl space-y-2"
                                >
                                    <div className="flex items-center gap-3">
                                        <Film className="w-4 h-4 text-[#ec1e24] flex-shrink-0" />
                                        <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">
                                            {file.name}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-[#6B7280] flex-shrink-0">
                                            {(file.size / 1024 / 1024).toFixed(1)} MB
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                haptics.light();
                                                setVideoFiles(videoFiles.filter((_, i) => i !== index));
                                                // Also remove the title mapping
                                                const newTitles = { ...videoTitles };
                                                delete newTitles[index];
                                                setVideoTitles(newTitles);
                                            }}
                                            className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-gray-100 dark:bg-[#111111] rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-300 dark:hover:border-red-900 transition-all duration-200"
                                        >
                                            <X className="w-4 h-4 text-gray-500 dark:text-[#6B7280] hover:text-red-600 dark:hover:text-red-400" />
                                        </button>
                                    </div>
                                    {/* Movie Title Input */}
                                    <div className="pl-7">
                                        <input
                                            type="text"
                                            placeholder="Enter movie/show title (e.g., Wicked)"
                                            value={videoTitles[index]?.title || ''}
                                            onChange={(e) => {
                                                setVideoTitles({
                                                    ...videoTitles,
                                                    [index]: {
                                                        ...videoTitles[index],
                                                        title: e.target.value
                                                    }
                                                });
                                            }}
                                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#ec1e24]"
                                        />
                                        {videoTitles[index]?.title && (
                                            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                                                {videoTitles[index].autoDetected ? (
                                                    <>
                                                        ✓ <span className="text-purple-600 dark:text-purple-400">Auto-detected:</span> {videoTitles[index].title}
                                                        {videoTitles[index].voiceoverTimestamp && (
                                                            <span className="text-gray-400 dark:text-[#6B7280]"> @ {videoTitles[index].voiceoverTimestamp}</span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>✓ Title set: {videoTitles[index].title}</>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Upload Button */}
                    {videoFiles.length < 10 && (
                        <label
                            className={`flex flex-col items-center justify-center gap-2 px-4 py-6 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl cursor-pointer hover:border-[#ec1e24] transition-all duration-200 ${
                                videoDrop.isDragging ? 'border-[#ec1e24] bg-[#ec1e24]/10' : ''
                            }`}
                            {...videoDrop.bind}
                        >
                            <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-[#9CA3AF] text-center">
                                {videoFiles.length === 0 ? 'Upload Videos' : 'Upload More Videos'}
                            </span>
                            <input
                                type="file"
                                accept="video/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    const remainingSlots = 10 - videoFiles.length;
                                    const filesToAdd = files.slice(0, remainingSlots);
                                    if (filesToAdd.length > 0) {
                                        const newFiles = [...videoFiles, ...filesToAdd];
                                        setVideoFiles(newFiles);
                                        haptics.light();

                                        // If we have detected titles and video count now matches, show auto-assign
                                        if (detectedTitles.length > 0 && newFiles.length === detectedTitles.length) {
                                            setShowAutoAssign(true);
                                        }
                                    }
                                    e.target.value = '';
                                }}
                            />
                        </label>
                    )}

                    {videoFiles.length >= 10 && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-xl">
                            <AlertCircle className="w-4 h-4 text-gray-500 dark:text-[#6B7280]" />
                            <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                                Maximum 10 videos reached
                            </span>
                        </div>
                    )}
                </div>

                {/* File Uploaders */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            Voice-over
                            {isAnalyzing && (
                                <span className="text-xs text-[#ec1e24]">Analyzing...</span>
                            )}
                        </label>
                        <label
                            className={`flex flex-col items-center justify-center gap-2 px-4 py-6 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl cursor-pointer hover:border-[#ec1e24] transition-all duration-200 ${
                                voiceoverDrop.isDragging ? 'border-[#ec1e24] bg-[#ec1e24]/10' : ''
                            }`}
                            {...voiceoverDrop.bind}
                        >
                            <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-[#9CA3AF] text-center">
                                {voiceover ? voiceover.name : 'Upload Audio'}
                            </span>
                            {isAnalyzing && (
                                <span className="text-xs text-gray-500 dark:text-[#6B7280]">
                                    Extracting movie titles...
                                </span>
                            )}
                            <input
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        handleVoiceoverUploadWrapper(file);
                                    }
                                    // Reset input to allow re-upload of same file
                                    e.target.value = '';
                                }}
                            />
                        </label>
                        {detectedTitles.length > 0 && (
                            <div className="mt-2 px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg">
                                <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">
                                    ✓ Detected {detectedTitles.length} {detectedTitles.length === 1 ? 'title' : 'titles'} from voiceover
                                </p>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-gray-900 dark:text-white mb-2 block">
                            Music Track
                        </label>
                        <label
                            className={`flex flex-col items-center justify-center gap-2 px-4 py-6 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl cursor-pointer hover:border-[#ec1e24] transition-all duration-200 ${
                                musicDrop.isDragging ? 'border-[#ec1e24] bg-[#ec1e24]/10' : ''
                            }`}
                            {...musicDrop.bind}
                        >
                            <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-[#9CA3AF] text-center">
                                {music ? music.name : 'Upload Music'}
                            </span>
                            <input
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                onChange={(e) => {
                                    haptics.light();
                                    onMusicUpload(e.target.files?.[0] || null);
                                }}
                            />
                        </label>
                    </div>
                </div>

                {/* Music Genre Selector */}
                <div>
                    <label className="text-gray-900 dark:text-white mb-2 block">
                        Music Genre
                    </label>
                    <div className="flex gap-2 flex-wrap">
                        {musicGenres.map((genre) => (
                            <button
                                key={genre}
                                onClick={() => {
                                    haptics.light();
                                    setMusicGenre(genre);
                                }}
                                className={`px-4 py-2 rounded-xl transition-all duration-300 ${musicGenre === genre
                                    ? 'bg-[#ec1e24] text-white'
                                    : 'bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-[#ec1e24]'
                                    }`}
                            >
                                {genre}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Aspect Ratio & Video Length */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-gray-900 dark:text-white mb-2 block">
                            Aspect Ratio
                        </label>
                        <div className="flex gap-2">
                            {aspectRatios.map((ratio) => (
                                <button
                                    key={ratio}
                                    onClick={() => {
                                        haptics.light();
                                        setAspectRatio(ratio);
                                        // Update lower third aspect ratio to match
                                        setLowerThirdConfig({
                                            ...lowerThirdConfig,
                                            aspectRatio: ratio
                                        });
                                        setPromptStatus('outdated');
                                    }}
                                    className={`flex-1 px-4 py-2 rounded-xl transition-all duration-300 ${aspectRatio === ratio
                                        ? 'bg-[#ec1e24] text-white'
                                        : 'bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-[#ec1e24]'
                                        }`}
                                >
                                    {ratio}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-gray-900 dark:text-white mb-2 block">
                            Video Length
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    haptics.light();
                                    setVideoLength('auto');
                                }}
                                className={`flex-1 px-4 py-2 rounded-xl transition-all duration-300 ${videoLength === 'auto'
                                    ? 'bg-[#ec1e24] text-white'
                                    : 'bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF] hover:border-[#ec1e24]'
                                    }`}
                            >
                                Auto
                            </button>
                            <input
                                type="number"
                                min="0"
                                max="59"
                                placeholder="MM"
                                value={videoLength !== 'auto' ? Math.floor(parseInt(videoLength) / 60) || '' : ''}
                                onChange={(e) => {
                                    const minutes = parseInt(e.target.value) || 0;
                                    const seconds = videoLength !== 'auto' ? parseInt(videoLength) % 60 : 0;
                                    setVideoLength(String(minutes * 60 + seconds));
                                }}
                                className="w-20 md:w-24 px-3 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-[#292929]"
                            />
                            <input
                                type="number"
                                min="0"
                                max="59"
                                placeholder="SS"
                                value={videoLength !== 'auto' ? (parseInt(videoLength) % 60).toString() : ''}
                                onChange={(e) => {
                                    const minutes = videoLength !== 'auto' ? Math.floor(parseInt(videoLength) / 60) : 0;
                                    const seconds = e.target.value === '' ? 0 : parseInt(e.target.value);
                                    setVideoLength(String(minutes * 60 + seconds));
                                }}
                                className="w-20 md:w-24 px-3 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-[#292929]"
                            />
                        </div>
                    </div>
                </div>

                {/* Generate LLM Prompt Button - Shows first */}
                {!isPromptGenerated && (
                    <Button
                        onClick={onRegenerateJSON}
                        className="w-full bg-[#ec1e24] hover:bg-[#d01a20] text-white"
                    >
                        Generate LLM Prompt
                    </Button>
                )}

                {/* Letterbox Removal Control */}
                {(aspectRatio === '9:16' || aspectRatio === '1:1') && (
                    <LetterboxControl
                        id="monthly-letterbox"
                        aspectRatio={aspectRatio}
                        removeLetterbox={removeLetterbox}
                        onToggle={(checked) => {
                            setRemoveLetterbox(checked);
                            setPromptStatus('outdated');
                        }}
                        enableAutoframing={enableAutoframing}
                        onAutoframingToggle={(checked) => {
                            setEnableAutoframing(checked);
                            setPromptStatus('outdated');
                        }}
                    />
                )}

                {/* Lower Thirds Configuration */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-gray-900 dark:text-white block">
                                Lower Thirds
                            </label>
                            <p className="text-sm text-gray-600 dark:text-[#9CA3AF] mt-0.5">
                                Add title overlays showing movie names and release dates
                            </p>
                        </div>
                        <Switch
                            checked={enableLowerThirds}
                            onCheckedChange={(checked) => {
                                haptics.light();
                                setEnableLowerThirds(checked);
                                setPromptStatus('outdated');

                                // Prevent keyboard from popping up when toggling on
                                if (checked) {
                                    setTimeout(() => {
                                        if (document.activeElement instanceof HTMLElement) {
                                            document.activeElement.blur();
                                        }
                                    }, 0);
                                }
                            }}
                        />
                    </div>

                    {enableLowerThirds && (
                        <div className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl">
                            <LowerThirdEditor
                                onSave={(config) => {
                                    setLowerThirdConfig(config);
                                    setPromptStatus('outdated');
                                    // Assumes toast is available or handled by caller, but here we can't easily toast unless imported
                                    // Let's assume haptics covers feedback or toast passed as prop? No toast prop.
                                    // Just run it.
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* LLM + JSON Prompt Panel */}
            {isPromptGenerated && (
                <div className="mt-6 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm px-6 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-gray-900 dark:text-white">LLM Prompt Configuration</h3>
                            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Configure AI generation settings before creating video</p>
                        </div>
                        <button
                            onClick={() => {
                                haptics.light();
                                setIsPromptPanelOpen(!isPromptPanelOpen);
                            }}
                            className="text-gray-600 dark:text-[#9CA3AF] hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                        >
                            {isPromptPanelOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>

                    {isPromptPanelOpen && (
                        <div className="space-y-4">
                            {/* Status Banner */}
                            <div className={`p-4 rounded-xl flex items-center gap-3 ${promptStatus === 'ready' ? 'bg-[#D1FAE5] dark:bg-[#065F46] text-[#065F46] dark:text-[#D1FAE5]' :
                                promptStatus === 'warning' ? 'bg-[#FEF3C7] dark:bg-[#92400E] text-[#92400E] dark:text-[#FEF3C7]' :
                                    promptStatus === 'outdated' ? 'bg-[#FED7AA] dark:bg-[#9A3412] text-[#9A3412] dark:text-[#FED7AA]' :
                                        'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-[#9CA3AF]'
                                }`}>
                                {promptStatus === 'ready' && <CheckCircle className="w-5 h-5" />}
                                {promptStatus === 'warning' && <AlertCircle className="w-5 h-5" />}
                                {promptStatus === 'outdated' && <Clock className="w-5 h-5" />}

                                <span>
                                    {promptStatus === 'ready' && 'Prompt Ready for Generation'}
                                    {promptStatus === 'warning' && 'Warning: Missing required inputs'}
                                    {promptStatus === 'outdated' && 'Prompt Outdated - Regenerate Required'}
                                    {promptStatus === 'empty' && 'Awaiting Required Inputs'}
                                </span>
                            </div>

                            {/* Diff Mode Toggle */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-900 dark:text-white">
                                    View Mode
                                </span>
                                <button
                                    onClick={() => {
                                        haptics.light();
                                        setShowDiffMode(!showDiffMode);
                                    }}
                                    className={`px-4 py-2 rounded-xl transition-all duration-300 ${showDiffMode
                                        ? 'bg-[#ec1e24] text-white'
                                        : 'bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] text-gray-600 dark:text-[#9CA3AF]'
                                        }`}
                                >
                                    {showDiffMode ? 'Side-by-Side' : 'Stacked'}
                                </button>
                            </div>

                            {/* JSON Preview */}
                            <div className={`${showDiffMode ? 'grid grid-cols-2 gap-4' : 'space-y-4'}`}>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-gray-900 dark:text-white">
                                            Structured JSON
                                        </label>
                                        <Button
                                            onClick={onRegenerateJSON}
                                            size="sm"
                                            variant="outline"
                                            className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
                                        >
                                            Regenerate JSON
                                        </Button>
                                    </div>
                                    <pre className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-sm text-gray-900 dark:text-white overflow-x-auto max-h-96 overflow-y-auto">
                                        {jsonData ? JSON.stringify(jsonData, null, 2) : '{\n  // Upload assets to generate JSON\n}'}
                                    </pre>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-gray-900 dark:text-white">
                                            Natural Language Prompt
                                        </label>
                                        <Button
                                            onClick={onCopyPrompt}
                                            size="sm"
                                            variant="outline"
                                            className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
                                        >
                                            Copy
                                        </Button>
                                    </div>
                                    <div className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-sm text-gray-900 dark:text-white max-h-96 overflow-y-auto">
                                        {naturalPrompt || 'Upload assets and generate JSON to see the prompt...'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Generate Video Button Section */}
            {isPromptGenerated && (
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

                    {/* Generate Video Button - Shows after prompt is generated */}
                    <Button
                        onClick={onGenerateVideo}
                        disabled={isGenerating}
                        className="w-full bg-[#ec1e24] hover:bg-[#d01a20] text-white"
                    >
                        {isGenerating ? (
                            <>
                                Generating Compilation...
                            </>
                        ) : (
                            <>
                                Generate Monthly Video Compilation
                            </>
                        )}
                    </Button>

                    {/* Progress Bar */}
                    {isGenerating && (
                        <div className="space-y-2">
                            <div className="w-full bg-gray-200 dark:bg-[#0A0A0A] rounded-full h-2.5">
                                <div
                                    className="bg-[#ec1e24] h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-sm text-center text-gray-600 dark:text-[#9CA3AF]">
                                Processing... {progress}%
                            </p>
                        </div>
                    )}

                    {/* Video Preview */}
                    {progress === 100 && (
                        <div className="space-y-4 mt-6 pt-6 border-t border-gray-200 dark:border-[#333333]">
                            <div className="bg-gray-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center relative group">
                                <p className="text-white">Video Compilation Preview</p>

                                {/* Video Controls - Inside Player */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-200">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                haptics.light();
                                                setIsPlaying(!isPlaying);
                                            }}
                                            className="w-9 h-9 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                                        >
                                            {isPlaying ? (
                                                <Pause className="w-4 h-4 text-white" />
                                            ) : (
                                                <Play className="w-4 h-4 text-white" />
                                            )}
                                        </button>

                                        <button
                                            onClick={() => {
                                                haptics.light();
                                                setIsMuted(!isMuted);
                                            }}
                                            className="w-9 h-9 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                                        >
                                            {isMuted ? (
                                                <VolumeX className="w-4 h-4 text-white" />
                                            ) : (
                                                <Volume2 className="w-4 h-4 text-white" />
                                            )}
                                        </button>

                                        <div
                                            className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer"
                                            onClick={handleProgressClick}
                                        >
                                            <div
                                                className="h-full bg-[#ec1e24] transition-all duration-150"
                                                style={{ width: `${(videoTime / videoDuration) * 100}%` }}
                                            />
                                        </div>

                                        <span className="text-xs text-white/90 min-w-[70px] text-right">
                                            {formatTime(videoTime)} / {formatTime(videoDuration)}
                                        </span>

                                        <button
                                            onClick={onFullscreen}
                                            className="w-9 h-9 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                                        >
                                            <Maximize className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Thumbnail Upload */}
                            <div>
                                <label className="text-gray-900 dark:text-white mb-2 block">
                                    Upload Thumbnail (Auto-sized for each platform)
                                </label>
                                <label
                                    className={`flex flex-col items-center justify-center gap-2 px-4 py-6 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl cursor-pointer hover:border-[#ec1e24] transition-all duration-200 ${
                                        thumbnailDrop.isDragging ? 'border-[#ec1e24] bg-[#ec1e24]/10' : ''
                                    }`}
                                    {...thumbnailDrop.bind}
                                >
                                    <Upload className="w-6 h-6 text-[#ec1e24]" />
                                    <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                                        {thumbnail ? thumbnail.name : 'Upload Thumbnail'}
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
                                    />
                                </label>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Button
                                    onClick={onDownloadVideo}
                                    variant="outline"
                                    className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
                                >
                                    Download Compilation
                                </Button>

                                <Button
                                    onClick={() => {
                                        haptics.light();
                                        onPublishVideo();
                                    }}
                                    className="bg-[#ec1e24] hover:bg-[#d01a20] text-white"
                                >
                                    Publish to Social Media
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
