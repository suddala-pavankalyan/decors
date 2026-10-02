# Decors

Marketplace for wedding cards, gift cards, wall decor and paints.

- `apps/web` — Next.js 14, Tailwind, Framer Motion (colourful, animated, filterable catalog)
- `apps/api` — NestJS (products search + facets, Postgres via Prisma)

## Run
```
docker compose up -d                       # Postgres on :5432
npm install
cp apps/api/.env.example apps/api/.env
npm run db:migrate -w apps/api             # create tables
npm run db:seed -w apps/api                # sample products
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

API: `GET /products?q=&categories=a,b&colors=Gold&tags=wedding&maxPrice=100&sort=price-asc|price-desc|rating`, `GET /products/facets`.
