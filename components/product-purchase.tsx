"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { Button } from "@/components/ui/button";

export function ProductPurchase({
  productId,
  stock,
  authenticated,
}: {
  productId: string;
  stock: number;
  authenticated: boolean;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const soldOut = stock <= 0;

  function buyNow() {
    const checkoutPath = `/checkout?buy=${encodeURIComponent(productId)}&qty=${qty}`;
    if (!authenticated) {
      const params = new URLSearchParams({ next: checkoutPath });
      router.push(`/signin?${params.toString()}`);
      return;
    }
    router.push(checkoutPath);
  }

  return (
    <>
      <div className="buy-row">
        <div className="stepper" role="group" aria-label="Quantity">
          <button
            type="button"
            onClick={() => setQty((value) => Math.max(1, value - 1))}
            disabled={qty <= 1}
            aria-label="Decrease quantity"
          >
            <Minus className="icon-sm" strokeWidth={1.75} />
          </button>
          <output id="qtyValue" aria-live="polite">
            {qty}
          </output>
          <button
            type="button"
            onClick={() => setQty((value) => Math.min(Math.max(1, stock), value + 1))}
            disabled={qty >= stock}
            aria-label="Increase quantity"
          >
            <Plus className="icon-sm" strokeWidth={1.75} />
          </button>
        </div>
        <AddToCartButton
          productId={productId}
          qty={qty}
          authenticated={authenticated}
          className="h-11 flex-1 px-5"
          label={soldOut ? "Sold out" : "Add to bag"}
          disabled={soldOut}
          nextPath={`/product/${productId}`}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full pt-5"
        onClick={buyNow}
        disabled={soldOut}
      >
        Buy now
        <ArrowRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </>
  );
}
