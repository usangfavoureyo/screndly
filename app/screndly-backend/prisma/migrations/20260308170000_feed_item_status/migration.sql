-- AlterTable
ALTER TABLE "FeedItem"
ADD COLUMN "status" TEXT;

UPDATE "FeedItem"
SET "status" = 'legacy'
WHERE "status" IS NULL;

ALTER TABLE "FeedItem"
ALTER COLUMN "status" SET DEFAULT 'accepted';

ALTER TABLE "FeedItem"
ALTER COLUMN "status" SET NOT NULL;

-- CreateIndex
CREATE INDEX "FeedItem_status_idx" ON "FeedItem"("status");
