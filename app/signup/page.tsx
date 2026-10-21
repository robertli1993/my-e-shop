import { io } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuthAside } from "@/components/auth-aside";
import { SignUpForm } from "@/components/sign-up-form";
import { getSessionUser } from "@/lib/auth/session";
import { authHref, parsePendingAdd } from "@/lib/auth-url";
import { safeNextPath } from "@/lib/redirect";

export const instant = false;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await io();

  const user = await getSessionUser();
  const nextPath = safeNextPath(params.next);
  const pendingAdd = parsePendingAdd(params.add, params.qty);
  if (user) redirect(nextPath);

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
              <h1>Create an account</h1>
              <p className="lead">One account for your bag, checkout and full order history.</p>
            </div>
            <div className="auth-tabs" role="tablist" aria-label="Account mode">
              <Link className="auth-tab" href={authHref("/signin", nextPath, pendingAdd)}>
                Sign in
              </Link>
              <span className="auth-tab is-active" aria-current="page">
                Create account
              </span>
            </div>
            <SignUpForm nextPath={nextPath} pendingAdd={pendingAdd} />
          </div>
        </div>
      </div>
    </section>
  );
}
