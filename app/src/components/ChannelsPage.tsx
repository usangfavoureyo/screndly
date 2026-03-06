import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import {
  BottomSheet,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
  BottomSheetFooter
} from './ui/bottom-sheet';
import { Trash2, Edit, RefreshCw, Radio, Clock3 } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { useBottomSheet } from '../hooks/useBottomSheet';
import { apiClient } from '../lib/api/client';

interface Channel {
  id: string;
  name: string;
  channelId: string;
  status: 'active' | 'inactive' | 'error';
  subscriberCount?: number;
  videoCount?: number;
  lastCheck?: string | null;
}

interface ChannelActivityItem {
  id: string;
  videoId: string;
  channelId: string;
  title: string;
  publishedAt: string;
  createdAt: string;
  channel?: {
    id: string;
    name: string;
  };
}

interface ChannelPollSummary {
  channelsChecked: number;
  channelsSkipped: number;
  newVideosDetected: number;
  successfulPublishes: number;
  failedPublishes: number;
}

type ChannelsUIState = 'CHANNELS' | 'ADD_CHANNEL' | 'EDIT_CHANNEL';

function formatRelativeDate(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString();
}

export function ChannelsPage() {
  const addSheet = useBottomSheet();
  const editSheet = useBottomSheet();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activity, setActivity] = useState<ChannelActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelInput, setNewChannelInput] = useState('');

  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelInput, setEditChannelInput] = useState('');

  const [uiState, setUIState] = useState<ChannelsUIState>('CHANNELS');

  const openAddChannel = () => {
    haptics.light();
    setUIState('ADD_CHANNEL');
    addSheet.open();
  };

  const closeAddChannel = () => {
    addSheet.close();
    setNewChannelName('');
    setNewChannelInput('');
    setUIState('CHANNELS');
  };

  const closeEditChannel = () => {
    editSheet.close();
    setEditingChannel(null);
    setEditChannelName('');
    setEditChannelInput('');
    setUIState('CHANNELS');
  };

  useEffect(() => {
    if (uiState === 'CHANNELS') return;

    window.history.pushState({ uiState }, '');

    const handlePopState = () => {
      if (uiState === 'ADD_CHANNEL') {
        closeAddChannel();
      } else if (uiState === 'EDIT_CHANNEL') {
        closeEditChannel();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [uiState]);

  useEffect(() => {
    void refreshData();
  }, []);

  const fetchChannels = async () => {
    const response = await apiClient.get<Channel[]>('/api/channels');
    if (response.success && Array.isArray(response.data)) {
      setChannels(response.data);
      return;
    }

    throw new Error(response.error?.message || 'Failed to load channels');
  };

  const fetchActivity = async () => {
    const response = await apiClient.get<ChannelActivityItem[]>('/api/channels/activity');
    if (response.success && Array.isArray(response.data)) {
      setActivity(response.data);
      return;
    }

    throw new Error(response.error?.message || 'Failed to load channel activity');
  };

  const refreshData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchChannels(), fetchActivity()]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh channels');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChannel = async (channel: Channel) => {
    haptics.light();
    const nextStatus = channel.status === 'active' ? 'inactive' : 'active';
    const previousChannels = [...channels];

    setChannels((current) =>
      current.map((item) => item.id === channel.id ? { ...item, status: nextStatus } : item)
    );

    const response = await apiClient.patch<Channel>(`/api/channels/${channel.id}`, { status: nextStatus });
    if (!response.success) {
      setChannels(previousChannels);
      toast.error(response.error?.message || 'Failed to update channel status');
      return;
    }

    toast.success(`${channel.name} ${nextStatus === 'active' ? 'activated' : 'paused'}`);
  };

  const deleteChannel = async (id: string) => {
    haptics.medium();
    const previousChannels = [...channels];

    setChannels((current) => current.filter((channel) => channel.id !== id));

    const response = await apiClient.delete(`/api/channels/${id}`);
    if (!response.success) {
      setChannels(previousChannels);
      toast.error(response.error?.message || 'Failed to remove channel');
      return;
    }

    toast.success('Channel removed');
    await fetchActivity().catch(() => undefined);
  };

  const addChannel = async () => {
    if (!newChannelInput.trim()) {
      toast.error('Enter a channel URL, ID, @handle, or name');
      return;
    }

    haptics.success();
    setIsLoading(true);

    const response = await apiClient.post<Channel>('/api/channels', {
      name: newChannelName.trim(),
      channelId: newChannelInput.trim()
    });

    if (response.success) {
      toast.success('Channel saved');
      closeAddChannel();
      await refreshData();
    } else {
      toast.error(response.error?.message || 'Failed to add channel');
      setIsLoading(false);
    }
  };

  const openEditDialog = (channel: Channel) => {
    haptics.light();
    setEditingChannel(channel);
    setEditChannelName(channel.name);
    setEditChannelInput(channel.channelId);
    setUIState('EDIT_CHANNEL');
    editSheet.open();
  };

  const saveEditedChannel = async () => {
    if (!editingChannel || !editChannelInput.trim()) {
      toast.error('Enter a channel URL, ID, @handle, or name');
      return;
    }

    haptics.success();

    const response = await apiClient.patch<Channel>(`/api/channels/${editingChannel.id}`, {
      name: editChannelName.trim(),
      channelId: editChannelInput.trim()
    });

    if (!response.success) {
      toast.error(response.error?.message || 'Failed to update channel');
      return;
    }

    toast.success('Channel updated');
    closeEditChannel();
    await refreshData();
  };

  const pollNow = async () => {
    haptics.medium();
    setIsPolling(true);

    const response = await apiClient.post<ChannelPollSummary>('/api/channels/poll', {});
    setIsPolling(false);

    if (!response.success || !response.data) {
      toast.error(response.error?.message || 'Polling failed');
      return;
    }

    const summary = response.data;
    toast.success(
      `Checked ${summary.channelsChecked} channel${summary.channelsChecked === 1 ? '' : 's'} • ${summary.newVideosDetected} new trailer${summary.newVideosDetected === 1 ? '' : 's'} • ${summary.successfulPublishes} publish success`
    );

    await refreshData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[#111827] dark:text-white mb-2">Channels</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">
            Monitor YouTube channels for trailers and teasers, then publish detected items to your active platforms.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={pollNow}
            disabled={isPolling}
            className="rounded-xl gap-2 bg-white dark:bg-[#000000] border-gray-300 dark:border-[#333333] text-gray-900 dark:text-white"
          >
            <Radio className={`w-4 h-4 ${isPolling ? 'animate-pulse' : ''}`} />
            Poll Now
          </Button>
          <Button
            onClick={openAddChannel}
            className="bg-[#ec1e24] hover:bg-[#d11b20] text-white rounded-xl gap-2"
          >
            Add Channel
          </Button>
        </div>
      </div>

      <BottomSheet
        open={editSheet.isOpen}
        onOpenChange={(open) => {
          if (!open) closeEditChannel();
          editSheet.setOpen(open);
        }}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Edit Channel</BottomSheetTitle>
          <BottomSheetDescription>
            Update the display name or the lookup value used to resolve this YouTube channel.
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-channel-name" className="text-gray-900 dark:text-white">Display Name (optional)</Label>
              <Input
                id="edit-channel-name"
                value={editChannelName}
                onFocus={() => haptics.light()}
                onChange={(event) => {
                  haptics.selection();
                  setEditChannelName(event.target.value);
                }}
                className="rounded-lg bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] placeholder:text-gray-400 dark:placeholder:text-[#6B7280]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-channel-id" className="text-gray-900 dark:text-white">Channel URL / ID / Handle / Name</Label>
              <Input
                id="edit-channel-id"
                value={editChannelInput}
                onFocus={() => haptics.light()}
                onChange={(event) => {
                  haptics.selection();
                  setEditChannelInput(event.target.value);
                }}
                placeholder="https://youtube.com/@universalpictures or Universal Pictures"
                className="rounded-lg bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] placeholder:text-gray-400 dark:placeholder:text-[#6B7280]"
              />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                The backend resolves this to the canonical YouTube channel ID used for polling.
              </p>
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button variant="outline" onClick={closeEditChannel}>Cancel</Button>
          <Button onClick={saveEditedChannel} className="bg-[#ec1e24] text-white">Save Changes</Button>
        </BottomSheetFooter>
      </BottomSheet>

      <div className="flex items-center justify-between mb-2 mt-2">
        <h3 className="text-gray-900 dark:text-white font-medium">
          Channels ({channels.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshData}
          disabled={isLoading}
          className="h-9 w-9 p-0 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-gray-900 dark:text-white mb-1">{channel.name}</h3>
                <p className="text-[#6B7280] dark:text-[#9CA3AF] break-all">{channel.channelId}</p>
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  <span className="flex items-center gap-1">
                    <Clock3 className="w-3.5 h-3.5" />
                    Last check: {formatRelativeDate(channel.lastCheck)}
                  </span>
                  <span>{channel.subscriberCount || 0} subscribers</span>
                  <span>{channel.videoCount || 0} processed videos</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={channel.status === 'active'}
                    onCheckedChange={() => toggleChannel(channel)}
                  />
                  <span className="text-[#6B7280] dark:text-[#9CA3AF]">
                    {channel.status === 'active' ? 'Active' : channel.status === 'inactive' ? 'Paused' : 'Attention'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(channel)}
                    className="text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#ec1e24] rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteChannel(channel.id)}
                    className="text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#EF4444] rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {channels.length === 0 && !isLoading && (
          <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center text-gray-500">
            No channels configured yet. Add a YouTube URL, channel ID, @handle, or searchable channel name to start monitoring.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-gray-900 dark:text-white mb-1">Recent Detections</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Latest trailer items the poller has already seen.
          </p>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] divide-y divide-gray-200 dark:divide-[#222222]">
          {activity.slice(0, 8).map((item) => (
            <div key={item.id} className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                  {item.channel?.name || item.channelId}
                </p>
              </div>
              <div className="text-right text-xs text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">
                <div>Published: {formatRelativeDate(item.publishedAt)}</div>
                <div>Tracked: {formatRelativeDate(item.createdAt)}</div>
              </div>
            </div>
          ))}

          {activity.length === 0 && (
            <div className="p-6 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              No channel activity yet. Run a poll or wait for the scheduled poller to detect a trailer.
            </div>
          )}
        </div>
      </div>

      <BottomSheet
        open={addSheet.isOpen}
        onOpenChange={(open) => {
          if (!open) closeAddChannel();
          addSheet.setOpen(open);
        }}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Add New Channel</BottomSheetTitle>
          <BottomSheetDescription>
            Add a YouTube channel using its URL, channel ID, @handle, or name. The backend will resolve and store the canonical channel ID.
          </BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="channel-name" className="text-gray-900 dark:text-white">Display Name (optional)</Label>
              <Input
                id="channel-name"
                placeholder="e.g., Universal Pictures"
                value={newChannelName}
                onFocus={() => haptics.light()}
                onChange={(event) => {
                  haptics.selection();
                  setNewChannelName(event.target.value);
                }}
                className="rounded-lg bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] placeholder:text-gray-400 dark:placeholder:text-[#6B7280]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-input" className="text-gray-900 dark:text-white">Channel URL / ID / Handle / Name</Label>
              <Input
                id="channel-input"
                placeholder="e.g., https://youtube.com/@universalpictures or Universal Pictures"
                value={newChannelInput}
                onFocus={() => haptics.light()}
                onChange={(event) => {
                  haptics.selection();
                  setNewChannelInput(event.target.value);
                }}
                className="rounded-lg bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] placeholder:text-gray-400 dark:placeholder:text-[#6B7280]"
              />
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button variant="outline" onClick={closeAddChannel}>Cancel</Button>
          <Button onClick={addChannel} className="bg-[#ec1e24] text-white" disabled={isLoading}>
            Add Channel
          </Button>
        </BottomSheetFooter>
      </BottomSheet>
    </div>
  );
}
