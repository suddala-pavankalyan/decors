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

Cart and wishlist: stored in the browser for guests; when logged in they are saved to your account (`/account/*` endpoints) and guest items are merged in at login.

API: `GET /products?q=&categories=a,b&colors=Gold&tags=wedding&maxPrice=100&sort=price-asc|price-desc|rating`, `GET /products/facets`, `GET /products/:id` (with images + related).

## Payments (Razorpay, INR)

Checkout creates an order priced on the server from your saved cart, opens Razorpay Checkout, then verifies the payment signature server-side. A webhook confirms payments even if the browser is closed.

1. Create a Razorpay account and copy your **test** keys (`rzp_test_...`) into `apps/api/.env`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. For the webhook, add one in the Razorpay dashboard (Settings → Webhooks) pointing to `<public api url>/webhooks/razorpay`, with events `payment.captured` and `order.paid`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`. (Locally, expose the API with a tunnel such as ngrok. Without the webhook, payments still complete through the browser callback.)
3. Prices are treated as INR. Test cards: https://razorpay.com/docs/payments/payments/test-card-details/

Endpoints: `POST /checkout`, `POST /checkout/verify`, `GET /orders`, `GET /orders/:id`, `POST /webhooks/razorpay`.
