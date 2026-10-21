import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

export type SummaryLine = {
  name: string;
  qty: number;
  priceCents: number;
};

export function Summary({
  title = "Order summary",
  lines,
  subtotalCents,
  shippingCents,
  taxCents,
  totalCents,
  footer,
  tail,
}: {
  title?: string;
  lines: SummaryLine[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  footer?: React.ReactNode;
  tail?: React.ReactNode;
}) {
  return (
    <Card className="summary gap-0 py-0">
      <h2>{title}</h2>
      <div className="summary-items">
        {lines.map((line) => (
          <div className="summary-item" key={line.name}>
            <span className="od-truncate">
              {line.name} <span className="qty">× {line.qty}</span>
            </span>
            <span className="val">{formatMoney(line.priceCents * line.qty)}</span>
          </div>
        ))}
      </div>
      <div className="summary-row">
        <span>Subtotal</span>
        <span className="val">{formatMoney(subtotalCents)}</span>
      </div>
      <div className="summary-row">
        <span>Shipping</span>
        <span className="val">
          {shippingCents === 0 ? <span className="ship-note">Free</span> : formatMoney(shippingCents)}
        </span>
      </div>
      <div className="summary-row">
        <span>Estimated tax</span>
        <span className="val">{formatMoney(taxCents)}</span>
      </div>
      <div className="summary-total">
        <span>Total</span>
        <span className="val">{formatMoney(totalCents)}</span>
      </div>
      {footer}
      <p className="summary-note">
        <svg
          className="icon icon-sm"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6l7-2.5Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        Demo checkout. No payment is processed.
      </p>
      {tail}
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  copy,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="page-section">
      <div className="container">
        <div className="centered-empty">
          <span className="empty-mark">{icon}</span>
          <h1>{title}</h1>
          <p>{copy}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

export function AuthRequired({
  title,
  copy,
  next,
}: {
  title: string;
  copy: string;
  next: string;
}) {
  const resolvedNext = encodeURIComponent(next);
  return (
    <EmptyState
      icon={
        <svg
          className="icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21c.6-3.7 3.7-5.8 7.5-5.8s6.9 2.1 7.5 5.8" />
        </svg>
      }
      title={title}
      copy={copy}
    >
      <div className="auth-required-actions">
        <Link className="btn btn-primary" href={`/signin?next=${resolvedNext}`}>
          Sign in
        </Link>
        <Link className="btn btn-secondary" href={`/signup?next=${resolvedNext}`}>
          Create account
        </Link>
      </div>
      <p className="tiny muted">A demo account is ready if you just want to look around.</p>
    </EmptyState>
  );
}
