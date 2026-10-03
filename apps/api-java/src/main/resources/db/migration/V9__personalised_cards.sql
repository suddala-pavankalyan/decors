SET search_path TO public;

-- Products the customer can put their own names, date and venue on (wedding cards to start with).
ALTER TABLE "Product" ADD COLUMN "personalizable" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Product" SET "personalizable" = true WHERE "category" = 'WEDDING_CARDS';

-- The details the customer typed: kept on the cart line, then copied onto the order line when they check out.
ALTER TABLE "CartItem" ADD COLUMN "personalization" JSONB;
ALTER TABLE "OrderItem" ADD COLUMN "personalization" JSONB;
