SET search_path TO public;

-- Reviews from people who received the product: one per person per product, with up to three photos.
CREATE TABLE "Review" (
    "id" TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
    "title" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK ("status" IN ('PUBLISHED', 'HIDDEN')),
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Review_productId_userId_key" ON "Review"("productId", "userId");
CREATE INDEX "Review_productId_status_createdAt_idx" ON "Review"("productId", "status", "createdAt");

CREATE TABLE "ReviewImage" (
    "id" SERIAL PRIMARY KEY,
    "reviewId" TEXT NOT NULL REFERENCES "Review"("id") ON DELETE CASCADE,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "ReviewImage_reviewId_idx" ON "ReviewImage"("reviewId");

-- From now on a product's rating is the average of its published reviews. The old hand-typed ratings are cleared, so
-- the shop shows stars only where real customers have rated something.
ALTER TABLE "Product" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "Product" SET "rating" = 0;

CREATE FUNCTION "sync_product_rating"() RETURNS trigger AS $$
DECLARE pid TEXT := COALESCE(NEW."productId", OLD."productId");
BEGIN
  UPDATE "Product" p SET "rating" = COALESCE(r.avg, 0), "reviewCount" = COALESCE(r.cnt, 0)
    FROM (SELECT ROUND(AVG("rating")::numeric, 1)::float8 AS avg, COUNT(*)::int AS cnt
          FROM "Review" WHERE "productId" = pid AND "status" = 'PUBLISHED') r
    WHERE p."id" = pid;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Review_sync" AFTER INSERT OR UPDATE OR DELETE ON "Review"
  FOR EACH ROW EXECUTE FUNCTION "sync_product_rating"();
