import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ChevronRight, Sparkles } from "lucide-react";
import { GuideButton } from "@/components/guide-button";
import { ProductCard } from "@/components/product-card";
import { ProductPurchase } from "@/components/product-purchase";
import { getSessionUser } from "@/lib/auth/session";
import { getProduct, listProducts } from "@/lib/db/queries";
import { formatPrice, stockState } from "@/lib/money";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = getProduct(id);
  return product
    ? { title: `${product.name} — Northline`, description: product.tagline }
    : { title: "Product not found — Northline" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await io();

  const product = getProduct(id);
  if (!product) notFound();

  const products = listProducts();
  const user = await getSessionUser();
  const state = stockState(product.stock);

  const related = products.filter(
    (item) => item.id !== product.id && item.category === product.category,
  );
  for (const item of products) {
    if (related.length >= 3) break;
    if (item.id !== product.id && !related.some((entry) => entry.id === item.id)) {
      related.push(item);
    }
  }

  return (
    <section className="page-section">
      <div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Shop</Link>
          <ChevronRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
          <Link href={`/?category=${encodeURIComponent(product.category)}`}>
            {product.category}
          </Link>
          <ChevronRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="product-layout">
          <figure className="product-figure">
            <Image
              src={product.image}
              width={900}
              height={900}
              alt={product.alt}
              sizes="(min-width: 1024px) 560px, 100vw"
              priority
            />
          </figure>

          <div className="product-info">
            <p className="eyebrow">{product.category}</p>
            <h1>{product.name}</h1>
            <p className="product-price">{formatPrice(product.priceCents)}</p>
            <p className="product-tagline">{product.tagline}</p>
            <p className="product-lede">{product.description}</p>
            <p className="detail-stock">
              <span className={`card-stock ${state.className}`}>
                <span className="stock-dot" aria-hidden="true" />
                {state.label}
              </span>
              <span aria-hidden="true">·</span>
              <span>Ships from the demo warehouse</span>
            </p>

            <ProductPurchase
              productId={product.id}
              stock={product.stock}
              authenticated={Boolean(user)}
            />

            <div className="assurance">
              <span>
                <Check className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                Free shipping over $150
              </span>
              <span>
                <Check className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                Demo checkout
              </span>
              <span>
                <Check className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                Live inventory
              </span>
            </div>

            <div className="detail-highlights">
              <h2>Highlights</h2>
              <ul className="check-list">
                {product.highlights.map((line) => (
                  <li key={line}>
                    <Check className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <GuideButton className="detail-guide" query={`Tell me about ${product.name}`}>
                <Sparkles className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
                Ask the guide about this
                <ArrowRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
              </GuideButton>
            </div>

            <div className="specs">
              <h2>Specifications</h2>
              <dl>
                {product.specs.map(([label, value]) => (
                  <div className="spec-row" key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="detail-columns">
              <div>
                <h2>In the box</h2>
                <ul>
                  {product.inBox.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2>Care &amp; warranty</h2>
                <p className="care-note">{product.care}</p>
              </div>
            </div>
          </div>
        </div>

        <section className="related">
          <div className="section-head">
            <div>
              <p className="eyebrow">Pairs well with</p>
              <h2>More from {product.category}</h2>
            </div>
            <Link className="link small" href="/">
              See all tech
            </Link>
          </div>
          <div className="related-grid">
            {related.slice(0, 3).map((item) => (
              <ProductCard key={item.id} product={item} authenticated={Boolean(user)} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
