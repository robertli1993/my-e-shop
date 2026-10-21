# Northline — everyday tech store

A production-shaped electronics shop built with Next.js App Router (frontend and API
routes), Drizzle ORM, Tailwind CSS and shadcn/ui components. The visual design follows
`reference/index.html`.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first boot creates
`data/northline.db`, applies the schema and loads the eighteen-product catalog plus four
sample orders.

Sample account:

```
alex@northline.co
northline123
```

New accounts can sign up from `/signup`. A cart and every order are persisted per user.

## Environment

Copy `.env.example` to `.env.local` only if you want to override defaults:

| Variable | Purpose |
| --- | --- |
| `DATABASE_PATH` | Database file path (default `data/northline.db`) |
| `OPENDESIGN_API_KEY` | Enables the AI shopping agent |
| `OPENDESIGN_API_URL` | OpenAI-compatible endpoint (default `https://amr-link.open-design.ai/v1`) |
| `OPENDESIGN_MODEL` | Model name (default `deepseek-v4.1-flash`) |

The guide is a Vercel AI SDK `ToolLoopAgent`. It receives read-only tools for catalog
search, product lookup, categories, the signed-in user's bag and order history. Product
tool results are returned to the page and rendered as product cards under the reply. The
agent validates every recommendation against the live catalog, so it cannot invent
products, prices or categories. When the model emits reasoning, the guide streams it into a
collapsible thinking block before the answer. Without `OPENDESIGN_API_KEY`, the endpoint uses
a deterministic catalog search so the rest of the shop keeps working.

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

`add` accepts `--description`, `--specs "Ports:3× USB-C|Weight:120 g"`,
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
- `/api/assistant` — the guide. It asks the configured model to call catalog and account
  tools, then extracts the tool results for display. Only products returned by those
  tools are shown in the chat.

## Inventory and states

Orders begin as `Processing`. They can be cancelled before shipping (`Processing` or
`Packed`); cancellation is a single database transaction that changes the order once and
returns each item to stock. Stock is only reserved when an order is placed. Both checkout
paths use conditional `UPDATE ... WHERE stock >= qty` statements inside a transaction, so
concurrent checkouts cannot drive stock below zero. The order id sequence is generated
atomically from a counters table.

## Architecture documentation

The implementation reference lives in [`docs/`](./docs/README.md):

- [Architecture](./docs/architecture.md) — runtime topology, module boundaries, rendering
  and caching, request lifecycles, security, deployment, decisions and limitations.
- [Data model](./docs/data-model.md) — schema, relationships, invariants and transactional
  flows.
- [HTTP API](./docs/api.md) — route contracts, payloads and status codes.
- [AI guide](./docs/ai-assistant.md) — agent tools, fallback behaviour and guardrails.

## Scripts and checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Delete `data/northline.db` while the server is stopped to reset the local database; it
will be re-seeded on the next boot. Remove any leftover `-wal`/`-shm` sidecars from an
older run as well.
