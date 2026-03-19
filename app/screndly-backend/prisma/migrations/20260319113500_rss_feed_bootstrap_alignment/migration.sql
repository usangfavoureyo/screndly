ALTER TABLE "RSSFeed"
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "favicon" TEXT,
ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "interval" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS "imageCount" TEXT NOT NULL DEFAULT '2',
ADD COLUMN IF NOT EXISTS "dedupeDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "filters" JSONB NOT NULL DEFAULT '{"scope":"title_or_body","required":[],"blocked":[]}',
ADD COLUMN IF NOT EXISTS "serperPriority" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "rehostImages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "autoPost" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "platformsEnabled" JSONB NOT NULL DEFAULT '{"x":true,"threads":true,"facebook":false,"pinterest":false}',
ADD COLUMN IF NOT EXISTS "lastProcessedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nextRunAt" TIMESTAMP(3);

UPDATE "RSSFeed"
SET "name" = COALESCE(NULLIF("name", ''), NULLIF("source", ''), NULLIF("title", ''), 'RSS Feed')
WHERE "name" IS NULL;

ALTER TABLE "RSSFeed"
ALTER COLUMN "name" SET NOT NULL;

UPDATE "RSSFeed"
SET "enabled" = CASE
  WHEN "status" = 'paused' THEN false
  ELSE true
END
WHERE "enabled" IS DISTINCT FROM CASE
  WHEN "status" = 'paused' THEN false
  ELSE true
END;

CREATE INDEX IF NOT EXISTS "RSSFeed_enabled_idx" ON "RSSFeed"("enabled");
CREATE INDEX IF NOT EXISTS "RSSFeed_name_idx" ON "RSSFeed"("name");
