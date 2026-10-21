"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { useToast } from "@/components/toast-provider";
import { authHref, type PendingAdd } from "@/lib/auth-url";

export function SignInForm({
  nextPath,
  pendingAdd,
}: {
  nextPath: string;
  pendingAdd?: PendingAdd;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as {
        user?: { name: string };
        error?: string;
      };
      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? "Unable to sign in.");
      }
      showToast(`Signed in as ${payload.user.name}.`);
      if (pendingAdd) {
        try {
          const cartResponse = await fetch("/api/cart", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(pendingAdd),
          });
          if (!cartResponse.ok) {
            showToast("Signed in, but the item could not be added. Add it again from the shop.", "warn");
          } else {
            showToast("Added to your bag.");
          }
        } catch {
          showToast("Signed in, but the item could not be added. Add it again from the shop.", "warn");
        }
      }
      router.push(nextPath);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
      setBusy(false);
    }
  }

  function useSampleAccount() {
    setEmail("alex@northline.co");
    setPassword("northline123");
    setError("");
  }

  return (
    <>
      <form className="auth-form" id="loginForm" onSubmit={submit} noValidate>
        <div className="field">
          <Label htmlFor="loginEmail">Email</Label>
          <Input
            id="loginEmail"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <Label htmlFor="loginPassword">Password</Label>
          <PasswordInput
            id="loginPassword"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
        </div>
        <div className="form-error" id="loginError" role="alert" hidden={!error}>
          {error}
        </div>
        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          <span className="btn-label">{busy ? "Signing in…" : "Sign in"}</span>
        </button>
      </form>

      <div className="auth-divider">or</div>
      <button className="btn btn-secondary auth-sample-btn" type="button" onClick={useSampleAccount}>
        Use the sample account
      </button>
      <p className="auth-sample-copy">
        Sample: alex@northline.co · northline123. The account is seeded with sample orders.
      </p>
      <p className="auth-sample">
        New to Northline?{" "}
        <Link href={authHref("/signup", nextPath, pendingAdd)}>Create an account</Link>
      </p>
    </>
  );
}
