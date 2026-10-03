SET search_path TO public;

-- Orders can be cancelled before they ship; a paid order is refunded through Razorpay.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "Order"
  ADD COLUMN "cancelReason" TEXT,
  ADD COLUMN "refundStatus" TEXT,   -- null (nothing to refund), PENDING, PROCESSING, PROCESSED or FAILED
  ADD COLUMN "refundId" TEXT,
  ADD COLUMN "refundedAt" TIMESTAMP(3);
