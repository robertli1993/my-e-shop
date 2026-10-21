import type Database from "better-sqlite3";
import { hashPassword } from "@/lib/auth/password";
import { SAMPLE_ACCOUNT, SAMPLE_ORDERS, SEED_PRODUCTS } from "./seed-data";

const FLOW = ["Processing", "Packed", "Shipped", "Delivered"] as const;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image TEXT NOT NULL,
  alt TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  specs TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  highlights TEXT NOT NULL DEFAULT '[]',
  in_box TEXT NOT NULL DEFAULT '[]',
  care TEXT NOT NULL DEFAULT '',
  featured_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS cart_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS cart_items_user_idx ON cart_items(user_id);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  postal TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  qty INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id);

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
`;

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function totalsFor(subtotalCents: number) {
  const shippingCents = subtotalCents >= 15_000 ? 0 : 800;
  const taxCents = Math.round(subtotalCents * 0.08);
  return {
    shippingCents,
    taxCents,
    totalCents: subtotalCents + shippingCents + taxCents,
  };
}

function seed(sqlite: Database.Database) {
  const now = Date.now();
  const productById = new Map(SEED_PRODUCTS.map((product) => [product.id, product]));
  const insertProduct = sqlite.prepare(`
    INSERT INTO products (
      id, name, category, price_cents, stock, image, alt, tagline, description,
      specs, tags, highlights, in_box, care, featured_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertUser = sqlite.prepare(`
    INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)
  `);
  const insertOrder = sqlite.prepare(`
    INSERT INTO orders (
      id, user_id, status, subtotal_cents, shipping_cents, tax_cents, total_cents,
      full_name, line1, line2, city, region, postal, country, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertOrderItem = sqlite.prepare(`
    INSERT INTO order_items (order_id, product_id, name, category, image, price_cents, qty)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEvent = sqlite.prepare(`
    INSERT INTO order_events (order_id, status, at) VALUES (?, ?, ?)
  `);

  SEED_PRODUCTS.forEach((product, index) => {
    insertProduct.run(
      product.id,
      product.name,
      product.category,
      product.priceCents,
      product.stock,
      product.image,
      product.alt,
      product.tagline,
      product.description,
      JSON.stringify(product.specs),
      JSON.stringify(product.tags),
      JSON.stringify(product.highlights),
      JSON.stringify(product.inBox),
      product.care,
      index,
      iso(now),
    );
  });

  const sampleUserId = SAMPLE_ACCOUNT.id;
  insertUser.run(
    sampleUserId,
    SAMPLE_ACCOUNT.name,
    SAMPLE_ACCOUNT.email,
    hashPassword(SAMPLE_ACCOUNT.password),
    iso(now - 42 * 86_400_000),
  );

  const address = {
    fullName: SAMPLE_ACCOUNT.name,
    line1: "88 Pine Street",
    line2: "Apt 4B",
    city: "Seattle",
    region: "WA",
    postal: "98101",
    country: "United States",
  };

  for (const order of SAMPLE_ORDERS) {
    const lineItems = order.items.map(([productId, qty]) => {
      const product = productById.get(productId);
      if (!product) throw new Error(`Seed order references unknown product ${productId}`);
      return { product, qty };
    });
    const subtotalCents = lineItems.reduce(
      (sum, line) => sum + line.product.priceCents * line.qty,
      0,
    );
    const totals = totalsFor(subtotalCents);
    const createdAt = new Date(now - order.daysAgo * 86_400_000 - order.offsetMs).toISOString();

    insertOrder.run(
      order.id,
      sampleUserId,
      order.status,
      subtotalCents,
      totals.shippingCents,
      totals.taxCents,
      totals.totalCents,
      address.fullName,
      address.line1,
      address.line2,
      address.city,
      address.region,
      address.postal,
      address.country,
      createdAt,
      createdAt,
    );

    for (const line of lineItems) {
      insertOrderItem.run(
        order.id,
        line.product.id,
        line.product.name,
        line.product.category,
        line.product.image,
        line.product.priceCents,
        line.qty,
      );
    }

    const reached = FLOW.slice(0, FLOW.indexOf(order.status as (typeof FLOW)[number]) + 1);
    reached.forEach((status, index) => {
      insertEvent.run(order.id, status, new Date(new Date(createdAt).getTime() + index * 13_200_000).toISOString());
    });
  }

  sqlite
    .prepare("INSERT INTO counters (name, value) VALUES ('orders', 1051), ('seeded', 1)")
    .run();
}

export function initializeDatabase(sqlite: Database.Database) {
  sqlite.exec(SCHEMA);
  const seedTransaction = sqlite.transaction(() => {
    const marker = sqlite.prepare("SELECT value FROM counters WHERE name = 'seeded'").get() as
      | { value: number }
      | undefined;
    if (marker) return;
    seed(sqlite);
  });
  seedTransaction.immediate();
}
