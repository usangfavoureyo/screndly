import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { ActivitySelectionToolbar } from './ActivitySelectionToolbar';
import {
  BottomSheet,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
  BottomSheetFooter
} from './ui/bottom-sheet';
import { Trash2, Edit, RefreshCw, Check } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { useBottomSheet } from '../hooks/useBottomSheet';
import { useUnsavedBackGuard } from '../hooks/useUnsavedBackGuard';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { apiClient } from '../lib/api/client';
import { useUndo } from './UndoContext';

interface Channel {
  id: string;
  name: string;
  channelId: string;
  status: string;
  videoCount?: number;
}

interface ChannelScanNowResponse {
  status: 'queued' | 'already_scanning';
  message?: string;
}

interface ChannelCardProps {
  channel: Channel;
  onToggle: (channel: Channel) => void;
  onScanNow: (channel: Channel) => void;
  onEdit: (channel: Channel) => void;
  onDelete: (id: string) => void;
  isScanning?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onEnterSelectionMode?: (id: string) => void;
  onToggleSelection?: (id: string) => void;
}

function ChannelCard({
  channel,
  onToggle,
  onScanNow,
  onEdit,
  onDelete,
  isScanning = false,
  selectionMode = false,
  selected = false,
  onEnterSelectionMode,
  onToggleSelection,
}: ChannelCardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeXRef = useRef(0);
  const swipeDirectionRef = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const startX = useRef(0);
  const startY = useRef(0);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const LONG_PRESS_MS = 450;
  const MOVE_CANCEL_THRESHOLD = 10;

  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(
      target.closest('button, input, textarea, select, label, [role="switch"], [data-prevent-swipe="true"]'),
    );

  const clearLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    pressOriginRef.current = null;
  };

  const startLongPress = (clientX: number, clientY: number, target: EventTarget | null) => {
    clearLongPress();
    longPressTriggeredRef.current = false;

    if (selectionMode || !onEnterSelectionMode || isInteractiveTarget(target)) {
      return;
    }

    pressOriginRef.current = { x: clientX, y: clientY };
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      haptics.medium();
      onEnterSelectionMode(channel.id);
    }, LONG_PRESS_MS);
  };

  const cancelLongPressOnMovement = (clientX: number, clientY: number) => {
    if (!pressOriginRef.current) return;

    const deltaX = Math.abs(clientX - pressOriginRef.current.x);
    const deltaY = Math.abs(clientY - pressOriginRef.current.y);
    if (deltaX > MOVE_CANCEL_THRESHOLD || deltaY > MOVE_CANCEL_THRESHOLD) {
      clearLongPress();
    }
  };

  const resetSwipe = () => {
    clearLongPress();
    swipeDirectionRef.current = 'none';
    swipeXRef.current = 0;
    hasDraggedRef.current = false;
    setSwipeX(0);
    setIsSwiping(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(e.target)) {
      swipeDirectionRef.current = 'vertical';
      return;
    }

    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    hasDraggedRef.current = false;
    swipeDirectionRef.current = 'none';
    swipeXRef.current = 0;
    startLongPress(e.touches[0].clientX, e.touches[0].clientY, e.target);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    cancelLongPressOnMovement(e.touches[0].clientX, e.touches[0].clientY);

    if (selectionMode || longPressTriggeredRef.current) {
      return;
    }

    if (swipeDirectionRef.current === 'vertical') {
      return;
    }

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;
    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);

    if (absDiffX > 6 || absDiffY > 6) {
      hasDraggedRef.current = true;
    }

    if (swipeDirectionRef.current === 'none') {
      if (absDiffY >= 10 && absDiffY > absDiffX) {
        swipeDirectionRef.current = 'vertical';
        return;
      }

      if (absDiffX >= 24 && absDiffX > absDiffY * 2) {
        swipeDirectionRef.current = 'horizontal';
        setIsSwiping(true);
      } else {
        return;
      }
    }

    if (swipeDirectionRef.current === 'horizontal') {
      e.preventDefault();
      e.stopPropagation();
      const maxSwipe = 120;
      const clampedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diffX));
      swipeXRef.current = clampedDiff;
      setSwipeX(clampedDiff);
    }
  };

  const handleTouchEnd = () => {
    clearLongPress();

    if (selectionMode || longPressTriggeredRef.current) {
      if (selectionMode && !longPressTriggeredRef.current && !hasDraggedRef.current) {
        haptics.light();
        onToggleSelection?.(channel.id);
      }
      longPressTriggeredRef.current = false;
      resetSwipe();
      return;
    }

    if (swipeDirectionRef.current === 'horizontal') {
      const threshold = 90;

      if (swipeXRef.current > threshold) {
        haptics.medium();
        onEdit(channel);
      } else if (swipeXRef.current < -threshold) {
        haptics.medium();
        onDelete(channel.id);
      }
    }

    resetSwipe();
  };

  const handleTouchCancel = () => {
    longPressTriggeredRef.current = false;
    resetSwipe();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    startLongPress(e.clientX, e.clientY, e.target);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    cancelLongPressOnMovement(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    clearLongPress();
  };

  const handleMouseLeave = () => {
    clearLongPress();
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(e.target)) {
      return;
    }

    if (selectionMode) {
      haptics.light();
      onToggleSelection?.(channel.id);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl group">
      <div className={`absolute inset-0 flex items-stretch justify-between rounded-2xl overflow-hidden ${selectionMode ? 'hidden' : ''}`}>
        <div
          className="flex h-full w-[120px] items-center justify-center bg-[#111827] px-6 text-white transition-opacity"
          style={{ opacity: swipeX > 0 ? 1 : 0 }}
        >
          <div className="flex flex-col items-center gap-1">
            <Edit className="w-5 h-5" />
            <span className="text-xs whitespace-nowrap">Edit</span>
          </div>
        </div>
        <div className="flex-1" />
        <div
          className="flex h-full w-[120px] items-center justify-center bg-[#ec1e24] px-6 text-white transition-opacity"
          style={{ opacity: swipeX < 0 ? 1 : 0 }}
        >
          <div className="flex flex-col items-center gap-1">
            <Trash2 className="w-5 h-5" />
            <span className="text-xs whitespace-nowrap">Delete</span>
          </div>
        </div>
      </div>

      <div
        className={`bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 transition-all duration-200 touch-pan-y hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] ${
          selected
            ? 'ring-2 ring-[#ec1e24] bg-[#ec1e24]/5'
            : selectionMode
              ? 'ring-1 ring-[#ec1e24]/30'
              : ''
        }`}
        style={{
          transform: `translateX(${selectionMode ? 0 : swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onClick={handleClick}
      >
        {selectionMode && (
          <button
            type="button"
            aria-label={selected ? 'Unselect channel card' : 'Select channel card'}
            aria-pressed={selected}
            data-prevent-swipe="true"
            className="absolute right-4 top-4 z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              haptics.light();
              onToggleSelection?.(channel.id);
            }}
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                selected
                  ? 'border-[#ec1e24] bg-[#ec1e24] text-white'
                  : 'border-gray-300 bg-white/95 text-transparent dark:border-[#333333] dark:bg-[#050505]/95'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
            </div>
          </button>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-gray-900 dark:text-white mb-1">{channel.name}</h3>
            <p className="text-[#6B7280] dark:text-[#9CA3AF] break-all">{channel.channelId}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-left lg:text-right">
              <p className="text-gray-900 dark:text-white">{channel.videoCount || 0}</p>
              <p className="text-[#6B7280] dark:text-[#9CA3AF]">videos</p>
            </div>
            <div className="flex items-center gap-2" data-prevent-swipe="true">
              <Switch
                checked={channel.status === 'active'}
                onCheckedChange={() => void onToggle(channel)}
                disabled={selectionMode || isScanning}
              />
              <span className="text-[#6B7280] dark:text-[#9CA3AF]">
                {channel.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              data-prevent-swipe="true"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onScanNow(channel);
              }}
              disabled={selectionMode || isScanning || channel.status !== 'active'}
              className="h-10 w-24 rounded-lg border-gray-300 bg-white px-4 text-gray-900 hover:border-[#ec1e24] hover:text-[#ec1e24] dark:border-[#333333] dark:bg-[#050505] dark:text-white"
            >
              Scan
            </Button>
            <div className={`hidden lg:flex items-center gap-2 transition-opacity duration-200 ${selectionMode ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(channel)}
                className="text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#ec1e24] rounded-lg"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void onDelete(channel.id)}
                className="text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#EF4444] rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ChannelsTabContentProps {
  showHeader?: boolean;
}

export function ChannelsTabContent({ showHeader = false }: ChannelsTabContentProps) {
  const addSheet = useBottomSheet();
  const editSheet = useBottomSheet();
  const { showUndo } = useUndo();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [scanningChannelIds, setScanningChannelIds] = useState<Set<string>>(() => new Set());

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
  const selection = useBulkSelection(channels.map((channel) => channel.id));

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

  const scanChannelNow = async (channel: Channel) => {
    if (channel.status !== 'active' || scanningChannelIds.has(channel.id)) {
      return;
    }

    haptics.medium();
    setScanningChannelIds((current) => new Set(current).add(channel.id));

    try {
      const response = await apiClient.post<ChannelScanNowResponse>(`/api/channels/${channel.id}/scan-now`, {});

      if (!response.success || !response.data) {
        toast.error(response.error?.message || `Failed to scan ${channel.name}`);
        return;
      }

      const { status, message } = response.data;
      if (status === 'already_scanning') {
        toast.info(`${channel.name} is already scanning`);
      } else {
        toast.success(message || `${channel.name} scan started`);
      }

      void fetchChannels();
    } catch (error: any) {
      toast.error(error?.message || `Failed to scan ${channel.name}`);
    } finally {
      setScanningChannelIds((current) => {
        const next = new Set(current);
        next.delete(channel.id);
        return next;
      });
    }
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

  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return;

    haptics.medium();
    setIsDeletingSelected(true);

    const selectedIdSet = new Set(selection.selectedIds);
    const removedChannels = channels.filter((channel) => selectedIdSet.has(channel.id));

    setChannels((current) => current.filter((channel) => !selectedIdSet.has(channel.id)));

    try {
      await Promise.all(selection.selectedIds.map((id) => apiClient.delete(`/api/channels/${id}`)));
      toast.success(`${selection.selectedCount} channel${selection.selectedCount === 1 ? '' : 's'} deleted`);
      selection.clearSelection();
    } catch (error) {
      console.error('Failed to bulk delete channels:', error);
      setChannels((current) => {
        const existingIds = new Set(current.map((channel) => channel.id));
        const next = [...current];

        removedChannels.forEach((channel) => {
          if (!existingIds.has(channel.id)) {
            next.push(channel);
          }
        });

        return next;
      });
      toast.error('Failed to delete selected channels');
    } finally {
      setIsDeletingSelected(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`flex gap-2 ${showHeader ? 'items-center justify-between' : 'justify-end'}`}>
        {showHeader && (
          <div>
            <h1 className="text-[#111827] dark:text-white mb-2">Channels</h1>
            <p className="text-[#6B7280] dark:text-[#9CA3AF]">Monitor YouTube channels for new 16:9 landscape trailers.</p>
          </div>
        )}
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

      <div className="flex items-center justify-between mb-2 mt-2 gap-3">
        <h3 className="text-gray-900 dark:text-white font-medium">
          Channels ({channels.length})
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchChannels()}
            disabled={isLoading}
            className="h-9 w-9 p-0 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={openAddChannel}
            className="bg-[#ec1e24] hover:bg-[#d11b20] text-white rounded-xl gap-2"
          >
            Add Channel
          </Button>
        </div>
      </div>

      {selection.selectionMode && (
        <ActivitySelectionToolbar
          selectedCount={selection.selectedCount}
          isDeleting={isDeletingSelected}
          allSelected={selection.allSelected}
          onSelectAll={selection.selectAll}
          onClear={selection.clearSelection}
          onDelete={handleDeleteSelected}
          itemLabel="channels"
        />
      )}

      <div className="grid grid-cols-1 gap-4">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            onToggle={toggleChannel}
            onScanNow={scanChannelNow}
            onEdit={openEditDialog}
            onDelete={deleteChannel}
            isScanning={scanningChannelIds.has(channel.id)}
            selectionMode={selection.selectionMode}
            selected={selection.isSelected(channel.id)}
            onEnterSelectionMode={selection.enterSelectionMode}
            onToggleSelection={selection.toggleSelection}
          />
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

export function ChannelsPage() {
  return <ChannelsTabContent showHeader />;
}
