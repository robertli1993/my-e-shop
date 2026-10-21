import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";

export function AuthAside() {
  return (
    <aside className="auth-aside" aria-label="About accounts">
      <Image src="/assets/tech/hero-workspace.jpg" fill sizes="(min-width: 1024px) 50vw, 0px" alt="" />
      <div className="auth-aside-scrim" aria-hidden="true" />
      <div className="auth-aside-content">
        <Link className="brand" href="/" aria-label="Northline home">
          NORTHLINE
          <span className="brand-dot" aria-hidden="true" />
        </Link>
        <div>
          <p className="eyebrow">Ready when you are</p>
          <p className="auth-quote">Tech that earns its place.</p>
          <ul className="auth-benefits">
            <li>
              <Check className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
              A bag that follows you from browsing to checkout
            </li>
            <li>
              <Check className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
              Full order history with items and shipping details
            </li>
            <li>
              <Check className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
              Live inventory, so nothing is promised twice
            </li>
          </ul>
        </div>
        <p className="auth-aside-foot">
          Northline is an independent storefront. Accounts, bags and orders live in the local database, and
          payment is never collected.
        </p>
      </div>
    </aside>
  );
}
