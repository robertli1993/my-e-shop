"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { CATEGORIES } from "@/lib/catalog";
import type { Product } from "@/lib/types";

export type CatalogInitial = {
  search: string;
  category: string;
  sort: string;
  min: number | null;
  max: number | null;
  assistant: boolean;
};

function haystack(product: Product): string {
  return [
    product.name,
    product.category,
    product.tagline,
    product.description,
    product.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function filterProducts(
  products: Product[],
  search: string,
  category: string,
  min: number | null,
  max: number | null,
  sort: string,
): Product[] {
  let list = products.slice();
  if (category !== "all") {
    list = list.filter((product) => product.category === category);
  }

  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    list = list.filter((product) => {
      const hay = haystack(product);
      return tokens.every((token) => hay.includes(token));
    });
  }

  if (min !== null) list = list.filter((product) => product.priceCents >= min * 100);
  if (max !== null) list = list.filter((product) => product.priceCents <= max * 100);

  if (sort === "price-asc") list.sort((left, right) => left.priceCents - right.priceCents);
  else if (sort === "price-desc") list.sort((left, right) => right.priceCents - left.priceCents);
  else if (sort === "name") list.sort((left, right) => left.name.localeCompare(right.name));

  return list;
}

export function CatalogBrowser({
  products,
  authenticated,
  initial,
}: {
  products: Product[];
  authenticated: boolean;
  initial: CatalogInitial;
}) {
  const [search, setSearch] = useState(initial.search);
  const [category, setCategory] = useState(initial.category);
  const [sort, setSort] = useState(initial.sort);
  const [min, setMin] = useState<number | null>(initial.min);
  const [max, setMax] = useState<number | null>(initial.max);
  const [assistant, setAssistant] = useState(initial.assistant);

  const visible = useMemo(
    () => filterProducts(products, search, category, min, max, sort),
    [products, search, category, min, max, sort],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (category !== "all") params.set("category", category);
    if (min !== null) params.set("min", String(min));
    if (max !== null) params.set("max", String(max));
    if (sort !== "featured") params.set("sort", sort);
    if (assistant) params.set("assistant", "1");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
  }, [search, category, min, max, sort, assistant]);

  const guideLabel = search.trim() || (category !== "all" ? category : "your request");
  const activeFilters = search || category !== "all" || min !== null || max !== null;

  function resetFilters() {
    setSearch("");
    setCategory("all");
    setSort("featured");
    setMin(null);
    setMax(null);
    setAssistant(false);
  }

  function leaveAssistant() {
    if (assistant) {
      setMin(null);
      setMax(null);
    }
    setAssistant(false);
  }

  return (
    <section className="catalog-section" id="catalog">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">The collection</p>
            <h2>Everyday tech, chosen well</h2>
          </div>
          <p className="count-note" id="resultCount">
            {visible.length} {visible.length === 1 ? "product" : "products"}
          </p>
        </div>

        <div className="toolbar">
          <div className="search-field">
            <Search className="icon" strokeWidth={1.75} aria-hidden="true" />
            <input
              id="searchInput"
              type="search"
              placeholder="Search iPhone, MacBook, audio…"
              aria-label="Search the catalog"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                leaveAssistant();
              }}
            />
            <button
              className="search-clear"
              type="button"
              onClick={() => {
                setSearch("");
                leaveAssistant();
              }}
              aria-label="Clear search"
              hidden={!search}
            >
              <X className="icon-sm" strokeWidth={1.75} />
            </button>
          </div>
          <label className="sort-field">
            Sort
            <select
              id="sortSelect"
              aria-label="Sort products"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>

        <div className="filter-row" role="group" aria-label="Filter by category">
          <button
            className={`chip${category === "all" ? " is-active" : ""}`}
            type="button"
            aria-pressed={category === "all"}
            onClick={() => {
              setCategory("all");
              leaveAssistant();
            }}
          >
            All tech
          </button>
          {CATEGORIES.map((item) => (
            <button
              className={`chip${category === item ? " is-active" : ""}`}
              type="button"
              key={item}
              aria-pressed={category === item}
              onClick={() => {
                setCategory(item);
                leaveAssistant();
              }}
            >
              {item}
            </button>
          ))}
        </div>

        {assistant ? (
          <div className="filter-note" id="guideFilterNote">
            <Sparkles className="icon-sm" strokeWidth={1.75} aria-hidden="true" />
            <span id="guideFilterText">Guided by “{guideLabel}”</span>
            <button
              className="filter-note-clear"
              type="button"
              aria-label="Clear guide filter"
              onClick={leaveAssistant}
            >
              <X className="icon-sm" strokeWidth={1.75} />
            </button>
          </div>
        ) : null}

        <div className="product-grid" id="productGrid">
          {visible.length > 0 ? (
            visible.map((product) => (
              <ProductCard key={product.id} product={product} authenticated={authenticated} />
            ))
          ) : (
            <div className="empty-state">
              <span className="empty-mark">
                <Search className="icon" strokeWidth={1.75} />
              </span>
              <h3>No products match that yet</h3>
              <p>
                Try a different word, another category, or a wider budget. Every result comes from
                this store&rsquo;s live inventory.
              </p>
              <button className="btn btn-secondary" type="button" onClick={resetFilters}>
                Reset filters
              </button>
            </div>
          )}
        </div>

        {activeFilters ? (
          <p className="tiny muted" style={{ marginTop: 18 }}>
            <button className="link-btn" type="button" onClick={resetFilters}>
              Clear all filters
            </button>
          </p>
        ) : null}
      </div>
    </section>
  );
}
