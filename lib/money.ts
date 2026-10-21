export const FREE_SHIPPING_THRESHOLD_CENTS = 15_000;
export const SHIPPING_CENTS = 800;
export const TAX_RATE = 0.08;

export function totalsFor(subtotalCents: number) {
  const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  return {
    shippingCents,
    taxCents,
    totalCents: subtotalCents + shippingCents + taxCents,
  };
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatPrice(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : formatMoney(cents);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function stockState(stock: number) {
  if (stock <= 0) return { className: "out", label: "Sold out" };
  if (stock <= 3) return { className: "low", label: `Only ${stock} left` };
  return { className: "", label: "In stock" };
}
