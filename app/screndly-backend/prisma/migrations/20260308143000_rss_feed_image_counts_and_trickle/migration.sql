ALTER TABLE "RSSFeed"
ADD COLUMN "platformImageCounts" JSONB,
ADD COLUMN "trickle" TEXT NOT NULL DEFAULT 'newest_first';
