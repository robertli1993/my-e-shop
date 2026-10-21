import { io } from "next/cache";
import Image from "next/image";
import { ArrowRight, Package, ShieldCheck, Truck } from "lucide-react";
import { CatalogBrowser } from "@/components/catalog-browser";
import { GuideButton } from "@/components/guide-button";
import { getSessionUser } from "@/lib/auth/session";
import { CATEGORIES } from "@/lib/catalog";
import { listProducts } from "@/lib/db/queries";

export const instant = false;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await io();

  const products = listProducts();
  const user = await getSessionUser();

  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const search = first(params.q)?.slice(0, 120) ?? "";
  const categoryParam = first(params.category) ?? "all";
  const category = (CATEGORIES as readonly string[]).includes(categoryParam)
    ? categoryParam
    : "all";
  const sortParam = first(params.sort) ?? "featured";
  const sort = ["featured", "price-asc", "price-desc", "name"].includes(sortParam)
    ? sortParam
    : "featured";

  const minValue = Number(first(params.min));
  const maxValue = Number(first(params.max));
  const min = Number.isFinite(minValue) && minValue >= 0 ? minValue : null;
  const max = Number.isFinite(maxValue) && maxValue >= 0 ? maxValue : null;

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">The 2026 desk edit</p>
            <h1>Tech that earns its place.</h1>
            <p className="lead">
              Phones, computers, audio and gaming gear — chosen for the desk, the commute and the
              long way home.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#catalog">
                Shop the collection
                <ArrowRight className="icon" strokeWidth={1.75} aria-hidden="true" />
              </a>
              <GuideButton className="btn btn-secondary">Ask the tech guide</GuideButton>
            </div>
            <div className="hero-facts">
              <span>
                <Package className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                {products.length} tech essentials
              </span>
              <span>
                <Truck className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                Free shipping over $150
              </span>
              <span>
                <ShieldCheck className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                No-card checkout
              </span>
            </div>
          </div>
          <figure className="hero-media">
            <Image
              src="/assets/tech/hero-workspace.jpg"
              width={1600}
              height={1067}
              alt="A laptop, phone, smartwatch and headphones arranged on a desk"
              sizes="(min-width: 1024px) 560px, 100vw"
              priority
            />
            <figcaption>The setup · Studio 04</figcaption>
          </figure>
        </div>
      </section>

      <CatalogBrowser
        key={`${search}|${category}|${sort}|${min}|${max}|${first(params.assistant) === "1"}`}
        products={products}
        authenticated={Boolean(user)}
        initial={{
          search,
          category,
          sort,
          min,
          max,
          assistant: first(params.assistant) === "1",
        }}
      />

      <section className="field-band">
        <div className="container field-band-grid">
          <div>
            <p className="eyebrow">Why this collection</p>
            <h2>Chosen for the everyday.</h2>
            <p>
              Every piece here has to justify its place: fast enough for work, simple enough to live
              with, and supported long enough to matter. Fewer things, used properly.
            </p>
            <GuideButton className="link-btn">
              Let the guide narrow it down
              <ArrowRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
            </GuideButton>
          </div>
          <figure className="field-band-media">
            <Image
              src="/assets/tech/feature-workspace.jpg"
              width={1600}
              height={1068}
              alt="A person working at a desk with a monitor, laptop, keyboard and mouse"
              sizes="(min-width: 1024px) 560px, 100vw"
              loading="lazy"
            />
          </figure>
        </div>
      </section>

      <section className="value-band">
        <div className="container value-row">
          <div className="value-item">
            <Package className="icon" strokeWidth={1.75} aria-hidden="true" />
            <div>
              <h3>Real inventory</h3>
              <p>Stock counts move when orders are placed and return when an order is cancelled.</p>
            </div>
          </div>
          <div className="value-item">
            <ShieldCheck className="icon" strokeWidth={1.75} aria-hidden="true" />
            <div>
              <h3>Orders that persist</h3>
              <p>Your account, bag and order history live in your account, not in this tab.</p>
            </div>
          </div>
          <div className="value-item">
            <Truck className="icon" strokeWidth={1.75} aria-hidden="true" />
            <div>
              <h3>One honest checkout</h3>
              <p>A no-card checkout — no payment is charged and no payment details are requested.</p>
            </div>
          </div>
        </div>
      </section>

      <noscript>
        <div className="container" style={{ padding: "40px 22px" }}>
          <h1 style={{ fontSize: 28 }}>Northline needs JavaScript</h1>
          <p style={{ marginTop: 8, color: "#6e6e73" }}>
            Enable JavaScript to search the catalog, manage your bag and check out.
          </p>
        </div>
      </noscript>
    </>
  );
}
