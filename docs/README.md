# Northline documentation

Architecture and implementation reference for the Northline storefront. These documents
describe the code in this repository; when the code and a document disagree, the code is
authoritative.

| Document | Covers |
| --- | --- |
| [architecture.md](./architecture.md) | System context, runtime topology, module boundaries, rendering and caching, request lifecycles, security, deployment, decisions and limitations |
| [data-model.md](./data-model.md) | SQLite schema, entity relationships, invariants, transactions and concurrency |
| [api.md](./api.md) | Route handler contracts, status codes, payloads and client call sites |
| [ai-assistant.md](./ai-assistant.md) | The optional `ToolLoopAgent`, its read-only tools, deterministic fallback, guardrails and configuration |

## Quick orientation

- **Stack:** Next.js 16 App Router (React 19 server components) + Drizzle ORM +
  better-sqlite3 + Tailwind CSS v4/shadcn (Base UI primitives) + Vercel AI SDK.
- **Shape:** one Node.js process serves both React pages and JSON route handlers. There is
  no separate backend service; server code reads and writes a local SQLite file in-process.
- **Data:** integer cents, snapshot order lines, conditional stock updates inside
  transactions, and per-user ownership checks on every order read/write.
- **Rendering:** per-request data. `await io()` excludes synchronous SQLite reads from the
  static shell; `instant = false` opts the app’s content routes out of instant/static-shell
  validation.
- **AI:** optional. Without `OPENDESIGN_API_KEY`, the guide runs a deterministic catalog
  search; with it, a `ToolLoopAgent` can only act through read-only, database-backed tools.

## Running and checking

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint
npx tsc --noEmit
npm run build
```

The database is created and seeded on first import of `lib/db`. Delete
`data/northline.db` while the server is stopped to reset it.
