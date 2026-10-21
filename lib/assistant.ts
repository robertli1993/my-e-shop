import { getCartLines, listOrders, listProducts } from "@/lib/db/queries";
import { CATEGORIES } from "@/lib/catalog";
import { formatDate, formatMoney, totalsFor } from "@/lib/money";
import type { OrderSummary, Product, SessionUser } from "@/lib/types";

export type AssistantFilters = {
  query: string;
  category: string | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  keywords: string[];
};

export type AssistantAction = {
  label: string;
  href: string;
  primary?: boolean;
};

export type AssistantResponse = {
  intent: "shopping" | "orders" | "cart" | "checkout" | "account" | "catalog" | "help";
  reply: string;
  products: Product[];
  orders: OrderSummary[];
  actions: AssistantAction[];
  filters: AssistantFilters | null;
  source: "agent" | "catalog";
};

export type AssistantStreamEvent =
  | { type: "text"; text: string }
  | { type: "tool-call"; id: string; name: string; input: unknown }
  | { type: "tool-result"; id: string; status: "done" | "error" }
  | { type: "done"; response: AssistantResponse }
  | { type: "error"; message: string };

export type AssistantToolCall = {
  id: string;
  name: string;
  input?: unknown;
  status: "running" | "done" | "error";
};

const CATEGORY_NAMES = CATEGORIES.map((category) => category.toLowerCase());
const CATEGORY_LIST =
  CATEGORY_NAMES.length > 1
    ? `${CATEGORY_NAMES.slice(0, -1).join(", ")} or ${CATEGORY_NAMES[CATEGORY_NAMES.length - 1]}`
    : CATEGORY_NAMES[0];

const STOP_WORDS = new Set([
  "the","and","for","with","under","below","less","than","over","above","more",
  "between","from","tech","gear","device","devices","item","items","product","products",
  "something","need","want","looking","show","me","some","around","about","that","this",
  "have","has","are","you","your","can","get","find","good","best","buy","please","help",
  "what","whats","which","would","like","any","all","into","make","build","setup","desk",
  "recommend","suggest","price","prices","cost","budget","dollar","dollars","usd",
]);

function clampPrice(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(Math.min(value, 100_000) * 100);
}

function budgetCents(value: string): number | null {
  return clampPrice(Number(value.replace(/,/g, "")));
}

export function parseGearQuery(query: string): AssistantFilters {
  const text = query.toLowerCase();
  let minPriceCents: number | null = null;
  let maxPriceCents: number | null = null;
  const amount = String.raw`\d[\d,]*(?:\.\d+)?`;

  const between = text.match(
    new RegExp(
      String.raw`between\s*[$¥￥]?\s*(${amount})\s*(?:and|to|-)\s*[$¥￥]?\s*(${amount})`,
    ),
  );
  if (between) {
    minPriceCents = budgetCents(between[1]);
    maxPriceCents = budgetCents(between[2]);
  } else {
    const under = text.match(
      new RegExp(
        String.raw`(?:under|below|less than|up to|max(?:imum)?(?: of)?|no more than)\s*[$¥￥]?\s*(${amount})`,
      ),
    );
    if (under) maxPriceCents = budgetCents(under[1]);
    const over = text.match(
      new RegExp(
        String.raw`(?:over|above|more than|starting at|from)\s*[$¥￥]?\s*(${amount})`,
      ),
    );
    if (over && maxPriceCents === null) minPriceCents = budgetCents(over[1]);
  }

  let category: string | null = null;
  if (/\b(iphones?|phones?|smartphones?|pixel|galaxy|android)\b/.test(text)) {
    category = "Phones";
  } else if (
    /\b(laptops?|macbooks?|computers?|pcs?|desktops?|imacs?|ipads?|tablets?|notebooks?)\b/.test(
      text,
    )
  ) {
    category = "Computers";
  } else if (/\b(headphones?|earbuds?|airpods?|speakers?|audio|soundbars?)\b/.test(text)) {
    category = "Audio";
  } else if (
    /\b(gaming|consoles?|playstation|ps5|xbox|switch|nintendo|controllers?|mice|mouse)\b/.test(
      text,
    )
  ) {
    category = "Gaming";
  } else if (/\b(watches?|smartwatch(?:es)?|wearables?|fitness trackers?)\b/.test(text)) {
    category = "Wearables";
  } else if (
    /\b(accessor(?:y|ies)|keyboards?|chargers?|power banks?|docks?|hubs?|cables?)\b/.test(text)
  ) {
    category = "Accessories";
  }

  const keywords = Array.from(
    new Set(
      text
        .replace(/[$¥￥]/g, " ")
        .replace(/[^a-z\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
    ),
  ).slice(0, 8);

  return { query: query.trim(), category, minPriceCents, maxPriceCents, keywords };
}

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

function scoreProduct(product: Product, words: string[]): number {
  const name = product.name.toLowerCase();
  const tags = product.tags.join(" ").toLowerCase();
  const hay = haystack(product);
  return words.reduce((score, word) => {
    if (name.includes(word)) return score + 4;
    if (tags.includes(word)) return score + 2;
    if (hay.includes(word)) return score + 1;
    return score;
  }, 0);
}

function keywordForms(word: string): string[] {
  const forms = new Set([word]);
  if (word.endsWith("ies") && word.length > 4) {
    forms.add(`${word.slice(0, -3)}y`);
  } else if (word.endsWith("es") && word.length > 4) {
    forms.add(word.slice(0, -2));
  }
  if (word.endsWith("s") && word.length > 3) {
    forms.add(word.slice(0, -1));
  } else {
    forms.add(`${word}s`);
  }
  return [...forms];
}

function matchesAllKeywords(text: string, words: string[]): boolean {
  return words.every((word) => keywordForms(word).some((form) => text.includes(form)));
}

export function matchProducts(products: Product[], filters: AssistantFilters): Product[] {
  let list = products.slice();
  if (filters.category) {
    list = list.filter((product) => product.category === filters.category);
  }
  if (filters.minPriceCents !== null) {
    list = list.filter((product) => product.priceCents >= filters.minPriceCents!);
  }
  if (filters.maxPriceCents !== null) {
    list = list.filter((product) => product.priceCents <= filters.maxPriceCents!);
  }
  if (filters.keywords.length > 0) {
    const keyed = list.filter((product) => {
      const key = `${product.name} ${product.tags.join(" ")}`.toLowerCase();
      return matchesAllKeywords(key, filters.keywords);
    });
    if (keyed.length > 0) {
      list = keyed;
    } else if (!filters.category) {
      list = [];
    }
  }
  return list.sort(
    (left, right) =>
      scoreProduct(right, filters.keywords) - scoreProduct(left, filters.keywords),
  );
}

export function filtersToHref(filters: AssistantFilters): string {
  const params = new URLSearchParams();
  const query = filters.keywords.join(" ");
  if (query) params.set("q", query);
  if (filters.category) params.set("category", filters.category);
  if (filters.minPriceCents !== null) params.set("min", String(filters.minPriceCents / 100));
  if (filters.maxPriceCents !== null) params.set("max", String(filters.maxPriceCents / 100));
  params.set("assistant", "1");
  return `/?${params.toString()}`;
}

function priceLabel(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : formatMoney(cents);
}

function categoryLabel(cents: AssistantFilters): string {
  const parts: string[] = [];
  if (cents.category) parts.push(`in ${cents.category.toLowerCase()}`);
  if (cents.minPriceCents !== null && cents.maxPriceCents !== null) {
    parts.push(`between ${priceLabel(cents.minPriceCents)} and ${priceLabel(cents.maxPriceCents)}`);
  } else if (cents.maxPriceCents !== null) {
    parts.push(`under ${priceLabel(cents.maxPriceCents)}`);
  } else if (cents.minPriceCents !== null) {
    parts.push(`over ${priceLabel(cents.minPriceCents)}`);
  }
  return parts.join(" ");
}

export async function buildFallbackReply(
  query: string,
  user: SessionUser | null,
): Promise<AssistantResponse> {
  const text = query.toLowerCase().trim();
  const products = listProducts();

  if (/^(hi|hello|hey)\b/.test(text)) {
    return {
      intent: "help",
      reply:
        `Hi — tell me a category or a budget and I will narrow the ${products.length}-piece collection. I can also open your orders, bag and checkout.`,
      products: [],
      orders: [],
      actions: [],
      filters: null,
      source: "catalog",
    };
  }

  if (/\b(thanks|thank you|cheers)\b/.test(text)) {
    return {
      intent: "help",
      reply: "Any time. Wave if you want a second opinion on a setup.",
      products: [],
      orders: [],
      actions: [],
      filters: null,
      source: "catalog",
    };
  }

  if (/\b(what can you do|how does this work)\b/.test(text) || /^help[?.! ]*$/.test(text)) {
    return {
      intent: "help",
      reply:
        "I can help with three things: find tech by category, use or budget; explain a product; and open your bag, orders or checkout. Every recommendation comes from this store's live catalog.",
      products: [],
      orders: [],
      actions: [],
      filters: null,
      source: "catalog",
    };
  }

  const orderId = text.match(/\bnl-\d{3,5}\b/i);
  if (
    orderId ||
    /\b(my orders?|orders|order status|track|tracking|where(?:'s| is) my order|deliver|shipped|cancel(?: my)? order)\b/.test(
      text,
    )
  ) {
    if (!user) {
      return {
        intent: "orders",
        reply: "Sign in and I can pull up your orders, delivery status and totals.",
        products: [],
        orders: [],
        actions: [
          { label: "Sign in", href: "/signin", primary: true },
          { label: "Browse tech", href: "/" },
        ],
        filters: null,
        source: "catalog",
      };
    }

    const orders = listOrders(user.id);
    const match = orderId
      ? orders.find((order) => order.id.toLowerCase() === orderId[0].toLowerCase())
      : null;

    if (match) {
      return {
        intent: "orders",
        reply: `${match.id} is ${match.status.toLowerCase()}. Placed ${formatDate(match.createdAt)} for ${formatMoney(match.totalCents)}.`,
        products: [],
        orders: [match],
        actions: [
          { label: "Open order", href: `/orders/${match.id}`, primary: true },
          { label: "All orders", href: "/orders" },
        ],
        filters: null,
        source: "catalog",
      };
    }

    if (orders.length === 0) {
      return {
        intent: "orders",
        reply: "You do not have any orders yet. Once you check out, the order and its status will appear here.",
        products: [],
        orders: [],
        actions: [{ label: "Browse the collection", href: "/", primary: true }],
        filters: null,
        source: "catalog",
      };
    }

    const recent = orders.slice(0, 3);
    return {
      intent: "orders",
      reply: orderId
        ? `I could not find ${orderId[0]} on this account. Your latest orders:`
        : `You have ${orders.length} ${orders.length === 1 ? "order" : "orders"}. Latest:`,
      products: [],
      orders: recent,
      actions: [{ label: "View all orders", href: "/orders", primary: true }],
      filters: null,
      source: "catalog",
    };
  }

  if (/\b(cart|basket)\b/.test(text) || /\b(my bag|in (?:my|the) bag|what(?:'s| is) in my bag|open bag|view bag)\b/.test(text)) {
    if (!user) {
      return {
        intent: "cart",
        reply: "Your bag is saved to your account. Sign in to see it or add something new.",
        products: [],
        orders: [],
        actions: [
          { label: "Sign in", href: "/signin", primary: true },
          { label: "Browse tech", href: "/" },
        ],
        filters: null,
        source: "catalog",
      };
    }
    const lines = getCartLines(user.id);
    if (lines.length === 0) {
      return {
        intent: "cart",
        reply: "Your bag is empty. Tell me what kind of tech you need, or browse the collection.",
        products: [],
        orders: [],
        actions: [
          { label: "Browse tech", href: "/", primary: true },
          { label: "Laptops under $1,500", href: "/?category=Computers&max=1500&assistant=1" },
        ],
        filters: null,
        source: "catalog",
      };
    }
    const count = lines.reduce((sum, line) => sum + line.qty, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.product.priceCents * line.qty, 0);
    return {
      intent: "cart",
      reply: `Your bag has ${count} ${count === 1 ? "item" : "items"} and comes to ${formatMoney(subtotal)} before shipping.`,
      products: lines.slice(0, 3).map((line) => line.product),
      orders: [],
      actions: [
        { label: "Open bag", href: "/cart", primary: true },
        { label: "Checkout", href: "/checkout" },
      ],
      filters: null,
      source: "catalog",
    };
  }

  if (/\b(checkout|check out|place (?:an )?order|complete (?:my|the) order)\b/.test(text)) {
    if (!user) {
      return {
        intent: "checkout",
        reply: "Sign in to check out. Your bag will be waiting.",
        products: [],
        orders: [],
        actions: [{ label: "Sign in", href: "/signin", primary: true }],
        filters: null,
        source: "catalog",
      };
    }
    const lines = getCartLines(user.id);
    if (lines.length === 0) {
      return {
        intent: "checkout",
        reply: "There is nothing to check out yet. Add a piece of tech to your bag first.",
        products: [],
        orders: [],
        actions: [{ label: "Browse tech", href: "/", primary: true }],
        filters: null,
        source: "catalog",
      };
    }
    const subtotal = lines.reduce((sum, line) => sum + line.product.priceCents * line.qty, 0);
    const totals = totalsFor(subtotal);
    return {
      intent: "checkout",
      reply: `You are ready to check out: ${formatMoney(totals.totalCents)} including estimated tax${totals.shippingCents ? " and shipping" : ", with free shipping"}. No payment details are requested.`,
      products: [],
      orders: [],
      actions: [
        { label: "Go to checkout", href: "/checkout", primary: true },
        { label: "Review bag", href: "/cart" },
      ],
      filters: null,
      source: "catalog",
    };
  }

  if (/\b(sign in|log in|account|profile|password)\b/.test(text)) {
    if (!user) {
      return {
        intent: "account",
        reply: "You are browsing as a guest. Sign in or create an account to keep a bag and order history.",
        products: [],
        orders: [],
        actions: [
          { label: "Sign in", href: "/signin", primary: true },
          { label: "Create account", href: "/signup" },
        ],
        filters: null,
        source: "catalog",
      };
    }
    const orders = listOrders(user.id);
    return {
      intent: "account",
      reply: `You are signed in as ${user.name} (${user.email}) with ${orders.length} ${orders.length === 1 ? "order" : "orders"} saved.`,
      products: [],
      orders: [],
      actions: [
        { label: "My orders", href: "/orders", primary: true },
        { label: "My bag", href: "/cart" },
      ],
      filters: null,
      source: "catalog",
    };
  }

  if (/\b(catalog|browse|shop|collection|what do you sell|what have you got)\b/.test(text)) {
    return {
      intent: "catalog",
      reply:
        `The collection has ${products.length} pieces across ${CATEGORY_LIST}. A few to start with:`,
      products: products.slice(0, 3),
      orders: [],
      actions: [{ label: "Browse all tech", href: "/", primary: true }],
      filters: null,
      source: "catalog",
    };
  }

  const named = products.filter((product) => text.includes(product.name.toLowerCase()));
  if (named.length === 1) {
    const product = named[0];
    return {
      intent: "shopping",
      reply: `${product.name} — ${product.tagline} ${priceLabel(product.priceCents)} · ${product.category}. ${product.description}`,
      products: [product],
      orders: [],
      actions: [
        { label: "View product", href: `/product/${product.id}`, primary: true },
      ],
      filters: null,
      source: "catalog",
    };
  }

  const filters: AssistantFilters = parseGearQuery(query);
  const matches = matchProducts(products, filters);

  if (matches.length === 0) {
    if (filters.category) {
      const pool = products
        .filter((product) => product.category === filters.category)
        .sort((left, right) => left.priceCents - right.priceCents);
      if (pool.length > 0) {
        const nearest =
          filters.minPriceCents !== null ? pool[pool.length - 1] : pool[0];
        const budget = categoryLabel({ ...filters, category: null });
        return {
          intent: "shopping",
          reply: `Nothing in ${filters.category} fits${budget ? ` ${budget}` : ""}. The closest is ${nearest.name} at ${priceLabel(nearest.priceCents)}.`,
          products: [nearest],
          orders: [],
          actions: [
            {
              label: `See all ${filters.category.toLowerCase()}`,
              href: `/?category=${encodeURIComponent(filters.category)}&assistant=1`,
            },
          ],
          filters,
          source: "catalog",
        };
      }
    }
    return {
      intent: "shopping",
      reply: `I could not match “${query}” to the live catalog. Try a category — ${CATEGORY_LIST} — or give me a budget.`,
      products: [],
      orders: [],
      actions: [
        { label: "Laptops under $1,500", href: "/?category=Computers&max=1500&assistant=1" },
        { label: "Browse the catalog", href: "/" },
      ],
      filters,
      source: "catalog",
    };
  }

  if (matches.length === 1) {
    const product = matches[0];
    return {
      intent: "shopping",
      reply: `${product.name} is the best fit — ${product.tagline} ${priceLabel(product.priceCents)} · ${product.category}.`,
      products: [product],
      orders: [],
      actions: [
        { label: "View product", href: `/product/${product.id}`, primary: true },
        { label: "See in catalog", href: filtersToHref(filters) },
      ],
      filters,
      source: "catalog",
    };
  }

  const descriptor = categoryLabel(filters);
  return {
    intent: "shopping",
    reply: `I found ${matches.length} ${matches.length === 1 ? "match" : "matches"}${descriptor ? ` ${descriptor}` : ""} in the live catalog. Here are the closest:`,
    products: matches.slice(0, 3),
    orders: [],
    actions: [
      {
        label: `See all ${matches.length} in the catalog`,
        href: filtersToHref(filters),
        primary: true,
      },
    ],
    filters,
    source: "catalog",
  };
}
