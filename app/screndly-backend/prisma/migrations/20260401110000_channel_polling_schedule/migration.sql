ALTER TABLE "Channel"
ADD COLUMN IF NOT EXISTS "pollIntervalMinutesOverride" INTEGER,
ADD COLUMN IF NOT EXISTS "nextPollAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lockUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "failureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastPollStartedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Channel_status_nextPollAt_idx" ON "Channel"("status", "nextPollAt");
CREATE INDEX IF NOT EXISTS "Channel_lockUntil_idx" ON "Channel"("lockUntil");
