ALTER TABLE "RSSFeed"
ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;

WITH ordered_feeds AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt" DESC, id ASC) - 1 AS position
  FROM "RSSFeed"
)
UPDATE "RSSFeed" AS feed
SET "displayOrder" = ordered_feeds.position
FROM ordered_feeds
WHERE feed.id = ordered_feeds.id;
