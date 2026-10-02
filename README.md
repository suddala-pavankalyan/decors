# Decors

Marketplace for wedding cards, gift cards, wall decor and paints.

- `apps/web` — Next.js 14, Tailwind, Framer Motion (colourful, animated, filterable catalog)
- `apps/api` — NestJS (products search + facets, Postgres via Prisma)

## Run
```
docker compose up -d                       # Postgres on :5432
npm install
cp apps/api/.env.example apps/api/.env      # then set JWT_SECRET (the API refuses to start with the placeholder)
npm run db:migrate -w apps/api             # create tables
npm run db:seed -w apps/api                # sample products
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

Accounts: email + password (bcrypt), JWT in an httpOnly cookie. Endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Login/register are rate-limited.

Profile: the avatar menu in the header leads to `/profile` (change name, change password) and holds Log out. Changing the password signs out every other device. Endpoints: `PATCH /auth/me`, `POST /auth/change-password`.

Cart and wishlist: stored in the browser for guests; when logged in they are saved to your account (`/account/*` endpoints) and guest items are merged in at login.

API: `GET /products?q=&categories=a,b&colors=Gold&tags=wedding&maxPrice=100&sort=price-asc|price-desc|rating&limit=24&offset=0` (paged: returns `total` and `hasMore`; `limit` is at most 60), `GET /products/facets`, `GET /products/overview` (everything the landing page needs in one call), `GET /products/:id` (with images + related).

## Payments (Razorpay, INR)

Checkout creates an order priced on the server from your saved cart, opens Razorpay Checkout, then verifies the payment signature server-side. A webhook confirms payments even if the browser is closed.

1. Create a Razorpay account and copy your **test** keys (`rzp_test_...`) into `apps/api/.env`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. For the webhook, add one in the Razorpay dashboard (Settings → Webhooks) pointing to `<public api url>/webhooks/razorpay`, with events `payment.captured` and `order.paid`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`. (Locally, expose the API with a tunnel such as ngrok. Without the webhook, payments still complete through the browser callback.)
3. Prices are treated as INR. Test cards: https://razorpay.com/docs/payments/payments/test-card-details/

Endpoints: `POST /checkout`, `POST /checkout/verify`, `GET /orders`, `GET /orders/:id`, `POST /webhooks/razorpay`.

## Admin area (products + photos)

Admins manage the catalog at `/admin`: add, edit and delete products, and upload, reorder and delete photos.

1. Sign up on the website with the account you want to be admin.
2. Promote it (run again with `--remove` to demote):
   ```
   npm run make-admin -w apps/api -- you@example.com
   ```
3. Log out and back in (or refresh): an **Admin** link appears in the header.

Notes
- Anyone can sign up, so admin is never granted automatically. Only this command (run by someone with access to the server) can do it, and the API re-checks the role on every admin request.
- Photos: JPEG, PNG or WebP, up to 5 MB, up to 8 per product. The file type is checked from the file contents, not the name, and SVG is not accepted.
- Photos are stored on local disk in `apps/api/uploads` (`UPLOAD_DIR`) and served from the API at `/uploads/...`. Most hosts wipe local disk on redeploy, so for production move storage to S3 or Cloudinary (the code is isolated in `apps/api/src/uploads/image-storage.ts`).
- Set `API_PUBLIC_URL` (API) and `NEXT_PUBLIC_API_URL` (web) to the API's public address when deploying.
- Deleting a product removes it from carts and wishlists; past orders keep their item name and price.

## Pages
- `/` — the exhibition landing page: search (press Enter to open the results), the four category halls, the top-rated pieces, a colour wall and occasions.
- `/shop` — the full collection with search, filters and sorting. Filters live in the URL (for example `/shop?categories=paints&sort=price-asc`), so results can be shared and survive a reload.

## Performance notes
- Product lists are paged (24 at a time, "Show more" for the rest) and the admin list is paged and searched in the database, so page weight stays small however large the catalog grows. With 3,000 products a list page is about 8 KB and 10 ms.
- `/shop` is rendered on the server with the first page of results, so it paints with products instead of a spinner. Later filter changes cancel any request still in flight.
- To see real-world speed, run the production build instead of the dev servers (the dev server compiles each page the first time you open it, which feels slow):
  ```
  npm run build
  npm run start:api
  npm run start:web
  ```

## Typography
One typeface for the whole site: **Inter** (bundled in `apps/web/app/fonts`, so builds work offline and visitors never contact a third party). If it can't load, the visitor's own system UI font takes over (Segoe UI on Windows, San Francisco on Apple devices, Roboto on Android), then plain sans-serif; a size-matched fallback keeps the page from jumping while Inter loads.

The look changes with context through weight, size and spacing, not by mixing fonts (see the comment at the top of `apps/web/app/globals.css`):

| Context | Style |
| --- | --- |
| Hero / page title (`h1`) | extra-bold, tight tracking |
| Section title (`h2`) | bold |
| Card and panel titles (`h3`, `h4`) | semibold |
| Body text | regular, 16px / 1.6 |
| Buttons and labels | medium to semibold, 14px |
| Small section labels | semibold, 12px, uppercase, wide tracking |
| Prices and counts | tabular figures (`tabular-nums`) so digits line up |

## Email: password reset and email verification
- **Sign up** sends a confirmation email. People can browse and log in without confirming, but **placing an order requires a confirmed email**. A banner (and the profile page) offers "Resend email".
- **Forgot password** (`/forgot-password`) emails a one-hour, single-use link to `/reset-password`. Resetting signs the person out of every device, confirms their email, and sends a "your password was changed" notice. The page answers the same way whether or not the address has an account.
- Links contain a random token; only its SHA-256 hash is stored. Confirmation links last 24 hours. A new link replaces the previous one, and a new email for the same account can be requested once a minute.
- Endpoints: `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`.

### Reading the emails in development
`docker compose up -d` also starts **Mailpit**, a local inbox. The API sends to it (settings are already in `.env.example`), and you read the messages at **http://localhost:8025**. Without any `SMTP_HOST`, the API instead prints each email, including its link, in the API console.

### Real email in production
Set these in the API's environment (any SMTP provider works: Amazon SES, SendGrid, Mailgun, Brevo, a Gmail app password...):
```
SMTP_HOST=...   SMTP_PORT=587   SMTP_USER=...   SMTP_PASS=...   SMTP_SECURE=false   MAIL_FROM="Decors <no-reply@yourdomain.com>"
WEB_ORIGIN=https://www.yourdomain.com     # the links in emails point here
```
In production (`NODE_ENV=production`) the API never prints emails: without `SMTP_HOST` it logs an error instead, because a reset link in a log file would be a security risk. Set up SPF/DKIM for your sending domain so the emails don't land in spam.
