SET search_path TO public;

-- One row of shop-wide shipping rules, editable by the admin.
CREATE TABLE "ShippingSetting" (
    "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
    "baseFeePaise" INTEGER NOT NULL CHECK ("baseFeePaise" >= 0),
    "freeAbovePaise" INTEGER CHECK ("freeAbovePaise" > 0),   -- null: shipping is never free
    "originPincode" TEXT NOT NULL,                           -- where parcels leave from; drives the delivery estimate
    "handlingDays" INTEGER NOT NULL CHECK ("handlingDays" >= 0),
    "blockedPrefixes" TEXT NOT NULL DEFAULT ''               -- comma separated pincode prefixes we do not deliver to
);
INSERT INTO "ShippingSetting" ("id", "baseFeePaise", "freeAbovePaise", "originPincode", "handlingDays")
VALUES (1, 4900, 99900, '560001', 1);

ALTER TABLE "Order"
  ADD COLUMN "shippingPaise" INTEGER NOT NULL DEFAULT 0,   -- amount = subtotal - discount + shipping
  ADD COLUMN "estimatedFrom" DATE,
  ADD COLUMN "estimatedTo" DATE;

-- Coupons can also waive the shipping fee.
ALTER TABLE "Coupon" DROP CONSTRAINT "Coupon_type_check";
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_type_check" CHECK ("type" IN ('PERCENT', 'FLAT', 'FREE_SHIPPING'));
ALTER TABLE "Coupon" DROP CONSTRAINT "Coupon_value_check";
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_value_check" CHECK ("value" >= 0);
