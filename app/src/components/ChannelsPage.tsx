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
import { Trash2, Edit, RefreshCw } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { useBottomSheet } from '../hooks/useBottomSheet';
import { useUnsavedBackGuard } from '../hooks/useUnsavedBackGuard';
import { apiClient } from '../lib/api/client';
import { useUndo } from './UndoContext';

interface Channel {
  id: string;
  name: string;
  channelId: string;
  status: string;
  videoCount?: number;
}

export function ChannelsPage() {
  const addSheet = useBottomSheet();
  const editSheet = useBottomSheet();
  const { showUndo } = useUndo();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelId, setNewChannelId] = useState('');

  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelId, setEditChannelId] = useState('');
  const isAddDirty = Boolean(newChannelName.trim() || newChannelId.trim());
  const isEditDirty = Boolean(
    editingChannel && (
      editChannelName.trim() !== (editingChannel.name ?? '').trim() ||
      editChannelId.trim() !== editingChannel.channelId.trim()
    ),
  );
  const addSheetGuard = useUnsavedBackGuard({
    isDirty: isAddDirty,
    title: 'Discard new channel?',
    description: 'You have unsaved channel details in this sheet. Closing it now will lose them.',
  });
  const editSheetGuard = useUnsavedBackGuard({
    isDirty: isEditDirty,
    title: 'Discard channel changes?',
    description: 'You have unsaved edits in this channel sheet. Closing it now will lose them.',
  });

  const openAddChannel = () => {
    haptics.light();
    addSheet.open();
  };

  const closeAddChannel = () => {
    addSheet.close();
    setNewChannelName('');
    setNewChannelId('');
  };

  const closeEditChannel = () => {
    editSheet.close();
    setEditingChannel(null);
    setEditChannelName('');
    setEditChannelId('');
  };

  useEffect(() => {
    void fetchChannels();
  }, []);

  const fetchChannels = async () => {
    setIsLoading(true);

    try {
      const response = await apiClient.get<Channel[]>('/api/channels');

      if (!response.success || !Array.isArray(response.data)) {
        throw new Error(response.error?.message || 'Failed to load channels');
      }

      setChannels(response.data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load channels');
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
    }
  };

  const deleteChannel = async (id: string) => {
    haptics.medium();
    const channelIndex = channels.findIndex((channel) => channel.id === id);
    const channel = channelIndex >= 0 ? channels[channelIndex] : null;
    if (!channel) return;

    setChannels((current) => current.filter((item) => item.id !== id));

    showUndo({
      id: `channel-${id}`,
      itemName: channel.name,
      onUndo: () => {
        setChannels((current) => {
          if (current.some((item) => item.id === id)) {
            return current;
          }

          const next = [...current];
          next.splice(Math.max(0, Math.min(channelIndex, next.length)), 0, channel);
          return next;
        });
      },
      onConfirm: async () => {
        const response = await apiClient.delete(`/api/channels/${id}`);

        if (response.success) {
          toast.success('Channel removed');
          return;
        }

        setChannels((current) => {
          if (current.some((item) => item.id === id)) {
            return current;
          }

          const next = [...current];
          next.splice(Math.max(0, Math.min(channelIndex, next.length)), 0, channel);
          return next;
        });
        toast.error(response.error?.message || 'Failed to remove channel');
      }
    });
  };

  const addChannel = async () => {
    if (!newChannelId.trim()) {
      toast.error('Channel ID or handle is required');
      return;
    }

    haptics.success();
    setIsLoading(true);

    const response = await apiClient.post<Channel>('/api/channels', {
      name: newChannelName.trim(),
      channelId: newChannelId.trim()
    });

    if (response.success && response.data) {
      setChannels((current) => [response.data!, ...current]);
      closeAddChannel();
      toast.success(`Added ${response.data.name}`);
      setIsLoading(false);
      return;
    }

    toast.error(response.error?.message || 'Failed to add channel');
    setIsLoading(false);
  };

  const openEditDialog = (channel: Channel) => {
    haptics.light();
    setEditingChannel(channel);
    setEditChannelName(channel.name);
    setEditChannelId(channel.channelId);
    editSheet.open();
  };

  const requestCloseAddChannel = () => {
    addSheetGuard.guardAction(closeAddChannel);
  };

  const requestCloseEditChannel = () => {
    editSheetGuard.guardAction(closeEditChannel);
  };

  const updateChannel = async () => {
    if (!editingChannel || !editChannelId.trim()) {
      toast.error('Channel ID is required');
      return;
    }

    haptics.success();

    const response = await apiClient.patch<Channel>(`/api/channels/${editingChannel.id}`, {
      name: editChannelName.trim(),
      channelId: editChannelId.trim()
    });

    if (!response.success || !response.data) {
      toast.error(response.error?.message || 'Failed to update channel');
      return;
    }

    setChannels((current) =>
      current.map((channel) => channel.id === editingChannel.id ? response.data! : channel)
    );
    closeEditChannel();
    toast.success('Channel updated');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#111827] dark:text-white mb-2">Channels</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">Monitor YouTube channels for new 16:9 landscape trailers.</p>
        </div>
        <div className="flex gap-2">
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
          if (open) {
            editSheet.setIsOpen(true);
            return;
          }

          requestCloseEditChannel();
        }}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Edit Channel</BottomSheetTitle>
          <BottomSheetDescription>Update the channel name and ID.</BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-channel-name" className="text-gray-900 dark:text-white">Channel Name</Label>
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
              <Label htmlFor="edit-channel-id" className="text-gray-900 dark:text-white">Channel ID</Label>
              <Input
                id="edit-channel-id"
                value={editChannelId}
                onFocus={() => haptics.light()}
                onChange={(event) => {
                  haptics.selection();
                  setEditChannelId(event.target.value);
                }}
                className="rounded-lg bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] placeholder:text-gray-400 dark:placeholder:text-[#6B7280]"
              />
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              haptics.medium();
              requestCloseEditChannel();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              haptics.medium();
              void updateChannel();
            }}
            className="bg-[#ec1e24] text-white"
          >
            Save Changes
          </Button>
        </BottomSheetFooter>
      </BottomSheet>

      <div className="flex items-center justify-between mb-2 mt-2">
        <h3 className="text-gray-900 dark:text-white font-medium">
          Channels ({channels.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchChannels()}
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
                <p className="text-[#6B7280] dark:text-[#9CA3AF]">{channel.channelId}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="text-left lg:text-right">
                  <p className="text-gray-900 dark:text-white">{channel.videoCount || 0}</p>
                  <p className="text-[#6B7280] dark:text-[#9CA3AF]">videos</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={channel.status === 'active'}
                    onCheckedChange={() => void toggleChannel(channel)}
                  />
                  <span className="text-[#6B7280] dark:text-[#9CA3AF]">
                    {channel.status === 'active' ? 'Active' : 'Inactive'}
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
                    onClick={() => void deleteChannel(channel.id)}
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
            No active channels. Add one to start monitoring.
          </div>
        )}
      </div>

      <BottomSheet
        open={addSheet.isOpen}
        onOpenChange={(open) => {
          if (open) {
            addSheet.setIsOpen(true);
            return;
          }

          requestCloseAddChannel();
        }}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Add New Channel</BottomSheetTitle>
          <BottomSheetDescription>Enter the channel name and ID to add a new channel.</BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="channel-name" className="text-gray-900 dark:text-white">Channel Name</Label>
              <Input
                id="channel-name"
                placeholder="e.g., Warner Bros. Pictures"
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
              <Label htmlFor="channel-id" className="text-gray-900 dark:text-white">Channel ID / Handle</Label>
              <Input
                id="channel-id"
                placeholder="e.g., @warnerbros"
                value={newChannelId}
                onFocus={() => haptics.light()}
                onChange={(event) => {
                  haptics.selection();
                  setNewChannelId(event.target.value);
                }}
                className="rounded-lg bg-white dark:bg-[#000000] text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] placeholder:text-gray-400 dark:placeholder:text-[#6B7280]"
              />
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              haptics.medium();
              requestCloseAddChannel();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              haptics.medium();
              void addChannel();
            }}
            className="bg-[#ec1e24] text-white"
            disabled={isLoading}
          >
            Add Channel
          </Button>
        </BottomSheetFooter>
      </BottomSheet>
      {addSheetGuard.prompt}
      {editSheetGuard.prompt}
    </div>
  );
}
