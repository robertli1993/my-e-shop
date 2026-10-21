"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast-provider";

export function AddToCartButton({
  productId,
  qty = 1,
  authenticated,
  nextPath,
  className = "btn btn-small card-buy",
  label = "Add to bag",
  disabled = false,
}: {
  productId: string;
  qty?: number;
  authenticated: boolean;
  nextPath?: string;
  className?: string;
  label?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!authenticated) {
      const next = nextPath ?? pathname;
      const params = new URLSearchParams({
        next,
        add: productId,
        qty: String(qty),
      });
      router.push(`/signin?${params.toString()}`);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, qty }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "That item could not be added.");
      showToast("Added to your bag.");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "That item could not be added.", "warn");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={add}
      disabled={disabled || busy}
      className={className}
      aria-busy={busy}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : null}
      <span className="btn-label">{busy ? "Adding…" : label}</span>
    </Button>
  );
}
