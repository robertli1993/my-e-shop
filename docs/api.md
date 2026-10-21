# Northline HTTP API

All endpoints live under `app/api/**/route.ts` and run in the Node.js runtime. Most return
JSON; `POST /api/assistant` streams NDJSON. They are called by client components with
same-origin `fetch`; there is no public API versioning, CORS configuration, API key or
gateway.

## 1. Conventions

### Authentication

Endpoints read the `northline_session` cookie through `getSessionUser()` (React-cached per
request). The session row must exist and be unexpired. There is no `Authorization` header
support and no middleware — each handler checks auth itself.

- **401** when a route requires a session and none is present.
- The user id always comes from the session; clients cannot pass a user id.

### Request bodies

`readJson(request)` parses JSON and throws `StoreError(400, "Send a valid JSON body.")` on
failure. There is no content-type enforcement. Bodies are then validated with Zod; the
`fields` object carries the first message per field.

### Error envelope

```json
{ "error": "Only 2 of iPhone 15 Pro remain. Adjust your bag and try again." }
```

Validation and duplicate-email responses add field messages:

```json
{
  "error": "Please check the fields and try again.",
  "fields": { "postal": "Enter a valid postal code." }
}
```

`handleRouteError` maps `StoreError` to its status; anything else is logged and returned as
`500 { "error": "Something went wrong on the server. Please try again." }`.

### Status codes used

| Code | Meaning |
| --- | --- |
| 200 | Read or mutation succeeded |
| 201 | Account or order created |
| 303 | Logout redirect for HTML form posts |
| 400 | Empty cart, invalid quantity, invalid JSON (where `StoreError` is preserved) |
| 401 | Missing session, unknown email, wrong password |
| 404 | Product or order not found / not owned by the session user |
| 409 | Insufficient stock, duplicate email, order no longer cancellable |
| 422 | Zod validation failed |
| 500 | Unexpected failure |

### Caching

No route sets cache headers or uses `use cache`. Handlers read SQLite per request, so every
request sees the current committed state; there is no application-level cache or CDN layer.

## 2. Endpoint summary

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | no | Create an account and session |
| `POST` | `/api/auth/login` | no | Verify credentials and create a session |
| `POST` | `/api/auth/logout` | no | Delete the current session and clear the cookie |
| `GET` | `/api/cart` | yes | Read bag lines and total item count |
| `POST` | `/api/cart` | yes | Add quantity to a product |
| `PATCH` | `/api/cart/[productId]` | yes | Set quantity (0 removes) |
| `DELETE` | `/api/cart/[productId]` | yes | Remove a product |
| `POST` | `/api/orders` | yes | Place a cart or buy-now order |
| `POST` | `/api/orders/[id]/cancel` | yes | Cancel before shipment and restock |
| `POST` | `/api/orders/[id]/reorder` | yes | Add an order’s available items to the bag |
| `GET` | `/api/products` | no | Server-side catalog search |
| `POST` | `/api/assistant` | no | Ask the shopping guide |

There is no `GET /api/orders`; order pages query SQLite directly in server components.

## 3. Authentication

### `POST /api/auth/signup`

Body (`signupSchema`):

```json
{
  "name": "Alex Rivera",
  "email": "alex@northline.co",
  "password": "northline123"
}
```

- `name`: trimmed, 2–80 characters.
- `email`: trimmed, lower-cased, valid email, max 254.
- `password`: 8–200 characters.

Success `201`:

```json
{ "user": { "id": "…uuid…", "name": "Alex Rivera", "email": "alex@northline.co" } }
```

Sets a 30-day `northline_session` cookie. Errors:

| Status | Condition |
| --- | --- |
| 409 | Email already registered (pre-check or caught `UNIQUE`) with an `email` field message |
| 422 | Validation failure |
| 500 | Invalid JSON or unexpected error (the handler’s broad catch does not preserve the 400) |

### `POST /api/auth/login`

Body (`loginSchema`): `{ "email": "...", "password": "..." }`. Email is lower-cased.

Success `200` returns the same `{ user }` shape and creates a session.

| Status | Condition |
| --- | --- |
| 401 | No account for the email, or password mismatch (field-specific message) |
| 422 | Validation failure |
| 500 | Invalid JSON or unexpected error |

The sign-in form, when `add`/`qty` query parameters are present, follows a successful login
with `POST /api/cart` to resume an interrupted add-to-bag.

### `POST /api/auth/logout`

Deletes the session row if a cookie is present and expires the cookie. No body, no auth
requirement.

- If `Accept` contains `text/html` → `303` redirect to `/`.
- Otherwise → `200 { "ok": true }`.

## 4. Cart

All cart responses use the same shape:

```json
{
  "count": 2,
  "lines": [
    {
      "qty": 1,
      "product": {
        "id": "iphone-15-pro",
        "name": "iPhone 15 Pro",
        "category": "Phones",
        "priceCents": 99900,
        "stock": 9,
        "image": "/assets/tech/iphone-15-pro.jpg",
        "alt": "Titanium iPhone 15 Pro photographed against a pale background",
        "tagline": "Titanium, USB-C and a camera that keeps up.",
        "description": "…",
        "specs": [["Display", "6.1-inch Super Retina XDR"]],
        "tags": ["iphone", "apple"],
        "highlights": ["…"],
        "inBox": ["iPhone 15 Pro"],
        "care": "…"
      }
    }
  ]
}
```

`count` is the sum of quantities, not the number of distinct lines.

### `GET /api/cart`

- `200` with `{ lines, count }`.
- `401 { "error": "Sign in to see your bag." }`.

### `POST /api/cart`

Body (`cartAddSchema`): `{ "productId": "iphone-15-pro", "qty": 1 }`.

- `qty`: integer 1–99; `productId`: 1–80 characters.
- Adds to any existing quantity and rejects the result if it exceeds current stock.
- `200` with the updated cart.

| Status | Condition |
| --- | --- |
| 401 | No session |
| 404 | Product does not exist |
| 409 | Existing quantity + qty exceeds stock, or product sold out |
| 422 | Validation failure |
| 400 | Invalid JSON |
| 500 | Unexpected error |

### `PATCH /api/cart/[productId]`

Body (`cartQtySchema`): `{ "qty": 3 }`, where `qty` is an integer 0–99.

- `qty = 0` removes the line (delegates to `removeCartItem`).
- `qty >= 1` checks stock and upserts.
- `200` with the updated cart.

| Status | Condition |
| --- | --- |
| 401 | No session |
| 404 | Product does not exist (only when `qty >= 1`) |
| 409 | Quantity exceeds stock |
| 422 | Validation failure |
| 400 | Invalid JSON |
| 500 | Unexpected error |

### `DELETE /api/cart/[productId]`

Removes the line. Idempotent: deleting a product that is not in the bag still returns `200`
with the current cart. Errors: `401`, `500`. There is no body.

## 5. Orders

### `POST /api/orders`

Two discriminated bodies (`orderSchema`):

```json
{
  "source": "cart",
  "shipping": {
    "fullName": "Alex Rivera",
    "line1": "88 Pine Street",
    "line2": "Apt 4B",
    "city": "Seattle",
    "region": "WA",
    "postal": "98101",
    "country": "United States"
  }
}
```

```json
{
  "source": "buy-now",
  "productId": "iphone-15-pro",
  "qty": 1,
  "shipping": { "…": "…" }
}
```

Shipping rules (`shippingSchema`):

| Field | Rule |
| --- | --- |
| `fullName` | trimmed, 2–80 |
| `line1` | trimmed, 4–120 |
| `line2` | trimmed, max 120, defaults to `""` |
| `city` | trimmed, 2–80 |
| `region` | trimmed, 2–80 |
| `postal` | `/^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/` |
| `country` | trimmed, 2–80 |

Success `201`:

```json
{ "orderId": "NL-1052" }
```

The transaction decrements stock, snapshots line items, writes the `Processing` event, and
clears the cart for `source: "cart"`. Buy-now does not touch the bag.

| Status | Condition |
| --- | --- |
| 400 | Empty cart; invalid JSON; store-level invalid quantity |
| 401 | No session |
| 404 | Buy-now product missing |
| 409 | Pre-check or conditional update finds insufficient stock |
| 422 | Schema validation failure |
| 500 | Unexpected error / SQLite busy |

### `POST /api/orders/[id]/cancel`

No body. Cancels only `Processing` or `Packed`, restocks every line, appends a `Cancelled`
event.

- `200 { "ok": true }`
- `401` no session
- `404` order missing or owned by another user
- `409` already `Shipped`/`Delivered`/`Cancelled`, or a concurrent cancel won
- `500` unexpected error

### `POST /api/orders/[id]/reorder`

No body. Adds each order line that still exists and has stock, clamped to the room left in
the bag.

```json
{ "added": 2, "limited": true }
```

`added` is the total quantity added; `limited` is true if any line was clamped or skipped.

- `400` order has no items
- `401` no session
- `404` order missing or owned by another user
- `500` unexpected error

## 6. Catalog

### `GET /api/products`

Public read. The current UI filters in the browser and does not call this endpoint.

Query parameters:

| Parameter | Meaning |
| --- | --- |
| `q` | Natural-language keywords; parsed by `parseGearQuery` (category/budget inference + keywords) |
| `category` | Exact category; `all` or empty disables the filter |
| `min` / `max` | USD, converted to cents with `Math.round`; only applied when the parameter is present and finite |
| `sort` | `price-asc`, `price-desc`, `name`; anything else keeps featured order |

Success `200`:

```json
{
  "count": 2,
  "products": [ { "id": "iphone-15-pro", "priceCents": 99900, "…": "…" } ]
}
```

`matchProducts` applies category and price filters, then keyword filtering against
`name + tags` (all keywords must match). If keyword filtering finds nothing and no category
was supplied, it returns an empty list; with a category, it keeps the category/price
results. Results are scored by name (4), tags (2) and full haystack (1). No pagination.

There is no `try/catch` around the handler, so an unexpected database error produces the
framework’s 500 response rather than the JSON error envelope.

## 7. Assistant

### `POST /api/assistant`

No authentication required; the handler reads the session, if any, so account tools can be
user-scoped.

Body (`assistantSchema`): `{ "query": "laptops under $1,500" }` — trimmed, 1–500 characters.

Success `200` returns an `application/x-ndjson` stream: one JSON event per line.

```json
{"type":"reasoning","text":"The user wants laptops under $1,500."}
{"type":"tool-call","id":"call_…","name":"search_products","input":{"query":"laptops","maxPrice":1500}}
{"type":"tool-result","id":"call_…","status":"done"}
{"type":"text","text":"Two"}
{"type":"text","text":" matches"}
{"type":"done","response":{"intent":"shopping","reply":"…","products":[],"orders":[],"actions":[],"filters":null,"source":"agent"}}
```

Event contract (`AssistantStreamEvent` in `lib/assistant.ts`):

| Type | Fields | Meaning |
| --- | --- | --- |
| `reasoning` | `text` | A reasoning/thinking delta; concatenate in arrival order |
| `reasoning-reset` | none | Discard reasoning already sent (emitted when the stream falls back) |
| `tool-call` | `id`, `name`, `input` | A model-requested tool call is starting |
| `tool-result` | `id`, `status` (`done` / `error`) | That tool call completed |
| `text` | `text` | A reply delta; concatenate in arrival order |
| `done` | `response` | Final `AssistantResponse`, including projected cards/actions |
| `error` | `message` | The stream could not produce a response |

Reasoning deltas are optional: the deterministic fallback never emits them, and a
non-reasoning model produces none. They may arrive before or between tool calls and text.
The widget shows them in a collapsible `Thinking…` block.

`done.response` has the existing `AssistantResponse` shape:

```json
{
  "intent": "shopping",
  "reply": "I found 2 matches in the computers category…",
  "products": [ { "id": "macbook-air-13-m3", "…": "…" } ],
  "orders": [],
  "actions": [
    { "label": "See all 2 in the catalog", "href": "/?q=…&category=Computers&max=1500&assistant=1", "primary": true }
  ],
  "filters": {
    "query": "laptops under $1,500",
    "category": "Computers",
    "minPriceCents": null,
    "maxPriceCents": 150000,
    "keywords": ["laptops"]
  },
  "source": "agent"
}
```

`intent` is one of `shopping`, `orders`, `cart`, `checkout`, `account`, `catalog`, `help`.
`source` is `agent` or `catalog` (the deterministic fallback). Product cards are capped at
four, order cards at three. See [ai-assistant.md](./ai-assistant.md).

| Status | Condition |
| --- | --- |
| 422 | Empty/overlong query (JSON error envelope) |
| 500 | Invalid JSON or unexpected failure before streaming starts (JSON error envelope) |

Agent failures after the stream starts do **not** produce a 500: `streamAssistantReply`
emits a `reasoning-reset` if reasoning was already sent, then a fallback `done` response.
The client replaces any partial text and reasoning with the fallback response.

## 8. Client call sites

| Component | Endpoint | After success |
| --- | --- | --- |
| `sign-up-form.tsx` | `POST /api/auth/signup` | optionally `POST /api/cart` for a pending add; `router.push(next)` + `router.refresh()` |
| `sign-in-form.tsx` | `POST /api/auth/login` | optionally `POST /api/cart`; `router.push(next)` + `router.refresh()` |
| `site-header.tsx` | `POST /api/auth/logout` | toast, `router.push("/")`, `router.refresh()` |
| `signin/page.tsx` | HTML form `POST /api/auth/logout` | 303 redirect to `/` |
| `add-to-cart-button.tsx` | `POST /api/cart` | toast, `router.refresh()`; unauthenticated → `/signin?next=…&add=…&qty=…` |
| `cart-lines.tsx` | `PATCH /api/cart/[productId]` | optimistic update, replace with server lines, `router.refresh()` |
| `checkout-form.tsx` | `POST /api/orders` | toast, `/orders/[id]?placed=1`, `router.refresh()` |
| `cancel-order-button.tsx` | `POST /api/orders/[id]/cancel` | toast, `router.refresh()` |
| `reorder-button.tsx` | `POST /api/orders/[id]/reorder` | toast with added/limited, `router.refresh()` |
| `chat-widget.tsx` | `POST /api/assistant` | stream tool calls and text into the pending message; replace it with the final response |

`product-purchase.tsx` does not call an API for buy-now; it routes to
`/checkout?buy=<id>&qty=<n>`, which posts the order later.
