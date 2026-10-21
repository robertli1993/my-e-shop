import { asc, eq, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { products } from "../lib/db/schema";
import { CATEGORIES } from "../lib/catalog";

type Flags = Record<string, string | true>;

function parseArgs(argv: string[]): { command: string; flags: Flags; positionals: string[] } {
  const [command = "help", ...rest] = argv;
  const flags: Flags = {};
  const positionals: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[index + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        index += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(token);
    }
  }

  return { command, flags, positionals };
}

function stringFlag(flags: Flags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function requireFlag(flags: Flags, key: string): string {
  const value = stringFlag(flags, key);
  if (!value) {
    throw new Error(`Missing required --${key}. Run "npm run products -- help" for usage.`);
  }
  return value;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function parseMoney(value: string): number {
  const amount = Number(value.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid price: ${value}`);
  return Math.round(amount * 100);
}

function parseInteger(value: string, label: string): number {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`Invalid ${label}: ${value}`);
  return amount;
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(value.includes("|") ? "|" : ",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSpecs(value: string | undefined): [string, string][] {
  return parseList(value)
    .map((item) => {
      const index = item.indexOf(":");
      if (index === -1) return null;
      return [item.slice(0, index).trim(), item.slice(index + 1).trim()] as [string, string];
    })
    .filter((item): item is [string, string] => item !== null);
}

function printHelp() {
  console.log(`Northline product CLI

Usage:
  npm run products -- list
  npm run products -- show <id>
  npm run products -- add --name "Ridge Mat" --category Sleep --price 59 --stock 10 --image /assets/p4.jpg
  npm run products -- update --id ridge-mat --price 49 --stock 12
  npm run products -- delete --id ridge-mat

Options (add):
  --name, --category, --price (USD), --stock, --image
  --id (default: slug of name), --tagline, --description, --alt
  --tags "sleep,pad", --specs "Weight:450 g|Fill:Down"
  --highlights "Line one|Line two", --in-box "Mat|Sack", --care "Text"

Categories: ${CATEGORIES.join(", ")}
Database: ${process.env.DATABASE_PATH ?? "data/northline.db"}`);
}

function listProducts() {
  const rows = db.select().from(products).orderBy(asc(products.featuredOrder)).all();
  if (rows.length === 0) {
    console.log("No products in the catalog. Use the add command to create one.");
    return;
  }
  const widths = {
    id: Math.max(4, ...rows.map((row) => row.id.length)),
    name: Math.max(4, ...rows.map((row) => row.name.length)),
    category: Math.max(8, ...rows.map((row) => row.category.length)),
  };
  console.log(
    `${"ID".padEnd(widths.id)}  ${"NAME".padEnd(widths.name)}  ${"CATEGORY".padEnd(widths.category)}  ${"PRICE".padStart(8)}  ${"STOCK".padStart(5)}`,
  );
  for (const row of rows) {
    console.log(
      `${row.id.padEnd(widths.id)}  ${row.name.padEnd(widths.name)}  ${row.category.padEnd(widths.category)}  ${`$${(row.priceCents / 100).toFixed(2)}`.padStart(8)}  ${String(row.stock).padStart(5)}`,
    );
  }
}

function showProduct(id: string) {
  const row = db.select().from(products).where(eq(products.id, id)).get();
  if (!row) throw new Error(`No product with id "${id}".`);
  console.log(JSON.stringify({ ...row, specs: JSON.parse(row.specs), tags: JSON.parse(row.tags) }, null, 2));
}

function addProduct(flags: Flags) {
  const name = requireFlag(flags, "name");
  const category = requireFlag(flags, "category");
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    throw new Error(`Unknown category "${category}". Use one of: ${CATEGORIES.join(", ")}.`);
  }
  const priceCents = parseMoney(requireFlag(flags, "price"));
  const stock = parseInteger(requireFlag(flags, "stock"), "stock");
  const image = requireFlag(flags, "image");
  const id = stringFlag(flags, "id") ?? slugify(name);
  if (!id) throw new Error("The product id could not be generated. Pass --id.");

  const existing = db.select({ id: products.id }).from(products).where(eq(products.id, id)).get();
  if (existing) throw new Error(`A product with id "${id}" already exists.`);

  const maxRow = db
    .select({ value: sql<number>`COALESCE(MAX(${products.featuredOrder}), -1) + 1` })
    .from(products)
    .get();
  const nextOrder = maxRow?.value ?? 0;

  db.insert(products)
    .values({
      id,
      name,
      category,
      priceCents,
      stock,
      image,
      alt: stringFlag(flags, "alt") ?? name,
      tagline: stringFlag(flags, "tagline") ?? "",
      description: stringFlag(flags, "description") ?? "",
      specs: JSON.stringify(parseSpecs(stringFlag(flags, "specs"))),
      tags: JSON.stringify(parseList(stringFlag(flags, "tags"))),
      highlights: JSON.stringify(parseList(stringFlag(flags, "highlights"))),
      inBox: JSON.stringify(parseList(stringFlag(flags, "in-box"))),
      care: stringFlag(flags, "care") ?? "",
      featuredOrder: nextOrder,
      createdAt: new Date().toISOString(),
    })
    .run();

  console.log(`Added ${id} (${name}) — $${(priceCents / 100).toFixed(2)}, ${stock} in stock.`);
}

function updateProduct(flags: Flags) {
  const id = requireFlag(flags, "id");
  const row = db.select().from(products).where(eq(products.id, id)).get();
  if (!row) throw new Error(`No product with id "${id}".`);

  const updates: Partial<typeof products.$inferInsert> = {};
  if (stringFlag(flags, "name")) updates.name = stringFlag(flags, "name");
  if (stringFlag(flags, "category")) {
    const category = stringFlag(flags, "category")!;
    if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      throw new Error(`Unknown category "${category}".`);
    }
    updates.category = category;
  }
  if (stringFlag(flags, "price")) updates.priceCents = parseMoney(stringFlag(flags, "price")!);
  if (stringFlag(flags, "stock")) updates.stock = parseInteger(stringFlag(flags, "stock")!, "stock");
  if (stringFlag(flags, "image")) updates.image = stringFlag(flags, "image");
  if (stringFlag(flags, "alt")) updates.alt = stringFlag(flags, "alt");
  if (stringFlag(flags, "tagline")) updates.tagline = stringFlag(flags, "tagline");
  if (stringFlag(flags, "description")) updates.description = stringFlag(flags, "description");
  if (stringFlag(flags, "tags")) updates.tags = JSON.stringify(parseList(stringFlag(flags, "tags")));
  if (stringFlag(flags, "specs")) updates.specs = JSON.stringify(parseSpecs(stringFlag(flags, "specs")));
  if (stringFlag(flags, "highlights")) {
    updates.highlights = JSON.stringify(parseList(stringFlag(flags, "highlights")));
  }
  if (stringFlag(flags, "in-box")) updates.inBox = JSON.stringify(parseList(stringFlag(flags, "in-box")));
  if (stringFlag(flags, "care")) updates.care = stringFlag(flags, "care");

  if (Object.keys(updates).length === 0) throw new Error("Pass at least one field to update.");
  db.update(products).set(updates).where(eq(products.id, id)).run();
  console.log(`Updated ${id}.`);
}

function deleteProduct(flags: Flags, positionals: string[]) {
  const id = stringFlag(flags, "id") ?? positionals[0];
  if (!id) throw new Error("Pass --id <product-id>.");
  const row = db.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, id)).get();
  if (!row) throw new Error(`No product with id "${id}".`);
  db.delete(products).where(eq(products.id, id)).run();
  console.log(`Deleted ${row.name} (${id}). Existing order snapshots are unchanged.`);
}

function main() {
  const { command, flags, positionals } = parseArgs(process.argv.slice(2));
  try {
    switch (command) {
      case "list":
        listProducts();
        break;
      case "show": {
        const id = stringFlag(flags, "id") ?? positionals[0];
        if (!id) throw new Error("Pass an id: npm run products -- show ridgeline-2p");
        showProduct(id);
        break;
      }
      case "add":
        addProduct(flags);
        break;
      case "update":
        updateProduct(flags);
        break;
      case "delete":
        deleteProduct(flags, positionals);
        break;
      case "help":
      case "--help":
      case "-h":
        printHelp();
        break;
      default:
        printHelp();
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main();
