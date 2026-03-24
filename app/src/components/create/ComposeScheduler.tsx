import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useComposeStore } from '../../store/useComposeStore';
import { publishComposeItem } from '../../lib/create/composePublish';

function isRetryablePublishError(message: string | undefined): boolean {
  if (!message) return false;
  return /failed to fetch|network|timed out|timeout|load failed|connection/i.test(message);
}

export function ComposeScheduler() {
  const { items, saveItem } = useComposeStore();
  const processingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const processDueItems = async () => {
      const now = Date.now();
      const dueItems = items.filter(
        (item) =>
          item.status === 'scheduled' &&
          item.scheduledAt &&
          new Date(item.scheduledAt).getTime() <= now &&
          !processingIdsRef.current.has(item.id),
      );

      for (const item of dueItems) {
        processingIdsRef.current.add(item.id);

        try {
          const result = await publishComposeItem(item);
          if (cancelled) return;

          const updatedAt = new Date().toISOString();
          const nextStatus = result.postedPlatforms.length > 0 ? 'published' : 'failed';
          const nextError =
            result.failedResults.length > 0 ? result.errorMessage || 'Some platforms failed to publish.' : undefined;

          saveItem({
            ...item,
            status: nextStatus,
            updatedAt,
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
          if (isRetryablePublishError(message)) {
            const retryAt = new Date(Date.now() + 60_000).toISOString();
            saveItem({
              ...item,
              status: 'scheduled',
              scheduledAt: retryAt,
              updatedAt: new Date().toISOString(),
              error: 'Temporary connection issue. Retrying automatically.',
            });
            toast.error('Scheduled publish hit a temporary network issue. Retrying shortly.');
            continue;
          }

          saveItem({
            ...item,
            status: 'failed',
            updatedAt: new Date().toISOString(),
            error: message,
          });
          toast.error(message);
        } finally {
          processingIdsRef.current.delete(item.id);
        }
      }
    };

    processDueItems();
    const intervalId = window.setInterval(processDueItems, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [items, saveItem]);

  return null;
}
