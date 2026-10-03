SET search_path TO public;

-- A customer's address book. At most one default address per customer (enforced by the partial unique index).
CREATE TABLE "Address" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Address_userId_idx" ON "Address"("userId");
CREATE UNIQUE INDEX "Address_one_default_per_user" ON "Address"("userId") WHERE "isDefault";
