import Link from "next/link";
import { StoreNotesButton } from "@/components/store-notes-button";
import { CATEGORIES } from "@/lib/catalog";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="brand">
              NORTHLINE<span className="brand-dot" aria-hidden="true" />
            </span>
            <p>
              Everyday tech for work, play and everything between. Northline is a fictional
              electronics store built as an interactive storefront.
            </p>
          </div>
          <div className="footer-col">
            <h3>Shop</h3>
            <ul>
              {CATEGORIES.map((category) => (
                <li key={category}>
                  <Link href={`/?category=${encodeURIComponent(category)}`}>{category}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-col">
            <h3>Account</h3>
            <ul>
              <li>
                <Link href="/orders">My orders</Link>
              </li>
              <li>
                <Link href="/cart">Shopping bag</Link>
              </li>
              <li>
                <Link href="/#catalog">Tech guide</Link>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h3>About this store</h3>
            <ul>
              <li>
                <StoreNotesButton />
              </li>
              <li>
                <Link href="/signin">Account &amp; orders</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Northline. Independent storefront concept.</span>
          <span>
            Prices in USD. Inventory is simulated. Photography via Unsplash; product names and
            pricing are illustrative.
          </span>
        </div>
      </div>
    </footer>
  );
}
