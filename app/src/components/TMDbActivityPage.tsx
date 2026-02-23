import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  RefreshCw,
  Clapperboard,
  MoreVertical,
  Send,
  Edit3,
  Image as ImageIcon
} from 'lucide-react';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { useTMDbPosts } from '../contexts/TMDbPostsContext';
import { useChatInputKeyHandler } from '../contexts/KeyboardContext';
import { SwipeableActivityCard } from './SwipeableActivityCard';
import { useUndo } from './UndoContext';
import { addRecentActivity, addLogEntry } from '../utils/activityStore';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { DatePicker } from './ui/date-picker';
import { TimePicker } from './ui/time-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  BottomSheet,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
  BottomSheetFooter
} from './ui/bottom-sheet';
import { Separator } from './ui/separator';
import { ChangeImageBottomSheet } from './tmdb/ChangeImageBottomSheet';

interface TMDbActivityItem {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  source: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary';
  status: 'queued' | 'published' | 'failed' | 'scheduled';
  timestamp: string;
  platforms?: string[];
  error?: string;
  imageUrl?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  caption?: string;
  imageType?: 'poster' | 'backdrop' | 'custom';
  year?: number;
  releaseDate?: string;
  cast?: string[];
}

interface TMDbActivityPageProps {
  onNavigate: (page: string) => void;
  previousPage?: string | null;
}

export function TMDbActivityPage({ onNavigate, previousPage }: TMDbActivityPageProps) {
  const { posts, reschedulePost, updatePostStatus, deletePost, updatePost, addPost, lastSyncTime } = useTMDbPosts();
  const { showUndo } = useUndo();
  const [filter, setFilter] = useState<'all' | 'failures' | 'published' | 'pending' | 'scheduled'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isChangeDateOpen, setIsChangeDateOpen] = useState(false);
  const [isChangeTimeOpen, setIsChangeTimeOpen] = useState(false);
  const [isEditCaptionOpen, setIsEditCaptionOpen] = useState(false);
  const [isChangeImageOpen, setIsChangeImageOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('');
  const [editedCaption, setEditedCaption] = useState('');
  const [openMenuItemId, setOpenMenuItemId] = useState<string | null>(null);

  // Get retention period from TMDb settings (default 24 hours)
  const getTMDbSettings = () => {
    try {
      const savedSettings = localStorage.getItem('screndly_tmdb_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading TMDb settings:', error);
    }
    return { tmdbActivityRetention: 24 };
  };

  const tmdbSettings = getTMDbSettings();
  const retentionHours = tmdbSettings.tmdbActivityRetention || 24;
  const retentionMs = retentionHours * 60 * 60 * 1000; // Convert to milliseconds

  // Helper function to check if an item should be filtered based on retention
  const shouldKeepItem = (item: TMDbActivityItem): boolean => {
    // Always keep scheduled and queued items regardless of age
    if (item.status === 'scheduled' || item.status === 'queued') {
      return true;
    }

    // For published and failed items, check retention period
    if (item.status === 'published' || item.status === 'failed') {
      try {
        const itemDate = new Date(item.timestamp);
        const now = new Date();
        const ageMs = now.getTime() - itemDate.getTime();
        return ageMs <= retentionMs;
      } catch (error) {
        // If parsing fails, keep the item
        return true;
      }
    }

    return true;
  };

  // Filter posts by retention period first, then by status filter
  const filteredItems = posts
    .filter(item => shouldKeepItem(item))
    .filter((item) => {
      if (filter === 'failures') return item.status === 'failed';
      if (filter === 'published') return item.status === 'published';
      if (filter === 'pending') return item.status === 'queued';
      if (filter === 'scheduled') return item.status === 'scheduled';
      return true;
    });

  const getStatusConfig = (status: TMDbActivityItem['status']) => {
    switch (status) {
      case 'queued':
        return { icon: Clock, color: 'text-gray-700 dark:text-[#9CA3AF]', bg: 'bg-gray-200 dark:bg-[#1f1f1f]', label: 'Queued' };
      case 'published':
        return { icon: CheckCircle, color: 'text-gray-700 dark:text-[#9CA3AF]', bg: 'bg-gray-200 dark:bg-[#1f1f1f]', label: 'Published' };
      case 'failed':
        return { icon: XCircle, color: 'text-[#EF4444]', bg: 'bg-[#FEE2E2] dark:bg-[#991B1B]', label: 'Failed' };
      case 'scheduled':
        return { icon: Calendar, color: 'text-gray-700 dark:text-[#9CA3AF]', bg: 'bg-gray-200 dark:bg-[#1f1f1f]', label: 'Scheduled' };
    }
  };

  const getSourceLabel = (source: TMDbActivityItem['source']) => {
    switch (source) {
      case 'tmdb_today':
        return 'Today';
      case 'tmdb_weekly':
        return 'Weekly';
      case 'tmdb_monthly':
        return 'Monthly';
      case 'tmdb_anniversary':
        return 'Anniversary';
    }
  };

  const handleRetry = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    haptics.medium();
    toast.success('Retry Initiated', {
      description: `Retrying TMDb feed: \"${title}\"`,
    });
    // Add logic to retry the TMDb feed processing here
  };

  const handlePostImmediately = (id: string, title: string) => {
    haptics.medium();

    // Find the post to get platform info
    const post = posts.find(p => p.id === id);
    const platforms = post?.platforms?.join(', ') || 'Social Media';

    // Update post status to published
    updatePostStatus(id, 'published', new Date().toISOString());

    // Add to recent activity
    addRecentActivity({
      title,
      platform: platforms,
      status: 'success',
      type: 'tmdb'
    });

    // Add to logs
    addLogEntry({
      videoTitle: title,
      platform: platforms,
      status: 'success',
      type: 'tmdb'
    });

    toast.success('Posted Successfully', {
      description: `"${title}" has been published`,
    });
  };

  const handleDelete = (id: string, title: string) => {
    haptics.medium();

    // Find the post to delete
    const deletedPost = posts.find(post => post.id === id);
    if (!deletedPost) return;

    // Temporarily remove from state
    deletePost(id);

    // Show undo toast
    showUndo({
      id,
      itemName: title,
      onUndo: () => {
        // Restore the post
        addPost(deletedPost);
      },
      onConfirm: () => {
        // Show final confirmation
        toast.success('Deleted', {
          description: `\"${title}\" has been removed`,
        });
      }
    });
  };

  const handleChangeScheduleDate = (id: string, title: string) => {
    haptics.light();
    setSelectedItemId(id);

    // Initialize with current scheduled date
    const selectedPost = posts.find(p => p.id === id);
    if (selectedPost && selectedPost.scheduledTime) {
      setSelectedDate(new Date(selectedPost.scheduledTime));
    }

    setIsChangeDateOpen(true);
  };

  const handleChangeScheduleTime = (id: string, title: string) => {
    haptics.light();
    setSelectedItemId(id);

    // Initialize with current scheduled time
    const selectedPost = posts.find(p => p.id === id);
    if (selectedPost && selectedPost.scheduledTime) {
      const currentTime = new Date(selectedPost.scheduledTime);
      const hours = currentTime.getHours().toString().padStart(2, '0');
      const minutes = currentTime.getMinutes().toString().padStart(2, '0');
      setSelectedTime(`${hours}:${minutes}`);
    }

    setIsChangeTimeOpen(true);
  };

  const handleRefresh = async () => {
    haptics.light();
    setIsRefreshing(true);

    try {
      toast.success('Refreshed TMDb Activity');

      // Simulate refresh - replace with actual refresh logic
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('[TMDbActivityPage] Refresh failed:', error);
      toast.error('Failed to refresh activity');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const handleTimeChange = (time: string) => {
    setSelectedTime(time);
  };

  const handleSaveSchedule = () => {
    if (!selectedItemId) return;

    if (selectedDate && !selectedTime) {
      // Only date changed - preserve the existing time
      const selectedPost = posts.find(p => p.id === selectedItemId);
      if (selectedPost) {
        const existingDate = new Date(selectedPost.scheduledTime);
        const hours = existingDate.getHours().toString().padStart(2, '0');
        const minutes = existingDate.getMinutes().toString().padStart(2, '0');
        const newScheduledTime = new Date(`${selectedDate.toISOString().split('T')[0]}T${hours}:${minutes}:00`).toISOString();
        reschedulePost(selectedItemId, newScheduledTime);
        toast.success('Schedule Updated');
      }
    } else if (selectedTime && selectedDate) {
      // Both date and time changed
      const newScheduledTime = new Date(`${selectedDate.toISOString().split('T')[0]}T${selectedTime}:00`).toISOString();
      reschedulePost(selectedItemId, newScheduledTime);
      toast.success('Schedule Updated');
    } else if (selectedTime) {
      // Only time changed - use the existing date
      const selectedPost = posts.find(p => p.id === selectedItemId);
      if (selectedPost) {
        const existingDate = new Date(selectedPost.scheduledTime);
        const newScheduledTime = new Date(`${existingDate.toISOString().split('T')[0]}T${selectedTime}:00`).toISOString();
        reschedulePost(selectedItemId, newScheduledTime);
        toast.success('Schedule Updated');
      }
    }

    setIsChangeDateOpen(false);
    setIsChangeTimeOpen(false);
    haptics.success();
  };

  const handleEditCaption = (id: string, title: string) => {
    haptics.light();
    setSelectedItemId(id);
    const selectedPost = posts.find(p => p.id === id);
    if (selectedPost) {
      setEditedCaption(selectedPost.caption);
    }
    setIsEditCaptionOpen(true);
  };

  const handleSaveCaption = () => {
    if (!selectedItemId) return;
    if (editedCaption.trim().length === 0) {
      toast.error('Caption cannot be empty');
      return;
    }
    if (editedCaption.length > 200) {
      toast.error('Caption too long (max 200 characters)');
      return;
    }
    updatePost(selectedItemId, { caption: editedCaption });
    haptics.success();
    toast.success('Caption Updated');
    setIsEditCaptionOpen(false);
  };

  const handleChangeImage = (id: string, title: string) => {
    haptics.light();
    setSelectedItemId(id);
    setIsChangeImageOpen(true);
  };

  const handleRegenerateCaption = async (id: string, title: string) => {
    haptics.light();
    setIsRegenerating(true);

    // Simulate AI caption generation
    setTimeout(() => {
      const selectedPost = posts.find(p => p.id === id);
      if (selectedPost) {
        const regeneratedCaptions = [
          `🎬 ${selectedPost.title} (${selectedPost.year}) - An unforgettable cinematic experience! #NowWatching`,
          `✨ Don't miss ${selectedPost.title}! Coming to theaters ${new Date(selectedPost.releaseDate).toLocaleDateString()}`,
          `🍿 ${selectedPost.title} is here! Featuring ${selectedPost.cast[0]} and more incredible talent.`,
          `🎥 Experience ${selectedPost.title} like never before. ${selectedPost.mediaType === 'movie' ? 'In theaters now!' : 'Streaming now!'}`,
        ];

        const newCaption = regeneratedCaptions[Math.floor(Math.random() * regeneratedCaptions.length)];
        updatePost(id, { caption: newCaption });
        setIsRegenerating(false);
        haptics.success();
        toast.success('Caption regenerated with AI');
      }
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start gap-4 mb-4">
          <button
            onClick={() => {
              haptics.light();
              onNavigate(previousPage || 'tmdb');
            }}
            className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12H2M9 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-gray-900 dark:text-white mb-2">TMDb Feeds Activity</h1>
            <p className="text-gray-600 dark:text-[#9CA3AF]">
              Track all TMDb feed processing status
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-4">
        {/* Total Posts - Full Width */}
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Total Posts</p>
          <p className="text-gray-900 dark:text-white text-2xl">{posts.length}</p>
        </div>

        {/* 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5">
            <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Published</p>
            <p className="text-gray-900 dark:text-white text-2xl">
              {posts.filter(item => item.status === 'published').length}
            </p>
          </div>
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5">
            <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Scheduled</p>
            <p className="text-gray-900 dark:text-white text-2xl">
              {posts.filter(item => item.status === 'scheduled').length}
            </p>
          </div>
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5">
            <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Pending</p>
            <p className="text-gray-900 dark:text-white text-2xl">
              {posts.filter(item => item.status === 'queued').length}
            </p>
          </div>
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5">
            <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Failures</p>
            <p className="text-gray-900 dark:text-white text-2xl">
              {posts.filter(item => item.status === 'failed').length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => {
              haptics.light();
              setFilter('all');
            }}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filter === 'all'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            All Activity
          </button>
          <button
            onClick={() => {
              haptics.light();
              setFilter('published');
            }}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filter === 'published'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Published
          </button>
          <button
            onClick={() => {
              haptics.light();
              setFilter('scheduled');
            }}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filter === 'scheduled'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Scheduled
          </button>
          <button
            onClick={() => {
              haptics.light();
              setFilter('pending');
            }}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filter === 'pending'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Pending
          </button>
          <button
            onClick={() => {
              haptics.light();
              setFilter('failures');
            }}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${filter === 'failures'
              ? 'bg-[#ec1e24] text-white'
              : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
              }`}
          >
            Failures
          </button>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const statusConfig = getStatusConfig(item.status);
            const StatusIcon = statusConfig.icon;

            return (
              <SwipeableActivityCard
                key={item.id}
                id={item.id}
                onDelete={(id) => handleDelete(id, item.title)}
                isScheduled={item.status === 'scheduled'}
                className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-5 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-all duration-200"
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  {item.imageUrl && (
                    <div className="w-20 h-28 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-[#1A1A1A]">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 flex flex-col">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-gray-900 dark:text-white mb-2 line-clamp-2">{item.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-black dark:bg-white text-white dark:text-black">
                            {item.mediaType === 'movie' ? 'Movie' : 'TV'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#ec1e24] text-white">
                            {getSourceLabel(item.source)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-[#9CA3AF]">{item.timestamp}</span>
                      </div>

                      {/* Status Badge and Retry Button */}
                      <div className="flex flex-col items-end gap-2">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusConfig.bg} flex-shrink-0`}>
                          {item.status !== 'scheduled' && item.status !== 'published' && <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />}
                          <span className={`text-sm ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        {item.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleRetry(e, item.id, item.title)}
                            className="gap-2 bg-white dark:bg-black"
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Platforms */}
                    {item.platforms && item.platforms.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex flex-wrap gap-1.5">
                          {item.platforms.map((platform) => (
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

                    {/* Error Message */}
                    {item.error && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-[#991B1B]/20 border border-red-200 dark:border-[#991B1B] rounded-lg mb-3">
                        <XCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-[#EF4444] flex-1">{item.error}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scheduled Date & Actions - Full Width Bar */}
                {item.status === 'scheduled' && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333333] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                        Scheduled: <span className="text-gray-900 dark:text-white">
                          {new Date(item.scheduledTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' at '}
                          {new Date(item.scheduledTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#111111]"
                      onClick={() => {
                        haptics.light();
                        setOpenMenuItemId(item.id);
                      }}
                    >
                      <MoreVertical className="w-4 h-4 text-gray-600 dark:text-[#9CA3AF]" />
                    </Button>

                    {/* Options BottomSheet */}
                    <BottomSheet open={openMenuItemId === item.id} onOpenChange={(open) => !open && setOpenMenuItemId(null)}>
                      <BottomSheetHeader>
                        <BottomSheetTitle>Options</BottomSheetTitle>
                      </BottomSheetHeader>
                      <BottomSheetBody>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => {
                              setOpenMenuItemId(null);
                              haptics.medium();
                              handlePostImmediately(item.id, item.title);
                            }}
                            className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                          >
                            Publish
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenuItemId(null);
                              haptics.light();
                              handleEditCaption(item.id, item.title);
                            }}
                            className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                          >
                            Edit Caption
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenuItemId(null);
                              haptics.light();
                              handleChangeImage(item.id, item.title);
                            }}
                            className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                          >
                            Change Image
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenuItemId(null);
                              haptics.light();
                              handleChangeScheduleDate(item.id, item.title);
                            }}
                            className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                          >
                            Change Date
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenuItemId(null);
                              haptics.light();
                              handleChangeScheduleTime(item.id, item.title);
                            }}
                            className="w-full py-2 px-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                          >
                            Change Time
                          </button>
                        </div>
                        {/* Action Divider - Full Width */}
                        <div className="my-4 -mx-6 border-t border-gray-200 dark:border-[#333333]" />
                        {/* Cancel Button */}
                        <button
                          onClick={() => {
                            haptics.light();
                            setOpenMenuItemId(null);
                          }}
                          className="w-full mb-2 py-2 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors text-center"
                        >
                          Cancel
                        </button>
                      </BottomSheetBody>
                    </BottomSheet>
                  </div>
                )}
              </SwipeableActivityCard>
            );
          })
        ) : (
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-12 text-center">
            <Clapperboard className="w-12 h-12 text-gray-400 dark:text-[#9CA3AF] mx-auto mb-4" />
            <h3 className="text-gray-900 dark:text-white mb-2">No TMDb activity</h3>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
              {filter === 'all'
                ? 'TMDb feed activity will appear here once posts are processed.'
                : `No ${filter} TMDb feeds found.`
              }
            </p>
          </div>
        )}
      </div>

      {/* Change Date Dialog */}
      <BottomSheet open={isChangeDateOpen} onOpenChange={setIsChangeDateOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Change Schedule Date</BottomSheetTitle>
          <BottomSheetDescription>
            Select a new date for the scheduled post
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="scheduled-date">Date</Label>
              <div className="mt-2">
                <DatePicker
                  date={selectedDate}
                  onDateChange={setSelectedDate}
                  placeholder="Select a date"
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]"
                />
              </div>
            </div>
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#ec1e24] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-black dark:text-white">
                  Posts are automatically spaced to prevent overlap. The system will adjust if needed.
                </p>
              </div>
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              haptics.light();
              setIsChangeDateOpen(false);
            }}
            className="bg-white dark:bg-black border-gray-200 dark:border-[#333333]"
          >
            Cancel
          </Button>
          <Button onClick={handleSaveSchedule}>
            Save Date
          </Button>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Change Time Dialog */}
      <BottomSheet open={isChangeTimeOpen} onOpenChange={setIsChangeTimeOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Change Schedule Time</BottomSheetTitle>
          <BottomSheetDescription>
            Select a new time for the scheduled post
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="scheduled-time">Time</Label>
              <div className="mt-2">
                <TimePicker
                  value={selectedTime}
                  onChange={setSelectedTime}
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]"
                />
              </div>
            </div>
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#ec1e24] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-black dark:text-white">
                  Posts are automatically spaced to prevent overlap. The system will adjust if needed.
                </p>
              </div>
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button variant="outline" onClick={() => {
            haptics.light();
            setIsChangeTimeOpen(false);
          }} className="bg-white dark:bg-black border-gray-200 dark:border-[#333333]">
            Cancel
          </Button>
          <Button onClick={() => {
            haptics.light();
            handleSaveSchedule();
          }}>
            Save Time
          </Button>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Edit Caption Dialog */}
      <BottomSheet open={isEditCaptionOpen} onOpenChange={setIsEditCaptionOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Edit Caption</BottomSheetTitle>
          <BottomSheetDescription>
            Update the caption for the post
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="caption">Caption</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (selectedItemId) {
                      haptics.light();
                      setIsRegenerating(true);

                      // Simulate AI caption generation
                      setTimeout(() => {
                        const selectedPost = posts.find(p => p.id === selectedItemId);
                        if (selectedPost) {
                          const regeneratedCaptions = [
                            `🎬 ${selectedPost.title} (${selectedPost.year}) - An unforgettable cinematic experience! #NowWatching`,
                            `✨ Don't miss ${selectedPost.title}! Coming to theaters ${new Date(selectedPost.releaseDate).toLocaleDateString()}`,
                            `🍿 ${selectedPost.title} is here! Featuring ${selectedPost.cast[0]} and more incredible talent.`,
                            `🎥 Experience ${selectedPost.title} like never before. ${selectedPost.mediaType === 'movie' ? 'In theaters now!' : 'Streaming now!'}`,
                          ];

                          const newCaption = regeneratedCaptions[Math.floor(Math.random() * regeneratedCaptions.length)];
                          setEditedCaption(newCaption);
                          setIsRegenerating(false);
                          haptics.success();
                          toast.success('Caption regenerated with AI');
                        }
                      }, 1500);
                    }
                  }}
                  disabled={isRegenerating}
                  className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-[#111111]"
                >
                  <RefreshCw className={`w-4 h-4 text-black dark:text-white ${isRegenerating ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="mt-2">
                <Textarea
                  id="caption"
                  value={editedCaption}
                  onChange={(e) => {
                    haptics.light();
                    setEditedCaption(e.target.value);
                  }}
                  onKeyDown={useChatInputKeyHandler(handleSaveCaption)}
                  onFocus={() => haptics.light()}
                  placeholder="Enter a new caption"
                  className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]"
                  disabled={isRegenerating}
                />
              </div>
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 sm:flex-1 w-full">
            <Button
              variant="outline"
              onClick={() => {
                haptics.light();
                setIsEditCaptionOpen(false);
              }}
              className="bg-white dark:bg-black border-gray-200 dark:border-[#333333] flex-1"
              disabled={isRegenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCaption}
              disabled={isRegenerating}
              className="flex-1"
            >
              Save Caption
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Change Image Dialog */}
      {selectedItemId && posts.find(p => p.id === selectedItemId) && (
        <ChangeImageBottomSheet
          open={isChangeImageOpen}
          onOpenChange={setIsChangeImageOpen}
          title={posts.find(p => p.id === selectedItemId)?.title || ''}
          mediaType={posts.find(p => p.id === selectedItemId)?.mediaType || 'movie'}
          tmdbId={posts.find(p => p.id === selectedItemId)?.tmdbId || 0}
          currentImageType={posts.find(p => p.id === selectedItemId)?.imageType}
          onSave={(imageUrl, imageType) => {
            if (selectedItemId) {
              updatePost(selectedItemId, { imageUrl, imageType });
            }
          }}
        />
      )}
    </div>
  );
}