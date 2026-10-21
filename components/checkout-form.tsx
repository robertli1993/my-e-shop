"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import { formatMoney } from "@/lib/money";

type Errors = Record<string, string>;

const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Japan",
  "Australia",
];

export function CheckoutForm({
  source,
  buyNowProductId,
  buyNowQty,
  fullName,
  email,
  totalCents,
}: {
  source: "cart" | "buy-now";
  buyNowProductId?: string;
  buyNowQty?: number;
  fullName: string;
  email: string;
  totalCents: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const shipping = {
      fullName: String(data.get("fullName") ?? "").trim(),
      line1: String(data.get("line1") ?? "").trim(),
      line2: String(data.get("line2") ?? "").trim(),
      city: String(data.get("city") ?? "").trim(),
      region: String(data.get("region") ?? "").trim(),
      postal: String(data.get("postal") ?? "").trim(),
      country: String(data.get("country") ?? "").trim(),
    };

    const found: Errors = {};
    if (shipping.fullName.length < 2) found.fullName = "Enter the recipient's full name.";
    if (shipping.line1.length < 4) found.line1 = "Enter a street address.";
    if (shipping.city.length < 2) found.city = "Enter a city.";
    if (shipping.region.length < 2) found.region = "Enter a state or region.";
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/.test(shipping.postal)) {
      found.postal = "Enter a valid postal code.";
    }
    if (!shipping.country) found.country = "Choose a country.";

    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) {
      form.querySelector<HTMLInputElement>(`[name="${Object.keys(found)[0]}"]`)?.focus();
      return;
    }

    setBusy(true);
    try {
      const body =
        source === "buy-now"
          ? {
              source,
              productId: buyNowProductId,
              qty: buyNowQty,
              shipping,
            }
          : { source, shipping };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        orderId?: string;
        error?: string;
        fields?: Errors;
      };

      if (response.status === 401) {
        router.push(`/signin?next=${encodeURIComponent("/checkout")}`);
        return;
      }
      if (!response.ok || !payload.orderId) {
        if (payload.fields) setErrors(payload.fields);
        throw new Error(payload.error ?? "The order could not be placed.");
      }

      showToast(`Order ${payload.orderId} placed.`);
      router.push(`/orders/${payload.orderId}?placed=1`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The order could not be placed.";
      setFormError(message);
      showToast(message, "warn");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="checkout-form" id="checkoutForm" onSubmit={submit} noValidate>
      {formError ? (
        <div className="form-summary" id="formSummary" role="alert">
          <strong>Please check the form before placing the order.</strong>
          {formError}
        </div>
      ) : null}

      <section className="form-card">
        <h2>Shipping details</h2>
        <div className="form-grid">
          <div className={`field${errors.fullName ? " is-invalid" : ""}`}>
            <Label htmlFor="fullName">
              Full name <span className="req">*</span>
            </Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              defaultValue={fullName}
              autoComplete="name"
              required
            />
            <p className="field-error">{errors.fullName}</p>
          </div>

          <div className="field">
            <Label htmlFor="email">
              Email <span className="req">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={email}
              autoComplete="email"
              readOnly
            />
            <p className="field-error" />
          </div>

          <div className={`field${errors.line1 ? " is-invalid" : ""}`}>
            <Label htmlFor="line1">
              Address <span className="req">*</span>
            </Label>
            <Input
              id="line1"
              name="line1"
              type="text"
              placeholder="Street address"
              autoComplete="address-line1"
              required
            />
            <p className="field-error">{errors.line1}</p>
          </div>

          <div className="field field-full">
            <Label htmlFor="line2">Apartment, suite (optional)</Label>
            <Input
              id="line2"
              name="line2"
              type="text"
              autoComplete="address-line2"
            />
            <p className="field-error" />
          </div>

          <div className={`field${errors.city ? " is-invalid" : ""}`}>
            <Label htmlFor="city">
              City <span className="req">*</span>
            </Label>
            <Input id="city" name="city" type="text" autoComplete="address-level2" required />
            <p className="field-error">{errors.city}</p>
          </div>

          <div className={`field${errors.region ? " is-invalid" : ""}`}>
            <Label htmlFor="region">
              State / region <span className="req">*</span>
            </Label>
            <Input id="region" name="region" type="text" autoComplete="address-level1" required />
            <p className="field-error">{errors.region}</p>
          </div>

          <div className={`field${errors.postal ? " is-invalid" : ""}`}>
            <Label htmlFor="postal">
              Postal code <span className="req">*</span>
            </Label>
            <Input id="postal" name="postal" type="text" autoComplete="postal-code" required />
            <p className="field-error">{errors.postal}</p>
          </div>

          <div className={`field${errors.country ? " is-invalid" : ""}`}>
            <Label htmlFor="country">Country</Label>
            <select id="country" name="country" autoComplete="country-name" defaultValue="United States">
              {COUNTRIES.map((country) => (
                <option key={country}>{country}</option>
              ))}
            </select>
            <p className="field-error">{errors.country}</p>
          </div>
        </div>
      </section>

      <section className="form-card">
        <h2>Payment</h2>
        <label className="pay-option">
          <input type="radio" name="payment" value="demo" defaultChecked />
          <span>
            <strong>Demo payment</strong>
            <small>
              No card is charged. This storefront never asks for payment details.
            </small>
          </span>
        </label>
      </section>

      <div className="checkout-submit">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          <span className="btn-label">
            {busy ? "Placing order…" : `Place order · ${formatMoney(totalCents)}`}
          </span>
        </button>
        <p className="tiny">
          By placing this order you agree to the demo store&rsquo;s imaginary terms.
        </p>
      </div>
    </form>
  );
}
