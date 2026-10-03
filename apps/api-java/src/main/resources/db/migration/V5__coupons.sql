SET search_path TO public;

CREATE TABLE "Coupon" (
    "id" TEXT PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL CHECK ("type" IN ('PERCENT', 'FLAT')),
    -- PERCENT: 1-100 (percent off). FLAT: paise off.
    "value" INTEGER NOT NULL CHECK ("value" > 0),
    "maxDiscountPaise" INTEGER,
    "minOrderPaise" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "perUserLimit" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- amount stays "what the customer pays"; subtotal - discount = amount.
ALTER TABLE "Order"
  ADD COLUMN "subtotalPaise" INTEGER,
  ADD COLUMN "discountPaise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "couponId" TEXT REFERENCES "Coupon"("id") ON DELETE SET NULL,
  ADD COLUMN "couponCode" TEXT;
UPDATE "Order" SET "subtotalPaise" = "amount";
ALTER TABLE "Order" ALTER COLUMN "subtotalPaise" SET NOT NULL;
CREATE INDEX "Order_couponId_idx" ON "Order"("couponId");
