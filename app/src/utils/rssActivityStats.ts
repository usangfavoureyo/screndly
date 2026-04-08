import type { RSSActivityItem } from '../contexts/RSSFeedsContext';

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function getPublishedTodayCount(
  items: RSSActivityItem[],
  referenceDate: Date = new Date()
): number {
  return items.filter((item) => {
    if (item.status !== 'published') {
      return false;
    }

    const sourceTimestamp = item.publishedAt || item.timestamp;
    if (!sourceTimestamp) {
      return false;
    }

    const publishedDate = new Date(sourceTimestamp);
    if (Number.isNaN(publishedDate.getTime())) {
      return false;
    }

    return isSameLocalDay(publishedDate, referenceDate);
  }).length;
}
