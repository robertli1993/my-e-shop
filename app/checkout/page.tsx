import { io } from "next/cache";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ShoppingBag } from "lucide-react";
import { CheckoutForm } from "@/components/checkout-form";
import { AuthRequired, EmptyState, Summary } from "@/components/summary";
import { getSessionUser } from "@/lib/auth/session";
import { getCartLines, getProduct } from "@/lib/db/queries";
import { totalsFor } from "@/lib/money";
import type { CartLine } from "@/lib/types";

export const instant = false;

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await io();

  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const buyId = first(params.buy);
  const rawQty = Number(first(params.qty) ?? "1");
  const qty = Number.isFinite(rawQty) ? Math.max(1, Math.min(99, Math.floor(rawQty))) : 1;

  const checkoutPath = buyId
    ? `/checkout?buy=${encodeURIComponent(buyId)}&qty=${qty}`
    : "/checkout";

  const user = await getSessionUser();
  if (!user) {
    return (
      <AuthRequired
        title="Checkout"
        copy="Sign in or create an account to place an order. Your bag will be waiting."
        next={checkoutPath}
      />
    );
  }

  let lines: CartLine[] = [];
  if (buyId) {
    const product = getProduct(buyId);
    if (product) lines = [{ product, qty }];
  } else {
    lines = getCartLines(user.id);
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="icon" strokeWidth={1.75} aria-hidden="true" />}
        title="Nothing to check out"
        copy="Your bag is empty. Add some tech and come back to finish the order."
      >
        <Link className="btn btn-primary" href="/">
          Browse the collection
        </Link>
      </EmptyState>
    );
  }

  const conflict = lines.find((line) => line.qty > line.product.stock);
  if (conflict) {
    const text =
      conflict.product.stock > 0
        ? `Only ${conflict.product.stock} of ${conflict.product.name} ${
            conflict.product.stock === 1 ? "remains" : "remain"
          }.`
        : `${conflict.product.name} is sold out.`;
    return (
      <EmptyState
        icon={<AlertTriangle className="icon" strokeWidth={1.75} aria-hidden="true" />}
        title="Update your bag"
        copy={`Stock changed while you were shopping. ${text} Adjust your bag before checking out.`}
      >
        <Link className="btn btn-primary" href="/cart">
          Review your bag
        </Link>
      </EmptyState>
    );
  }

  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.product.priceCents * line.qty,
    0,
  );
  const totals = totalsFor(subtotalCents);

  return (
    <section className="page-section">
      <div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/cart">Bag</Link>
          <ChevronRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
          <span aria-current="page">Checkout</span>
        </nav>
        <div className="page-head">
          <p className="eyebrow">One last step</p>
          <h1>Checkout</h1>
        </div>

        <div className="checkout-layout">
          <CheckoutForm
            source={buyId ? "buy-now" : "cart"}
            buyNowProductId={buyId || undefined}
            buyNowQty={buyId ? qty : undefined}
            fullName={user.name}
            email={user.email}
            totalCents={totals.totalCents}
          />
          <Summary
            title="In this order"
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
              <p className="summary-note">
                Stock is reserved when you place the order. No payment is collected.
              </p>
            }
          />
        </div>
      </div>
    </section>
  );
}
