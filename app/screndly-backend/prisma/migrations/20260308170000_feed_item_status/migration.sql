DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'FeedItem'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'FeedItem' AND column_name = 'status'
        ) THEN
            ALTER TABLE "FeedItem" ADD COLUMN "status" TEXT;
        END IF;

        UPDATE "FeedItem"
        SET "status" = 'legacy'
        WHERE "status" IS NULL;

        ALTER TABLE "FeedItem"
        ALTER COLUMN "status" SET DEFAULT 'accepted';

        ALTER TABLE "FeedItem"
        ALTER COLUMN "status" SET NOT NULL;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'FeedItem_status_idx'
        ) THEN
            CREATE INDEX "FeedItem_status_idx" ON "FeedItem"("status");
        END IF;
    ELSE
        CREATE TABLE "FeedItem" (
            "id" TEXT NOT NULL,
            "videoId" TEXT NOT NULL,
            "channelId" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'accepted',
            "publishedAt" TIMESTAMP(3) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "FeedItem_pkey" PRIMARY KEY ("id")
        );

        CREATE UNIQUE INDEX "FeedItem_videoId_key" ON "FeedItem"("videoId");
        CREATE INDEX "FeedItem_channelId_idx" ON "FeedItem"("channelId");
        CREATE INDEX "FeedItem_publishedAt_idx" ON "FeedItem"("publishedAt");
        CREATE INDEX "FeedItem_status_idx" ON "FeedItem"("status");

        ALTER TABLE "FeedItem"
        ADD CONSTRAINT "FeedItem_channelId_fkey"
        FOREIGN KEY ("channelId") REFERENCES "Channel"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
