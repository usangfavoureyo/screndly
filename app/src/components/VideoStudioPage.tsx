import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, ChevronDownIcon, ChevronUp, CheckCircle, Volume2, VolumeX, X, MoreVertical, Edit2, Monitor, Smartphone, Square } from 'lucide-react';
import { toast } from "sonner";
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { haptics } from '../utils/haptics';
import { useSettings } from '../contexts/SettingsContext';
import { InstagramIcon } from './icons/InstagramIcon';
import { FacebookIcon } from './icons/FacebookIcon';
import { ThreadsIcon } from './icons/ThreadsIcon';
import { XIcon } from './icons/XIcon';
import { YouTubeIcon } from './icons/YouTubeIcon';
import { TikTokIcon } from './icons/TikTokIcon';
import { PinterestIcon } from './icons/PinterestIcon';

import { VisuallyHidden } from './ui/visually-hidden';
import { TrailerScenesDialog } from './TrailerScenesDialog';
import { AnalysisSettingsPanel } from './AnalysisSettingsPanel';
import { SceneCorrectionInterface } from './SceneCorrectionInterface';
import { TrainingProgressDashboard } from './TrainingProgressDashboard';
import { LowerThirdConfig } from './LowerThirdEditor';
import { BackblazeVideoBrowser } from './BackblazeVideoBrowser';
import { addVideoStudioActivity, addRecentActivity, addLogEntry } from '../utils/activityStore';
import { analyzeTrailer, TrailerAnalysis, VideoMoment } from '../lib/api/googleVideoIntelligence';
import { generateShotstackJSON, getRenderStatus, renderVideo } from '../lib/api/shotstack';
import { analyzeMultipleTrailers, MonthlyTrailerAnalysis, generateMonthlyCompilationJSON } from '../lib/api/monthlyCompilation';
import { performWebSearch, formatSearchResultsForPrompt, buildSceneSearchQuery } from '../lib/api/webSearch';
import { uploadVideoStudioAsset } from '../lib/api/backblaze';
import { apiClient } from '../lib/api/client';
import { generateVideoStudioCaption, type VideoContent, VideoContentType } from '../utils/videoStudioCaptionGenerator';
import { publishContent } from '../lib/api/platforms';
import type { AIModelId } from '../lib/ai/models';
import { VideoStudioHeader } from './video-studio/VideoStudioHeader';
import { ReviewModule } from './video-studio/ReviewModule';
import { MonthlyModule } from './video-studio/MonthlyModule';
import { ScenesModule } from './video-studio/ScenesModule';
import { AudioDynamicsPanel } from './video-studio/AudioDynamicsPanel';
import { CaptionEditorPanel } from './video-studio/CaptionEditorPanel';
import { VideoTitleData, AudioFile, AspectRatio, MusicGenre, DuckingMode, Scene } from './video-studio/types';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';

interface VideoStudioPageProps {
  onNavigate: (page: string, fromPage?: string | null) => void;
  previousPage?: string | null;
  onCaptionEditorChange?: (isOpen: boolean) => void;
}

export function VideoStudioPage({ onNavigate, onCaptionEditorChange }: VideoStudioPageProps) {
  const { settings } = useSettings();
  const isMountedRef = useRef(true);
  const reviewMusicInputRef = useRef<HTMLInputElement>(null);
  const monthlyMusicInputRef = useRef<HTMLInputElement>(null);
  const uploadedAssetCacheRef = useRef(new Map<string, string>());
  const [activeModule, setActiveModule] = useState<'review' | 'monthly' | 'scenes'>('review');
  const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false);
  const [isPromptGenerated, setIsPromptGenerated] = useState(false);
  const [isAudioPanelOpen, setIsAudioPanelOpen] = useState(false);
  const [isCaptionEditorOpen, setIsCaptionEditorOpen] = useState(false);
  const [showDiffMode, setShowDiffMode] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState({
    x: true,
    threads: true,
    facebook: false,
    tiktok: false,
    youtube: false,
    instagram: false,
    pinterest: false,
  });
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [captionEditMode, setCaptionEditMode] = useState(false);

  // Review Module State
  const [reviewYoutubeUrls, setReviewYoutubeUrls] = useState<string[]>(['']);
  const [reviewVideoFiles, setReviewVideoFiles] = useState<File[]>([]);
  const [reviewVideoTitles, setReviewVideoTitles] = useState<Record<number, VideoTitleData>>({});
  const [reviewVoiceover, setReviewVoiceover] = useState<AudioFile | null>(null);
  const [reviewMusic, setReviewMusic] = useState<AudioFile | null>(null);
  const [reviewMusicGenre, setReviewMusicGenre] = useState<MusicGenre>('Hip-Hop');
  const [reviewAspectRatio, setReviewAspectRatio] = useState<AspectRatio>('16:9');
  const [reviewRemoveLetterbox, setReviewRemoveLetterbox] = useState(true); // Auto-fill for 9:16 and 1:1
  const [reviewEnableAutoframing, setReviewEnableAutoframing] = useState(true); // AI-powered intelligent cropping
  const [reviewVideoLength, setReviewVideoLength] = useState('auto');
  const [reviewIsGenerating, setReviewIsGenerating] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [reviewIsPlaying, setReviewIsPlaying] = useState(false);
  const [reviewIsMuted, setReviewIsMuted] = useState(false);
  const [reviewThumbnail, setReviewThumbnail] = useState<File | null>(null);
  const [reviewVideoTime, setReviewVideoTime] = useState(0);
  const [reviewVideoDuration] = useState(135); // 2:15 in seconds
  const [reviewIsFullscreen, setReviewIsFullscreen] = useState(false);
  const [reviewRenderOutputUrl, setReviewRenderOutputUrl] = useState('');

  // Monthly Module State
  const [monthlyFilter, setMonthlyFilter] = useState<'Movies' | 'TV Shows'>('Movies');
  const [monthlyYoutubeUrls, setMonthlyYoutubeUrls] = useState<string[]>(['']);
  const [monthlyVideoFiles, setMonthlyVideoFiles] = useState<File[]>([]);
  const [monthlyVideoTitles, setMonthlyVideoTitles] = useState<Record<number, VideoTitleData>>({});
  const [monthlyVoiceover, setMonthlyVoiceover] = useState<AudioFile | null>(null);
  const [monthlyMusic, setMonthlyMusic] = useState<AudioFile | null>(null);
  const [monthlyMusicGenre, setMonthlyMusicGenre] = useState<MusicGenre>('Hip-Hop');
  const [monthlyAspectRatio, setMonthlyAspectRatio] = useState<AspectRatio>('16:9');
  const [monthlyRemoveLetterbox, setMonthlyRemoveLetterbox] = useState(true); // Auto-fill for 9:16 and 1:1
  const [monthlyEnableAutoframing, setMonthlyEnableAutoframing] = useState(true); // AI-powered intelligent cropping
  const [monthlyVideoLength, setMonthlyVideoLength] = useState('auto');
  const [monthlyIsGenerating, setMonthlyIsGenerating] = useState(false);
  const [monthlyProgress, setMonthlyProgress] = useState(0);
  const [monthlyIsPlaying, setMonthlyIsPlaying] = useState(false);
  const [monthlyIsMuted, setMonthlyIsMuted] = useState(false);
  const [monthlyThumbnail, setMonthlyThumbnail] = useState<File | null>(null);
  const [monthlyVideoTime, setMonthlyVideoTime] = useState(0);
  const [monthlyVideoDuration] = useState(285); // 4:45 in seconds
  const [monthlyIsFullscreen, setMonthlyIsFullscreen] = useState(false);
  const [monthlyRenderOutputUrl, setMonthlyRenderOutputUrl] = useState('');
  const [monthlyLowerThirdConfig, setMonthlyLowerThirdConfig] = useState<LowerThirdConfig>({
    position: 'bottom-left',
    aspectRatio: '16:9',
    size: 'medium',
    duration: 3.5,
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
  });
  const [monthlyEnableLowerThirds, setMonthlyEnableLowerThirds] = useState(false);

  // Video Scenes Module State
  const [scenesMovieTitle, setScenesMovieTitle] = useState('');
  const [scenesVideoFile, setScenesVideoFile] = useState<File | null>(null);
  const [scenesVideoUrl, setScenesVideoUrl] = useState(''); // For Backblaze URLs
  const [scenesVideoSource, setScenesVideoSource] = useState<'local' | 'backblaze'>('local');
  const [showBackblazeBrowser, setShowBackblazeBrowser] = useState(false);
  const [scenesMode, setScenesMode] = useState<'ai' | 'manual'>('manual');
  const [scenesAIQuery, setScenesAIQuery] = useState('');

  const [scenesStartTime, setScenesStartTime] = useState('');
  const [scenesEndTime, setScenesEndTime] = useState('');
  const [scenesAspectRatio, setScenesAspectRatio] = useState<AspectRatio>('16:9');
  const [, setScenesOriginalRatio] = useState<AspectRatio>('16:9');
  const [scenesRemoveLetterbox, setScenesRemoveLetterbox] = useState(true);
  const [scenesEnableAutoframing, setScenesEnableAutoframing] = useState(true);
  const [scenesIsProcessing, setScenesIsProcessing] = useState(false);
  const [scenesProgress, setScenesProgress] = useState(0);
  const [scenesProgressMessage, setScenesProgressMessage] = useState('');
  const [scenesOutputUrl, setScenesOutputUrl] = useState('');
  const [scenesOutputBlob, setScenesOutputBlob] = useState<Blob | null>(null);
  const [scenesAIModel, setScenesAIModel] = useState<Extract<AIModelId, 'gpt-5.4' | 'gpt-5.4-mini' | 'gpt-5.4-nano' | 'flash-3'>>('gpt-5.4-mini');

  // Spreadsheet Import State
  const [showSceneImportDialog, setShowSceneImportDialog] = useState(false);
  const [importedScenes, setImportedScenes] = useState<any[]>([]);
  const [importedMovieName, setImportedMovieName] = useState<string>('');

  // Audio Dynamics State
  const [enableAutoDucking, setEnableAutoDucking] = useState(true);
  const [duckingMode, setDuckingMode] = useState<DuckingMode>('Adaptive');
  const [duckLevel, setDuckLevel] = useState(-12);
  const [attackMs, setAttackMs] = useState(50);
  const [releaseMs, setReleaseMs] = useState(200);

  // Trailer Audio Hooks State
  const [enableTrailerAudioHooks, setEnableTrailerAudioHooks] = useState(true);
  const [hookPlacements, setHookPlacements] = useState<string[]>(['opening', 'mid-video', 'ending']);
  const [hookDuration, setHookDuration] = useState(3);
  const [isHookDurationAuto, setIsHookDurationAuto] = useState(false);
  const [trailerAudioVolume, setTrailerAudioVolume] = useState(100);
  const [crossfadeDuration, setCrossfadeDuration] = useState(0.5);
  const [audioVariety, setAudioVariety] = useState<'balanced' | 'heavy-voiceover' | 'heavy-trailer'>('balanced');

  // Trailer Analysis State (Google Video Intelligence)
  const [reviewTrailerAnalysis, setReviewTrailerAnalysis] = useState<TrailerAnalysis | null>(null);
  const [reviewIsAnalyzingTrailer, setReviewIsAnalyzingTrailer] = useState(false);
  const [showTrailerScenesDialog, setShowTrailerScenesDialog] = useState(false);
  const [monthlyTrailerAnalyses, setMonthlyTrailerAnalyses] = useState<MonthlyTrailerAnalysis[]>([]);
  const [monthlyIsAnalyzingTrailer, setMonthlyIsAnalyzingTrailer] = useState(false);

  // Custom Hook Selection State
  const [customOpeningHook, setCustomOpeningHook] = useState<VideoMoment | null>(null);
  const [customMidVideoHook, setCustomMidVideoHook] = useState<VideoMoment | null>(null);
  const [customEndingHook, setCustomEndingHook] = useState<VideoMoment | null>(null);

  // Video Rendering State (Shotstack)
  const [, setReviewRenderId] = useState<string | null>(null);
  const [, setMonthlyRenderId] = useState<string | null>(null);

  // LLM Prompt State
  const [promptStatus, setPromptStatus] = useState<'empty' | 'ready' | 'outdated' | 'warning'>('empty');
  const [jsonData, setJsonData] = useState<any>(null);
  const [naturalPrompt, setNaturalPrompt] = useState('');

  // Voiceover Analysis State
  const [reviewDetectedTitles, setReviewDetectedTitles] = useState<Array<{
    title: string;
    releaseDate?: string;
    timestamp: string;
    confidence: number;
    context: string;
  }>>([]);
  const [reviewIsAnalyzing, setReviewIsAnalyzing] = useState(false);
  const [reviewShowAutoAssign, setReviewShowAutoAssign] = useState(false);

  const [monthlyDetectedTitles, setMonthlyDetectedTitles] = useState<Array<{
    title: string;
    releaseDate?: string;
    timestamp: string;
    confidence: number;
    context: string;
  }>>([]);
  const [monthlyIsAnalyzing, setMonthlyIsAnalyzing] = useState(false);
  const [monthlyShowAutoAssign, setMonthlyShowAutoAssign] = useState(false);

  // Caption Template State
  const [captionTemplate, setCaptionTemplate] = useState('Netflix Style');
  const [captionFontFamily, setCaptionFontFamily] = useState('Inter');
  const [captionFontSize, setCaptionFontSize] = useState(24);
  const [captionFontWeight, setCaptionFontWeight] = useState('Bold');
  const [captionTextColor, setCaptionTextColor] = useState('#FFFF00');
  const [captionBgColor, setCaptionBgColor] = useState('#000000');
  const [captionBgOpacity, setCaptionBgOpacity] = useState(80);
  const [captionPosition, setCaptionPosition] = useState('Bottom-Center');
  const [captionAlignment, setCaptionAlignment] = useState('Center');
  const [captionStrokeColor, setCaptionStrokeColor] = useState('#000000');
  const [captionStrokeWidth, setCaptionStrokeWidth] = useState(0);
  const [captionShadow, setCaptionShadow] = useState(true);
  const [captionBorderRadius, setCaptionBorderRadius] = useState(8);
  const [captionAnimation, setCaptionAnimation] = useState('Fade In');
  const [captionWordsPerLine, setCaptionWordsPerLine] = useState(3);
  const [, setShowTextColorPicker] = useState(false);
  const [, setShowBgColorPicker] = useState(false);
  const [, setShowStrokeColorPicker] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingTemplate, setRenamingTemplate] = useState<string | null>(null);
  const [showRenameMenu, setShowRenameMenu] = useState<string | null>(null);



  // Caption Preview State
  const [captionPreviewAspectRatio, setCaptionPreviewAspectRatio] = useState<AspectRatio>('16:9');
  const [isCaptionPreviewPlaying, setIsCaptionPreviewPlaying] = useState(false);

  // Audio Preview Player State
  const [isAudioPreviewPlaying, setIsAudioPreviewPlaying] = useState(false);
  const [audioPreviewProgress, setAudioPreviewProgress] = useState(0);
  const [audioPreviewCurrentSegment, setAudioPreviewCurrentSegment] = useState<string | null>(null);
  const audioPreviewTimerRef = useRef<NodeJS.Timeout | null>(null);

  // AI Training & Analysis Settings State
  const [analysisBackend, setAnalysisBackend] = useState<'google-vi' | 'ffmpeg-fallback'>('google-vi');
  const [qualityMode, setQualityMode] = useState<'fast' | 'quality'>('fast');
  const [enableSelectiveSTT, setEnableSelectiveSTT] = useState(false);
  const [monthlyBudget] = useState(50.00);
  const [monthlySpend] = useState(12.40);
  const [totalCorrections, setTotalCorrections] = useState(237); // All corrections stored locally
  const [currentAccuracy, setCurrentAccuracy] = useState(72.3); // Current model accuracy
  const [systemRating, setSystemRating] = useState(7.2); // Self-assessed rating (0-10)
  const [accuracyImprovement, setAccuracyImprovement] = useState(4.3); // Gain from corrections
  const [overrideRate] = useState(18.5); // Override rate over last 100 videos
  const [meanHookConfidence] = useState(0.71); // Mean confidence of selected hooks
  const [showAnalysisSettings, setShowAnalysisSettings] = useState(false);
  const [showCorrectionInterface, setShowCorrectionInterface] = useState(false);
  const [showTrainingDashboard, setShowTrainingDashboard] = useState(false);
  const [stratificationNeeds, setStratificationNeeds] = useState({
    action: 82,
    dialogue: 45,
    suspense: 38,
    atmosphere: 52,
    transition: 20
  });

  const fontFamilies = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Open Sans', 'Lato'];
  const fontWeights = ['Regular', 'Medium', 'Bold', 'Black'];
  const positions = ['Top', 'Center', 'Bottom-Center', 'Bottom'];
  const alignments = ['Left', 'Center', 'Right'];
  const animations = ['None', 'Fade In', 'Slide Up', 'Word Highlight'];

  // Calculate effective hook duration (auto or manual)
  const effectiveHookDuration = React.useMemo(() => {
    if (!isHookDurationAuto) {
      return hookDuration;
    }

    // Auto mode: Calculate based on trailer analysis or use smart defaults
    const currentAnalysis = activeModule === 'review' ? reviewTrailerAnalysis : null;

    if (currentAnalysis?.suggestedHooks) {
      // Calculate average duration from suggested hooks
      const hooks = [
        currentAnalysis.suggestedHooks.opening,
        currentAnalysis.suggestedHooks.midVideo,
        currentAnalysis.suggestedHooks.ending
      ].filter(Boolean);

      if (hooks.length > 0) {
        // Use 2-4 seconds based on scene intensity/confidence
        const avgConfidence = hooks.reduce((sum, hook) => sum + (hook.confidence || 0.5), 0) / hooks.length;
        return avgConfidence > 0.7 ? 3.5 : 2.5; // Higher confidence = longer hooks
      }
    }

    // Default auto duration based on video type
    return 3; // Standard 3 second hooks
  }, [isHookDurationAuto, hookDuration, reviewTrailerAnalysis, activeModule]);

  // Helper functions for lazy-loaded FFmpeg utilities
  const loadFFmpegUtils = async () => {
    const { validateTimestamp, getClipDuration, cutVideoSegment } = await import('../utils/ffmpeg');
    return { validateTimestamp, getClipDuration, cutVideoSegment };
  };

  // Lightweight timestamp helpers (no FFmpeg import needed)
  const getUploadedAssetCacheKey = (file: File, folder: 'trailers' | 'voiceovers' | 'music') =>
    `${folder}:${file.name}:${file.size}:${file.lastModified}`;

  const ensureVideoStudioAssetUploaded = async (
    file: File,
    folder: 'trailers' | 'voiceovers' | 'music'
  ): Promise<string> => {
    const cacheKey = getUploadedAssetCacheKey(file, folder);
    const cachedUrl = uploadedAssetCacheRef.current.get(cacheKey);
    if (cachedUrl) {
      return cachedUrl;
    }

    const uploadResult = await uploadVideoStudioAsset(file, folder);
    if (!uploadResult.success || !uploadResult.data?.url) {
      throw new Error(uploadResult.error || `Failed to upload ${file.name}`);
    }

    uploadedAssetCacheRef.current.set(cacheKey, uploadResult.data.url);
    return uploadResult.data.url;
  };

  const getAudioDurationFromUrl = async (url: string): Promise<number> => (
    new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.src = url;

      const cleanup = () => {
        audio.onloadedmetadata = null;
        audio.onerror = null;
      };

      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        cleanup();
        resolve(duration);
      };

      audio.onerror = () => {
        cleanup();
        reject(new Error('Failed to read audio duration'));
      };
    })
  );

  const fetchFileFromUrl = async (url: string, fileName: string): Promise<File> => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download rendered video (${response.status})`);
    }

    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type || 'video/mp4' });
  };

  const waitForShotstackRender = async (
    renderId: string,
    setProgress: React.Dispatch<React.SetStateAction<number>>
  ): Promise<string | undefined> => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const status = await getRenderStatus(renderId);
      setProgress(status.progress);

      if (status.status === 'failed') {
        throw new Error('Shotstack render failed');
      }

      if ((status.status === 'done' || status.status === 'completed') && status.url) {
        setProgress(100);
        return status.url;
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error('Shotstack render timed out');
  };

  // Load saved templates from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('screndly_saved_caption_templates');
    if (saved) {
      try {
        setSavedTemplates(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved templates:', e);
      }
    }
  }, []);

  // Cleanup FFmpeg loading on unmount
  useEffect(() => {
    return () => {
      // Cancel any ongoing FFmpeg.wasm download when component unmounts
      import('../utils/ffmpeg').then(({ cancelFFmpegLoad }) => {
        cancelFFmpegLoad();
      }).catch(() => {
        // FFmpeg module not loaded yet, nothing to cancel
      });
    };
  }, []);

  // Close rename menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showRenameMenu) {
        setShowRenameMenu(null);
      }
    };

    if (showRenameMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showRenameMenu]);

  // Video playback simulation for Review module
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (reviewIsPlaying && reviewVideoTime < reviewVideoDuration) {
      interval = setInterval(() => {
        setReviewVideoTime(prev => {
          const newTime = prev + 1;
          if (newTime >= reviewVideoDuration) {
            setReviewIsPlaying(false);
            return reviewVideoDuration;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [reviewIsPlaying, reviewVideoTime, reviewVideoDuration]);

  // Video playback simulation for Monthly module
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (monthlyIsPlaying && monthlyVideoTime < monthlyVideoDuration) {
      interval = setInterval(() => {
        setMonthlyVideoTime(prev => {
          const newTime = prev + 1;
          if (newTime >= monthlyVideoDuration) {
            setMonthlyIsPlaying(false);
            return monthlyVideoDuration;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [monthlyIsPlaying, monthlyVideoTime, monthlyVideoDuration]);

  // Prevent auto-focus on mount (mobile keyboard prevention)
  useEffect(() => {
    // Blur any focused element to prevent keyboard from appearing on page load
    const blurActiveElement = () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };

    // Immediate blur
    blurActiveElement();

    // Delayed blur to catch late auto-focus by browser
    const timer1 = setTimeout(blurActiveElement, 0);
    const timer2 = setTimeout(blurActiveElement, 50);
    const timer3 = setTimeout(blurActiveElement, 100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup blob URLs on unmount to prevent memory leaks
      if (reviewVoiceover?.url) {
        URL.revokeObjectURL(reviewVoiceover.url);
      }
      if (monthlyVoiceover?.url) {
        URL.revokeObjectURL(monthlyVoiceover.url);
      }
      if (reviewMusic?.url) {
        URL.revokeObjectURL(reviewMusic.url);
      }
      if (monthlyMusic?.url) {
        URL.revokeObjectURL(monthlyMusic.url);
      }
    };
  }, [reviewVoiceover, monthlyVoiceover, reviewMusic, monthlyMusic]);

  // Helper function to format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const analyzeVoiceoverForTitles = async (file: File, module: 'review' | 'monthly'): Promise<Array<{
    title: string;
    releaseDate?: string;
    timestamp: string;
    confidence: number;
    context: string;
  }>> => {
    console.warn('[VideoStudio] Voiceover title extraction is not implemented yet for uploaded audio.', {
      fileName: file.name,
      module,
    });
    return [];
  };

  // Auto-assign detected titles to uploaded videos
  const autoAssignTitles = (
    detectedTitles: Array<{ title: string; releaseDate?: string; timestamp: string }>,
    module: 'review' | 'monthly'
  ) => {
    const assignments: { [key: number]: { title: string; tmdbId?: number; year?: string; type?: 'movie' | 'tv'; autoDetected: boolean; voiceoverTimestamp?: string; releaseDate?: string } } = {};

    // Assign titles to videos in chronological order (by voiceover mention)
    detectedTitles.forEach((titleData, index) => {
      assignments[index] = {
        title: titleData.title,
        releaseDate: titleData.releaseDate,
        voiceoverTimestamp: titleData.timestamp,
        autoDetected: true,
        type: 'movie' // Could be enhanced with TMDb lookup
      };
    });

    if (module === 'review') {
      setReviewVideoTitles(assignments);
      setReviewShowAutoAssign(false);
    } else {
      setMonthlyVideoTitles(assignments);
      setMonthlyShowAutoAssign(false);
    }

    haptics.success();
  };

  // Handle voiceover upload with analysis
  const handleVoiceoverUpload = async (file: File, module: 'review' | 'monthly') => {
    // Prevent multiple simultaneous uploads
    if ((module === 'review' && reviewIsAnalyzing) || (module === 'monthly' && monthlyIsAnalyzing)) {
      toast.error('Please wait for the current upload to finish.');
      return;
    }

    // Stricter file size limit for mobile devices (20MB for mobile, 50MB for desktop)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const maxSize = isMobile ? 20 * 1024 * 1024 : 50 * 1024 * 1024; // 20MB mobile / 50MB desktop

    if (file.size > maxSize) {
      const maxSizeMB = isMobile ? '20MB' : '50MB';
      toast.error(`Audio file is too large. Please upload a file smaller than ${maxSizeMB}.`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      toast.error('Please upload a valid audio file.');
      return;
    }

    // Warn for large files on mobile (over 5MB)
    const warnSize = 5 * 1024 * 1024; // 5MB
    if (file.size > warnSize && isMobile) {
      toast('Processing audio file. This may take a moment...', {
        duration: 3000,
      });
    }

    // Set analyzing state first
    if (module === 'review') {
      setReviewIsAnalyzing(true);
    } else {
      setMonthlyIsAnalyzing(true);
    }

    // Create blob URL for memory-efficient file handling
    let blobUrl: string | null = null;

    try {
      if (module === 'review') {
        if (!isMountedRef.current) return;

        // Clean up previous blob URL if exists
        if (reviewVoiceover?.url) {
          URL.revokeObjectURL(reviewVoiceover.url);
        }

        try {
          blobUrl = URL.createObjectURL(file);
          const [detectedTitles, uploadedUrl, durationSeconds] = await Promise.all([
            analyzeVoiceoverForTitles(file, 'review'),
            ensureVideoStudioAssetUploaded(file, 'voiceovers'),
            getAudioDurationFromUrl(blobUrl),
          ]);

          // Check if component is still mounted before updating state
          if (!isMountedRef.current) {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            return;
          }

          setReviewVoiceover({
            name: file.name,
            size: file.size,
            url: blobUrl,
            uploadedUrl,
            originalFile: file,
            contentType: file.type,
            durationSeconds,
          });
          setReviewDetectedTitles(detectedTitles);

          // Show auto-assign dialog if we have videos uploaded
          if (reviewVideoFiles.length > 0) {
            setReviewShowAutoAssign(true);
          }

          toast.success(`Voice-over uploaded and ${detectedTitles.length} titles detected`);
          haptics.success();
        } catch (error) {
          console.error('Error analyzing voiceover:', error);
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          if (!isMountedRef.current) return;
          toast.error('Failed to analyze voiceover. Please try again.');
          haptics.error();
        } finally {
          if (isMountedRef.current) {
            setReviewIsAnalyzing(false);
          }
        }
      } else {
        if (!isMountedRef.current) return;

        // Clean up previous blob URL if exists
        if (monthlyVoiceover?.url) {
          URL.revokeObjectURL(monthlyVoiceover.url);
        }

        try {
          blobUrl = URL.createObjectURL(file);
          const [detectedTitles, uploadedUrl, durationSeconds] = await Promise.all([
            analyzeVoiceoverForTitles(file, 'monthly'),
            ensureVideoStudioAssetUploaded(file, 'voiceovers'),
            getAudioDurationFromUrl(blobUrl),
          ]);

          // Check if component is still mounted before updating state
          if (!isMountedRef.current) {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            return;
          }

          setMonthlyVoiceover({
            name: file.name,
            size: file.size,
            url: blobUrl,
            uploadedUrl,
            originalFile: file,
            contentType: file.type,
            durationSeconds,
          });
          setMonthlyDetectedTitles(detectedTitles);

          // Show auto-assign dialog if we have videos uploaded
          if (monthlyVideoFiles.length > 0) {
            setMonthlyShowAutoAssign(true);
          }

          toast.success(`Voice-over uploaded and ${detectedTitles.length} titles detected`);
          haptics.success();
        } catch (error) {
          console.error('Error analyzing voiceover:', error);
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          if (!isMountedRef.current) return;
          toast.error('Failed to analyze voiceover. Please try again.');
          haptics.error();
        } finally {
          if (isMountedRef.current) {
            setMonthlyIsAnalyzing(false);
          }
        }
      }
    } catch (error) {
      console.error('Error handling voiceover upload:', error);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (isMountedRef.current) {
        toast.error('An unexpected error occurred. Please try again.');
        // Reset analyzing state on error
        if (module === 'review') {
          setReviewIsAnalyzing(false);
        } else {
          setMonthlyIsAnalyzing(false);
        }
        haptics.error();
      }
    }
  };

  // Handle music upload with memory-efficient blob URL approach
  const handleMusicUpload = async (file: File | null, module: 'review' | 'monthly') => {
    try {
      if (!file) {
        // Clear music if no file
        if (module === 'review') {
          if (reviewMusic?.url) {
            URL.revokeObjectURL(reviewMusic.url);
          }
          setReviewMusic(null);
          if (reviewMusicInputRef.current) {
            reviewMusicInputRef.current.value = '';
          }
        } else {
          if (monthlyMusic?.url) {
            URL.revokeObjectURL(monthlyMusic.url);
          }
          setMonthlyMusic(null);
          if (monthlyMusicInputRef.current) {
            monthlyMusicInputRef.current.value = '';
          }
        }
        return;
      }

      // Stricter file size limit for mobile devices (20MB for mobile, 50MB for desktop)
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const maxSize = isMobile ? 20 * 1024 * 1024 : 50 * 1024 * 1024; // 20MB mobile / 50MB desktop

      if (file.size > maxSize) {
        const maxSizeMB = isMobile ? '20MB' : '50MB';
        toast.error(`Music file is too large. Please upload a file smaller than ${maxSizeMB}.`);
        // Reset the file input
        if (module === 'review' && reviewMusicInputRef.current) {
          reviewMusicInputRef.current.value = '';
        } else if (module === 'monthly' && monthlyMusicInputRef.current) {
          monthlyMusicInputRef.current.value = '';
        }
        return;
      }

      // Validate file type
      if (!file.type.startsWith('audio/')) {
        toast.error('Please upload a valid audio file.');
        // Reset the file input
        if (module === 'review' && reviewMusicInputRef.current) {
          reviewMusicInputRef.current.value = '';
        } else if (module === 'monthly' && monthlyMusicInputRef.current) {
          monthlyMusicInputRef.current.value = '';
        }
        return;
      }

      // Warn for large files on mobile (over 5MB)
      const warnSize = 5 * 1024 * 1024; // 5MB
      if (file.size > warnSize && isMobile) {
        toast('Processing music file. This may take a moment...', {
          duration: 3000,
        });
      }

      // Clean up previous blob URL if exists and create new one
      if (module === 'review') {
        if (reviewMusic?.url) {
          URL.revokeObjectURL(reviewMusic.url);
        }

        const blobUrl = URL.createObjectURL(file);
        const uploadedUrl = await ensureVideoStudioAssetUploaded(file, 'music');

        setReviewMusic({
          name: file.name,
          size: file.size,
          url: blobUrl,
          uploadedUrl,
          originalFile: file,
          contentType: file.type,
        });

        // Reset the file input to prevent holding reference
        if (reviewMusicInputRef.current) {
          reviewMusicInputRef.current.value = '';
        }

        toast.success('Music uploaded successfully');
        haptics.success();
      } else {
        if (monthlyMusic?.url) {
          URL.revokeObjectURL(monthlyMusic.url);
        }

        const blobUrl = URL.createObjectURL(file);
        const uploadedUrl = await ensureVideoStudioAssetUploaded(file, 'music');

        setMonthlyMusic({
          name: file.name,
          size: file.size,
          url: blobUrl,
          uploadedUrl,
          originalFile: file,
          contentType: file.type,
        });

        // Reset the file input to prevent holding reference
        if (monthlyMusicInputRef.current) {
          monthlyMusicInputRef.current.value = '';
        }

        toast.success('Music uploaded successfully');
        haptics.success();
      }
    } catch (error) {
      console.error('Error uploading music:', error);
      toast.error('Failed to upload music. Please try again.');
      haptics.error();
      // Reset the file input on error
      if (module === 'review' && reviewMusicInputRef.current) {
        reviewMusicInputRef.current.value = '';
      } else if (module === 'monthly' && monthlyMusicInputRef.current) {
        monthlyMusicInputRef.current.value = '';
      }
    }
  };

  // Handle video download
  const handleDownloadVideo = async (module: 'review' | 'monthly') => {
    haptics.light();
    const outputUrl = module === 'review' ? reviewRenderOutputUrl : monthlyRenderOutputUrl;
    if (!outputUrl) {
      toast.error('No rendered video is available to download yet.');
      return;
    }

    const filename = module === 'review' ? 'video-preview.mp4' : 'video-compilation.mp4';

    try {
      const downloadedFile = await fetchFileFromUrl(outputUrl, filename);
      const url = URL.createObjectURL(downloadedFile);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download the rendered video.', {
        description: error instanceof Error ? error.message : 'Unknown download error',
      });
      haptics.error();
    }
  };

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>, module: 'review' | 'monthly') => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;

    if (module === 'review') {
      const newTime = Math.floor(percentage * reviewVideoDuration);
      setReviewVideoTime(newTime);
    } else {
      const newTime = Math.floor(percentage * monthlyVideoDuration);
      setMonthlyVideoTime(newTime);
    }
    haptics.light();
  };

  // Handle fullscreen toggle
  const handleFullscreen = (module: 'review' | 'monthly') => {
    haptics.light();
    if (module === 'review') {
      setReviewIsFullscreen(!reviewIsFullscreen);
    } else {
      setMonthlyIsFullscreen(!monthlyIsFullscreen);
    }
  };

  // Generate caption using Video Studio Caption Generator utility
  const generateCaption = async (module: 'review' | 'monthly' | 'scenes') => {
    setIsGeneratingCaption(true);
    haptics.light();

    try {
      // Map module to content type
      const contentTypeMap: Record<'review' | 'monthly' | 'scenes', VideoContentType> = {
        'review': 'review',
        'monthly': 'releases',
        'scenes': 'scenes'
      };

      const contentType = contentTypeMap[module];
      const activePlatforms = Object.entries(selectedPlatforms)
        .filter(([, isSelected]) => isSelected)
        .map(([platform]) => platform);

      // Build content context based on module
      let content: VideoContent = {
        contentType,
        platforms: activePlatforms,
      };

      if (module === 'scenes') {
        // Calculate duration for scenes
        const { getClipDuration } = await loadFFmpegUtils();
        const duration = getClipDuration(scenesStartTime, scenesEndTime);

        content = {
          ...content,
          movieTitle: scenesMovieTitle,
          startTime: scenesStartTime,
          endTime: scenesEndTime,
          duration,
          transcript: '',
          description: scenesMovieTitle ? `Scene-based clip from ${scenesMovieTitle}` : 'Scene-based clip',
        };
      } else if (module === 'review') {
        // For review module, use voiceover transcript if available
        content = {
          ...content,
          transcript: reviewVoiceover ? 'Review voiceover content' : undefined,
          movieTitle: Object.values(reviewVideoTitles).map(t => t.title).join(', '),
          description: 'Review-driven video content',
        };
      } else {
        // For monthly/releases module
        content = {
          ...content,
          transcript: monthlyVoiceover ? 'Monthly releases voiceover content' : undefined,
          movieTitle: Object.values(monthlyVideoTitles).map(t => t.title).join(', '),
          description: 'Monthly releases roundup',
        };
      }

      // Use the utility to generate caption with settings from Video Studio Settings
      const result = await generateVideoStudioCaption(content);

      setGeneratedCaption(result.caption);
      toast.success(`Caption generated (${result.charCount} characters)`);
      haptics.success();
    } catch (error) {
      toast.error('Failed to generate caption. Please try again.');
      setGeneratedCaption('');
      haptics.error();
    } finally {
      setIsGeneratingCaption(false);
    }
  };



  const handleSaveCaptionTemplate = () => {
    haptics.medium();
    // Open naming dialog
    setTemplateName('');
    setIsRenaming(false);
    setShowNameDialog(true);
  };

  const saveTemplateWithName = () => {
    if (!templateName.trim()) return;

    // Check for duplicate names
    if (savedTemplates.some(t => t.name === templateName.trim())) {
      alert('A template with this name already exists. Please choose a different name.');
      return;
    }

    haptics.medium();
    const timestamp = new Date().toLocaleString();

    const templateData = {
      name: templateName.trim(),
      fontFamily: captionFontFamily,
      fontSize: captionFontSize,
      fontWeight: captionFontWeight,
      textColor: captionTextColor,
      bgColor: captionBgColor,
      bgOpacity: captionBgOpacity,
      position: captionPosition,
      alignment: captionAlignment,
      strokeColor: captionStrokeColor,
      strokeWidth: captionStrokeWidth,
      shadow: captionShadow,
      borderRadius: captionBorderRadius,
      animation: captionAnimation,
      wordsPerLine: captionWordsPerLine,
      savedAt: timestamp,
    };

    // Save to localStorage
    const updatedTemplates = [...savedTemplates, templateData];
    setSavedTemplates(updatedTemplates);
    localStorage.setItem('screndly_saved_caption_templates', JSON.stringify(updatedTemplates));

    setShowNameDialog(false);
    setTemplateName('');
    setShowSaveSuccess(true);

    // Hide success message after 2 seconds
    setTimeout(() => {
      setShowSaveSuccess(false);
    }, 2000);
  };

  const loadSavedTemplate = (template: any) => {
    haptics.light();
    setCaptionTemplate(template.name);
    setCaptionFontFamily(template.fontFamily);
    setCaptionFontSize(template.fontSize);
    setCaptionFontWeight(template.fontWeight);
    setCaptionTextColor(template.textColor);
    setCaptionBgColor(template.bgColor);
    setCaptionBgOpacity(template.bgOpacity);
    setCaptionPosition(template.position);
    setCaptionAlignment(template.alignment);
    setCaptionStrokeColor(template.strokeColor);
    setCaptionStrokeWidth(template.strokeWidth);
    setCaptionShadow(template.shadow);
    setCaptionBorderRadius(template.borderRadius || 8);
    setCaptionAnimation(template.animation);
    setCaptionWordsPerLine(template.wordsPerLine);

    // Mark prompt as outdated since caption settings changed
    if (isPromptGenerated) {
      setPromptStatus('outdated');
    }
  };

  const deleteSavedTemplate = (templateName: string) => {
    haptics.medium();
    const updatedTemplates = savedTemplates.filter(t => t.name !== templateName);
    setSavedTemplates(updatedTemplates);
    localStorage.setItem('screndly_saved_caption_templates', JSON.stringify(updatedTemplates));
  };

  const handleRenameTemplate = (oldName: string) => {
    const template = savedTemplates.find(t => t.name === oldName);
    if (template) {
      setTemplateName(oldName);
      setRenamingTemplate(oldName);
      setIsRenaming(true);
      setShowNameDialog(true);
      setShowRenameMenu(null);
    }
  };

  const renameTemplate = () => {
    if (!templateName.trim() || !renamingTemplate) return;

    // Check for duplicate names (excluding the current template being renamed)
    if (savedTemplates.some(t => t.name === templateName.trim() && t.name !== renamingTemplate)) {
      alert('A template with this name already exists. Please choose a different name.');
      return;
    }

    haptics.medium();
    const updatedTemplates = savedTemplates.map(t =>
      t.name === renamingTemplate
        ? { ...t, name: templateName.trim() }
        : t
    );
    setSavedTemplates(updatedTemplates);
    localStorage.setItem('screndly_saved_caption_templates', JSON.stringify(updatedTemplates));

    setShowNameDialog(false);
    setTemplateName('');
    setRenamingTemplate(null);
    setIsRenaming(false);
  };

  // Analyze trailer with Google Video Intelligence
  const handleAnalyzeTrailer = async (module: 'review' | 'monthly') => {
    const videoFiles = module === 'review' ? reviewVideoFiles : monthlyVideoFiles;

    if (videoFiles.length === 0) {
      // No trailer video to analyze
      return;
    }

    try {
      if (module === 'review') {
        setReviewIsAnalyzingTrailer(true);
        haptics.light();

        // Analyze single trailer for review module
        const analysis = await analyzeTrailer(videoFiles[0]);
        setReviewTrailerAnalysis(analysis);

        haptics.success();
      } else {
        // Monthly module - analyze multiple trailers
        setMonthlyIsAnalyzingTrailer(true);
        haptics.light();

        const movieTitles = Object.values(monthlyVideoTitles).map(t => t.title);
        const analyses = await analyzeMultipleTrailers(videoFiles, movieTitles);
        setMonthlyTrailerAnalyses(analyses);

        haptics.success();
      }
    } catch (error) {
      console.error('Error analyzing trailer:', error);
      haptics.error();
    } finally {
      if (module === 'review') {
        setReviewIsAnalyzingTrailer(false);
      } else {
        setMonthlyIsAnalyzingTrailer(false);
      }
    }
  };

  const handleGenerateReviewVideo = async () => {
    haptics.medium();
    setReviewIsGenerating(true);
    setReviewProgress(5);
    setReviewRenderOutputUrl('');

    try {
      if (reviewVideoFiles.length === 0) {
        throw new Error('Upload at least one trailer video before generating.');
      }

      const analysis = reviewTrailerAnalysis || await analyzeTrailer(reviewVideoFiles[0]);
      if (!reviewTrailerAnalysis) {
        setReviewTrailerAnalysis(analysis);
      }

      const [trailerVideoUrl, voiceoverUrl, backgroundMusicUrl] = await Promise.all([
        ensureVideoStudioAssetUploaded(reviewVideoFiles[0], 'trailers'),
        reviewVoiceover?.uploadedUrl
          ? Promise.resolve(reviewVoiceover.uploadedUrl)
          : reviewVoiceover?.originalFile
            ? ensureVideoStudioAssetUploaded(reviewVoiceover.originalFile, 'voiceovers')
            : Promise.resolve(undefined),
        reviewMusic?.uploadedUrl
          ? Promise.resolve(reviewMusic.uploadedUrl)
          : reviewMusic?.originalFile
            ? ensureVideoStudioAssetUploaded(reviewMusic.originalFile, 'music')
            : Promise.resolve(undefined),
      ]);

      const reviewData = {
        movieTitle: reviewVideoTitles[0]?.title || 'Movie Review',
        trailerVideoUrl,
        voiceoverUrl,
        voiceoverDuration: reviewVoiceover?.durationSeconds,
        backgroundMusicUrl,
        aspectRatio: reviewAspectRatio,
        removeLetterbox: reviewRemoveLetterbox,
        enableAutoframing: reviewEnableAutoframing,
        selectedScenes: [customOpeningHook, customMidVideoHook, customEndingHook]
          .filter((scene): scene is VideoMoment => !!scene)
          .map(scene => ({
            startTime: scene.startTime,
            duration: scene.duration,
          })),
      };

      const audioSettings = {
        enableTrailerAudioHooks,
        hookPlacements,
        hookDuration,
        trailerVolume: trailerAudioVolume,
        crossfadeDuration,
        audioVariety,
        backgroundMusicVolume: 85
      };

      const shotstackConfig = generateShotstackJSON(
        reviewData,
        analysis,
        audioSettings
      );

      const renderResult = await renderVideo(shotstackConfig);
      setReviewRenderId(renderResult.id);
      setReviewProgress(20);

      const outputUrl = await waitForShotstackRender(renderResult.id, setReviewProgress);
      setReviewRenderOutputUrl(outputUrl || '');
      setReviewIsGenerating(false);

      addVideoStudioActivity({
        type: 'review',
        title: reviewVideoTitles[0]?.title || 'Movie Review',
        status: 'completed',
        timestamp: new Date().toISOString(),
        aspectRatio: reviewAspectRatio,
        duration: reviewVoiceover?.durationSeconds
          ? formatTime(Math.round(reviewVoiceover.durationSeconds))
          : '1:00',
        downloads: 0,
        published: false,
        platforms: []
      });

      toast.success('Review video render completed.');
      haptics.success();
    } catch (error) {
      console.error('Error generating video:', error);
      setReviewProgress(0);
      setReviewIsGenerating(false);
      toast.error('Failed to generate the review video.', {
        description: error instanceof Error ? error.message : 'Unknown render error',
      });
      haptics.error();
    }
  };

  const handleGenerateMonthlyVideo = async () => {
    haptics.medium();
    setMonthlyIsGenerating(true);
    setMonthlyProgress(5);
    setMonthlyRenderOutputUrl('');

    try {
      if (monthlyVideoFiles.length === 0) {
        throw new Error('Upload at least one trailer video before generating.');
      }

      if (!monthlyVoiceover?.durationSeconds) {
        throw new Error('Upload a monthly voice-over before generating the compilation.');
      }

      const movieTitles = monthlyVideoFiles.map((_, index) => monthlyVideoTitles[index]?.title || `Movie ${index + 1}`);
      const analyses = monthlyTrailerAnalyses.length > 0
        ? monthlyTrailerAnalyses
        : await analyzeMultipleTrailers(monthlyVideoFiles, movieTitles);

      if (monthlyTrailerAnalyses.length === 0) {
        setMonthlyTrailerAnalyses(analyses);
      }

      const [trailerVideoUrls, voiceoverUrl, backgroundMusicUrl] = await Promise.all([
        Promise.all(monthlyVideoFiles.map(file => ensureVideoStudioAssetUploaded(file, 'trailers'))),
        monthlyVoiceover.uploadedUrl
          ? Promise.resolve(monthlyVoiceover.uploadedUrl)
          : monthlyVoiceover.originalFile
            ? ensureVideoStudioAssetUploaded(monthlyVoiceover.originalFile, 'voiceovers')
            : Promise.resolve(undefined),
        monthlyMusic?.uploadedUrl
          ? Promise.resolve(monthlyMusic.uploadedUrl)
          : monthlyMusic?.originalFile
            ? ensureVideoStudioAssetUploaded(monthlyMusic.originalFile, 'music')
            : Promise.resolve(undefined),
      ]);

      if (!voiceoverUrl) {
        throw new Error('Monthly voice-over upload is required for compilation rendering.');
      }

      const compilationConfig = {
        trailers: monthlyVideoFiles.map((file, i) => ({
          title: movieTitles[i],
          videoUrl: trailerVideoUrls[i],
          file
        })),
        voiceoverUrl,
        voiceoverDuration: monthlyVoiceover.durationSeconds,
        backgroundMusicUrl,
        aspectRatio: monthlyAspectRatio,
        removeLetterbox: monthlyRemoveLetterbox,
        enableAutoframing: monthlyEnableAutoframing
      };

      const shotstackConfig = generateMonthlyCompilationJSON(
        compilationConfig,
        analyses,
        {
          backgroundMusicVolume: 85,
          trailerVolume: trailerAudioVolume,
          crossfadeDuration
        }
      );

      const renderResult = await renderVideo(shotstackConfig);
      setMonthlyRenderId(renderResult.id);
      setMonthlyProgress(20);

      const outputUrl = await waitForShotstackRender(renderResult.id, setMonthlyProgress);
      setMonthlyRenderOutputUrl(outputUrl || '');
      setMonthlyIsGenerating(false);

      addVideoStudioActivity({
        type: 'monthly',
        title: `Monthly Releases - ${movieTitles.join(', ')}`,
        status: 'completed',
        timestamp: new Date().toISOString(),
        aspectRatio: monthlyAspectRatio,
        duration: formatTime(Math.round(monthlyVoiceover.durationSeconds)),
        downloads: 0,
        published: false,
        platforms: []
      });

      toast.success('Monthly compilation render completed.');
      haptics.success();
    } catch (error) {
      console.error('Error generating monthly video:', error);
      setMonthlyProgress(0);
      setMonthlyIsGenerating(false);
      toast.error('Failed to generate the monthly compilation.', {
        description: error instanceof Error ? error.message : 'Unknown render error',
      });
      haptics.error();
    }
  };

  const handlePublishVideo = async () => {
    haptics.medium();

    // Determine current video title based on module
    let videoTitle = 'Video Studio Project';
    if (activeModule === 'review') {
      videoTitle = reviewVideoTitles[0]?.title || 'Movie Review';
    } else if (activeModule === 'monthly') {
      videoTitle = `Monthly Releases - ${Object.values(monthlyVideoTitles).map(t => t.title).join(', ')}`;
    } else if (activeModule === 'scenes') {
      videoTitle = scenesMovieTitle || 'Movie Scene';
    }

    // Identify media file to upload
    let mediaFile: File | undefined;
    try {
      if (activeModule === 'review') {
        if (reviewRenderOutputUrl) {
          mediaFile = await fetchFileFromUrl(reviewRenderOutputUrl, `${videoTitle.replace(/\s+/g, '_')}_review.mp4`);
        } else if (reviewVideoFiles.length > 0) {
          mediaFile = reviewVideoFiles[0];
        }
      } else if (activeModule === 'monthly') {
        if (monthlyRenderOutputUrl) {
          mediaFile = await fetchFileFromUrl(monthlyRenderOutputUrl, `${videoTitle.replace(/\s+/g, '_')}_monthly.mp4`);
        } else if (monthlyVideoFiles.length > 0) {
          mediaFile = monthlyVideoFiles[0];
        }
      } else if (activeModule === 'scenes') {
        if (scenesOutputBlob) {
          mediaFile = new File([scenesOutputBlob], `${videoTitle.replace(/\s+/g, '_')}_scene.mp4`, { type: 'video/mp4' });
        } else if (scenesVideoFile) {
          mediaFile = scenesVideoFile;
        }
      }
    } catch (error) {
      toast.error('Failed to prepare the rendered video for publishing.', {
        description: error instanceof Error ? error.message : 'Unknown file preparation error',
      });
      haptics.error();
      return;
    }

    // Show loading toast with ID for updates
    const toastId = toast.loading('Publishing video...', {
      description: 'Uploading and processing...'
    });

    // Optimistic Update: Close immediately
    setIsPublishDialogOpen(false);
    setGeneratedCaption('');
    setCaptionEditMode(false);

    // Perform publish in background
    publishContent(
      selectedPlatforms,
      {
        text: generatedCaption,
        title: videoTitle,
        pinterestBoardId: selectedPlatforms.pinterest ? (settings as any).videoStudioDefaultPinterestBoard : undefined,
      },
      mediaFile
    ).then(result => {

      if (result.success) {
        toast.success('Published successfully!', {
          id: toastId,
          description: `Posted to ${result.data?.summary.posted} platforms.`
        });

        // Add recent activity
        addRecentActivity({
          title: videoTitle,
          platform: Object.entries(selectedPlatforms).filter(([_, v]) => v).map(([k]) => k).join(', '), // simplified
          status: 'success',
          type: 'videostudio'
        });

        // Add log entry
        addLogEntry({
          videoTitle,
          platform: Object.entries(selectedPlatforms).filter(([_, v]) => v).map(([k]) => k).join(', '),
          status: 'success',
          type: 'videostudio'
        });
      } else {
        toast.error('Publishing failed', {
          id: toastId,
          description: result.error?.message || 'Unknown error'
        });

        // Log failure
        addLogEntry({
          videoTitle,
          platform: Object.entries(selectedPlatforms).filter(([_, v]) => v).map(([k]) => k).join(', '),
          status: 'failed',
          type: 'videostudio',
          error: result.error?.message
        });
      }
    }).catch((error: any) => {
      toast.error('Publishing error', {
        id: toastId,
        description: error.message
      });
    });
  };


  const handleRegenerateJSON = () => {
    haptics.light();
    setIsPromptGenerated(true);
    setIsPromptPanelOpen(true);
    setPromptStatus('ready');

    // Build caption configuration object
    const captionConfig = {
      template: captionTemplate,
      font_family: captionFontFamily,
      font_size: captionFontSize,
      font_weight: captionFontWeight,
      text_color: captionTextColor,
      bg_color: captionBgColor,
      bg_opacity: captionBgOpacity,
      position: captionPosition,
      alignment: captionAlignment,
      stroke_color: captionStrokeColor,
      stroke_width: captionStrokeWidth,
      shadow: captionShadow,
      border_radius: captionBorderRadius,
      animation: captionAnimation,
      words_per_line: captionWordsPerLine
    };

    // Build audio choreography segments (with AI-selected scenes if available)
    const analysis = activeModule === 'review'
      ? reviewTrailerAnalysis
      : (monthlyTrailerAnalyses.length > 0 ? monthlyTrailerAnalyses[0].analysis : null);
    const audioSegments = [];

    if (enableTrailerAudioHooks) {
      if (hookPlacements.includes('opening')) {
        const openingScene = analysis?.suggestedHooks.opening;
        audioSegments.push({
          type: 'trailer_audio',
          placement: 'opening',
          startTime: 0,
          duration: effectiveHookDuration,
          scene: openingScene?.type || 'opening_action_hook',
          sceneTimestamp: openingScene?.startTime,
          sceneLabels: openingScene?.labels,
          fadeOut: crossfadeDuration,
          volume: trailerAudioVolume,
          description: openingScene?.reason || 'Opening hook with trailer original audio (dialogue/voice)'
        });
        audioSegments.push({
          type: 'voiceover_with_music',
          startTime: effectiveHookDuration,
          duration: 12,
          fadeIn: crossfadeDuration,
          description: 'Main voiceover section with background music'
        });
      }

      if (hookPlacements.includes('mid-video')) {
        const midStart = effectiveHookDuration + 12;
        const midScene = analysis?.suggestedHooks.midVideo;
        audioSegments.push({
          type: 'trailer_audio',
          placement: 'mid-video',
          startTime: midStart,
          duration: effectiveHookDuration,
          scene: midScene?.type || 'dramatic_moment',
          sceneTimestamp: midScene?.startTime,
          sceneLabels: midScene?.labels,
          fadeOut: crossfadeDuration,
          volume: trailerAudioVolume,
          description: midScene?.reason || 'Mid-video hook before rating reveal'
        });
        audioSegments.push({
          type: 'voiceover_with_music',
          startTime: midStart + effectiveHookDuration,
          duration: 8,
          fadeIn: crossfadeDuration,
          includeRating: true,
          description: 'Voiceover continues with rating number'
        });
      }

      if (hookPlacements.includes('ending')) {
        const endStart = effectiveHookDuration + 12 + effectiveHookDuration + 8;
        const endingScene = analysis?.suggestedHooks.ending;
        audioSegments.push({
          type: 'trailer_audio',
          placement: 'ending',
          startTime: endStart,
          duration: effectiveHookDuration,
          scene: endingScene?.type || 'closing_scene',
          sceneTimestamp: endingScene?.startTime,
          sceneLabels: endingScene?.labels,
          fadeOut: 0.3,
          volume: trailerAudioVolume,
          description: endingScene?.reason || 'Ending hook to close the video'
        });
      }
    } else {
      // Standard voiceover with music throughout
      audioSegments.push({
        type: 'voiceover_with_music',
        startTime: 0,
        duration: 30,
        description: 'Continuous voiceover with background music'
      });
    }

    setJsonData({
      voice_over_segments: [
        { start: 0, end: 3.5, text: "This holiday season..." },
        { start: 8.2, end: 12.1, text: "Experience the magic..." }
      ],
      trailer_dialog_segments: [
        { start: 4.0, end: 7.8, text: "Character dialogue detected" }
      ],
      audio_choreography: {
        enabled: enableTrailerAudioHooks,
        variety: audioVariety,
        hook_placements: hookPlacements,
        segments: audioSegments,
        trailer_audio_volume: trailerAudioVolume,
        crossfade_duration: crossfadeDuration,
        hook_duration: effectiveHookDuration,
        ai_analysis: analysis ? {
          total_scenes_detected: analysis.moments.length,
          total_duration: analysis.totalDuration,
          selected_hooks: {
            opening: {
              timestamp: analysis.suggestedHooks.opening.startTime,
              type: analysis.suggestedHooks.opening.type,
              labels: analysis.suggestedHooks.opening.labels
            },
            midVideo: {
              timestamp: analysis.suggestedHooks.midVideo.startTime,
              type: analysis.suggestedHooks.midVideo.type,
              labels: analysis.suggestedHooks.midVideo.labels
            },
            ending: {
              timestamp: analysis.suggestedHooks.ending.startTime,
              type: analysis.suggestedHooks.ending.type,
              labels: analysis.suggestedHooks.ending.labels
            }
          }
        } : null
      },
      audio_dynamics: {
        auto_ducking: enableAutoDucking,
        mode: duckingMode,
        duck_level_db: duckLevel,
        attack_ms: attackMs,
        release_ms: releaseMs
      },
      music_genre: activeModule === 'review' ? reviewMusicGenre : monthlyMusicGenre,
      caption_style: captionConfig,
      aspect_ratio: activeModule === 'review' ? reviewAspectRatio : monthlyAspectRatio,
      video_length: activeModule === 'review' ? reviewVideoLength : monthlyVideoLength
    });

    let trailerHooksText = '';
    if (enableTrailerAudioHooks) {
      if (analysis) {
        // With AI analysis - use custom hooks if available
        const opening = customOpeningHook || analysis.suggestedHooks.opening;
        const mid = customMidVideoHook || analysis.suggestedHooks.midVideo;
        const ending = customEndingHook || analysis.suggestedHooks.ending;
        const customNote = (customOpeningHook || customMidVideoHook || customEndingHook) ? ' (custom selected)' : '';
        trailerHooksText = ` Include AI-selected trailer audio hooks${customNote} at: ${hookPlacements.join(', ')}. Opening hook (${opening.startTime.toFixed(1)}s): ${opening.reason}. Mid-video hook (${mid.startTime.toFixed(1)}s): ${mid.reason}. Ending hook (${ending.startTime.toFixed(1)}s): ${ending.reason}. Each hook lasts ${effectiveHookDuration}s with ${crossfadeDuration}s crossfade. Variety style: ${audioVariety}.`;
      } else {
        // Without AI analysis
        trailerHooksText = ` Include trailer audio hooks (original dialogue/voice) at: ${hookPlacements.join(', ')}. Each hook lasts ${effectiveHookDuration}s with ${crossfadeDuration}s crossfade. Variety style: ${audioVariety}.`;
      }
    }

    setNaturalPrompt(`Create a cinematic ${activeModule === 'review' ? reviewAspectRatio : monthlyAspectRatio} video compilation with dynamic audio mixing.${trailerHooksText} Apply ${duckingMode.toLowerCase()} ducking at ${duckLevel}dB when voiceover is active. Use ${captionTemplate} caption style with ${captionFontFamily} font (${captionFontSize}px, ${captionFontWeight}) positioned at ${captionPosition} with ${captionAnimation} animation. Music genre: ${activeModule === 'review' ? reviewMusicGenre : monthlyMusicGenre}. Total duration: ${activeModule === 'review' ? reviewVideoLength : monthlyVideoLength}.`);
  };

  const copyPromptToClipboard = () => {
    haptics.light();

    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(naturalPrompt).catch((err) => {
        console.error('Clipboard API failed:', err);
        // Fallback to older method
        fallbackCopyToClipboard(naturalPrompt);
      });
    } else {
      // Use fallback for unsupported browsers
      fallbackCopyToClipboard(naturalPrompt);
    }
  };

  const fallbackCopyToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(textArea);
  };

  // Audio Preview Player Functions
  const handleRenderAudioPreview = () => {
    haptics.medium();

    // Stop if already playing
    if (isAudioPreviewPlaying) {
      stopAudioPreview();
      return;
    }

    // Build audio segments based on current configuration
    const analysis = activeModule === 'review'
      ? reviewTrailerAnalysis
      : (monthlyTrailerAnalyses.length > 0 ? monthlyTrailerAnalyses[0].analysis : null);

    const segments: Array<{
      type: 'trailer_audio' | 'voiceover_with_music';
      startTime: number;
      duration: number;
      description: string;
      placement?: string;
    }> = [];

    if (enableTrailerAudioHooks) {
      if (hookPlacements.includes('opening')) {
        const openingScene = analysis?.suggestedHooks.opening;
        segments.push({
          type: 'trailer_audio',
          placement: 'opening',
          startTime: 0,
          duration: effectiveHookDuration,
          description: openingScene?.reason || 'Opening hook with trailer audio'
        });
        segments.push({
          type: 'voiceover_with_music',
          startTime: effectiveHookDuration,
          duration: Math.min(12, 15 - effectiveHookDuration),
          description: 'Voiceover with background music'
        });
      } else {
        segments.push({
          type: 'voiceover_with_music',
          startTime: 0,
          duration: 15,
          description: 'Continuous voiceover with background music'
        });
      }
    } else {
      segments.push({
        type: 'voiceover_with_music',
        startTime: 0,
        duration: 15,
        description: 'Continuous voiceover with background music'
      });
    }

    // Start preview playback
    toast.success('Rendering 15s audio preview...', {
      description: 'Playing audio choreography simulation'
    });

    setIsAudioPreviewPlaying(true);
    setAudioPreviewProgress(0);

    let currentTime = 0;
    const totalDuration = 15; // 15 seconds
    const intervalMs = 50; // Update every 50ms

    audioPreviewTimerRef.current = setInterval(() => {
      currentTime += intervalMs / 1000;

      if (currentTime >= totalDuration) {
        stopAudioPreview();
        toast.success('Preview complete!');
        return;
      }

      const progress = (currentTime / totalDuration) * 100;
      setAudioPreviewProgress(progress);

      // Determine which segment is currently playing
      const currentSegment = segments.find(
        seg => currentTime >= seg.startTime && currentTime < seg.startTime + seg.duration
      );

      if (currentSegment) {
        const label = currentSegment.type === 'trailer_audio'
          ? `Trailer Audio${currentSegment.placement ? ` (${currentSegment.placement})` : ''}`
          : 'Voiceover + Music';
        setAudioPreviewCurrentSegment(label);
      }
    }, intervalMs);
  };

  const stopAudioPreview = () => {
    if (audioPreviewTimerRef.current) {
      clearInterval(audioPreviewTimerRef.current);
      audioPreviewTimerRef.current = null;
    }
    setIsAudioPreviewPlaying(false);
    setAudioPreviewProgress(0);
    setAudioPreviewCurrentSegment(null);
  };

  // Cleanup audio preview on unmount
  useEffect(() => {
    return () => {
      stopAudioPreview();
    };
  }, []);

  // Video Scenes Handlers
  const handleSceneImport = (scenes: Scene[], movieName: string) => {
    haptics.success();

    setImportedScenes(scenes);
    setImportedMovieName(movieName);
    if (!scenesMovieTitle) {
      setScenesMovieTitle(movieName);
    }

    toast.success(`Imported ${scenes.length} scenes`, {
      description: `Movie: ${movieName}`
    });
  };

  const handleScenesVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      haptics.light();
      setScenesVideoFile(file);
      setScenesOriginalRatio('16:9'); // Detect actual ratio in production
      toast.success(`Uploaded: ${file.name}`, {
        description: `Size: ${(file.size / (1024 * 1024)).toFixed(0)}MB`
      });
    }
  };

  const handleAIAssistedQuery = async () => {
    if (!scenesMovieTitle.trim() || !scenesAIQuery.trim()) return;

    haptics.medium();

    const toastId = toast.loading('Analyzing scene request...', {
      description: 'Using AI to identify scene'
    });

    try {
      // Build prompt context from spreadsheet
      let promptContext = '';
      if (importedScenes.length > 0) {
        promptContext = `
CONTEXT FROM IMPORTED SPREADSHEET:
Movie Name: ${importedMovieName || scenesMovieTitle}
Available Scenes Breakdown:
${importedScenes.map((s, i) => `Scene ${i + 1}: "${s.description}" (${s.startTime} - ${s.endTime}) - ${s.details}`).join('\n')}

User is requesting a scene based on this context. If the user's query matches one of these scenes, prefer using its exact timestamps.
`;
      }

      // Check if web search is enabled and perform search
      let webSearchContext = '';
      if (settings.videoStudioWebSearchEnabled) {
        toast.loading('Searching web for additional context...', {
          description: 'Fetching plot details and scene information',
          id: toastId
        });

        try {
          const searchQuery = buildSceneSearchQuery(scenesMovieTitle, scenesAIQuery);
          const searchProvider = settings.videoStudioWebSearchProvider || 'serper';
          const maxResults = settings.videoStudioWebSearchMaxResults || 3;

          // Backend handles API keys from encrypted database
          const searchResult = await performWebSearch(searchQuery, searchProvider, {
            maxResults
          });

          if (searchResult.results.length > 0) {
            webSearchContext = `

WEB SEARCH RESULTS (${searchResult.provider.toUpperCase()}):
${formatSearchResultsForPrompt(searchResult.results)}

Use this information to provide more accurate timestamp estimates.
`;
          }
        } catch (searchError) {
          console.warn('Web search failed, continuing without it:', searchError);
          // Don't fail the whole operation if web search fails
        }
      }

      const prompt = `You are a movie scene expert. Given the movie/TV show title "${scenesMovieTitle}" and the user's scene request "${scenesAIQuery}", provide the approximate timestamp range where this scene occurs.
${promptContext}${webSearchContext}

IMPORTANT: Respond ONLY with a JSON object in this exact format:
{
  "startTime": "HH:MM:SS",
  "endTime": "HH:MM:SS",
  "sceneDescription": "Brief description of the scene"
}

Do not include any other text or explanation. Only return the JSON object.`;

      // Update toast to show AI analysis is starting
      toast.loading('Analyzing scene with AI...', {
        description: webSearchContext ? 'Using web search context' : 'Processing request',
        id: toastId
      });

      const systemPrompt = 'You are a movie scene timestamp expert. You provide precise timestamp ranges for specific scenes in movies and TV shows.';
      const response = await apiClient.post<{ content: string }>('/api/ai/generate', {
        model: scenesAIModel,
        prompt,
        systemPrompt,
        temperature: 0.7,
        maxTokens: 200,
        jsonMode: true,
      });

      if (!response.success || !response.data?.content) {
        throw new Error(response.error?.message || 'AI scene query failed');
      }

      const content = response.data.content.trim();

      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from AI');
      }

      const sceneData = JSON.parse(jsonMatch[0]);

      setScenesStartTime(sceneData.startTime);
      setScenesEndTime(sceneData.endTime);

      haptics.success();
      toast.success('Scene identified!', {
        description: sceneData.sceneDescription || `Found scene at ${sceneData.startTime} - ${sceneData.endTime}`,
        id: toastId
      });

    } catch (error) {
      console.error('AI Scene Query Error:', error);
      haptics.error();

      toast.error('Scene query failed', {
        description: 'No estimated timestamps were applied. Refine the query or set timestamps manually.',
        id: toastId
      });
    }
  };

  const handleCutScene = async () => {
    // Validate inputs
    const hasVideo = scenesVideoSource === 'local' ? scenesVideoFile : scenesVideoUrl;
    if (!hasVideo || !scenesStartTime || !scenesEndTime) {
      toast.error('Missing required fields', {
        description: 'Please select a video and enter timestamps'
      });
      return;
    }

    // Load FFmpeg utilities dynamically
    const { validateTimestamp, getClipDuration, cutVideoSegment } = await loadFFmpegUtils();

    // Validate timestamp format
    if (!validateTimestamp(scenesStartTime) || !validateTimestamp(scenesEndTime)) {
      toast.error('Invalid timestamp format', {
        description: 'Use format HH:MM:SS or MM:SS'
      });
      return;
    }

    // Check duration
    const duration = getClipDuration(scenesStartTime, scenesEndTime);
    if (duration <= 0) {
      toast.error('Invalid time range', {
        description: 'End time must be after start time'
      });
      return;
    }

    haptics.medium();
    setScenesIsProcessing(true);
    setScenesProgress(0);
    setScenesProgressMessage('Starting...');
    setScenesOutputUrl(''); // Clear previous output

    try {
      // Prepare input (File or URL)
      const input = scenesVideoSource === 'local' ? scenesVideoFile! : scenesVideoUrl;

      const videoSource = scenesVideoSource === 'local' ? 'local file' : 'Backblaze cloud';
      toast.info(`Processing ${duration}s clip from ${videoSource}`, {
        description: `${scenesStartTime} → ${scenesEndTime}`
      });

      // Execute actual FFmpeg cut
      const result = await cutVideoSegment({
        input,
        startTime: scenesStartTime,
        endTime: scenesEndTime,
        outputFormat: 'mp4',
        onProgress: (progress, message) => {
          setScenesProgress(progress);
          setScenesProgressMessage(message);
        }
      });

      if (result.success && result.outputUrl && result.outputBlob) {
        haptics.success();
        setScenesOutputUrl(result.outputUrl);
        setScenesOutputBlob(result.outputBlob);

        // Track successful scene cut
        const sourceFileName = scenesVideoSource === 'local'
          ? (scenesVideoFile?.name || 'Local Video')
          : (scenesVideoUrl.split('/').pop() || 'Backblaze Video');

        const sceneTitle = scenesMovieTitle
          ? `${scenesMovieTitle} - Scene (${scenesStartTime} → ${scenesEndTime})`
          : `Video Scene (${scenesStartTime} → ${scenesEndTime})`;

        // Add to Video Studio Activity
        addVideoStudioActivity({
          type: 'scenes',
          title: sceneTitle,
          status: 'completed',
          timestamp: new Date().toISOString(),
          duration: `${duration}s`,
          downloads: 0,
          published: false,
          platforms: [],
          sceneStart: scenesStartTime,
          sceneEnd: scenesEndTime,
          sceneSource: scenesVideoSource,
          sceneSourceName: sourceFileName,
        });

        // Add to Recent Activity
        addRecentActivity({
          title: sceneTitle,
          platform: 'Video Studio',
          status: 'success',
          type: 'scenes',
        });

        // Add to System Logs
        addLogEntry({
          videoTitle: sceneTitle,
          platform: 'FFmpeg.wasm',
          status: 'success',
          type: 'scenes',
        });

        toast.success('Scene cut successfully!', {
          description: `${duration}s clip ready to download`,
          duration: 5000
        });
      } else {
        throw new Error(result.error || 'Unknown error during cutting');
      }
    } catch (error) {
      haptics.error();
      console.error('Cut scene error:', error);

      // Track failed scene cut
      const sourceFileName = scenesVideoSource === 'local'
        ? (scenesVideoFile?.name || 'Local Video')
        : (scenesVideoUrl.split('/').pop() || 'Backblaze Video');

      const sceneTitle = scenesMovieTitle
        ? `${scenesMovieTitle} - Scene (${scenesStartTime} → ${scenesEndTime})`
        : `Video Scene (${scenesStartTime} → ${scenesEndTime})`;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Calculate duration for error logging
      const { getClipDuration: calcDuration } = await loadFFmpegUtils();
      const failedDuration = calcDuration(scenesStartTime, scenesEndTime);

      // Add to Video Studio Activity
      addVideoStudioActivity({
        type: 'scenes',
        title: sceneTitle,
        status: 'failed',
        timestamp: new Date().toISOString(),
        duration: `${failedDuration}s`,
        downloads: 0,
        published: false,
        platforms: [],
        sceneStart: scenesStartTime,
        sceneEnd: scenesEndTime,
        sceneSource: scenesVideoSource,
        sceneSourceName: sourceFileName,
        error: errorMessage,
      });

      // Add to Recent Activity
      addRecentActivity({
        title: sceneTitle,
        platform: 'Video Studio',
        status: 'failed',
        type: 'scenes',
      });

      // Add to System Logs
      addLogEntry({
        videoTitle: sceneTitle,
        platform: 'FFmpeg.wasm',
        status: 'failed',
        type: 'scenes',
        error: 'Scene cutting failed',
        errorDetails: errorMessage,
      });

      toast.error('Processing failed', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
      setScenesProgress(0);
      setScenesProgressMessage('');
    } finally {
      setScenesIsProcessing(false);
    }
  };

  // Download the cut scene
  const handleDownloadScene = () => {
    if (!scenesOutputUrl || !scenesOutputBlob) return;

    haptics.light();

    const fileName = `${scenesMovieTitle || 'scene'}_${scenesStartTime.replace(/:/g, '-')}_${scenesEndTime.replace(/:/g, '-')}.mp4`;

    const a = document.createElement('a');
    a.href = scenesOutputUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast.success('Downloading...', {
      description: fileName
    });
  };

  return (
    <div className="space-y-6">
      <VideoStudioHeader
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        onNavigate={onNavigate}
      />

      {/* Video Review Module */}
      {activeModule === 'review' && (
        <ReviewModule
          youtubeUrls={reviewYoutubeUrls}
          setYoutubeUrls={setReviewYoutubeUrls}
          videoFiles={reviewVideoFiles}
          setVideoFiles={setReviewVideoFiles}
          videoTitles={reviewVideoTitles}
          setVideoTitles={setReviewVideoTitles}
          detectedTitles={reviewDetectedTitles}
          showAutoAssign={reviewShowAutoAssign}
          setShowAutoAssign={setReviewShowAutoAssign}
          onAutoAssign={() => autoAssignTitles(reviewDetectedTitles, 'review')}
          voiceover={reviewVoiceover}
          onVoiceoverUpload={(file) => handleVoiceoverUpload(file, 'review')}
          music={reviewMusic}
          onMusicUpload={(file) => handleMusicUpload(file, 'review')}
          musicGenre={reviewMusicGenre}
          setMusicGenre={setReviewMusicGenre}
          isAnalyzing={reviewIsAnalyzing}
          aspectRatio={reviewAspectRatio}
          setAspectRatio={setReviewAspectRatio}
          removeLetterbox={reviewRemoveLetterbox}
          setRemoveLetterbox={setReviewRemoveLetterbox}
          enableAutoframing={reviewEnableAutoframing}
          setEnableAutoframing={setReviewEnableAutoframing}
          videoLength={reviewVideoLength}
          setVideoLength={setReviewVideoLength}
          isPromptGenerated={isPromptGenerated}
          isPromptPanelOpen={isPromptPanelOpen}
          setIsPromptPanelOpen={setIsPromptPanelOpen}
          promptStatus={promptStatus}
          setPromptStatus={setPromptStatus}
          showDiffMode={showDiffMode}
          setShowDiffMode={setShowDiffMode}
          jsonData={jsonData}
          naturalPrompt={naturalPrompt}
          onRegenerateJSON={handleRegenerateJSON}
          onCopyPrompt={copyPromptToClipboard}
          isGenerating={reviewIsGenerating}
          progress={reviewProgress}
          onGenerateVideo={handleGenerateReviewVideo}
          isPlaying={reviewIsPlaying}
          setIsPlaying={setReviewIsPlaying}
          isMuted={reviewIsMuted}
          setIsMuted={setReviewIsMuted}
          videoTime={reviewVideoTime}
          setVideoTime={setReviewVideoTime}
          videoDuration={reviewVideoDuration}
          thumbnail={reviewThumbnail}
          setThumbnail={setReviewThumbnail}
          onFullscreen={() => handleFullscreen('review')}
          onDownloadVideo={() => handleDownloadVideo('review')}
          onPublishVideo={() => setIsPublishDialogOpen(true)}
          isCaptionEditorOpen={isCaptionEditorOpen}
          setIsCaptionEditorOpen={setIsCaptionEditorOpen}
          onCaptionEditorChange={onCaptionEditorChange}
        />
      )}

      {/* Monthly Releases Module */}
      {activeModule === 'monthly' && (
        <MonthlyModule
          filter={monthlyFilter}
          setFilter={setMonthlyFilter}
          youtubeUrls={monthlyYoutubeUrls}
          setYoutubeUrls={setMonthlyYoutubeUrls}
          videoFiles={monthlyVideoFiles}
          setVideoFiles={setMonthlyVideoFiles}
          videoTitles={monthlyVideoTitles}
          setVideoTitles={setMonthlyVideoTitles}
          detectedTitles={monthlyDetectedTitles}
          showAutoAssign={monthlyShowAutoAssign}
          setShowAutoAssign={setMonthlyShowAutoAssign}
          onAutoAssign={() => autoAssignTitles(monthlyDetectedTitles, 'monthly')}
          voiceover={monthlyVoiceover}
          onVoiceoverUpload={(file) => handleVoiceoverUpload(file, 'monthly')}
          music={monthlyMusic}
          onMusicUpload={(file) => handleMusicUpload(file, 'monthly')}
          musicGenre={monthlyMusicGenre}
          setMusicGenre={setMonthlyMusicGenre}
          isAnalyzing={monthlyIsAnalyzing}
          aspectRatio={monthlyAspectRatio}
          setAspectRatio={setMonthlyAspectRatio}
          removeLetterbox={monthlyRemoveLetterbox}
          setRemoveLetterbox={setMonthlyRemoveLetterbox}
          enableAutoframing={monthlyEnableAutoframing}
          setEnableAutoframing={setMonthlyEnableAutoframing}
          videoLength={monthlyVideoLength}
          setVideoLength={setMonthlyVideoLength}
          isPromptGenerated={isPromptGenerated}
          isPromptPanelOpen={isPromptPanelOpen}
          setIsPromptPanelOpen={setIsPromptPanelOpen}
          promptStatus={promptStatus}
          setPromptStatus={setPromptStatus}
          showDiffMode={showDiffMode}
          setShowDiffMode={setShowDiffMode}
          jsonData={jsonData}
          naturalPrompt={naturalPrompt}
          onRegenerateJSON={handleRegenerateJSON}
          onCopyPrompt={copyPromptToClipboard}
          lowerThirdConfig={monthlyLowerThirdConfig}
          setLowerThirdConfig={setMonthlyLowerThirdConfig}
          enableLowerThirds={monthlyEnableLowerThirds}
          setEnableLowerThirds={setMonthlyEnableLowerThirds}
          isGenerating={monthlyIsGenerating}
          progress={monthlyProgress}
          onGenerateVideo={handleGenerateMonthlyVideo}
          isPlaying={monthlyIsPlaying}
          setIsPlaying={setMonthlyIsPlaying}
          isMuted={monthlyIsMuted}
          setIsMuted={setMonthlyIsMuted}
          videoTime={monthlyVideoTime}
          setVideoTime={setMonthlyVideoTime}
          videoDuration={monthlyVideoDuration}
          thumbnail={monthlyThumbnail}
          setThumbnail={setMonthlyThumbnail}
          onFullscreen={() => handleFullscreen('monthly')}
          onDownloadVideo={() => handleDownloadVideo('monthly')}
          onPublishVideo={() => setIsPublishDialogOpen(true)}
          isCaptionEditorOpen={isCaptionEditorOpen}
          setIsCaptionEditorOpen={setIsCaptionEditorOpen}
          onCaptionEditorChange={onCaptionEditorChange}
        />
      )}



      {/* Video Scenes Module */}
      {activeModule === 'scenes' && (
        <ScenesModule
          movieTitle={scenesMovieTitle}
          setMovieTitle={setScenesMovieTitle}
          importedScenes={importedScenes}
          importDialogParams={{ importedMovieName }}
          showSceneImportDialog={showSceneImportDialog}
          setShowSceneImportDialog={setShowSceneImportDialog}
          onSceneImport={handleSceneImport}
          videoSource={scenesVideoSource}
          videoFile={scenesVideoFile}
          videoUrl={scenesVideoUrl}
          onVideoUpload={handleScenesVideoUpload}
          onShowBackblazeBrowser={() => setShowBackblazeBrowser(true)}
          mode={scenesMode}
          setMode={setScenesMode}
          startTime={scenesStartTime}
          setStartTime={setScenesStartTime}
          endTime={scenesEndTime}
          setEndTime={setScenesEndTime}
          aspectRatio={scenesAspectRatio}
          setAspectRatio={setScenesAspectRatio}
          removeLetterbox={scenesRemoveLetterbox}
          setRemoveLetterbox={setScenesRemoveLetterbox}
          enableAutoframing={scenesEnableAutoframing}
          setEnableAutoframing={setScenesEnableAutoframing}
          aiQuery={scenesAIQuery}
          setAiQuery={setScenesAIQuery}
          onAIAssistedQuery={handleAIAssistedQuery}
          isProcessing={scenesIsProcessing}
          progress={scenesProgress}
          progressMessage={scenesProgressMessage}
          onCutScene={handleCutScene}
          outputUrl={scenesOutputUrl}
          onDownloadScene={handleDownloadScene}
          onPublish={() => setIsPublishDialogOpen(true)}
          isCaptionEditorOpen={isCaptionEditorOpen}
          setIsCaptionEditorOpen={setIsCaptionEditorOpen}
          onCaptionEditorChange={onCaptionEditorChange}
        />
      )}

      {/* Audio Dynamics Panel - Shown when voiceover is uploaded */}
      {(reviewVoiceover || monthlyVoiceover) && (
        <AudioDynamicsPanel
          isOpen={isAudioPanelOpen}
          setIsOpen={setIsAudioPanelOpen}
          enableAutoDucking={enableAutoDucking}
          setEnableAutoDucking={setEnableAutoDucking}
          duckingMode={duckingMode}
          setDuckingMode={setDuckingMode}
          duckLevel={duckLevel}
          setDuckLevel={setDuckLevel}
          attackMs={attackMs}
          setAttackMs={setAttackMs}
          releaseMs={releaseMs}
          setReleaseMs={setReleaseMs}
          enableTrailerAudioHooks={enableTrailerAudioHooks}
          setEnableTrailerAudioHooks={setEnableTrailerAudioHooks}
          hookPlacements={hookPlacements}
          setHookPlacements={setHookPlacements}
          hookDuration={hookDuration}
          setHookDuration={setHookDuration}
          isHookDurationAuto={isHookDurationAuto}
          setIsHookDurationAuto={setIsHookDurationAuto}
          trailerAudioVolume={trailerAudioVolume}
          setTrailerAudioVolume={setTrailerAudioVolume}
          crossfadeDuration={crossfadeDuration}
          setCrossfadeDuration={setCrossfadeDuration}
          activeModule={activeModule}
          reviewVideoFiles={reviewVideoFiles}
          monthlyVideoFiles={monthlyVideoFiles}
          reviewTrailerAnalysis={reviewTrailerAnalysis}
          monthlyTrailerAnalyses={monthlyTrailerAnalyses}
          reviewIsAnalyzingTrailer={reviewIsAnalyzingTrailer}
          monthlyIsAnalyzingTrailer={monthlyIsAnalyzingTrailer}
          onAnalyzeTrailer={(module) => {
            if (module !== 'scenes') {
              void handleAnalyzeTrailer(module);
            }
          }}
          onShowTrailerScenesDialog={() => setShowTrailerScenesDialog(true)}
          customOpeningHook={customOpeningHook}
          setCustomOpeningHook={setCustomOpeningHook}
          customMidVideoHook={customMidVideoHook}
          setCustomMidVideoHook={setCustomMidVideoHook}
          customEndingHook={customEndingHook}
          setCustomEndingHook={setCustomEndingHook}
          audioVariety={audioVariety}
          setAudioVariety={setAudioVariety}
          onRenderAudioPreview={handleRenderAudioPreview}
          isAudioPreviewPlaying={isAudioPreviewPlaying}
          audioPreviewCurrentSegment={audioPreviewCurrentSegment}
          audioPreviewProgress={audioPreviewProgress}
          setPromptStatus={setPromptStatus}
        />
      )}

      {/* AI Training & Analysis Settings */}
      {activeModule === 'review' && (
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-gray-900 dark:text-white">AI Training & Analysis</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Configure analysis backend, quality, and training</p>
            </div>
            <button
              onClick={() => {
                haptics.light();
                setShowAnalysisSettings(!showAnalysisSettings);
              }}
              className="text-gray-600 dark:text-[#9CA3AF] hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              {showAnalysisSettings ? <ChevronUp className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>
          </div>

          {showAnalysisSettings && (
            <div className="space-y-6">
              {/* Analysis Settings Panel */}
              <AnalysisSettingsPanel
                backend={analysisBackend}
                onBackendChange={setAnalysisBackend}
                qualityMode={qualityMode}
                onQualityModeChange={setQualityMode}
                enableSTT={enableSelectiveSTT}
                onEnableSTTChange={setEnableSelectiveSTT}
                estimatedCost={analysisBackend === 'google-vi' ? (enableSelectiveSTT ? 0.22 : 0.22) : 0.00}
                monthlyBudget={monthlyBudget}
                monthlySpend={monthlySpend}
                aiModel={scenesAIModel}
                onAIModelChange={setScenesAIModel}
              />

              <Separator />

              {/* Training Progress Dashboard */}
              <div>
                <button
                  onClick={() => {
                    haptics.light();
                    setShowTrainingDashboard(!showTrainingDashboard);
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#000000] rounded-lg hover:bg-gray-100 dark:hover:bg-[#0A0A0A] transition-colors"
                >
                  <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onNavigate('video-studio-activity', 'video-studio')}>
                    <span className="text-gray-900 dark:text-white">View Training Progress</span>
                  </div>
                  {showTrainingDashboard ? <ChevronUp className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                </button>
                {showTrainingDashboard && (
                  <div className="mt-4">
                    <TrainingProgressDashboard
                      totalCorrections={totalCorrections}
                      currentAccuracy={currentAccuracy}
                      systemRating={systemRating}
                      modelVersion="v1.2-baseline"
                      lastTrainingDate="Nov 15, 2025"
                      overrideRate={overrideRate}
                      meanHookConfidence={meanHookConfidence}
                      lastBackupDate="Nov 22, 2025"
                      stratificationNeeds={stratificationNeeds}
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Scene Correction Interface */}
              <div>
                <button
                  onClick={() => {
                    haptics.light();
                    setShowCorrectionInterface(!showCorrectionInterface);
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#000000] rounded-lg hover:bg-gray-100 dark:hover:bg-[#0A0A0A] transition-colors"
                >
                  <div>
                    <span className="text-gray-900 dark:text-white">Review & Correct Scenes</span>
                  </div>
                  {showCorrectionInterface ? <ChevronUp className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                </button>
                {showCorrectionInterface && reviewTrailerAnalysis && (
                  <div className="mt-4">
                    <SceneCorrectionInterface
                      scenes={reviewTrailerAnalysis.moments?.map((moment, idx) => {
                        const predictedLabel =
                          moment.type === 'dialogue' ? 'dialogue'
                            : moment.type === 'suspense' ? 'suspense'
                              : moment.type === 'atmosphere' || moment.type === 'establishing' ? 'atmosphere'
                                : moment.type === 'transition' ? 'transition'
                                  : 'action';

                        return {
                          id: `scene-${idx}`,
                          timestamp: formatTime(Math.floor(moment.startTime)),
                          duration: moment.duration ?? Math.max(moment.endTime - moment.startTime, 0),
                          predictedLabel,
                          confidence: moment.confidence || 0.65,
                          reasoning: {
                            audioEnergy: moment.audioFeatures?.avgVolume ?? 0.5,
                            spectralFlux: moment.audioFeatures?.dynamicRange ?? 0.35,
                            zeroCrossingRate: moment.audioFeatures?.speechProbability ?? 0.2,
                            tempo: predictedLabel === 'action' ? 128 : undefined
                          }
                        };
                      }) || []}
                      totalCorrections={totalCorrections}
                      accuracyImprovement={accuracyImprovement}
                      overrideRate={overrideRate}
                      onCorrection={(_sceneId, isCorrect, correctedLabel) => {
                        setTotalCorrections(prev => prev + 1);
                        if (!isCorrect && correctedLabel) {
                          // Update stratification needs
                          setStratificationNeeds(prev => ({
                            ...prev,
                            [correctedLabel]: (prev[correctedLabel as keyof typeof prev] || 0) + 1
                          }));
                        }
                        const nextCorrections = totalCorrections + 1;
                        setAccuracyImprovement(Math.min(nextCorrections * 0.02, 10));
                        setCurrentAccuracy(Math.min(72.3 + nextCorrections * 0.05, 100));
                        setSystemRating(Math.min(7.2 + nextCorrections * 0.01, 10));
                      }}
                    />
                  </div>
                )}
                {showCorrectionInterface && !reviewTrailerAnalysis && (
                  <div className="mt-4 p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Upload and analyze a trailer first to start correcting scenes
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Caption Template Editor */}
      {isCaptionEditorOpen && (
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
          <h3 className="text-gray-900 dark:text-white mb-6">
            Caption Template Editor
          </h3>

          <div className="space-y-6">

            {/* Saved Templates */}
            {savedTemplates.length > 0 && (
              <div>
                <label className="text-gray-900 dark:text-white mb-3 block">My Saved Templates</label>
                <div className="space-y-2">
                  {savedTemplates.map((template) => (
                    <div
                      key={template.name}
                      className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg"
                    >
                      <button
                        onClick={() => loadSavedTemplate(template)}
                        className="flex-1 text-left text-gray-900 dark:text-white hover:text-[#ec1e24] dark:hover:text-[#ec1e24] transition-colors"
                      >
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                          {template.fontFamily} �� {template.fontSize}px • {template.wordsPerLine} {template.wordsPerLine === 1 ? 'word' : 'words'} per segment
                        </div>
                      </button>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowRenameMenu(showRenameMenu === template.name ? null : template.name);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {showRenameMenu === template.name && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333333] rounded-lg shadow-lg z-10 min-w-[120px]"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameTemplate(template.name);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors rounded-t-lg"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSavedTemplate(template.name);
                                setShowRenameMenu(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors rounded-b-lg"
                            >
                              <X className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Preview */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Live Preview
                </label>
                <button
                  onClick={() => {
                    haptics.light();
                    setIsCaptionPreviewPlaying(true);
                    setTimeout(() => {
                      setIsCaptionPreviewPlaying(false);
                    }, 10000);
                  }}
                  disabled={isCaptionPreviewPlaying}
                  className="flex items-center gap-2 px-4 py-2 bg-[#ec1e24] text-white rounded-lg hover:bg-[#d11a20] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCaptionPreviewPlaying ? (
                    <span className="text-sm">Playing...</span>
                  ) : (
                    <span className="text-sm">Preview</span>
                  )}
                </button>
              </div>

              <div className={`relative w-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden shadow-xl ${captionPreviewAspectRatio === '16:9' ? 'aspect-video' :
                captionPreviewAspectRatio === '9:16' ? 'aspect-[9/16]' :
                  'aspect-square'
                }`}>
                        {/* Preview video background */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900">
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-500 text-center">
                      <Monitor className="w-16 h-16 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Video Preview Area</p>
                    </div>
                  </div>
                </div>

                {/* Caption Preview */}
                {isCaptionPreviewPlaying && (
                  <div className={`absolute ${captionPosition === 'Top' ? 'top-8' :
                    captionPosition === 'Center' ? 'top-1/2 -translate-y-1/2' :
                      captionPosition === 'Bottom-Center' ? 'bottom-[20%]' :
                        'bottom-8'
                    } left-0 right-0 px-8 flex ${captionAlignment === 'Left' ? 'justify-start' : captionAlignment === 'Right' ? 'justify-end' : 'justify-center'}`}>
                    <div
                      className="px-4 py-2 inline-block animate-in fade-in duration-300"
                      style={{
                        backgroundColor: `${captionBgColor}${Math.round(captionBgOpacity * 2.55).toString(16).padStart(2, '0')}`,
                        color: captionTextColor,
                        fontFamily: captionFontFamily,
                        fontSize: `${captionFontSize}px`,
                        fontWeight: captionFontWeight === 'Regular' ? 400 : captionFontWeight === 'Medium' ? 500 : captionFontWeight === 'Bold' ? 700 : 900,
                        textShadow: captionShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                        borderRadius: `${captionBorderRadius}px`,
                        ...(captionStrokeWidth > 0 && { WebkitTextStroke: `${captionStrokeWidth}px ${captionStrokeColor}` }),
                      }}
                    >
                      {(() => {
                        const samplePhrase = "this is a banger";
                        const words = samplePhrase.split(' ');
                        const segmentWords = words.slice(0, captionWordsPerLine);
                        return segmentWords.join(' ') + '.';
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Aspect Ratio Selection */}
              <div className="mt-4">
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-3">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      haptics.light();
                      setCaptionPreviewAspectRatio('16:9');
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${captionPreviewAspectRatio === '16:9'
                      ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                      : 'border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-[#444444]'
                      }`}
                  >
                    <Monitor className={`w-6 h-6 ${captionPreviewAspectRatio === '16:9' ? 'text-[#ec1e24]' : 'text-gray-600 dark:text-[#9CA3AF]'}`} />
                    <div className="text-center">
                      <div className="text-sm text-gray-900 dark:text-white">16:9</div>
                      <div className="text-xs text-gray-500 dark:text-[#9CA3AF]">Cinematic</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      haptics.light();
                      setCaptionPreviewAspectRatio('9:16');
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${captionPreviewAspectRatio === '9:16'
                      ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                      : 'border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-[#444444]'
                      }`}
                  >
                    <Smartphone className={`w-6 h-6 ${captionPreviewAspectRatio === '9:16' ? 'text-[#ec1e24]' : 'text-gray-600 dark:text-[#9CA3AF]'}`} />
                    <div className="text-center">
                      <div className="text-sm text-gray-900 dark:text-white">9:16</div>
                      <div className="text-xs text-gray-500 dark:text-[#9CA3AF]">Vertical</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      haptics.light();
                      setCaptionPreviewAspectRatio('1:1');
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${captionPreviewAspectRatio === '1:1'
                      ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                      : 'border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-[#444444]'
                      }`}
                  >
                    <Square className={`w-6 h-6 ${captionPreviewAspectRatio === '1:1' ? 'text-[#ec1e24]' : 'text-gray-600 dark:text-[#9CA3AF]'}`} />
                    <div className="text-center">
                      <div className="text-sm text-gray-900 dark:text-white">1:1</div>
                      <div className="text-xs text-gray-500 dark:text-[#9CA3AF]">Square</div>
                    </div>
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-3 italic">
                <span className="text-gray-700 dark:text-gray-400">Kinetic caption label: {captionWordsPerLine} {captionWordsPerLine === 1 ? 'word' : 'words'} per segment.</span> Each caption segment will appear separately as the video plays
              </p>
            </div>

            {/* Font Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-900 dark:text-white mb-2 block">Font Family</label>
                <Select value={captionFontFamily} onValueChange={setCaptionFontFamily}>
                  <SelectTrigger className="w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:ring-[#ec1e24]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fontFamilies.map((font) => (
                      <SelectItem key={font} value={font}>{font}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-gray-900 dark:text-white mb-2 block">Font Weight</label>
                <Select value={captionFontWeight} onValueChange={setCaptionFontWeight}>
                  <SelectTrigger className="w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:ring-[#ec1e24]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fontWeights.map((weight) => (
                      <SelectItem key={weight} value={weight}>{weight}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Font Size */}
            <div>
              <label className="text-gray-900 dark:text-white mb-2 block">Font Size: {captionFontSize}px</label>
              <input
                type="range"
                min="12"
                max="48"
                value={captionFontSize}
                onChange={(e) => setCaptionFontSize(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-[#0A0A0A] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ec1e24]"
              />
            </div>

            {/* Text Color */}
            <div>
              <label className="text-gray-900 dark:text-white mb-2 block">Text Color</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    haptics.light();
                    setShowTextColorPicker(true);
                  }}
                  className="w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform"
                  style={{ backgroundColor: captionTextColor }}
                  title={captionTextColor}
                />
                <input
                  type="text"
                  value={captionTextColor}
                  onChange={(e) => setCaptionTextColor(e.target.value)}
                  className="flex-1 px-4 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            {/* Background Color */}
            <div>
              <label className="text-gray-900 dark:text-white mb-2 block">Background Color</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    haptics.light();
                    setShowBgColorPicker(true);
                  }}
                  className="w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform"
                  style={{ backgroundColor: captionBgColor }}
                  title={captionBgColor}
                />
                <input
                  type="text"
                  value={captionBgColor}
                  onChange={(e) => setCaptionBgColor(e.target.value)}
                  className="flex-1 px-4 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase"
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* Background Opacity */}
            <div>
              <label className="text-gray-900 dark:text-white mb-2 block">Background Opacity: {captionBgOpacity}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={captionBgOpacity}
                onChange={(e) => setCaptionBgOpacity(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-[#0A0A0A] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ec1e24]"
              />
            </div>

            {/* Border Radius */}
            <div>
              <label className="text-gray-900 dark:text-white mb-2 block">Corner Radius: {captionBorderRadius}px</label>
              <input
                type="range"
                min="0"
                max="50"
                value={captionBorderRadius}
                onChange={(e) => setCaptionBorderRadius(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-[#0A0A0A] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ec1e24]"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1">
                <span>Sharp</span>
                <span>Rounded</span>
              </div>
            </div>

            {/* Position & Alignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-900 dark:text-white mb-2 block">Position</label>
                <Select value={captionPosition} onValueChange={setCaptionPosition}>
                  <SelectTrigger className="w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:ring-[#ec1e24]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((pos) => (
                      <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-gray-900 dark:text-white mb-2 block">Alignment</label>
                <Select value={captionAlignment} onValueChange={setCaptionAlignment}>
                  <SelectTrigger className="w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:ring-[#ec1e24]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {alignments.map((align) => (
                      <SelectItem key={align} value={align}>{align}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stroke Settings */}
            <div>
              <label className="text-gray-900 dark:text-white mb-2 block">Stroke Width: {captionStrokeWidth}px</label>
              <input
                type="range"
                min="0"
                max="5"
                value={captionStrokeWidth}
                onChange={(e) => setCaptionStrokeWidth(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-[#0A0A0A] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ec1e24]"
              />
              {captionStrokeWidth > 0 && (
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => {
                      haptics.light();
                      setShowStrokeColorPicker(true);
                    }}
                    className="w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform"
                    style={{ backgroundColor: captionStrokeColor }}
                    title={captionStrokeColor}
                  />
                  <input
                    type="text"
                    value={captionStrokeColor}
                    onChange={(e) => setCaptionStrokeColor(e.target.value)}
                    className="flex-1 px-4 py-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase"
                    placeholder="#000000"
                  />
                </div>
              )}
            </div>

            {/* Shadow Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-gray-900 dark:text-white">Text Shadow</label>
              <Switch
                checked={captionShadow}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setCaptionShadow(checked);
                }}
              />
            </div>

            {/* Animation */}
            <div>
              <label className="text-gray-900 dark:text-white mb-2 block">Animation</label>
              <Select value={captionAnimation} onValueChange={setCaptionAnimation}>
                <SelectTrigger className="w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white focus:ring-[#ec1e24]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {animations.map((anim) => (
                    <SelectItem key={anim} value={anim}>{anim}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Words Per Line */}
            <div>
              <label className="text-gray-900 dark:text-white mb-2 block">Words Per Line</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      haptics.light();
                      setCaptionWordsPerLine(num);
                    }}
                    className={`px-4 py-2 rounded-lg border transition-all duration-200 ${captionWordsPerLine === num
                      ? 'bg-[#ec1e24] text-white border-[#ec1e24]'
                      : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:border-[#ec1e24]'
                      }`}
                  >
                    {num} {num === 1 ? 'Word' : 'Words'}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Template Button */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSaveCaptionTemplate}
                className="flex-1 bg-[#ec1e24] hover:bg-[#ec1e24] text-white"
              >
                Save Template
              </Button>
              {showSaveSuccess && (
                <span className="text-green-600 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Saved!
                </span>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Publish Dialog */}
      <BottomSheet
        open={isPublishDialogOpen}
        onOpenChange={(open) => {
          setIsPublishDialogOpen(open);
          if (open && !generatedCaption) {
            // Auto-generate caption when dialog opens
            generateCaption(activeModule);
          }
        }}
      >
        <BottomSheetHeader>
          <BottomSheetTitle className="text-gray-900 dark:text-white">Publish Video</BottomSheetTitle>
          <BottomSheetDescription className="text-[#6B7280] dark:text-[#9CA3AF]">
            Select platforms and customize your caption
          </BottomSheetDescription>
        </BottomSheetHeader>

        <BottomSheetBody>
          {/* Caption Generation Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-900 dark:text-white">Social Media Caption</Label>
              <button
                onClick={() => generateCaption(activeModule)}
                disabled={isGeneratingCaption}
                className="text-sm text-black dark:text-white hover:opacity-70 disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingCaption ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="relative">
              <textarea
                value={generatedCaption}
                onFocus={() => {
                  haptics.light();
                }}
                onChange={(e) => {
                  haptics.light();
                  setGeneratedCaption(e.target.value);
                  setCaptionEditMode(true);
                }}
                placeholder={isGeneratingCaption ? "Generating caption..." : "Caption will appear here"}
                disabled={isGeneratingCaption}
                className="w-full min-h-[120px] px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#ec1e24] transition-colors resize-none disabled:opacity-50"
              />
              <div className="absolute bottom-2 right-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                {generatedCaption.length} chars
              </div>
            </div>

            {captionEditMode && (
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Caption edited manually
              </p>
            )}
          </div>

          <Separator className="bg-gray-200 dark:bg-[#1F1F1F]" />

          {/* Platform Selection */}
          <div className="space-y-3 pt-4">
            <Label className="text-gray-900 dark:text-white">Select Platforms</Label>
            <div className="flex justify-center">
              <div className="grid grid-cols-3 gap-3 max-w-fit">
                <button
                  onClick={() => {
                    haptics.light();
                    setSelectedPlatforms({ ...selectedPlatforms, x: !selectedPlatforms.x });
                  }}
                  className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.x
                    ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                    : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                    }`}
                  title="X"
                >
                  <XIcon className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    haptics.light();
                    setSelectedPlatforms({ ...selectedPlatforms, threads: !selectedPlatforms.threads });
                  }}
                  className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.threads
                    ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                    : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                    }`}
                  title="Threads"
                >
                  <ThreadsIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={() => {
                    haptics.light();
                    setSelectedPlatforms({ ...selectedPlatforms, facebook: !selectedPlatforms.facebook });
                  }}
                  className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.facebook
                    ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                    : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                    }`}
                  title="Facebook"
                >
                  <FacebookIcon className="w-5.5 h-5.5" />
                </button>

                <button
                  onClick={() => {
                    haptics.light();
                    setSelectedPlatforms({ ...selectedPlatforms, tiktok: !selectedPlatforms.tiktok });
                  }}
                  className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.tiktok
                    ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                    : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                    }`}
                  title="TikTok"
                >
                  <TikTokIcon className="w-6.5 h-6.5" />
                </button>

                <button
                  onClick={() => {
                    haptics.light();
                    setSelectedPlatforms({ ...selectedPlatforms, youtube: !selectedPlatforms.youtube });
                  }}
                  className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.youtube
                    ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                    : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                    }`}
                  title="YouTube"
                >
                  <YouTubeIcon className="w-6 h-6" />
                </button>

                <button
                  onClick={() => {
                    haptics.light();
                    setSelectedPlatforms({ ...selectedPlatforms, instagram: !selectedPlatforms.instagram });
                  }}
                  className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.instagram
                    ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                    : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                    }`}
                  title="Instagram"
                >
                  <InstagramIcon className="w-5.5 h-5.5" />
                </button>

                <button
                  onClick={() => {
                    haptics.light();
                    setSelectedPlatforms({ ...selectedPlatforms, pinterest: !selectedPlatforms.pinterest });
                  }}
                  className={`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${selectedPlatforms.pinterest
                    ? 'bg-[#ec1e24]/10 border-2 border-[#ec1e24]'
                    : 'bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40'
                    }`}
                  title="Pinterest"
                >
                  <PinterestIcon className="w-5.5 h-5.5" />
                </button>
              </div>
            </div>
          </div>

        </BottomSheetBody>

        <BottomSheetFooter>
          <div className="flex gap-3 w-full">
            <Button
              onClick={() => {
                haptics.light();
                setIsPublishDialogOpen(false);
                setGeneratedCaption('');
                setCaptionEditMode(false);
              }}
              variant="outline"
              className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePublishVideo}
              className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white shadow-none hover:shadow-none active:shadow-none focus:shadow-none hover:scale-100 active:scale-100"
            >
              Publish
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Template Naming/Renaming Bottom Sheet */}
      <BottomSheet open={showNameDialog} onOpenChange={setShowNameDialog}>
        <BottomSheetHeader>
          <BottomSheetTitle>
            {isRenaming ? 'Rename Template' : 'Save Template'}
          </BottomSheetTitle>
          <BottomSheetDescription>
            {isRenaming ? 'Enter a new name for your template.' : 'Enter a name for your caption template.'}
          </BottomSheetDescription>
        </BottomSheetHeader>

        <BottomSheetBody>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                isRenaming ? renameTemplate() : saveTemplateWithName();
              }
            }}
            placeholder="e.g., My Custom Style"
            className="w-full px-4 py-3 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#292929] dark:focus:border-[#292929] transition-colors"
            autoFocus
          />
        </BottomSheetBody>

        <BottomSheetFooter>
          <div className="flex gap-3 w-full">
            <Button
              onClick={() => {
                haptics.light();
                setShowNameDialog(false);
                setTemplateName('');
                setIsRenaming(false);
                setRenamingTemplate(null);
              }}
              variant="outline"
              className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                haptics.medium();
                isRenaming ? renameTemplate() : saveTemplateWithName();
              }}
              disabled={!templateName.trim()}
              className="flex-1 bg-[#ec1e24] hover:bg-[#d11b20] text-white disabled:opacity-50 shadow-none hover:shadow-none active:shadow-none focus:shadow-none hover:scale-100 active:scale-100"
            >
              {isRenaming ? 'Rename' : 'Save'}
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Review Fullscreen Video Player */}
      <BottomSheet open={reviewIsFullscreen} onOpenChange={setReviewIsFullscreen}>
        <BottomSheetHeader>
          <VisuallyHidden>
            <BottomSheetTitle>Review Video Fullscreen</BottomSheetTitle>
            <BottomSheetDescription>Fullscreen video player for review module</BottomSheetDescription>
          </VisuallyHidden>
        </BottomSheetHeader>
        <BottomSheetBody className="p-0">{/* Full-height video player */}
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <p className="text-white text-xl">Video Preview (Fullscreen)</p>
            </div>

            {/* Fullscreen Video Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    haptics.light();
                    setReviewIsPlaying(!reviewIsPlaying);
                  }}
                  className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  {reviewIsPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white" />
                  )}
                </button>

                <button
                  onClick={() => {
                    haptics.light();
                    setReviewIsMuted(!reviewIsMuted);
                  }}
                  className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  {reviewIsMuted ? (
                    <VolumeX className="w-6 h-6 text-white" />
                  ) : (
                    <Volume2 className="w-6 h-6 text-white" />
                  )}
                </button>

                <div
                  className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer"
                  onClick={(e) => handleProgressClick(e, 'review')}
                >
                  <div
                    className="h-full bg-[#ec1e24] transition-all duration-150"
                    style={{ width: `${(reviewVideoTime / reviewVideoDuration) * 100}%` }}
                  />
                </div>

                <span className="text-sm text-white/90 min-w-[80px] text-right">
                  {formatTime(reviewVideoTime)} / {formatTime(reviewVideoDuration)}
                </span>

                <button
                  onClick={() => {
                    haptics.light();
                    setReviewIsFullscreen(false);
                  }}
                  className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          </div>
        </BottomSheetBody>
      </BottomSheet>

      {/* Monthly Fullscreen Video Player */}
      <BottomSheet open={monthlyIsFullscreen} onOpenChange={setMonthlyIsFullscreen}>
        <BottomSheetHeader>
          <VisuallyHidden>
            <BottomSheetTitle>Monthly Video Fullscreen</BottomSheetTitle>
            <BottomSheetDescription>Fullscreen video player for monthly releases module</BottomSheetDescription>
          </VisuallyHidden>
        </BottomSheetHeader>
        <BottomSheetBody className="p-0">{/* Full-height video player */}
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <p className="text-white text-xl">Video Compilation Preview (Fullscreen)</p>
            </div>

            {/* Fullscreen Video Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    haptics.light();
                    setMonthlyIsPlaying(!monthlyIsPlaying);
                  }}
                  className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  {monthlyIsPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white" />
                  )}
                </button>

                <button
                  onClick={() => {
                    haptics.light();
                    setMonthlyIsMuted(!monthlyIsMuted);
                  }}
                  className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  {monthlyIsMuted ? (
                    <VolumeX className="w-6 h-6 text-white" />
                  ) : (
                    <Volume2 className="w-6 h-6 text-white" />
                  )}
                </button>

                <div
                  className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer"
                  onClick={(e) => handleProgressClick(e, 'monthly')}
                >
                  <div
                    className="h-full bg-[#ec1e24] transition-all duration-150"
                    style={{ width: `${(monthlyVideoTime / monthlyVideoDuration) * 100}%` }}
                  />
                </div>

                <span className="text-sm text-white/90 min-w-[80px] text-right">
                  {formatTime(monthlyVideoTime)} / {formatTime(monthlyVideoDuration)}
                </span>

                <button
                  onClick={() => {
                    haptics.light();
                    setMonthlyIsFullscreen(false);
                  }}
                  className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          </div>
        </BottomSheetBody>
      </BottomSheet>

      {/* Caption Editor Panel */}
      <CaptionEditorPanel
        isOpen={isCaptionEditorOpen}
        onClose={() => setIsCaptionEditorOpen(false)}
        template={captionTemplate}
        setTemplate={setCaptionTemplate}
        fontFamily={captionFontFamily}
        setFontFamily={setCaptionFontFamily}
        fontSize={captionFontSize}
        setFontSize={setCaptionFontSize}
        fontWeight={captionFontWeight}
        setFontWeight={setCaptionFontWeight}
        textColor={captionTextColor}
        setTextColor={setCaptionTextColor}
        bgColor={captionBgColor}
        setBgColor={setCaptionBgColor}
        bgOpacity={captionBgOpacity}
        setBgOpacity={setCaptionBgOpacity}
        position={captionPosition}
        setPosition={setCaptionPosition}
        alignment={captionAlignment}
        setAlignment={setCaptionAlignment}
        strokeColor={captionStrokeColor}
        setStrokeColor={setCaptionStrokeColor}
        strokeWidth={captionStrokeWidth}
        setStrokeWidth={setCaptionStrokeWidth}
        hasShadow={captionShadow}
        setHasShadow={setCaptionShadow}
        borderRadius={captionBorderRadius}
        setBorderRadius={setCaptionBorderRadius}
        animation={captionAnimation}
        setAnimation={setCaptionAnimation}
        wordsPerLine={captionWordsPerLine}
        setWordsPerLine={setCaptionWordsPerLine}
      />

      {/* Trailer Scenes Dialog */}
      {(reviewTrailerAnalysis || (monthlyTrailerAnalyses.length > 0)) && (
        <TrailerScenesDialog
          open={showTrailerScenesDialog}
          onOpenChange={setShowTrailerScenesDialog}
          analysis={activeModule === 'review'
            ? reviewTrailerAnalysis!
            : monthlyTrailerAnalyses[0].analysis
          }
          onSelectScene={(moment, hookType) => {
            // Update custom hook selections
            switch (hookType) {
              case 'opening':
                setCustomOpeningHook(moment);
                toast.success(`Opening hook set to ${moment.startTime.toFixed(1)}s - ${moment.type.replace('_', ' ')}`);
                break;
              case 'midVideo':
                setCustomMidVideoHook(moment);
                toast.success(`Mid-video hook set to ${moment.startTime.toFixed(1)}s - ${moment.type.replace('_', ' ')}`);
                break;
              case 'ending':
                setCustomEndingHook(moment);
                toast.success(`Ending hook set to ${moment.startTime.toFixed(1)}s - ${moment.type.replace('_', ' ')}`);
                break;
            }
            setPromptStatus('outdated'); // Mark prompt for regeneration
            haptics.light();
            setShowTrailerScenesDialog(false);
          }}
        />
      )}

      {/* Backblaze Video Browser */}
      <BackblazeVideoBrowser
        open={showBackblazeBrowser}
        onSelectVideo={(url, fileName, fileSize) => {
          setScenesVideoUrl(url);
          setScenesVideoSource('backblaze');
          setScenesVideoFile(null); // Clear local file if any
          toast.success('Video Loaded from Backblaze!', {
            description: `${fileName} (${(fileSize / (1024 * 1024)).toFixed(1)}MB) - No bandwidth used`
          });
          haptics.success();
        }}
        onClose={() => {
          haptics.light();
          setShowBackblazeBrowser(false);
        }}
      />



    </div>
  );
}
