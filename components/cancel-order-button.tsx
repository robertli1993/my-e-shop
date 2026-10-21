"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/toast-provider";
import { X } from "lucide-react";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The order could not be cancelled.");
      setOpen(false);
      showToast("Order cancelled and inventory restored.");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The order could not be cancelled.", "warn");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        className="danger-link"
        type="button"
        onClick={() => setOpen(true)}
      >
        Cancel this order
      </button>
      <DialogContent className="modal-shell" showCloseButton={false}>
        <button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close">
          <X className="icon" strokeWidth={1.75} />
        </button>
        <DialogTitle className="modal-heading">Cancel {orderId}?</DialogTitle>
        <DialogDescription className="modal-sub">
          Every item goes back into inventory. This cannot be undone.
        </DialogDescription>
        <div className="account-actions">
          <button className="btn btn-primary btn-block" type="button" onClick={cancel} disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            <span className="btn-label">{busy ? "Cancelling…" : "Yes, cancel the order"}</span>
          </button>
          <button className="btn btn-secondary btn-block" type="button" onClick={() => setOpen(false)}>
            Keep the order
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
