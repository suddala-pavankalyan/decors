SET search_path TO public;

-- Options of one kind per product ("Size": A5, A4; "Volume": 1 L, 4 L), each with its own price and stock.
ALTER TABLE "Product" ADD COLUMN "variantLabel" TEXT;   -- the kind of option ("Size"); null when the product has none

CREATE TABLE "ProductVariant" (
    "id" TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
    "label" TEXT NOT NULL,
    "price" INTEGER NOT NULL CHECK ("price" >= 1),      -- rupees, like Product.price
    "stock" INTEGER NOT NULL DEFAULT 0 CHECK ("stock" >= 0),
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId", "position");
CREATE UNIQUE INDEX "ProductVariant_productId_label_key" ON "ProductVariant"("productId", lower("label"));

-- For a product with options, Product.price is the lowest option price and Product.stock the total across options, so
-- listings, sorting and the "sold out" label keep working unchanged. A trigger keeps them in step with every change.
CREATE FUNCTION "sync_product_from_variants"() RETURNS trigger AS $$
DECLARE pid TEXT := COALESCE(NEW."productId", OLD."productId");
BEGIN
  UPDATE "Product" p SET "price" = v.minp, "stock" = v.total
    FROM (SELECT MIN("price") AS minp, SUM("stock")::int AS total FROM "ProductVariant" WHERE "productId" = pid AND "active") v
    WHERE p."id" = pid AND v.minp IS NOT NULL;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ProductVariant_sync" AFTER INSERT OR UPDATE OR DELETE ON "ProductVariant"
  FOR EACH ROW EXECUTE FUNCTION "sync_product_from_variants"();

-- A cart line is now product + option ('' for products without options).
ALTER TABLE "CartItem" ADD COLUMN "variantId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_pkey";
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_pkey" PRIMARY KEY ("userId", "productId", "variantId");

-- What was bought: the option (kept for giving stock back), while "name" already reads "Product (Option)".
ALTER TABLE "OrderItem" ADD COLUMN "variantId" TEXT, ADD COLUMN "variantLabel" TEXT;
