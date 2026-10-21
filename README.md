# Northline — everyday tech store

A demo-ready electronics shop built with Next.js App Router (frontend and API routes),
SQLite, Drizzle ORM, Tailwind CSS and shadcn/ui components. The visual design follows
`reference/index.html`.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first boot creates
`data/northline.db`, applies the schema and loads the eighteen-product catalog plus four
sample orders.

Demo account:

```
demo@northline.co
demo1234
```

New accounts can sign up from `/signup`. A cart and every order are persisted in SQLite
per user.

## Environment

Copy `.env.example` to `.env.local` only if you want to override defaults:

| Variable | Purpose |
| --- | --- |
| `DATABASE_PATH` | SQLite file path (default `data/northline.db`) |
| `OPENDESIGN_API_KEY` | Enables the LLM-backed shopping assistant |
| `OPENDESIGN_API_URL` | OpenAI-compatible endpoint (default `https://amr-link.open-design.ai/v1`) |
| `OPENDESIGN_MODEL` | Model name (default `deepseek-v4.1-flash`) |

Without `OPENDESIGN_API_KEY` the assistant falls back to deterministic intent and
catalog rules, so search, budgets, categories and bag/order questions keep working.

## Product CLI

There is intentionally no admin dashboard. Manage catalog rows from the terminal:

```bash
npm run products -- list
npm run products -- show iphone-15-pro
npm run products -- add --name "Studio Dock" --category Accessories --price 129 --stock 10 \
  --image /assets/tech/xiaomi-power-bank.jpg --tagline "A compact USB-C hub" --tags "dock,hub,usb-c"
npm run products -- update --id studio-dock --price 119 --stock 12
npm run products -- delete --id studio-dock
```

`add` accepts `--description`, `--specs "Weight:450 g|Fill:Down"`,
`--highlights "Line one|Line two"`, `--in-box`, `--care` and `--alt` in addition to the
required flags. Products deleted from the catalog keep their snapshots inside historical
orders.

## The flow

- `/` — hero, search, category chips, sort, price filter and product grid. Filters are
  kept in the URL so they are shareable.
- `/product/[id]` — full detail, quantity stepper, add-to-bag and buy-now.
- `/signin`, `/signup` — accounts. Unauthenticated add-to-bag/buy-now sends the user to
  sign in and resumes the action afterwards.
- `/cart` — quantity changes, removal and an order summary.
- `/checkout` — shipping form and order placement. Cart checkout or direct buy-now both
  decrement inventory and create an order.
- `/orders` — all orders with status and totals; filter by status.
- `/orders/[id]` — items, shipping address, payment note, status and cancellation.
  Cancelling a `Processing` or `Packed` order restores every item's stock exactly once.
- `/api/assistant` — the guide. It asks the configured model to turn a natural-language
  query into filters, validates those filters against the categories and catalog, and
  only returns products that actually exist. It does not invent prices or products.

## Inventory and states

Orders begin as `Processing`. They can be cancelled before shipping (`Processing` or
`Packed`); cancellation is a single SQLite transaction that changes the order once and
returns each item to stock. Stock is only reserved when an order is placed. Both checkout
paths use conditional `UPDATE ... WHERE stock >= qty` statements inside a transaction, so
concurrent checkouts cannot drive stock below zero. The order id sequence is generated
atomically from a counters table.

## Scripts and checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Delete `data/northline.db` (and its `-wal`/`-shm` files) while the server is stopped to
reset the demo database; it will be re-seeded on the next boot.
