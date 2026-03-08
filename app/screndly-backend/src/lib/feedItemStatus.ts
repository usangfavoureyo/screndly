import prisma from './prisma';

let feedItemStatusColumnSupportPromise: Promise<boolean> | null = null;

export async function hasFeedItemStatusColumn(): Promise<boolean> {
  if (!feedItemStatusColumnSupportPromise) {
    feedItemStatusColumnSupportPromise = (async () => {
      try {
        const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'FeedItem'
            AND column_name = 'status'
        `;

        return columns.some((column) => column.column_name === 'status');
      } catch (error) {
        console.warn('[FeedItem] Failed to inspect FeedItem.status column. Assuming latest schema.', error);
        return true;
      }
    })();
  }

  return feedItemStatusColumnSupportPromise;
}
