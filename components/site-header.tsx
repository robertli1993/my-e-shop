"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Package, ShoppingBag, User } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import type { SessionUser } from "@/lib/types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SiteHeader({
  user,
  cartCount,
  orderCount,
}: {
  user: SessionUser | null;
  cartCount: number;
  orderCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shopActive =
    pathname === "/" ||
    pathname.startsWith("/product") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout");

  async function signOut() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    showToast("Signed out.");
    router.push("/");
    router.refresh();
  }

  return (
    <header className="site-header">
      <div className="header-inner container">
        <Link className="brand" href="/" aria-label="Northline home">
          NORTHLINE<span className="brand-dot" aria-hidden="true" />
        </Link>
        <nav className="primary-nav" aria-label="Primary">
          <Link href="/" aria-current={shopActive ? "page" : undefined}>
            Shop
          </Link>
        </nav>
        <div className="header-tools">
          <div className={`account-wrap${open ? " is-open" : ""}`} ref={wrapRef}>
            <button
              ref={buttonRef}
              className="tool-btn"
              type="button"
              onClick={() => {
                if (!user) {
                  router.push(`/signin?next=${encodeURIComponent(pathname)}`);
                  return;
                }
                setOpen((value) => !value);
              }}
              aria-label={user ? `Account menu for ${user.name}` : "Sign in"}
              aria-haspopup={user ? "true" : undefined}
              aria-expanded={user ? open : undefined}
              aria-controls={user ? "accountMenu" : undefined}
            >
              {user ? (
                <span className="avatar" aria-hidden="true">
                  {initials(user.name)}
                </span>
              ) : (
                <span className="account-icon" aria-hidden="true">
                  <User className="icon" strokeWidth={1.75} />
                </span>
              )}
              <span>{user ? user.name.split(" ")[0] : "Sign in"}</span>
              {user ? (
                <span className="account-caret" aria-hidden="true">
                  <ChevronDown className="icon icon-sm" strokeWidth={1.75} />
                </span>
              ) : null}
            </button>

            {user ? (
              <div className="account-menu" id="accountMenu" hidden={!open}>
                <div className="account-menu-head">
                  <span className="avatar" aria-hidden="true">
                    {initials(user.name)}
                  </span>
                  <div>
                    <div className="account-menu-name">{user.name}</div>
                    <div className="account-menu-email">{user.email}</div>
                  </div>
                </div>
                <Link className="account-item" href="/orders" onClick={() => setOpen(false)}>
                  <Package className="icon-sm" strokeWidth={1.75} />
                  <span>My orders</span>
                  <span className="account-item-count">{orderCount}</span>
                </Link>
                <Link className="account-item" href="/cart" onClick={() => setOpen(false)}>
                  <ShoppingBag className="icon-sm" strokeWidth={1.75} />
                  <span>Shopping bag</span>
                  <span className="account-item-count">{cartCount}</span>
                </Link>
                <div className="account-menu-sep" role="presentation" />
                <button className="account-item" type="button" onClick={signOut}>
                  <LogOut className="icon-sm" strokeWidth={1.75} />
                  <span>Sign out</span>
                </button>
              </div>
            ) : null}
          </div>

          <Link
            className="bag-btn"
            href="/cart"
            aria-label={`Shopping bag, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
          >
            <ShoppingBag className="icon" strokeWidth={1.75} aria-hidden="true" />
            <span className="bag-count" hidden={cartCount === 0}>
              {cartCount}
            </span>
            <span className="sr-only">
              {cartCount} {cartCount === 1 ? "item" : "items"} in bag
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
