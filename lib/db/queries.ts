import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cartItems,
  orderEvents,
  orderItems,
  orders,
  products,
  sessions,
  users,
} from "@/lib/db/schema";
import type {
  CartLine,
  OrderDetail,
  OrderItem,
  OrderSummary,
  Product,
  SessionUser,
} from "@/lib/types";

type ProductRow = typeof products.$inferSelect;
type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;
type OrderEventRow = typeof orderEvents.$inferSelect;

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseSpecs(value: string): [string, string][] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is [string, string] =>
        Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "string",
    );
  } catch {
    return [];
  }
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.priceCents,
    stock: row.stock,
    image: row.image,
    alt: row.alt,
    tagline: row.tagline,
    description: row.description,
    specs: parseSpecs(row.specs),
    tags: parseStringArray(row.tags),
    highlights: parseStringArray(row.highlights),
    inBox: parseStringArray(row.inBox),
    care: row.care,
  };
}

export function listProducts(): Product[] {
  return db
    .select()
    .from(products)
    .orderBy(asc(products.featuredOrder), asc(products.name))
    .all()
    .map(toProduct);
}

export function getProduct(id: string): Product | null {
  const row = db.select().from(products).where(eq(products.id, id)).get();
  return row ? toProduct(row) : null;
}

export function getCartLines(userId: string): CartLine[] {
  return db
    .select({ qty: cartItems.qty, product: products })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, userId))
    .orderBy(asc(cartItems.addedAt))
    .all()
    .map(({ qty, product }) => ({ qty, product: toProduct(product) }));
}

export function getCartCount(userId: string): number {
  const rows = db
    .select({ qty: cartItems.qty })
    .from(cartItems)
    .where(eq(cartItems.userId, userId))
    .all();
  return rows.reduce((sum, row) => sum + row.qty, 0);
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    productId: row.productId,
    name: row.name,
    category: row.category,
    image: row.image,
    priceCents: row.priceCents,
    qty: row.qty,
  };
}

function toOrderSummary(row: OrderRow, items: OrderItem[]): OrderSummary {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    totalCents: row.totalCents,
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    items,
  };
}

function toOrderDetail(row: OrderRow, items: OrderItem[], timeline: OrderEventRow[]): OrderDetail {
  return {
    ...toOrderSummary(row, items),
    subtotalCents: row.subtotalCents,
    shippingCents: row.shippingCents,
    taxCents: row.taxCents,
    address: {
      fullName: row.fullName,
      line1: row.line1,
      line2: row.line2,
      city: row.city,
      region: row.region,
      postal: row.postal,
      country: row.country,
    },
    timeline: timeline.map((event) => ({ status: event.status, at: event.at })),
  };
}

export function listOrders(userId: string): OrderSummary[] {
  const rows = db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .all();

  if (rows.length === 0) return [];

  const itemRows = db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((row) => row.id)))
    .orderBy(asc(orderItems.id))
    .all();

  const grouped = new Map<string, OrderItem[]>();
  for (const item of itemRows) {
    const list = grouped.get(item.orderId) ?? [];
    list.push(toOrderItem(item));
    grouped.set(item.orderId, list);
  }

  return rows.map((row) => toOrderSummary(row, grouped.get(row.id) ?? []));
}

export function getOrderCount(userId: string): number {
  return db.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId)).all().length;
}

export function getOrder(userId: string, orderId: string): OrderDetail | null {
  const row = db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .get();

  if (!row) return null;

  const items = db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.id))
    .all()
    .map(toOrderItem);

  const timeline = db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(asc(orderEvents.id))
    .all();

  return toOrderDetail(row, items, timeline);
}

export function getSessionUserByToken(token: string): SessionUser | null {
  const row = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date().toISOString())))
    .get();
  return row ?? null;
}

export function getUserByEmail(email: string) {
  return db.select().from(users).where(eq(users.email, email)).get() ?? null;
}

export function getUserById(id: string) {
  return db.select().from(users).where(eq(users.id, id)).get() ?? null;
}
