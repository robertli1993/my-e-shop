import { io } from "next/cache";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { OrdersExplorer } from "@/components/orders-explorer";
import { AuthRequired, EmptyState } from "@/components/summary";
import { getSessionUser } from "@/lib/auth/session";
import { listOrders } from "@/lib/db/queries";

export const instant = false;

export default async function OrdersPage() {
  await io();
  const user = await getSessionUser();

  if (!user) {
    return (
      <AuthRequired
        title="My orders"
        copy="Sign in to see every order placed with this account."
        next="/orders"
      />
    );
  }

  const orders = listOrders(user.id);

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Package className="icon" strokeWidth={1.75} aria-hidden="true" />}
        title="No orders yet"
        copy="When you place an order it will appear here with its items, shipping details and status."
      >
        <Link className="btn btn-primary" href="/">
          Browse the collection
        </Link>
      </EmptyState>
    );
  }

  return (
    <section className="page-section">
      <div className="container">
        <div className="page-head">
          <p className="eyebrow">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </p>
          <h1>My orders</h1>
          <p className="lead">Every order placed with this account, newest first.</p>
        </div>

        <OrdersExplorer orders={orders} />

        <div className="orders-foot">
          <Link className="link-btn" href="/cart">
            View shopping bag
            <ArrowRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <Link className="btn btn-secondary btn-small" href="/">
            Continue shopping
          </Link>
        </div>
      </div>
    </section>
  );
}
