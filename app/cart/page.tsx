import { io } from "next/cache";
import Link from "next/link";
import { ArrowRight, ChevronRight, ShoppingBag } from "lucide-react";
import { CartLines } from "@/components/cart-lines";
import { AuthRequired, EmptyState, Summary } from "@/components/summary";
import { getSessionUser } from "@/lib/auth/session";
import { getCartLines } from "@/lib/db/queries";
import { formatMoney, totalsFor } from "@/lib/money";

export const instant = false;

export default async function CartPage() {
  await io();
  const user = await getSessionUser();

  if (!user) {
    return (
      <AuthRequired
        title="Your bag"
        copy="Sign in to keep a bag across visits, check out, and see your orders."
        next="/cart"
      />
    );
  }

  const lines = getCartLines(user.id);

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="icon" strokeWidth={1.75} aria-hidden="true" />}
        title="Your bag is empty"
        copy="Start with the collection — a new phone, a faster laptop, better audio, or something for the desk."
      >
        <Link className="btn btn-primary" href="/">
          Browse the collection
        </Link>
      </EmptyState>
    );
  }

  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.product.priceCents * line.qty,
    0,
  );
  const totals = totalsFor(subtotalCents);
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const stockIssue = lines.some((line) => line.qty > line.product.stock);

  return (
    <section className="page-section">
      <div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Shop</Link>
          <ChevronRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
          <span aria-current="page">Bag</span>
        </nav>
        <div className="page-head">
          <p className="eyebrow">
            {count} {count === 1 ? "item" : "items"}
          </p>
          <h1>Shopping bag</h1>
        </div>

        <div className="cart-layout">
          <CartLines initialLines={lines} />
          <Summary
            lines={lines.map((line) => ({
              name: line.product.name,
              qty: line.qty,
              priceCents: line.product.priceCents,
            }))}
            subtotalCents={subtotalCents}
            shippingCents={totals.shippingCents}
            taxCents={totals.taxCents}
            totalCents={totals.totalCents}
            footer={
              stockIssue ? (
                <>
                  <button className="btn btn-primary btn-block" type="button" disabled>
                    Checkout unavailable
                  </button>
                  <p className="summary-note">
                    Some quantities are above current stock. Lower or remove those items to continue.
                  </p>
                </>
              ) : (
                <>
                  <Link className="btn btn-primary btn-block" href="/checkout">
                    Checkout
                    <ArrowRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                  <p className="summary-note">
                    Shipping is free over $150. Tax is estimated at 8% for this demo. Bag total{" "}
                    {formatMoney(totals.totalCents)}.
                  </p>
                </>
              )
            }
            tail={
              <Link className="cart-continue" href="/">
                Continue shopping
              </Link>
            }
          />
        </div>
      </div>
    </section>
  );
}
