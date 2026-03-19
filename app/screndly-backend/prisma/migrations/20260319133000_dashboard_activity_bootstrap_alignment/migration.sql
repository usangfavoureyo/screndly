-- Create missing activity and API usage tables for fresh databases.
-- Older deployments expected these tables, but the original init migration did not create them.

CREATE TABLE IF NOT EXISTS "DesignStudioActivity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignStudioActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VideoStudioActivity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "aspectRatio" TEXT,
    "duration" TEXT,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "platforms" TEXT[],
    "error" TEXT,
    "progress" INTEGER,
    "sceneSource" TEXT,
    "sceneStart" TEXT,
    "sceneEnd" TEXT,
    "sceneSourceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoStudioActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApiUsage" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "endpoint" TEXT,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DesignStudioActivity_type_idx" ON "DesignStudioActivity"("type");
CREATE INDEX IF NOT EXISTS "DesignStudioActivity_createdAt_idx" ON "DesignStudioActivity"("createdAt");

CREATE INDEX IF NOT EXISTS "VideoStudioActivity_type_idx" ON "VideoStudioActivity"("type");
CREATE INDEX IF NOT EXISTS "VideoStudioActivity_status_idx" ON "VideoStudioActivity"("status");
CREATE INDEX IF NOT EXISTS "VideoStudioActivity_createdAt_idx" ON "VideoStudioActivity"("createdAt");

CREATE INDEX IF NOT EXISTS "ApiUsage_service_idx" ON "ApiUsage"("service");
CREATE INDEX IF NOT EXISTS "ApiUsage_createdAt_idx" ON "ApiUsage"("createdAt");
