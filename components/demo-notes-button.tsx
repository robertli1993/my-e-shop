"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

export function DemoNotesButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button className="link-btn" type="button" onClick={() => setOpen(true)}>
        How data works
      </button>
      <DialogContent className="modal-shell" showCloseButton={false}>
        <button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close">
          <X className="icon" strokeWidth={1.75} />
        </button>
        <DialogTitle className="modal-heading">How this store works</DialogTitle>
        <DialogDescription className="modal-sub">
          A Next.js storefront with a SQLite database, Drizzle ORM and server-side sessions.
        </DialogDescription>
        <div className="modal-body">
          <div className="account-block">
            Products, accounts, bags and orders are persisted in <code>data/northline.db</code>. The
            catalog is seeded on first boot with eighteen tech products. No data is stored in the
            browser beyond an httpOnly session cookie.
          </div>
          <div className="account-block">
            Placing an order decrements stock inside a SQLite transaction with a guarded update, so
            two concurrent checkouts cannot oversell the last unit. Cancelling before dispatch
            restores every item.
          </div>
          <div className="account-block">
            The product catalog is managed from the terminal:{" "}
            <code>npm run products -- add …</code> and{" "}
            <code>npm run products -- delete --id …</code>. Existing orders keep their snapshots when
            a product is removed.
          </div>
        </div>
        <div className="account-actions">
          <button className="btn btn-secondary btn-block" type="button" onClick={() => setOpen(false)}>
            Back to the store
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
