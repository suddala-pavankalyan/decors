SET search_path TO public;

-- Units available. Existing products start with 25 so the shop does not suddenly show everything as sold out;
-- the admin sets the real numbers.
ALTER TABLE "Product" ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 25 CHECK ("stock" >= 0);
