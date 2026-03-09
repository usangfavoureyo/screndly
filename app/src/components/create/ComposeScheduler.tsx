import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useComposeStore } from '../../store/useComposeStore';
import { publishComposeItem } from '../../lib/create/composePublish';

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

          saveItem({
            ...item,
            status: 'failed',
            updatedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Failed to publish scheduled post',
          });
          toast.error(error instanceof Error ? error.message : 'Failed to publish scheduled post');
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
