import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cartItems,
  orderEvents,
  orderItems,
  orders,
  products,
} from "@/lib/db/schema";
import { getCartLines, getProduct, toProduct } from "@/lib/db/queries";
import { totalsFor } from "@/lib/money";
import type { Product } from "@/lib/types";

export class StoreError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "StoreError";
    this.status = status;
  }
}

export type ShippingAddress = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

export type PlaceOrderInput =
  | { source: "cart"; shipping: ShippingAddress }
  | { source: "buy-now"; productId: string; qty: number; shipping: ShippingAddress };

function assertStock(product: Product, qty: number) {
  if (product.stock <= 0) {
    throw new StoreError(409, `${product.name} is sold out.`);
  }
  if (qty > product.stock) {
    throw new StoreError(
      409,
      `Only ${product.stock} of ${product.name} ${product.stock === 1 ? "remains" : "remain"}.`,
    );
  }
}

export function addToCart(userId: string, productId: string, qty: number): void {
  if (!Number.isInteger(qty) || qty < 1) {
    throw new StoreError(400, "Choose a quantity of at least 1.");
  }

  db.transaction((tx) => {
    const productRow = tx.select().from(products).where(eq(products.id, productId)).get();
    if (!productRow) throw new StoreError(404, "That product is no longer in the catalog.");
    const product = toProduct(productRow);

    const existing = tx
      .select({ qty: cartItems.qty })
      .from(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
      .get();
    const nextQty = (existing?.qty ?? 0) + qty;

    if (nextQty > product.stock) {
      throw new StoreError(
        409,
        product.stock > 0
          ? `Only ${product.stock} of ${product.name} in stock.`
          : `${product.name} is sold out.`,
      );
    }

    tx.insert(cartItems)
      .values({ userId, productId, qty: nextQty })
      .onConflictDoUpdate({
        target: [cartItems.userId, cartItems.productId],
        set: { qty: nextQty },
      })
      .run();
  });
}

export function setCartQty(userId: string, productId: string, qty: number): void {
  if (!Number.isInteger(qty)) {
    throw new StoreError(400, "Quantity must be a whole number.");
  }

  if (qty < 1) {
    removeCartItem(userId, productId);
    return;
  }

  const product = getProduct(productId);
  if (!product) throw new StoreError(404, "That product is no longer in the catalog.");
  if (qty > product.stock) assertStock(product, qty);

  db.insert(cartItems)
    .values({ userId, productId, qty })
    .onConflictDoUpdate({
      target: [cartItems.userId, cartItems.productId],
      set: { qty },
    })
    .run();
}

export function removeCartItem(userId: string, productId: string): void {
  db.delete(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .run();
}

export function placeOrder(userId: string, input: PlaceOrderInput): { orderId: string } {
  return db.transaction((tx) => {
    type Line = { product: Product; qty: number };
    const lines: Line[] = [];

    if (input.source === "buy-now") {
      const row = tx.select().from(products).where(eq(products.id, input.productId)).get();
      if (!row) throw new StoreError(404, "That product is no longer in the catalog.");
      const product = toProduct(row);
      if (!Number.isInteger(input.qty) || input.qty < 1) {
        throw new StoreError(400, "Choose a quantity of at least 1.");
      }
      assertStock(product, input.qty);
      lines.push({ product, qty: input.qty });
    } else {
      const rows = tx
        .select({ qty: cartItems.qty, product: products })
        .from(cartItems)
        .innerJoin(products, eq(cartItems.productId, products.id))
        .where(eq(cartItems.userId, userId))
        .orderBy(asc(cartItems.addedAt))
        .all();
      if (rows.length === 0) throw new StoreError(400, "Your bag is empty.");
      for (const row of rows) {
        const product = toProduct(row.product);
        assertStock(product, row.qty);
        lines.push({ product, qty: row.qty });
      }
    }

    for (const line of lines) {
      const result = tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${line.qty}` })
        .where(and(eq(products.id, line.product.id), gte(products.stock, line.qty)))
        .run();

      if (result.changes !== 1) {
        const fresh = tx.select().from(products).where(eq(products.id, line.product.id)).get();
        throw new StoreError(
          409,
          fresh && fresh.stock > 0
            ? `Only ${fresh.stock} of ${line.product.name} remain. Adjust your bag and try again.`
            : `${line.product.name} just sold out. Adjust your bag and try again.`,
        );
      }
    }

    const subtotalCents = lines.reduce(
      (sum, line) => sum + line.product.priceCents * line.qty,
      0,
    );
    const totals = totalsFor(subtotalCents);
    const now = new Date().toISOString();

    const counter = tx.get<{ value: number }>(sql`
      INSERT INTO counters (name, value) VALUES ('orders', 1052)
      ON CONFLICT(name) DO UPDATE SET value = counters.value + 1
      RETURNING value
    `);
    const orderId = `NL-${counter?.value ?? 1052}`;

    tx.insert(orders)
      .values({
        id: orderId,
        userId,
        status: "Processing",
        subtotalCents,
        shippingCents: totals.shippingCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        fullName: input.shipping.fullName,
        line1: input.shipping.line1,
        line2: input.shipping.line2,
        city: input.shipping.city,
        region: input.shipping.region,
        postal: input.shipping.postal,
        country: input.shipping.country,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    for (const line of lines) {
      tx.insert(orderItems)
        .values({
          orderId,
          productId: line.product.id,
          name: line.product.name,
          category: line.product.category,
          image: line.product.image,
          priceCents: line.product.priceCents,
          qty: line.qty,
        })
        .run();
    }

    tx.insert(orderEvents).values({ orderId, status: "Processing", at: now }).run();

    if (input.source === "cart") {
      tx.delete(cartItems).where(eq(cartItems.userId, userId)).run();
    }

    return { orderId };
  });
}

export function cancelOrder(userId: string, orderId: string): void {
  db.transaction((tx) => {
    const order = tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
      .get();

    if (!order) throw new StoreError(404, "That order was not found.");
    if (order.status !== "Processing" && order.status !== "Packed") {
      throw new StoreError(409, "Orders can only be cancelled before they ship.");
    }

    const now = new Date().toISOString();
    const updated = tx
      .update(orders)
      .set({ status: "Cancelled", updatedAt: now })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.userId, userId),
          inArray(orders.status, ["Processing", "Packed"]),
        ),
      )
      .run();

    if (updated.changes !== 1) {
      throw new StoreError(409, "This order can no longer be cancelled.");
    }

    const items = tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
    for (const item of items) {
      tx.update(products)
        .set({ stock: sql`${products.stock} + ${item.qty}` })
        .where(eq(products.id, item.productId))
        .run();
    }

    tx.insert(orderEvents).values({ orderId, status: "Cancelled", at: now }).run();
  });
}

export function reorder(userId: string, orderId: string): { added: number; limited: boolean } {
  const order = db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .get();
  if (!order) throw new StoreError(404, "That order was not found.");

  const items = db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
  if (items.length === 0) throw new StoreError(400, "That order has no items.");

  let added = 0;
  let limited = false;

  db.transaction((tx) => {
    for (const item of items) {
      const productRow = tx.select().from(products).where(eq(products.id, item.productId)).get();
      if (!productRow || productRow.stock <= 0) {
        limited = true;
        continue;
      }
      const existing = tx
        .select({ qty: cartItems.qty })
        .from(cartItems)
        .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, item.productId)))
        .get();
      const have = existing?.qty ?? 0;
      const room = Math.max(0, productRow.stock - have);
      const qty = Math.min(item.qty, room);
      if (qty < item.qty) limited = true;
      if (qty > 0) {
        tx.insert(cartItems)
          .values({ userId, productId: item.productId, qty: have + qty })
          .onConflictDoUpdate({
            target: [cartItems.userId, cartItems.productId],
            set: { qty: have + qty },
          })
          .run();
        added += qty;
      }
    }
  });

  return { added, limited };
}

export { getCartLines };
