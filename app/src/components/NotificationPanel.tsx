import { useEffect, useMemo, useState } from 'react';
import {
  CheckCheck,
  Clapperboard,
  ExternalLink,
  Filter,
  Film,
  MoreVertical,
  Settings as SettingsIcon,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react';
import { haptics } from '../utils/haptics';
import { BackIconButton } from './BackIconButton';
import { SwipeableNotificationCard } from './SwipeableNotificationCard';
import { apiClient } from '../lib/api/client';
import type { Notification, NotificationSource } from '../contexts/NotificationsContext';

export interface NotificationAction {
  id: string;
  label: string;
  type: 'approve' | 'schedule' | 'view' | 'dismiss';
  icon?: any;
}

interface NotificationActionTarget {
  page: string;
  tab?: 'rss' | 'tmdb';
}

interface NotificationRelatedItem {
  id: string;
  title: string;
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
  kind: 'generic' | 'tmdb_refresh';
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
  onNotificationAction?: (notificationId: string, actionType: string) => void;
  onOpenPage?: (page: string, tab?: 'rss' | 'tmdb') => void;
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
  if (target.page === 'feeds' && target.tab === 'tmdb') return 'Open TMDb Feeds';
  if (target.page === 'feeds' && target.tab === 'rss') return 'Open RSS Feeds';
  if (target.page === 'channels') return 'Open Channels';
  if (target.page === 'logs') return 'Open Logs';
  return 'Open Page';
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
    parts.push(item.status);
  }
  return parts.join(' • ');
}

export function NotificationPanel({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onDeleteNotification,
  onNotificationAction,
  onOpenPage,
}: NotificationPanelProps) {
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [detail, setDetail] = useState<NotificationDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowFilters(false);
      setShowMenu(false);
      setSelectedNotification(null);
      setDetail(null);
      setIsDetailLoading(false);
    }
  }, [isOpen]);

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (filterSource && notification.source !== filterSource) return false;
        if (filterType && notification.type !== filterType) return false;
        return true;
      }),
    [filterSource, filterType, notifications]
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
        setDetail(response.data.detail);
      } else {
        setDetail(null);
      }
    } catch (error) {
      console.error('Failed to load notification detail:', error);
      setDetail(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const getIcon = (notification: Notification) => {
    if (notification.source === 'tmdb') {
      return <Clapperboard className="w-5 h-5 text-[#ec1e24]" />;
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
      <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 z-10">
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
            className="text-black dark:text-white p-1"
            onClick={() => {
              haptics.light();
              onClose();
            }}
          >
            <X className="w-[26px] h-[26px] stroke-1" />
          </button>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                haptics.light();
                setShowFilters(!showFilters);
              }}
              className={`text-xs flex items-center gap-1 ${
                filterSource || filterType ? 'text-[#ec1e24]' : 'text-[#9CA3AF]'
              } hover:text-[#ec1e24]`}
            >
              <Filter className="w-3 h-3" />
              Filter
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  haptics.light();
                  setShowMenu(!showMenu);
                }}
                className="text-[#9CA3AF] hover:text-black dark:hover:text-white p-1"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => {
                      haptics.light();
                      setShowMenu(false);
                    }}
                  />

                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#000000] rounded-lg shadow-lg dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-[#333333] py-1 z-20">
                    {unreadCount > 0 && (
                      <button
                        onClick={() => {
                          haptics.medium();
                          onMarkAllAsRead();
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A] flex items-center gap-2"
                      >
                        <CheckCheck className="w-4 h-4" />
                        Mark all as read
                      </button>
                    )}
                    <button
                      onClick={() => {
                        haptics.medium();
                        onClearAll();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-[#ec1e24] hover:bg-gray-50 dark:hover:bg-[#1A1A1A] flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear all
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showFilters && notifications.length > 0 && (
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

      <div className="p-4 space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-200 dark:bg-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCheck className="w-8 h-8 text-[#6B7280]" />
            </div>
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
        <div className="sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BackIconButton
                onClick={() => {
                  setSelectedNotification(null);
                  setDetail(null);
                }}
                className="text-black dark:text-white hover:text-[#ec1e24] p-1 -ml-1"
                ariaLabel="Back to notifications"
              />
              <div className="min-w-0">
                <h2 className="text-black dark:text-white text-xl truncate">Notification</h2>
                <p className="text-xs text-[#6B7280]">{getSourceLabel(selectedNotification.source)}</p>
              </div>
            </div>
            <button
              className="text-black dark:text-white p-1"
              onClick={() => {
                haptics.light();
                onClose();
              }}
            >
              <X className="w-[26px] h-[26px] stroke-1" />
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

            <p className="text-sm text-gray-600 dark:text-[#9CA3AF] leading-6">{selectedNotification.message}</p>

            {actionTarget && onOpenPage && (
              <button
                onClick={() => {
                  haptics.medium();
                  onOpenPage(actionTarget.page, actionTarget.tab);
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
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center text-[#6B7280]">
              Loading details...
            </div>
          )}

          {!isDetailLoading && detail?.relatedItems?.length ? (
            <div className="space-y-3">
              <div>
                <h4 className="text-gray-900 dark:text-white">Related items</h4>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                  Items created during this notification cycle.
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
                            Release: {formatDateTime(item.releaseDate)}
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

      <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[450px] bg-white dark:bg-[#000000] z-50 overflow-y-auto">
        {selectedNotification ? renderDetailView() : renderListView()}
      </div>
    </>
  );
}
