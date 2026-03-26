-- Add multi-image support for TMDb feed posts
ALTER TABLE "TMDbPost"
ADD COLUMN "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "imageTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "TMDbPost"
SET
  "imageUrls" = CASE
    WHEN COALESCE(array_length("imageUrls", 1), 0) = 0 THEN ARRAY["imageUrl"]
    ELSE "imageUrls"
  END,
  "imageTypes" = CASE
    WHEN COALESCE(array_length("imageTypes", 1), 0) = 0 THEN ARRAY["imageType"]
    ELSE "imageTypes"
  END;

ALTER TABLE "TMDbPost"
ALTER COLUMN "imageUrls" SET NOT NULL,
ALTER COLUMN "imageTypes" SET NOT NULL;
