-- Flyway's own schema comes first on the search path, so say where the tables belong.
SET search_path TO public;

-- Fulfilment steps after payment, a shipment record, and a timeline of what happened to each order.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PACKED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';

ALTER TABLE "Order" ADD COLUMN "carrier" TEXT, ADD COLUMN "trackingNumber" TEXT;

CREATE TABLE "OrderEvent" (
    "id" SERIAL PRIMARY KEY,
    "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- Existing orders get the events they would have had.
INSERT INTO "OrderEvent" ("orderId", "status", "note", "createdAt")
  SELECT "id", 'PENDING', 'Order placed', "createdAt" FROM "Order";
INSERT INTO "OrderEvent" ("orderId", "status", "note", "createdAt")
  SELECT "id", 'PAID', 'Payment received', "paidAt" FROM "Order" WHERE "status" = 'PAID' AND "paidAt" IS NOT NULL;
