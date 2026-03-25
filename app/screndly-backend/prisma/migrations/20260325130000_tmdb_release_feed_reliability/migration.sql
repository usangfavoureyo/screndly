ALTER TABLE "TMDbPost"
ADD COLUMN IF NOT EXISTS "moduleType" TEXT,
ADD COLUMN IF NOT EXISTS "runId" TEXT,
ADD COLUMN IF NOT EXISTS "captionContextHash" TEXT,
ADD COLUMN IF NOT EXISTS "overflowPolicy" TEXT,
ADD COLUMN IF NOT EXISTS "overflowExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "unscheduledReason" TEXT,
ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "TMDbPost_moduleType_idx" ON "TMDbPost"("moduleType");
CREATE INDEX IF NOT EXISTS "TMDbPost_runId_idx" ON "TMDbPost"("runId");

CREATE TABLE IF NOT EXISTS "ReleaseFeedHistory" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "moduleType" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "imdbId" TEXT,
    "canonicalKey" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "originalReleaseDate" TIMESTAMP(3),
    "anniversaryMilestone" INTEGER,
    "firstFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "skipReason" TEXT,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseFeedHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReleaseFeedHistory_cycleKey_key" ON "ReleaseFeedHistory"("cycleKey");
CREATE INDEX IF NOT EXISTS "ReleaseFeedHistory_canonicalKey_idx" ON "ReleaseFeedHistory"("canonicalKey");
CREATE INDEX IF NOT EXISTS "ReleaseFeedHistory_moduleType_status_idx" ON "ReleaseFeedHistory"("moduleType", "status");
CREATE INDEX IF NOT EXISTS "ReleaseFeedHistory_releaseDate_idx" ON "ReleaseFeedHistory"("releaseDate");
CREATE INDEX IF NOT EXISTS "ReleaseFeedHistory_tmdbId_idx" ON "ReleaseFeedHistory"("tmdbId");
CREATE INDEX IF NOT EXISTS "ReleaseFeedHistory_runId_idx" ON "ReleaseFeedHistory"("runId");
