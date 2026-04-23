import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownWideNarrow,
  CheckCheck,
  Clapperboard,
  ExternalLink,
  Film,
  Image as ImageIcon,
  MoreVertical,
  Rss,
  Settings as SettingsIcon,
  Video02,
  X,
  AlertCircle,
  WifiNoSignal,
} from 'lucide-react';
import { haptics } from '../utils/haptics';
import { BackIconButton } from './BackIconButton';
import { ActivitySelectionToolbar } from './ActivitySelectionToolbar';
import { SwipeableNotificationCard } from './SwipeableNotificationCard';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { apiClient } from '../lib/api/client';
import { useComposeStore } from '../store/useComposeStore';
import type { Notification, NotificationSource } from '../contexts/NotificationsContext';
import { formatCalendarDate, formatDateTime } from '../utils/calendarDate';
import { toast } from 'sonner';
import { useBackNavigation } from '../contexts/BackNavigationContext';
import { PageLoader } from './PageLoader';
import { getComposeAssetPreviewUrl } from '../lib/create/composeMedia';
import { BottomSheet, BottomSheetBody, BottomSheetHeader, BottomSheetTitle } from './ui/bottom-sheet';
import { useScrollLock } from '../hooks/useScrollLock';
import { useTransientHistoryState } from '../hooks/useTransientHistoryState';

export interface NotificationAction {
  id: string;
  label: string;
  type: 'approve' | 'schedule' | 'view' | 'dismiss';
  icon?: any;
}

interface NotificationActionTarget {
  page: string;
  tab?: 'rss' | 'tmdb';
  itemId?: string;
}

interface NotificationRelatedItem {
  id: string;
  title: string;
  link?: string;
  mediaType?: string;
  source?: string;
  status?: string;
  imageUrl?: string;
  imageType?: string;
  releaseDate?: string;
  scheduledTime?: string;
  createdAt?: string;
}

interface NotificationDetail {
  kind: 'generic' | 'tmdb_refresh' | 'post_activity';
  actionTarget?: NotificationActionTarget | null;
  relatedItems: NotificationRelatedItem[];
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onDeleteNotification?: (id: string) => void;
  onDeleteNotifications?: (ids: string[]) => Promise<void>;
  onNotificationAction?: (notificationId: string, actionType: string) => void;
  onOpenPage?: (page: string, tab?: 'rss' | 'tmdb', itemId?: string) => void;
}

function getSourceLabel(source: NotificationSource) {
  switch (source) {
    case 'tmdb':
      return 'TMDb';
    case 'rss':
      return 'RSS';
    case 'upload':
      return 'Uploads';
    case 'videostudio':
      return 'Video Studio';
    case 'create_studio':
      return 'Post';
    case 'design_studio':
      return 'Design Studio';
    case 'youtube':
      return 'YouTube';
    case 'comment':
      return 'Comments';
    default:
      return 'System';
  }
}

function getTargetLabel(target?: NotificationActionTarget | null) {
  if (!target) return 'Open';
  if (target.page === 'rss-activity') return 'Open RSS Activity';
  if (target.page === 'feeds' && target.tab === 'tmdb') return 'Open TMDb Feeds';
  if (target.page === 'feeds' && target.tab === 'rss') return 'Open RSS Feeds';
  if (target.page === 'channels' || target.page === 'platforms' || target.page === 'connections') {
    return 'Open Connections';
  }
  if (target.page === 'create') return 'Open Post';
  if (target.page === 'logs') return 'Open Logs';
  return 'Open Page';
}

function getItemMeta(item: NotificationRelatedItem) {
  const parts: string[] = [];
  if (item.mediaType) {
    parts.push(item.mediaType === 'tv' ? 'TV' : 'Movie');
  }
  if (item.source) {
    parts.push(item.source.replace(/^tmdb_/, '').replace(/_/g, ' '));
  }
  if (item.status) {
    parts.push(item.status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()));
  }
  return parts.join(' • ');
}

function extractPostLabel(title: string) {
  const parts = title.split(':');
  if (parts.length < 2) return title.trim();
  return parts.slice(1).join(':').trim();
}

function buildPostRelatedItems(notification: Notification, composeItems: ReturnType<typeof useComposeStore>['items']): NotificationRelatedItem[] {
  const label = extractPostLabel(notification.title).toLowerCase();
  if (!label) return [];

  const matches = composeItems.filter((item) => {
    const title = item.title?.toLowerCase() || '';
    const firstAssetName = item.mediaAssets?.[0]?.fileName?.toLowerCase() || '';
    const caption = item.sharedCaption?.toLowerCase() || '';
    return title === label || firstAssetName === label || caption.startsWith(label);
  });

  if (!matches.length) return [];

  return matches.map((item) => {
    const primaryAsset = item.mediaAssets?.[0] ?? item.media;
    return {
      id: item.id,
      title: item.title || primaryAsset?.fileName || 'Untitled post',
      source: 'post',
      status: item.status,
      imageUrl: getComposeAssetPreviewUrl(primaryAsset),
      scheduledTime: item.scheduledAt,
      createdAt: item.updatedAt || item.createdAt,
    };
  });
}

export function NotificationPanel({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onDeleteNotification,
  onDeleteNotifications,
  onNotificationAction,
  onOpenPage,
}: NotificationPanelProps) {
  const { registerModalWithCloseHandler, unregisterModal } = useBackNavigation();
  useScrollLock(isOpen);
  const floatingSurfaceClasses = 'border border-black/10 bg-white/90 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#050505]/88 dark:shadow-[0_16px_38px_rgba(0,0,0,0.46)]';
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActionsSheet, setShowBulkActionsSheet] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [detail, setDetail] = useState<NotificationDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const composeItems = useComposeStore((state) => state.items);
  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (filterSource && notification.source !== filterSource) return false;
        if (filterType && notification.type !== filterType) return false;
        return true;
      }),
    [filterSource, filterType, notifications]
  );
  const selection = useBulkSelection(filteredNotifications.map((notification) => notification.id));

  useEffect(() => {
    if (!isOpen) {
      setShowFilters(false);
      setShowBulkActionsSheet(false);
      setSelectedNotification(null);
      setDetail(null);
      setIsDetailLoading(false);
      selection.clearSelection();
    }
  }, [isOpen, selection.clearSelection]);

  useEffect(() => {
    if (!selectedNotification) {
      unregisterModal('notification-detail');
      return;
    }

    registerModalWithCloseHandler('notification-detail', () => {
      setSelectedNotification(null);
      setDetail(null);
    });

    return () => {
      unregisterModal('notification-detail');
    };
  }, [detail, registerModalWithCloseHandler, selectedNotification, unregisterModal]);

  useTransientHistoryState(
    selectedNotification !== null,
    'notification-detail',
    'notification-detail',
    selectedNotification ? { notificationId: selectedNotification.id } : undefined,
  );

  const unreadCount = filteredNotifications.filter((n) => !n.read).length;
  const sources = Array.from(new Set(notifications.map((n) => n.source).filter(Boolean)));

  if (!isOpen) return null;

  const handleActionClick = (notificationId: string, actionType: string, e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.medium();

    if (onNotificationAction) {
      onNotificationAction(notificationId, actionType);
    }
  };

  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return;

    setIsDeletingSelected(true);

    try {
      if (onDeleteNotifications) {
        await onDeleteNotifications(selection.selectedIds);
      } else if (onDeleteNotification) {
        selection.selectedIds.forEach((id) => onDeleteNotification(id));
      }

      toast.success(
        `${selection.selectedCount} notification${selection.selectedCount === 1 ? '' : 's'} deleted`
      );
      selection.clearSelection();
    } catch (error) {
      console.error('Failed to bulk delete notifications:', error);
      toast.error('Failed to delete selected notifications');
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const handleOpenNotification = async (notification: Notification) => {
    haptics.light();
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }

    setSelectedNotification(notification);
    setIsDetailLoading(true);

    try {
      const response = await apiClient.get<{ notification: Notification; detail: NotificationDetail }>(
        `/api/notifications/${notification.id}/detail`
      );

      if (response.success && response.data) {
        const fallbackPostItems = notification.source === 'create_studio'
          ? buildPostRelatedItems(notification, composeItems)
          : [];
        const nextDetail = fallbackPostItems.length
          ? {
            ...response.data.detail,
            kind: 'post_activity' as const,
            relatedItems: fallbackPostItems,
          }
          : response.data.detail;
        setDetail(nextDetail);
      } else {
        setDetail(notification.source === 'create_studio'
          ? {
            kind: 'post_activity',
            actionTarget: { page: 'create' },
            relatedItems: buildPostRelatedItems(notification, composeItems),
          }
          : null);
      }
    } catch (error) {
      console.error('Failed to load notification detail:', error);
      setDetail(notification.source === 'create_studio'
        ? {
          kind: 'post_activity',
          actionTarget: { page: 'create' },
          relatedItems: buildPostRelatedItems(notification, composeItems),
        }
        : null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const isYouTubeRelatedNotification = (notification: Notification) => {
    if (notification.source === 'youtube') return true;
    return /youtube/i.test(`${notification.title} ${notification.message}`);
  };

  const isDesignStudioNotification = (notification: Notification) => {
    if (notification.source === 'design_studio') return true;
    const combinedText = `${notification.title} ${notification.message}`;
    return /design studio|new fetched news available/i.test(combinedText);
  };

  const getIcon = (notification: Notification) => {
    if (isYouTubeRelatedNotification(notification)) {
      return <Video02 className="w-5 h-5 text-[#ec1e24]" />;
    }

    if (isDesignStudioNotification(notification)) {
      return <ImageIcon className="w-5 h-5 text-[#ec1e24]" />;
    }

    if (notification.source === 'rss') {
      return <Rss className="w-5 h-5 text-[#ec1e24]" />;
    }

    if (notification.source === 'tmdb') {
      return <WifiNoSignal className="w-5 h-5 text-[#ec1e24]" />;
    }

    if (notification.source === 'videostudio') {
      return <Film className="w-5 h-5 text-[#ec1e24]" />;
    }

    switch (notification.type) {
      case 'success':
        return <CheckCheck className="w-5 h-5 text-[#ec1e24]" />;
      case 'error':
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-[#ec1e24]" />;
      default:
        return <SettingsIcon className="w-5 h-5 text-[#ec1e24]" />;
    }
  };

  const renderListView = () => (
    <>
      <div className="sticky top-0 z-10 bg-gradient-to-b from-white via-white/95 to-transparent px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] dark:from-[#000000] dark:via-[#000000]/95">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-black dark:text-white text-xl">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-[#ec1e24] text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            className={`flex h-12 w-12 items-center justify-center rounded-full text-black transition-[transform,background-color,color] duration-200 hover:scale-[1.03] active:scale-95 dark:text-white ${floatingSurfaceClasses}`}
            onClick={(event) => {
              event.stopPropagation();
              haptics.light();
              onClose();
            }}
            aria-label="Close notifications"
          >
            <X className="h-[22px] w-[22px] stroke-[1.75]" />
          </button>
        </div>

        {notifications.length > 0 && !selection.selectionMode && (
          <div className={`flex items-center justify-between gap-2 rounded-full px-3 py-2 ${floatingSurfaceClasses}`}>
            <button
              onClick={() => {
                haptics.light();
                setShowFilters(!showFilters);
              }}
              className={`text-xs flex items-center gap-1 ${
                filterSource || filterType ? 'text-[#ec1e24]' : 'text-[#9CA3AF]'
              } hover:text-[#ec1e24]`}
            >
              <ArrowDownWideNarrow className="h-2.5 w-2.5" />
              Filter
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  haptics.light();
                  setShowBulkActionsSheet(true);
                }}
                className="text-[#9CA3AF] hover:text-black dark:hover:text-white p-1"
                type="button"
                aria-label="Notification actions"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {showFilters && notifications.length > 0 && !selection.selectionMode && (
          <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-[#333333]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#6B7280]">Source:</span>
              <button
                onClick={() => {
                  haptics.light();
                  setFilterSource(null);
                }}
                className={`text-xs px-2 py-1 rounded ${
                  !filterSource
                    ? 'bg-[#ec1e24] text-white'
                    : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
                }`}
              >
                All
              </button>
              {sources.map((source) => (
                <button
                  key={source}
                  onClick={() => {
                    haptics.light();
                    setFilterSource(source || null);
                  }}
                  className={`text-xs px-2 py-1 rounded capitalize ${
                    filterSource === source
                      ? 'bg-[#ec1e24] text-white'
                      : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#6B7280]">Type:</span>
              <button
                onClick={() => {
                  haptics.light();
                  setFilterType(null);
                }}
                className={`text-xs px-2 py-1 rounded ${
                  !filterType
                    ? 'bg-[#ec1e24] text-white'
                    : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
                }`}
              >
                All
              </button>
              {['success', 'error', 'warning', 'info'].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    haptics.light();
                    setFilterType(type);
                  }}
                  className={`text-xs px-2 py-1 rounded capitalize ${
                    filterType === type
                      ? 'bg-[#ec1e24] text-white'
                      : 'bg-white dark:bg-black text-gray-600 dark:text-[#9CA3AF]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`space-y-3 p-4 ${selection.selectionMode ? 'pb-36 lg:pb-4' : ''}`}>
        {selection.selectionMode && (
          <ActivitySelectionToolbar
            selectedCount={selection.selectedCount}
            isDeleting={isDeletingSelected}
            allSelected={selection.allSelected}
            onSelectAll={selection.selectAll}
            onClear={selection.clearSelection}
            onDelete={handleDeleteSelected}
            itemLabel="notifications"
            mobilePortalClassName="z-[60]"
          />
        )}
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#9CA3AF]">No notifications</p>
            <p className="text-[#6B7280] text-sm mt-1">You're all caught up!</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <SwipeableNotificationCard
              key={notification.id}
              notification={notification}
              onMarkAsRead={onMarkAsRead}
              onDelete={onDeleteNotification || (() => {})}
              selectionMode={selection.selectionMode}
              selected={selection.isSelected(notification.id)}
              onEnterSelectionMode={(id) => {
                setShowBulkActionsSheet(false);
                setShowFilters(false);
                selection.enterSelectionMode(id);
              }}
              onToggleSelection={selection.toggleSelection}
              onActionClick={handleActionClick}
              onOpen={handleOpenNotification}
            />
          ))
        )}
      </div>
    </>
  );

  const renderDetailView = () => {
    if (!selectedNotification) return null;

    const actionTarget = detail?.actionTarget;

    return (
      <>
        <div className="sticky top-0 z-10 bg-gradient-to-b from-white via-white/95 to-transparent px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] dark:from-[#000000] dark:via-[#000000]/95">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BackIconButton
                onClick={() => {
                  setSelectedNotification(null);
                  setDetail(null);
                }}
                className="shrink-0"
                ariaLabel="Back to notifications"
              />
              <div className="min-w-0">
                <h2 className="text-black dark:text-white text-xl truncate">Notification</h2>
                <p className="text-xs text-[#6B7280]">{getSourceLabel(selectedNotification.source)}</p>
              </div>
            </div>
            <button
              className={`flex h-12 w-12 items-center justify-center rounded-full text-black transition-[transform,background-color,color] duration-200 hover:scale-[1.03] active:scale-95 dark:text-white ${floatingSurfaceClasses}`}
              onClick={(event) => {
                event.stopPropagation();
                haptics.light();
                onClose();
              }}
              aria-label="Close notifications"
            >
              <X className="h-[22px] w-[22px] stroke-[1.75]" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl p-5 shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#ec1e24]/10 flex items-center justify-center flex-shrink-0">
                {getIcon(selectedNotification)}
              </div>
              <div className="min-w-0">
                <h3 className="text-gray-900 dark:text-white">{selectedNotification.title}</h3>
                <p className="text-xs text-[#6B7280] mt-1">{selectedNotification.timestamp}</p>
              </div>
            </div>

            <p className="break-words whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-[#9CA3AF]">
              {selectedNotification.message}
            </p>

            {actionTarget && onOpenPage && (
              <button
                onClick={() => {
                  haptics.medium();
                  onOpenPage(actionTarget.page, actionTarget.tab, actionTarget.itemId);
                  onClose();
                }}
                className="mt-4 inline-flex items-center gap-2 text-sm text-[#ec1e24] hover:text-[#d11b20]"
              >
                <ExternalLink className="w-4 h-4" />
                {getTargetLabel(actionTarget)}
              </button>
            )}
          </div>

          {isDetailLoading && (
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl p-6">
              <PageLoader size="sm" className="h-auto py-2" label="Loading notification details..." />
            </div>
          )}

          {!isDetailLoading && detail?.relatedItems?.length ? (
            <div className="space-y-3">
              <div>
                <h4 className="text-gray-900 dark:text-white">
                  {detail.kind === 'post_activity' ? 'Post items' : 'Related items'}
                </h4>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  {detail.kind === 'post_activity'
                    ? 'Posts linked to this notification.'
                    : 'Items created during this notification cycle.'}
                </p>
              </div>

              {detail.relatedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl p-4 shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]"
                >
                  <div className="flex gap-4">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-16 h-24 rounded-xl object-cover flex-shrink-0 border border-gray-200 dark:border-[#333333]"
                      />
                    ) : (
                      <div className="w-16 h-24 rounded-xl bg-gray-100 dark:bg-[#111111] flex items-center justify-center flex-shrink-0">
                        <Clapperboard className="w-5 h-5 text-[#6B7280]" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h5 className="text-sm text-gray-900 dark:text-white">{item.title}</h5>
                      <p className="text-xs text-[#6B7280] mt-1 capitalize">{getItemMeta(item)}</p>
                      <div className="space-y-1 mt-2">
                        {item.releaseDate && (
                          <p className="text-xs text-[#9CA3AF]">
                            Release: {formatCalendarDate(item.releaseDate)}
                          </p>
                        )}
                        {item.scheduledTime && (
                          <p className="text-xs text-[#9CA3AF]">
                            Scheduled: {formatDateTime(item.scheduledTime)}
                          </p>
                        )}
                        {item.createdAt && (
                          <p className="text-xs text-[#9CA3AF]">
                            Added: {formatDateTime(item.createdAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!isDetailLoading && detail && detail.relatedItems.length === 0 && (
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center">
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                No item details were available for this notification.
              </p>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 lg:pl-64" onClick={onClose} />

      <div
        className="fixed top-0 right-0 bottom-0 w-full lg:w-[450px] bg-white dark:bg-[#000000] z-50 overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        {selectedNotification ? renderDetailView() : renderListView()}
      </div>

      <BottomSheet
        open={showBulkActionsSheet}
        onOpenChange={setShowBulkActionsSheet}
        heightMode="auto"
        sheetId="notification-bulk-actions"
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Notification actions</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="flex flex-col gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  haptics.medium();
                  onMarkAllAsRead();
                  setShowBulkActionsSheet(false);
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-base font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
              >
                <span>Mark all as read</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                haptics.medium();
                onClearAll();
                setShowBulkActionsSheet(false);
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-base font-medium text-[#ec1e24] transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:hover:bg-[#111111]"
            >
              <span>Clear all</span>
            </button>
          </div>
          <div className="my-4 -mx-6 border-t border-gray-200 dark:border-[#333333]" />
          <button
            type="button"
            onClick={() => {
              haptics.light();
              setShowBulkActionsSheet(false);
            }}
            className="mb-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-base font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:text-white dark:hover:bg-[#111111]"
          >
            Cancel
          </button>
        </BottomSheetBody>
      </BottomSheet>
    </>
  );
}
