import { io } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { CancelOrderButton } from "@/components/cancel-order-button";
import { GuideButton } from "@/components/guide-button";
import { OrderItemRow, StatusPill } from "@/components/order-visuals";
import { ReorderButton } from "@/components/reorder-button";
import { AuthRequired } from "@/components/summary";
import { getSessionUser } from "@/lib/auth/session";
import { getOrder, listProducts } from "@/lib/db/queries";
import { formatDate, formatDateTime, formatMoney } from "@/lib/money";
import type { OrderDetail } from "@/lib/types";

const FLOW = ["Processing", "Packed", "Shipped", "Delivered"];

export const instant = false;

function Timeline({ order }: { order: OrderDetail }) {
  const cancelled = order.status === "Cancelled";
  const history = new Map(order.timeline.map((entry) => [entry.status, entry.at]));
  const currentIndex = FLOW.indexOf(order.status);

  const steps = FLOW.map((status, index) => ({
    status,
    at: history.get(status),
    reached: history.has(status),
    current: order.status === status,
    cancelled: false,
    pending: !history.has(status) && !cancelled && index > currentIndex,
  })).filter((step) => {
    if (cancelled) return step.reached;
    return step.reached || FLOW.indexOf(step.status) <= currentIndex;
  });

  if (cancelled) {
    steps.push({
      status: "Cancelled",
      at: history.get("Cancelled"),
      reached: true,
      current: true,
      cancelled: true,
      pending: false,
    });
  }

  return (
    <ol className="timeline">
      {steps.map((step) => {
        const className = step.cancelled
          ? " cancelled"
          : step.current
            ? " current"
            : step.reached
              ? " done"
              : "";
        return (
          <li className={`tl-step${className}`} key={step.status}>
            <span className="tl-dot" aria-hidden="true" />
            <div className="tl-body">
              <div className="tl-title">{step.status}</div>
              <div className="tl-time">
                {step.at ? formatDateTime(step.at) : "Pending"}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  await io();

  const user = await getSessionUser();
  if (!user) {
    return (
      <AuthRequired
        title="Order details"
        copy="Sign in to open this order."
        next={`/orders/${id}`}
      />
    );
  }

  const order = getOrder(user.id, id);
  if (!order) notFound();

  const placed = query.placed === "1";
  const canCancel = order.status === "Processing" || order.status === "Packed";
  const products = listProducts();
  const canReorder = order.items.some((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return Boolean(product && product.stock > 0);
  });
  const address = order.address;

  return (
    <section className="page-section">
      <div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/orders">Orders</Link>
          <ChevronRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
          <span aria-current="page">{order.id}</span>
        </nav>

        {placed && order.status !== "Cancelled" ? (
          <div className="placed-banner">
            <Check className="icon" strokeWidth={1.75} aria-hidden="true" />
            <div>
              <h2>Order confirmed</h2>
              <p>
                {order.id} is saved with its items and shipping details. No email is sent and no
                payment is taken.
              </p>
            </div>
          </div>
        ) : null}

        <div className="page-head">
          <p className="eyebrow">{formatDate(order.createdAt)}</p>
          <h1>Order {order.id}</h1>
          <div style={{ marginTop: 12 }}>
            <StatusPill status={order.status} />
          </div>
        </div>

        <div className="order-layout">
          <div>
            <section className="detail-panel">
              <h2>Items</h2>
              <div className="order-items">
                {order.items.map((item) => (
                  <OrderItemRow key={item.productId} item={item} />
                ))}
              </div>
              <div className="order-summary-rows">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span className="val">{formatMoney(order.subtotalCents)}</span>
                </div>
                <div className="summary-row">
                  <span>Shipping</span>
                  <span className="val">
                    {order.shippingCents === 0 ? "Free" : formatMoney(order.shippingCents)}
                  </span>
                </div>
                <div className="summary-row">
                  <span>Tax</span>
                  <span className="val">{formatMoney(order.taxCents)}</span>
                </div>
                <div className="summary-total">
                  <span>Order total</span>
                  <span className="val">{formatMoney(order.totalCents)}</span>
                </div>
              </div>
              <div className="order-again">
                <ReorderButton orderId={order.id} disabled={!canReorder} />
                <p className="tiny">
                  Available quantities are added to your bag. Stock is not reserved until checkout.
                </p>
              </div>
            </section>

            <section className="detail-panel">
              <h2>Shipping</h2>
              <p className="address">
                <strong>{address.fullName}</strong>
                <br />
                {address.line1}
                {address.line2 ? (
                  <>
                    <br />
                    {address.line2}
                  </>
                ) : null}
                <br />
                {address.city}, {address.region} {address.postal}
                <br />
                {address.country}
              </p>
              <p className="cancel-note">
                Placed {formatDateTime(order.createdAt)}. Payment: demo, not charged.
              </p>
            </section>
          </div>

          <div>
            <section className="detail-panel">
              <h2>Status</h2>
              <Timeline order={order} />
              {canCancel ? (
                <>
                  <CancelOrderButton orderId={order.id} />
                  <p className="cancel-note">
                    Cancelling before dispatch returns every item to inventory. This cannot be
                    undone.
                  </p>
                </>
              ) : (
                <p className="cancel-note">
                  {order.status === "Cancelled"
                    ? "This order was cancelled and its items were returned to inventory."
                    : "This order has left the warehouse and can no longer be cancelled."}
                </p>
              )}
            </section>

            <section className="detail-panel">
              <h2>Need anything?</h2>
              <p className="small muted" style={{ marginBottom: 12 }}>
                This is a demo. There is no support inbox, but the tech guide can help you find a
                replacement.
              </p>
              <GuideButton className="link-btn">
                Ask the tech guide
                <ArrowRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
              </GuideButton>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
