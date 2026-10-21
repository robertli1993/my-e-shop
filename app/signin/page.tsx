import { io } from "next/cache";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LogOut, ShoppingBag } from "lucide-react";
import { AuthAside } from "@/components/auth-aside";
import { SignInForm } from "@/components/sign-in-form";
import { getSessionUser } from "@/lib/auth/session";
import { getCartCount, getOrderCount } from "@/lib/db/queries";
import { authHref, parsePendingAdd } from "@/lib/auth-url";
import { safeNextPath } from "@/lib/redirect";

export const instant = false;

function initials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await io();

  const user = await getSessionUser();
  const nextPath = safeNextPath(params.next);
  const pendingAdd = parsePendingAdd(params.add, params.qty);

  if (user) {
    const count = getCartCount(user.id);
    const orders = getOrderCount(user.id);
    return (
      <section className="auth-page">
        <div className="container">
          <div className="auth-panel auth-panel-signed">
            <div className="auth-profile">
              <span className="auth-avatar" aria-hidden="true">
                {initials(user.name)}
              </span>
              <p className="eyebrow">Signed in</p>
              <h1>Hello, {user.name}</h1>
              <p>{user.email}</p>
              <div className="auth-profile-stats">
                <div className="auth-profile-stat">
                  <strong>{orders}</strong>
                  <span>{orders === 1 ? "order placed" : "orders placed"}</span>
                </div>
                <div className="auth-profile-stat">
                  <strong>{count}</strong>
                  <span>{count === 1 ? "item in bag" : "items in bag"}</span>
                </div>
              </div>
              <div className="auth-profile-actions">
                <Link className="btn btn-primary" href="/orders">
                  <ShoppingBag className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                  My orders
                </Link>
                <Link className="btn btn-secondary" href="/cart">
                  View shopping bag
                  <ArrowRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button className="auth-signout" type="submit">
                    <LogOut className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                    Sign out
                  </button>
                </form>
              </div>
              <p className="auth-note">
                Your bag and orders are tied to this account in the local database.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <div className="container">
        <div className="auth-layout">
          <AuthAside />
          <div className="auth-panel">
            <Link className="auth-back" href="/">
              <ArrowLeft className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
              Back to the shop
            </Link>
            <div className="auth-head">
              <p className="eyebrow">Account</p>
              <h1>Welcome back</h1>
              <p className="lead">Sign in to check out, follow orders, and keep your bag.</p>
            </div>
            <div className="auth-tabs" role="tablist" aria-label="Account mode">
              <span className="auth-tab is-active" aria-current="page">
                Sign in
              </span>
              <Link className="auth-tab" href={authHref("/signup", nextPath, pendingAdd)}>
                Create account
              </Link>
            </div>
            <SignInForm nextPath={nextPath} pendingAdd={pendingAdd} />
          </div>
        </div>
      </div>
    </section>
  );
}
