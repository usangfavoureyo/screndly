-- CreateTable
CREATE TABLE "RSSFeedItem" (
    "id" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "guid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "itemData" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RSSFeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RSSFeedItem_feedId_dedupeKey_key" ON "RSSFeedItem"("feedId", "dedupeKey");

-- CreateIndex
CREATE INDEX "RSSFeedItem_feedId_status_idx" ON "RSSFeedItem"("feedId", "status");

-- CreateIndex
CREATE INDEX "RSSFeedItem_firstSeenAt_idx" ON "RSSFeedItem"("firstSeenAt");

-- AddForeignKey
ALTER TABLE "RSSFeedItem" ADD CONSTRAINT "RSSFeedItem_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "RSSFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
