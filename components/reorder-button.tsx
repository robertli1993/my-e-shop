"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";

export function ReorderButton({ orderId, disabled }: { orderId: string; disabled: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function reorder() {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/reorder`, { method: "POST" });
      const payload = (await response.json()) as {
        added?: number;
        limited?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "The items could not be added.");
      showToast(
        `Added ${payload.added ?? 0} ${payload.added === 1 ? "item" : "items"} to your bag.` +
          (payload.limited ? " Some quantities were limited by stock." : ""),
      );
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The items could not be added.", "warn");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="btn btn-secondary btn-block"
      type="button"
      onClick={reorder}
      disabled={disabled || busy}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : null}
      <span className="btn-label">
        {busy
          ? "Adding…"
          : disabled
            ? "Items currently out of stock"
            : "Order these items again"}
      </span>
    </button>
  );
}
