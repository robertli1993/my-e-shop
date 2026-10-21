import { listProducts } from "@/lib/db/queries";
import { matchProducts, parseGearQuery } from "@/lib/assistant";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const min = Number(url.searchParams.get("min"));
  const max = Number(url.searchParams.get("max"));

  const filters = {
    ...parseGearQuery(query),
    category: category && category !== "all" ? category : null,
    minPriceCents: Number.isFinite(min) && url.searchParams.has("min") ? Math.round(min * 100) : null,
    maxPriceCents: Number.isFinite(max) && url.searchParams.has("max") ? Math.round(max * 100) : null,
  };

  let products = matchProducts(listProducts(), filters);
  const sort = url.searchParams.get("sort");
  if (sort === "price-asc") products = products.slice().sort((a, b) => a.priceCents - b.priceCents);
  if (sort === "price-desc") products = products.slice().sort((a, b) => b.priceCents - a.priceCents);
  if (sort === "name") products = products.slice().sort((a, b) => a.name.localeCompare(b.name));

  return Response.json({ products, count: products.length });
}
