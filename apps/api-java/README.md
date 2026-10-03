# Decors API — Java (Spring Boot)

A drop-in Java version of the backend in `apps/api` (NestJS). It exposes the **same HTTP API** — same URLs, JSON,
cookies, error messages, validation and rate limits — and uses the **same Postgres database**, so the website in
`apps/web` works against either one without changes. The NestJS code is untouched; run whichever you prefer.

- Java 21, Spring Boot 3.3, Spring Data JPA (Hibernate 6), Flyway, JJWT, BCrypt, Jakarta Mail
- Virtual threads are on, so a request waiting on the database or the mail server does not hold up others
- Everything is ported: products (search, facets, overview, detail), accounts (register, login, profile, password
  change, email verification, password reset), cart/wishlist, Razorpay checkout/verify/webhook/orders, the admin area
  with image uploads, and the `seed` / `make-admin` commands

## Shop features (Java API only)

These exist only in this backend; the NestJS API in `apps/api` has not been given them. The admin pages are at `/admin`.

| Feature | What it does |
| --- | --- |
| Order tracking | Paid orders move packed → shipped (carrier and tracking number) → delivered; customers see a timeline and get emails when it ships and arrives. Admin > Orders. |
| Cancellation and refunds | Customers (or admins) cancel until an order ships; paid orders are refunded in full through Razorpay, and a failed refund can be retried by an admin. |
| Saved addresses | Up to 10 per customer with a default, on the profile page and as a picker at checkout. |
| Coupons | Percentage (with a cap), flat amount or free shipping; minimum order, dates, total and per-customer limits. Admin > Coupons. |
| Shipping | Fee, free-shipping threshold, shop pincode, packing days and blocked areas (Admin > Shipping); "Check delivery" on product pages; delivery window at checkout. |
| GST invoices | A PDF invoice once an order ships (CGST + SGST or IGST, consecutive numbers per financial year, no tax if the shop has no GSTIN). Set the seller details and GST rates under Admin > Business & GST. |
| Personalised cards | Wedding cards (any product the admin ticks "customers can personalise") take two names, the event date, a venue and an optional line, with a live preview; the details travel cart → order and the admin sees a print-ready preview on the order. Checkout refuses a personalised card without details or with a date in the past. |
| Admin dashboard | Admin > Dashboard: sales, orders, average order and new customers for 7, 30 or 90 days with change against the previous period, a daily chart (with a table view), top products, low stock, things to do (orders to ship, unpaid orders) and recent orders. Admin > Customers lists everyone with their orders and spend. |
| Product options | A product can come in options of one kind ("Size: A5, A4", "Volume: 1 L, 4 L, 10 L"), each with its own price and stock, set under Admin > Products > Edit > Options. The product then shows "From" its lowest price; the cart keeps one line per option; checkout charges the option's price and reserves the option's stock; the order line reads "Product (Option)". `seed` gives the paints three tin sizes. |
| Reviews and ratings | Customers who have received a product (delivered order) leave one 1–5 star review with optional title, text and up to 3 photos, and can edit or delete it; reviews show a star histogram, sorting and a "Verified buyer" badge. A product's rating and review count are derived from published reviews by a database trigger (hand-typed ratings were cleared and the admin form no longer has the field). Admin > Reviews hides, shows, replies to or deletes reviews. |
| Search | Every word of a search must match a product's name, description, tag, colour or category; name matches rank first. If nothing matches, small typos are fixed against the catalogue's own words ("Showing results for…"). Shop filters add minimum rating and in-stock-only, and a Newest sort. |
| Stock | Units are reserved at checkout and returned on cancellation; unpaid orders release their stock after 30 minutes (checked every 5 minutes, `ORDER_REAP_INTERVAL_MS`). Low-stock and sold-out labels, and cart limits. |

Things to know:

- Existing products start with a stock of 25 and a new shop starts with a Rs 49 shipping fee (free above Rs 999) and no GSTIN, so invoices carry no tax until you enter one. Change these in the admin area before taking real orders.
- GST rates and HSN codes shipped here are starting values, not tax advice: check them with your accountant.
- Invoices are issued when an order ships, and an order cannot be cancelled after that, so nothing issued ever needs a credit note.

## Run it (Windows, macOS, Linux)

You need **JDK 21** (for example [Temurin 21](https://adoptium.net)) and the database from the repo's
`docker-compose.yml`. Maven is downloaded automatically by the wrapper (`mvnw`), nothing else to install.

```powershell
docker compose up -d                     # Postgres :5432 and Mailpit (run from the repo root)
cd apps\api-java
copy .env.example .env                   # then set JWT_SECRET (32+ characters)
.\mvnw.cmd spring-boot:run               # http://localhost:4000
```

On macOS/Linux: `cp .env.example .env` and `./mvnw spring-boot:run`.

The API listens on **port 4000**, like the NestJS one, so **stop the NestJS API first** (or change `PORT` in `.env`
and point the website at it with `NEXT_PUBLIC_API_URL`). The website runs as before:

```powershell
npm run dev:web                          # from the repo root, http://localhost:3000
```

### First run on an empty database

The Java API creates the tables itself (Flyway), so you don't need Node or Prisma at all:

```powershell
.\mvnw.cmd -q package -DskipTests
java -jar target\decors-api-0.1.0.jar seed                          # 15 sample products
java -jar target\decors-api-0.1.0.jar make-admin you@example.com    # after signing up on the website
java -jar target\decors-api-0.1.0.jar make-admin you@example.com --remove   # demote again
```

If the database was already created by `npm run db:migrate -w apps/api`, nothing is re-created or changed: the Java
API recognises the existing tables and carries on with your data.

### Running a built jar (production)

```
.\mvnw.cmd -q package -DskipTests
java -jar target\decors-api-0.1.0.jar
```

Set `APP_ENV=production` there: cookies become `Secure`, and emails are never printed to the log when SMTP is
missing. The same environment variables as `apps/api/.env.example` apply (see `.env.example` here); a real
environment variable always wins over `.env`.

## Settings

Same names as the NestJS API: `DATABASE_URL` (the `postgresql://…?schema=public` form is accepted as is),
`JWT_SECRET`, `WEB_ORIGIN`, `API_PUBLIC_URL`, `UPLOAD_DIR`, `SMTP_HOST/PORT/USER/PASS/SECURE`, `MAIL_FROM`,
`RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`. Extras: `PORT` (default 4000), `APP_ENV` (or `NODE_ENV`).

`JWT_SECRET` may be shared with the NestJS API: login tokens use the same format, so a session made on one backend
is accepted by the other.

## Database and migrations

The schema is owned by two parallel histories that must stay in step:

| Backend | Where migrations live |
| --- | --- |
| NestJS (`apps/api`) | `apps/api/prisma/migrations` (frozen: order tracking and later features exist only in the Java API) |
| Java (this folder) | `src/main/resources/db/schema/baseline.sql` (the 8 Prisma migrations so far) and Java migrations in `src/main/java/db/migration` |

Flyway keeps its bookkeeping table in its own `flyway` schema, so Prisma does not see it as drift when both
backends share a database. **When the schema changes later, add a Prisma migration and a matching Flyway migration**
(`V3__something.sql` in `src/main/resources/db/migration`; start the file with `SET search_path TO public;`, because
Flyway's own schema comes first on the search path and tables would otherwise land there). If you retire the NestJS API, Flyway becomes the only
history and the Prisma folder can go.

## Tests

```powershell
.\mvnw.cmd test                          # unit tests (no database needed)
```

`contract-tests/` holds a black-box HTTP suite that runs against **either** backend (350 checks: catalogue, auth,
email verification, password reset, cart/wishlist, addresses, admin + uploads, Razorpay checkout and webhooks,
order tracking, cancellations and refunds, coupons, shipping, stock, GST invoices, rate limits). It
plays the part of the mail server and, for the payment checks, of Razorpay:

```powershell
cd contract-tests; npm install
# 1. start the backend under test with SMTP pointing at the suite:   SMTP_HOST=localhost SMTP_PORT=2525
# 2. run it
$env:BASE="http://localhost:4000"; $env:DATABASE_URL="postgresql://decors:decors@localhost:5432/decors"; node contract.js
```

For the Java API add `PAYMENTS=1` and start it with `RAZORPAY_BASE_URL=http://localhost:4545`,
`RAZORPAY_KEY_ID=rzp_test_x`, `RAZORPAY_KEY_SECRET=test_key_secret`, `RAZORPAY_WEBHOOK_SECRET=test_webhook_secret`
(the NestJS SDK always talks to Razorpay's real servers, so payments are only exercised on Java). Also start the Java
API with `ORDER_REAP_INTERVAL_MS=2000 ORDER_REAP_INITIAL_DELAY_MS=1000` so the abandoned-order check can be observed.
The suite creates throw-away accounts, deletes them afterwards, waits out the checkout rate limit when it has to, and the
rate-limit check at the end needs a minute between runs. The invoice checks read the PDFs with `pdftotext` when it is installed.

## Layout

```
src/main/java/com/decors
  config/    .env + DATABASE_URL loading, JSON rules, CORS, /uploads
  security/  JWT, login/admin checks, rate limiting
  domain/    JPA entities (tables are the same as Prisma's)
  repo/      Spring Data repositories
  service/   products, auth, accounts, admin, one-time tokens
  payments/  Razorpay gateway + orders
  storage/   image storage (local disk; swap this class for S3/Cloudinary)
  mail/      SMTP sender + email templates
  web/       controllers and request bodies
  cli/       seed, make-admin
```
