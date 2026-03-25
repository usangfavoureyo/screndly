import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useComposeStore } from '../../store/useComposeStore';
import { publishComposeItem } from '../../lib/create/composePublish';

const PUBLISH_LOCK_MS = 10 * 60 * 1000;

function isInterruptedPublishError(message: string | undefined): boolean {
  if (!message) return false;
  return /failed to fetch|network|timed out|timeout|load failed|connection|aborted/i.test(message);
}

export function ComposeScheduler() {
  const { items, saveItem } = useComposeStore();
  const processingIdsRef = useRef<Set<string>>(new Set());

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
        processingIdsRef.current.add(item.id);
        const attemptStartedAt = new Date().toISOString();
        const publishLockExpiresAt = new Date(Date.now() + PUBLISH_LOCK_MS).toISOString();

        saveItem({
          ...item,
          publishLockExpiresAt,
          lastPublishAttemptAt: attemptStartedAt,
          error: undefined,
        });

        try {
          const result = await publishComposeItem(item);
          if (cancelled) return;

          const updatedAt = new Date().toISOString();
          const nextStatus = result.postedPlatforms.length > 0 ? 'published' : 'failed';
          const nextError =
            nextStatus === 'published'
              ? undefined
              : result.failedResults.length > 0
                ? result.errorMessage || 'Some platforms failed to publish.'
                : undefined;

          saveItem({
            ...item,
            status: nextStatus,
            updatedAt,
            publishLockExpiresAt: undefined,
            lastPublishAttemptAt: attemptStartedAt,
            publishRetryCount: nextStatus === 'failed' ? (item.publishRetryCount ?? 0) + 1 : 0,
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

          const message = error instanceof Error ? error.message : 'Failed to publish scheduled post';
          const safeMessage = isInterruptedPublishError(message)
            ? 'Scheduled publish request was interrupted. Check whether the post already published before retrying.'
            : message;
          saveItem({
            ...item,
            status: 'failed',
            updatedAt: new Date().toISOString(),
            publishLockExpiresAt: undefined,
            lastPublishAttemptAt: attemptStartedAt,
            publishRetryCount: (item.publishRetryCount ?? 0) + 1,
            error: safeMessage,
          });
          toast.error(safeMessage);
        } finally {
          processingIdsRef.current.delete(item.id);
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
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [items, saveItem]);

  return null;
}
