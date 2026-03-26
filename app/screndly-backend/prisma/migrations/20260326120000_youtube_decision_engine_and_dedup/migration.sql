ALTER TABLE "FeedItem"
ADD COLUMN IF NOT EXISTS "decisionPath" TEXT,
ADD COLUMN IF NOT EXISTS "promoFingerprint" TEXT,
ADD COLUMN IF NOT EXISTS "duplicateOfVideoId" TEXT,
ADD COLUMN IF NOT EXISTS "decisionLog" JSONB;

CREATE INDEX IF NOT EXISTS "FeedItem_promoFingerprint_idx" ON "FeedItem"("promoFingerprint");
CREATE INDEX IF NOT EXISTS "FeedItem_duplicateOfVideoId_idx" ON "FeedItem"("duplicateOfVideoId");

CREATE TABLE IF NOT EXISTS "PromoDedupIndex" (
    "id" TEXT NOT NULL,
    "canonicalFingerprint" TEXT NOT NULL,
    "matchedMetadataId" TEXT,
    "normalizedTitle" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "seasonNumber" INTEGER,
    "releaseYear" INTEGER,
    "promoAssetType" TEXT NOT NULL,
    "chosenCanonicalVideoId" TEXT NOT NULL,
    "chosenCanonicalChannelId" TEXT NOT NULL,
    "sourcePriorityScore" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateVideoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoDedupIndex_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromoDedupIndex_canonicalFingerprint_key" ON "PromoDedupIndex"("canonicalFingerprint");
CREATE INDEX IF NOT EXISTS "PromoDedupIndex_matchedMetadataId_idx" ON "PromoDedupIndex"("matchedMetadataId");
CREATE INDEX IF NOT EXISTS "PromoDedupIndex_normalizedTitle_mediaType_promoAssetType_idx" ON "PromoDedupIndex"("normalizedTitle", "mediaType", "promoAssetType");
CREATE INDEX IF NOT EXISTS "PromoDedupIndex_chosenCanonicalVideoId_idx" ON "PromoDedupIndex"("chosenCanonicalVideoId");
