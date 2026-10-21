import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { formatPrice, stockState } from "@/lib/money";
import type { Product } from "@/lib/types";

export function ProductCard({
  product,
  authenticated,
}: {
  product: Product;
  authenticated: boolean;
}) {
  const state = stockState(product.stock);
  const soldOut = product.stock <= 0;

  return (
    <article className="product-card">
      <Link
        className="card-media"
        href={`/product/${product.id}`}
        aria-label={`View ${product.name}`}
      >
        <Image
          src={product.image}
          width={900}
          height={900}
          alt={product.alt}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          loading="lazy"
        />
        {state.className === "low" ? <span className="card-flag">Low stock</span> : null}
        <span className="card-open">
          View details
          <ArrowRight className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
        </span>
      </Link>
      <div className="card-body">
        <div className="card-top">
          <span className="card-cat">{product.category}</span>
          <span className={`card-stock ${state.className}`}>
            <span className="stock-dot" aria-hidden="true" />
            {state.label}
          </span>
        </div>
        <h3 className="card-title">
          <Link href={`/product/${product.id}`}>{product.name}</Link>
        </h3>
        <p className="card-tagline">{product.tagline}</p>
        <div className="card-foot">
          <span className="card-price nowrap">{formatPrice(product.priceCents)}</span>
          <AddToCartButton
            productId={product.id}
            authenticated={authenticated}
            disabled={soldOut}
            label={soldOut ? "Sold out" : "Add to bag"}
            nextPath={`/product/${product.id}`}
          />
        </div>
      </div>
    </article>
  );
}
