import { CheckCircle, RefreshCw, Scissors, Video } from 'lucide-react';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { InstagramIcon } from './icons/InstagramIcon';
import { FacebookIcon } from './icons/FacebookIcon';
import { ThreadsIcon } from './icons/ThreadsIcon';
import { XIcon } from './icons/XIcon';
import { YouTubeIcon } from './icons/YouTubeIcon';
import { TikTokIcon } from './icons/TikTokIcon';
import { PinterestIcon } from './icons/PinterestIcon';
import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import { useUndo } from './UndoContext';
import { VideoStudioActivity, updateVideoStudioActivity, addRecentActivity, addLogEntry } from '../utils/activityStore';
import { Skeleton } from './ui/skeleton';

interface VideoStudioActivityPageProps {
  onNavigate: (page: string) => void;
  previousPage?: string | null;
}

export function VideoStudioActivityPage({ onNavigate, previousPage }: VideoStudioActivityPageProps) {
  const { settings } = useSettings();
  const { showUndo } = useUndo();

  // Get retention period from settings (default 24 hours)
  const retentionHours = settings.videoStudioActivityRetention || 24;
  const retentionMs = retentionHours * 60 * 60 * 1000; // Convert to milliseconds

  // Helper function to check if an item should be kept based on retention
  const shouldKeepItem = (item: VideoStudioActivity): boolean => {
    // For completed and failed items, check retention period
    if (item.status === 'completed' || item.status === 'failed') {
      try {
        const now = Date.now();
        const ageMs = now - item.timestampMs;
        return ageMs <= retentionMs;
      } catch (error) {
        // If parsing fails, keep the item
        return true;
      }
    }

    // Keep processing items regardless of age
    return true;
  };

  // Tab filter state
  const [activeTab, setActiveTab] = useState<'review' | 'releases' | 'scenes'>('review');

  // Load activities from API
  const [activities, setActivities] = useState<VideoStudioActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  const fetchActivities = async () => {
    setIsLoadingActivities(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://screndly-production.up.railway.app';
      const res = await fetch(`${BACKEND_URL}/api/video-studio`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('screndly_token')}`,
        }
      });
      if (res.ok) {
        const { data } = await res.json();
        // Convert database entity to expected struct
        const mappedActivities = data.map((item: any) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          status: item.status,
          timestamp: item.createdAt,
          timestampMs: new Date(item.createdAt).getTime(),
          aspectRatio: item.aspectRatio,
          duration: item.duration,
          progress: item.progress || undefined,
          error: item.error || undefined,
          downloads: item.downloads || 0,
          published: item.published,
          platforms: item.platforms || []
        })).filter(shouldKeepItem);
        setActivities(mappedActivities);
      } else {
        console.error("Failed to fetch video studio activities");
      }
    } catch (error) {
      console.error("Video studio fetch error", error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    // Auto-refresh when returning to tab
    const handleFocus = () => {
      fetchActivities();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [retentionMs]);

  // Calculate stats
  const completedCount = activities.filter(a => a.status === 'completed').length;
  const processingCount = activities.filter(a => a.status === 'processing').length;
  const failedCount = activities.filter(a => a.status === 'failed').length;
  const totalDownloads = activities.reduce((sum, a) => sum + a.downloads, 0);

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
  const [selectedActivity, setSelectedActivity] = useState<typeof activities[0] | null>(null);
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [captionEditMode, setCaptionEditMode] = useState(false);

  // Generate caption from video content
  const generateCaption = async (activity: typeof activities[0]) => {
    setIsGeneratingCaption(true);
    setCaptionEditMode(false);
    haptics.light();

    try {
      // Use caption settings from context
      const captionSettings = {
        captionOpenaiModel: settings.captionOpenaiModel || 'gpt-4o',
        captionTemperature: settings.captionTemperature || 0.7,
        captionMaxTokens: 500,
        captionSystemPrompt: 'You are a social media caption writer...',
        captionMaxLength: 280,
        captionTone: 'engaging'
      };

      // Simulate voiceover transcript based on video type and title
      const mockTranscript = activity.type === 'review'
        ? `${activity.title} - Experience the cinematic masterpiece everyone's talking about. Coming to theaters soon.`
        : activity.type === 'scenes'
          ? `${activity.title} - Exclusive scene cut from the movie.`
          : `${activity.title} - Your monthly dose of the best new releases in cinema. Don't miss these incredible films.`;

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate mock caption based on tone
      let caption = '';

      if (activity.type === 'scenes') {
        // Special captions for scene cuts
        switch (captionSettings.captionTone) {
          case 'hype':
            caption = `🎬 EXCLUSIVE SCENE! ${activity.title.toUpperCase()} ✂️\n\nCheck out this EPIC moment!\n\n#MovieScenes #BehindTheScenes #Cinema #FilmClips`;
            break;
          case 'professional':
            caption = `${activity.title}\n\nPrecision-cut scene showcasing a key moment.\n\n#Cinema #MovieClips #FilmAnalysis`;
            break;
          case 'casual':
            caption = `Just cut this sick scene! ${activity.title} 🎬✂️\n\n#MovieMoments #FilmClips #Cinema`;
            break;
          default:
            caption = `${activity.title} ✨\n\nA perfectly crafted scene moment.\n\n#MovieScenes #Cinema #FilmClips`;
        }
      } else {
        switch (captionSettings.captionTone) {
          case 'hype':
            caption = activity.type === 'review'
              ? `🔥 ${activity.title.toUpperCase()} 🎬\n\nThis is THE movie event you can't miss!\n\n#Movies #MustWatch #Cinema #FilmTwitter #Premiere`
              : `🎬 ${activity.title.toUpperCase()} 🚀\n\nYour cinema guide is HERE! Check out what's hitting screens!\n\n#NewReleases #Movies #Cinema #FilmLovers #MustWatch`;
            break;
          case 'professional':
            caption = activity.type === 'review'
              ? `${activity.title}\n\nA compelling addition to this year's theatrical releases. Now in theaters.\n\n#Cinema #NewRelease #Film #Movies`
              : `${activity.title}\n\nComprehensive overview of this month's most anticipated theatrical releases.\n\n#NewMovies #FilmReleases #Cinema`;
            break;
          case 'casual':
            caption = activity.type === 'review'
              ? `Yo ${activity.title} looks absolutely FIRE 🔥🍿\n\nGotta see this one!\n\n#Movies #MustWatch #FilmTwitter #Cinema`
              : `This month's movie lineup is STACKED 🎬✨\n\nSo many good ones!\n\n#Movies #NewReleases #FilmTwitter #Cinema`;
            break;
          default: // engaging
            caption = activity.type === 'review'
              ? `${activity.title} ✨\n\nThe cinematic experience you've been waiting for. Don't miss it.\n\n#Movies #ComingSoon #MustWatch #Cinema #Film`
              : `${activity.title} 🎬\n\nYour complete guide to this month's must-see releases.\n\n#NewReleases #Movies #MustWatch #Cinema #FilmLovers`;
        }
      }

      // Trim to max length if needed
      if (caption.length > captionSettings.captionMaxLength) {
        caption = caption.substring(0, captionSettings.captionMaxLength - 3) + '...';
      }

      setGeneratedCaption(caption);
    } catch (error) {
      console.error('Error generating caption:', error);
      setGeneratedCaption('Failed to generate caption. Please try again.');
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  // Helper to format timestamp
  const getTimeAgo = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const handleDelete = (id: string, title: string) => {
    haptics.medium();

    // Find the activity to delete
    const deletedActivity = activities.find(activity => activity.id === id);
    if (!deletedActivity) return;

    // Temporarily remove from state
    setActivities(prev => prev.filter(activity => activity.id !== id));

    // Show undo toast
    showUndo({
      id,
      itemName: title,
      onUndo: () => {
        // Restore the activity
        setActivities(prev => [...prev, deletedActivity]);
      },
      onConfirm: () => {
        // Show final confirmation
        toast.success('Deleted', {
          description: `\"${title}\" has been removed`,
        });
      }
    });
  };

  const handleRepublish = (activity: VideoStudioActivity) => {
    // Simulate republishing logic
    toast.success('Republishing', {
      description: `Republishing "${activity.title}"`,
    });

    // Update activity status to processing
    setActivities(prev => prev.map(a => a.id === activity.id ? { ...a, status: 'processing' } : a));

    // Simulate processing delay
    setTimeout(() => {
      setActivities(prev => prev.map(a => a.id === activity.id ? { ...a, status: 'completed' } : a));
    }, 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => {
            haptics.light();
            onNavigate(previousPage || 'video-studio');
          }}
          className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-gray-900 dark:text-white mb-2">Video Studio Activity</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">Track video generation, downloads, and publishing status</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
          <div>
            <p className="text-2xl text-gray-900 dark:text-white">{completedCount}</p>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">Completed</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
          <div>
            <p className="text-2xl text-gray-900 dark:text-white">{processingCount}</p>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">Processing</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
          <div>
            <p className="text-2xl text-gray-900 dark:text-white">{failedCount}</p>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">Failed</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
          <div>
            <p className="text-2xl text-gray-900 dark:text-white">{totalDownloads}</p>
            <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">Total Downloads</p>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => {
              haptics.light();
              setActiveTab('review');
            }}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${activeTab === 'review'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-[#1F1F1F]'
              }`}
          >
            Review
          </button>
          <button
            onClick={() => {
              haptics.light();
              setActiveTab('releases');
            }}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${activeTab === 'releases'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-[#1F1F1F]'
              }`}
          >
            Releases
          </button>
          <button
            onClick={() => {
              haptics.light();
              setActiveTab('scenes');
            }}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${activeTab === 'scenes'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-[#1F1F1F]'
              }`}
          >
            Scenes
          </button>
        </div>

        <div className="space-y-4">
          {isLoadingActivities ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl dark:bg-[#111111]" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-[#ec1e24]/10 flex items-center justify-center mb-4">
                <Video className="w-8 h-8 text-[#ec1e24]" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No activity yet</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] max-w-sm">
                Generated videos and publishing activity will appear here.
              </p>
            </div>
          ) : (
            <>
              {activities
                .filter(shouldKeepItem) // Apply retention filter first
                .filter(activity => {
                  if (activeTab === 'review') return activity.type === 'review';
                  if (activeTab === 'releases') return activity.type === 'monthly';
                  if (activeTab === 'scenes') return activity.type === 'scenes';
                  return true;
                })
                .map((activity) => (
                  <SwipeableActivityCard
                    key={activity.id}
                    id={activity.id}
                    onDelete={() => handleDelete(activity.id, activity.title)}
                    className="p-4 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-gray-900 dark:text-white">
                            {activity.title}
                          </h4>
                          <span className={`px-3 py-1 text-xs rounded-full flex-shrink-0 ${activity.status === 'completed'
                            ? 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]'
                            : activity.status === 'processing'
                              ? 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]'
                              : 'bg-[#FEE2E2] dark:bg-[#991B1B] text-[#991B1B] dark:text-[#FEE2E2]'
                            }`}>
                            {activity.status === 'completed' && 'Completed'}
                            {activity.status === 'processing' && 'Processing'}
                            {activity.status === 'failed' && 'Failed'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-[#9CA3AF] mb-2">
                          <span>{getTimeAgo(activity.timestamp)}</span>
                          {activity.type === 'scenes' ? (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Scissors className="w-3 h-3" />
                                Scene Cut
                              </span>
                              <span>•</span>
                              <span>{activity.duration}</span>
                              {activity.sceneStart && activity.sceneEnd && (
                                <>
                                  <span>•</span>
                                  <span>{activity.sceneStart} → {activity.sceneEnd}</span>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              {activity.aspectRatio && (
                                <>
                                  <span>•</span>
                                  <span>{activity.aspectRatio}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>{activity.duration}</span>
                            </>
                          )}
                        </div>

                        {/* Scene Source Info */}
                        {activity.type === 'scenes' && activity.sceneSource && activity.sceneSourceName && (
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-[#9CA3AF] mb-2">
                            <span className="px-2 py-1 bg-gray-100 dark:bg-[#1f1f1f] rounded">
                              {activity.sceneSource === 'local' ? '📁 Local' : '☁️ Backblaze'}: {activity.sceneSourceName}
                            </span>
                          </div>
                        )}

                        {/* Error Message */}
                        {activity.status === 'failed' && activity.error && (
                          <p className="text-sm text-[#EF4444] mt-1">{activity.error}</p>
                        )}

                        {/* Processing Progress */}
                        {activity.status === 'processing' && activity.progress !== undefined && (
                          <div className="space-y-1 mb-2">
                            <div className="w-full bg-gray-200 dark:bg-[#0A0A0A] rounded-full h-2">
                              <div
                                className="bg-[#ec1e24] h-2 rounded-full transition-all duration-300"
                                style={{ width: `${activity.progress}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">
                              {activity.progress}% complete
                            </p>
                          </div>
                        )}

                        {/* Publishing Status */}
                        {activity.status === 'completed' && activity.published && activity.platforms.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                              Published
                            </span>
                            <div className="flex items-center gap-1.5">
                              {activity.platforms.map((platform) => (
                                <span
                                  key={platform}
                                  className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-[#1F1F1F] text-gray-700 dark:text-[#9CA3AF]"
                                >
                                  {platform}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {activity.status === 'completed' && (
                          <>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                haptics.light();
                                toast.success('Download Started', {
                                  description: `Downloading "${activity.title}"`,
                                });
                              }}
                              size="sm"
                              variant="outline"
                              className="gap-2 bg-white dark:bg-black border-gray-200 dark:border-[#333333] whitespace-nowrap"
                            >
                              Download
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                haptics.medium();
                                setSelectedActivity(activity);
                                setIsPublishDialogOpen(true);
                              }}
                              size="sm"
                              className="gap-2 bg-[#ec1e24] hover:bg-[#d01a20] text-white shadow-none whitespace-nowrap"
                            >
                              {activity.published ? 'Re-publish' : 'Publish'}
                            </Button>
                          </>
                        )}

                        {activity.status === 'failed' && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              haptics.light();
                              toast.success('Retry Initiated', {
                                description: `Retrying "${activity.title}"`,
                              });
                            }}
                            size="sm"
                            variant="outline"
                            className="gap-2 bg-white dark:bg-black border-gray-200 dark:border-[#333333] whitespace-nowrap"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  </SwipeableActivityCard>
                ))}
            </>
          )}
        </div>

        {/* Publish Dialog */}
        <BottomSheet
          open={isPublishDialogOpen}
          onOpenChange={(open) => {
            setIsPublishDialogOpen(open);
            if (open && !generatedCaption && selectedActivity) {
              // Auto-generate caption when dialog opens
              generateCaption(selectedActivity);
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
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-gray-900 dark:text-white">Social Media Caption</Label>
                <button
                  onClick={() => selectedActivity && generateCaption(selectedActivity)}
                  disabled={isGeneratingCaption}
                  className="text-sm text-black dark:text-white hover:opacity-70 disabled:opacity-50 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingCaption ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="relative">
                <textarea
                  value={generatedCaption}
                  onFocus={() => haptics.light()}
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
            <div className="space-y-3">
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
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  haptics.light();
                  setIsPublishDialogOpen(false);
                }}
                variant="outline"
                className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  haptics.medium();

                  if (!selectedActivity) return;

                  // Optimistic Update: Close immediately
                  setIsPublishDialogOpen(false);

                  // Get selected platforms as array
                  const platforms: string[] = [];
                  if (selectedPlatforms.x) platforms.push('X');
                  if (selectedPlatforms.threads) platforms.push('Threads');
                  if (selectedPlatforms.facebook) platforms.push('Facebook');
                  if (selectedPlatforms.youtube) platforms.push('YouTube');
                  if (selectedPlatforms.instagram) platforms.push('Instagram');
                  if (selectedPlatforms.tiktok) platforms.push('TikTok');
                  if (selectedPlatforms.pinterest) platforms.push('Pinterest');

                  // Update activity with published status (Optimistic local update)
                  const updatedActivity = {
                    ...selectedActivity,
                    published: true,
                    platforms
                  };

                  updateVideoStudioActivity(updatedActivity);

                  // Update local state
                  setActivities(prev => prev.map(a =>
                    a.id === selectedActivity.id ? updatedActivity : a
                  ));

                  // Show success toast
                  toast.success(selectedActivity.published ? 'Republished' : 'Published', {
                    description: `"${selectedActivity.title}" published to ${platforms.join(', ')}`,
                  });

                  // Add recent activity
                  addRecentActivity({
                    title: selectedActivity.title,
                    platform: platforms.join(', '),
                    status: 'success',
                    type: 'videostudio'
                  });

                  // Add log entry
                  addLogEntry({
                    videoTitle: selectedActivity.title,
                    platform: platforms.join(', '),
                    status: 'success',
                    type: 'videostudio'
                  });

                  // Close dialog and reset
                  setIsPublishDialogOpen(false);
                  setGeneratedCaption('');
                  setCaptionEditMode(false);
                  setSelectedActivity(null);
                }}
                className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white shadow-none hover:shadow-none active:shadow-none focus:shadow-none hover:scale-100 active:scale-100"
              >
                Publish
              </Button>
            </div>
          </BottomSheetFooter>
        </BottomSheet>
      </div>
    </div>
  );
}