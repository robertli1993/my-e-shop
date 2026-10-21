"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { formatMoney, formatPrice } from "@/lib/money";
import type { CartLine } from "@/lib/types";

export function CartLines({ initialLines }: { initialLines: CartLine[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [lines, setLines] = useState(initialLines);
  const [busy, setBusy] = useState<string | null>(null);

  async function change(productId: string, qty: number, name?: string) {
    if (busy) return;
    setBusy(productId);
    const next =
      qty <= 0
        ? lines.filter((line) => line.product.id !== productId)
        : lines.map((line) =>
            line.product.id === productId ? { ...line, qty } : line,
          );
    setLines(next);

    try {
      const response = await fetch(`/api/cart/${encodeURIComponent(productId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qty }),
      });
      const payload = (await response.json()) as {
        lines?: CartLine[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "The bag could not be updated.");
      if (payload.lines) setLines(payload.lines);
      if (qty <= 0 && name) showToast(`${name} removed from your bag.`);
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The bag could not be updated.", "warn");
      setLines(initialLines);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="cart-lines">
      {lines.map((line) => {
        const product = line.product;
        const short = line.qty > product.stock;
        const warning =
          product.stock > 0
            ? `Only ${product.stock} left — lower the quantity to ${product.stock} to check out.`
            : "This item is sold out — remove it to check out.";

        return (
          <div className={`cart-line${short ? " is-stock-issue" : ""}`} key={product.id}>
            <Link
              className="cart-thumb"
              href={`/product/${product.id}`}
              aria-label={`View ${product.name}`}
            >
              <Image src={product.image} width={96} height={96} alt="" sizes="64px" />
            </Link>
            <div className="cart-line-main">
              <span className="card-cat">{product.category}</span>
              <h3>
                <Link href={`/product/${product.id}`}>{product.name}</Link>
              </h3>
              <div className="cart-line-actions">
                <div
                  className="stepper stepper-small"
                  role="group"
                  aria-label={`Quantity for ${product.name}`}
                >
                  <button
                    type="button"
                    onClick={() => change(product.id, line.qty - 1)}
                    disabled={line.qty <= 1 || busy === product.id}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="icon-sm" strokeWidth={1.75} />
                  </button>
                  <output aria-live="polite">{line.qty}</output>
                  <button
                    type="button"
                    onClick={() => change(product.id, line.qty + 1)}
                    disabled={line.qty >= product.stock || busy === product.id}
                    aria-label="Increase quantity"
                  >
                    <Plus className="icon-sm" strokeWidth={1.75} />
                  </button>
                </div>
                <button
                  className="cart-remove"
                  type="button"
                  onClick={() => change(product.id, 0, product.name)}
                  disabled={busy === product.id}
                >
                  <Trash2 className="icon-sm" strokeWidth={1.75} />
                  Remove
                </button>
              </div>
              {short ? (
                <p className="cart-stock-warn">
                  <AlertTriangle className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                  <span>{warning}</span>
                </p>
              ) : null}
            </div>
            <div className="cart-line-price">
              {formatMoney(product.priceCents * line.qty)}
              <span className="unit">{formatPrice(product.priceCents)} each</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
