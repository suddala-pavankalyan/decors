SET search_path TO public;

-- Who is selling: printed at the top of every invoice. Without a GSTIN the shop is treated as not registered for GST.
CREATE TABLE "Business" (
    "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
    "legalName" TEXT NOT NULL,
    "addressLines" TEXT NOT NULL,
    "gstin" TEXT,
    "stateName" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "contactEmail" TEXT,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',     -- at most 3 letters: GST invoice numbers are limited to 16 characters
    "shippingGstPercent" INTEGER NOT NULL DEFAULT 18
);
INSERT INTO "Business" ("id", "legalName", "addressLines", "stateName", "stateCode")
VALUES (1, 'Decors', 'Add your registered address under Admin > Business', 'Karnataka', '29');

-- GST rate (prices are GST-inclusive) and HSN code per product category. Editable, these are only starting values.
CREATE TABLE "GstRate" (
    "category" "Category" PRIMARY KEY,
    "ratePercent" INTEGER NOT NULL CHECK ("ratePercent" BETWEEN 0 AND 28),
    "hsn" TEXT NOT NULL
);
INSERT INTO "GstRate" ("category", "ratePercent", "hsn") VALUES
  ('WEDDING_CARDS', 12, '4909'), ('GIFT_CARDS', 12, '4909'), ('WALL_DECOR', 18, '8306'), ('PAINTS', 18, '3208');

CREATE TABLE "InvoiceCounter" ("fy" TEXT PRIMARY KEY, "last" INTEGER NOT NULL);

ALTER TABLE "Order" ADD COLUMN "invoiceNumber" TEXT, ADD COLUMN "invoiceDate" DATE;
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");

-- Category at the time of purchase, so an invoice still has a rate after the product is deleted.
ALTER TABLE "OrderItem" ADD COLUMN "category" "Category";
UPDATE "OrderItem" i SET "category" = p."category" FROM "Product" p WHERE p."id" = i."productId";
