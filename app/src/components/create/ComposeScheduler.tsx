import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useComposeStore } from '../../store/useComposeStore';
import { publishComposeItem } from '../../lib/create/composePublish';
import { validateComposeItemAction } from '../../lib/create/composeValidation';

const PUBLISH_LOCK_MS = 10 * 60 * 1000;

function isInterruptedPublishError(message: string | undefined): boolean {
  if (!message) return false;
  return /failed to fetch|network|timed out|timeout|load failed|connection|aborted/i.test(message);
}

export function ComposeScheduler() {
  const { items, saveItem } = useComposeStore();
  const processingIdsRef = useRef<Set<string>>(new Set());
  const publishControllersRef = useRef<Map<string, { controller: AbortController; scheduledAt?: string }>>(new Map());

  useEffect(() => {
    for (const [itemId, activePublish] of publishControllersRef.current.entries()) {
      const currentItem = items.find((item) => item.id === itemId);
      if (!currentItem || currentItem.status !== 'scheduled' || currentItem.scheduledAt !== activePublish.scheduledAt) {
        activePublish.controller.abort();
        publishControllersRef.current.delete(itemId);
      }
    }
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    const processDueItems = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }

      const now = Date.now();
      const dueItems = items.filter(
        (item) =>
          item.status === 'scheduled' &&
          item.scheduledAt &&
          new Date(item.scheduledAt).getTime() <= now &&
          (!item.publishLockExpiresAt || new Date(item.publishLockExpiresAt).getTime() <= now) &&
          !processingIdsRef.current.has(item.id),
      );

      for (const item of dueItems) {
        const latestItem = useComposeStore.getState().items.find((entry) => entry.id === item.id);
        if (!latestItem || latestItem.status !== 'scheduled' || latestItem.scheduledAt !== item.scheduledAt) {
          continue;
        }
        const validation = validateComposeItemAction(latestItem, {
          mode: 'published',
          scheduledAt: latestItem.scheduledAt,
        });
        if (!validation.ok) {
          saveItem({
            ...latestItem,
            status: 'failed',
            updatedAt: new Date().toISOString(),
            publishLockExpiresAt: undefined,
            lastPublishAttemptAt: new Date().toISOString(),
            publishRetryCount: (latestItem.publishRetryCount ?? 0) + 1,
            error: validation.error,
          });
          toast.error(validation.error);
          continue;
        }

        processingIdsRef.current.add(item.id);
        const attemptStartedAt = new Date().toISOString();
        const publishLockExpiresAt = new Date(Date.now() + PUBLISH_LOCK_MS).toISOString();
        const controller = new AbortController();
        publishControllersRef.current.set(item.id, {
          controller,
          scheduledAt: latestItem.scheduledAt,
        });

        saveItem({
          ...latestItem,
          publishLockExpiresAt,
          lastPublishAttemptAt: attemptStartedAt,
          error: undefined,
        });

        try {
          const result = await publishComposeItem(latestItem, { signal: controller.signal });
          if (cancelled) return;
          const currentItem = useComposeStore.getState().items.find((entry) => entry.id === item.id);
          if (!currentItem || currentItem.status !== 'scheduled' || currentItem.scheduledAt !== latestItem.scheduledAt) {
            continue;
          }

          const updatedAt = new Date().toISOString();
          const nextStatus = result.postedPlatforms.length > 0 ? 'published' : 'failed';
          const nextError =
            nextStatus === 'published'
              ? undefined
              : result.failedResults.length > 0
                ? result.errorMessage || 'Some platforms failed to publish.'
                : undefined;

          saveItem({
            ...currentItem,
            status: nextStatus,
            updatedAt,
            scheduledAt: nextStatus === 'published' ? undefined : currentItem.scheduledAt,
            publishLockExpiresAt: undefined,
            lastPublishAttemptAt: attemptStartedAt,
            publishRetryCount: nextStatus === 'failed' ? (currentItem.publishRetryCount ?? 0) + 1 : 0,
            error: nextError,
          });

          if (result.postedPlatforms.length > 0) {
            toast.success(
              result.failedResults.length > 0
                ? `Scheduled post published to ${result.postedPlatforms.join(', ')}.`
                : `Scheduled post published to ${result.postedPlatforms.join(', ')}.`,
            );
          } else {
            toast.error(nextError || 'Failed to publish scheduled post');
          }
        } catch (error) {
          if (cancelled) return;
          const currentItem = useComposeStore.getState().items.find((entry) => entry.id === item.id);
          if (!currentItem || currentItem.status !== 'scheduled' || currentItem.scheduledAt !== latestItem.scheduledAt) {
            continue;
          }

          const message = error instanceof Error ? error.message : 'Failed to publish scheduled post';
          const safeMessage = isInterruptedPublishError(message)
            ? 'Scheduled publish request was interrupted. Check whether the post already published before retrying.'
            : message;
          saveItem({
            ...currentItem,
            status: 'failed',
            updatedAt: new Date().toISOString(),
            publishLockExpiresAt: undefined,
            lastPublishAttemptAt: attemptStartedAt,
            publishRetryCount: (currentItem.publishRetryCount ?? 0) + 1,
            error: safeMessage,
          });
          toast.error(safeMessage);
        } finally {
          processingIdsRef.current.delete(item.id);
          publishControllersRef.current.delete(item.id);
        }
      }
    };

    processDueItems();
    const intervalId = window.setInterval(processDueItems, 30000);
    const handleResume = () => {
      void processDueItems();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void processDueItems();
      }
    };
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      publishControllersRef.current.forEach(({ controller }) => controller.abort());
      publishControllersRef.current.clear();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [items, saveItem]);

  return null;
}
