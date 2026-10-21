"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { useToast } from "@/components/toast-provider";
import { authHref, type PendingAdd } from "@/lib/auth-url";

export function SignUpForm({
  nextPath,
  pendingAdd,
}: {
  nextPath: string;
  pendingAdd?: PendingAdd;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setErrors({});

    const data = new FormData(event.currentTarget);
    const body = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    };

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        user?: { name: string };
        error?: string;
        fields?: Record<string, string>;
      };
      if (!response.ok || !payload.user) {
        if (payload.fields) setErrors(payload.fields);
        throw new Error(payload.error ?? "Unable to create the account.");
      }
      showToast(`Welcome, ${payload.user.name}.`);
      if (pendingAdd) {
        try {
          const cartResponse = await fetch("/api/cart", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(pendingAdd),
          });
          if (!cartResponse.ok) {
            showToast("Account created, but the item could not be added. Add it again from the shop.", "warn");
          } else {
            showToast("Added to your bag.");
          }
        } catch {
          showToast("Account created, but the item could not be added. Add it again from the shop.", "warn");
        }
      }
      router.push(nextPath);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the account.");
      setBusy(false);
    }
  }

  return (
    <>
      <form className="auth-form" id="signupForm" onSubmit={submit} noValidate>
        <div className={`field${errors.name ? " is-invalid" : ""}`}>
          <Label htmlFor="signupName">Name</Label>
          <Input id="signupName" name="name" type="text" autoComplete="name" required />
          <p className="field-error">{errors.name}</p>
        </div>
        <div className={`field${errors.email ? " is-invalid" : ""}`}>
          <Label htmlFor="signupEmail">Email</Label>
          <Input id="signupEmail" name="email" type="email" autoComplete="email" required />
          <p className="field-error">{errors.email}</p>
        </div>
        <div className={`field${errors.password ? " is-invalid" : ""}`}>
          <Label htmlFor="signupPassword">Password</Label>
          <PasswordInput
            id="signupPassword"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <p className="field-hint">Use at least 8 characters. Stored hashed, never in the clear.</p>
          <p className="field-error">{errors.password}</p>
        </div>
        <div className="form-error" role="alert" hidden={!error}>
          {error}
        </div>
        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          <span className="btn-label">{busy ? "Creating account…" : "Create account"}</span>
        </button>
      </form>
      <p className="auth-demo">
        Already have an account?{" "}
        <Link href={authHref("/signin", nextPath, pendingAdd)}>Sign in</Link>
      </p>
    </>
  );
}
