import { ToolLoopAgent, isStepCount, tool } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import {
  buildFallbackReply,
  filtersToHref,
  matchProducts,
  parseGearQuery,
  type AssistantAction,
  type AssistantFilters,
  type AssistantResponse,
  type AssistantStreamEvent,
} from "@/lib/assistant";
import { CATEGORIES } from "@/lib/catalog";
import {
  getCartLines,
  getOrder,
  getProduct,
  listOrders,
  listProducts,
} from "@/lib/db/queries";
import { totalsFor } from "@/lib/money";
import type { CartLine, OrderSummary, Product, SessionUser } from "@/lib/types";

type CatalogToolPayload = {
  filters?: AssistantFilters;
  products?: Product[];
  product?: Product;
  total?: number;
  orders?: OrderSummary[];
  order?: OrderSummary;
  lines?: CartLine[];
  count?: number;
  signedIn?: boolean;
};

function category(value: string | undefined): string | null {
  if (!value) return null;
  return CATEGORIES.find((item) => item.toLowerCase() === value.toLowerCase()) ?? null;
}

function dollarsToCents(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(Math.min(value, 100_000) * 100);
}

function fallbackReply(
  products: Product[],
  orders: OrderSummary[],
  signedIn: boolean,
): string {
  if (products.length > 0) {
    const names = products.map((product) => product.name).join(", ");
    return `I found ${products.length === 1 ? names : `${products.length} matches: ${names}`}. The product cards below open the full details.`;
  }
  if (orders.length > 0) {
    return "Here are your latest orders. Open one to see its items, shipping details and status.";
  }
  if (!signedIn) {
    return "Sign in and I can pull up your bag, orders and delivery status.";
  }
  return "I can help you find tech by category, budget or use case. Tell me what you need and I will search the live catalog.";
}

function plainText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

function addAction(actions: AssistantAction[], action: AssistantAction): void {
  if (actions.some((item) => item.href === action.href && item.label === action.label)) return;
  actions.push(action);
}

function buildAgent(user: SessionUser | null) {
  const apiKey = process.env.OPENDESIGN_API_KEY;
  if (!apiKey) return null;

  const baseURL = (process.env.OPENDESIGN_API_URL ?? "https://amr-link.open-design.ai/v1").replace(
    /\/$/,
    "",
  );
  const modelId = process.env.OPENDESIGN_MODEL ?? "deepseek-v4.1-flash";
  const provider = createOpenAICompatible({
    name: "northline",
    baseURL,
    apiKey,
  });

  const searchProducts = tool({
    description:
      "Search the live Northline catalog. Use this for every product recommendation, category browse, price or stock question. Returns only products that exist in the store.",
    inputSchema: z.object({
      query: z
        .string()
        .max(200)
        .optional()
        .describe("Product keywords or a short natural-language request, e.g. 'noise cancelling headphones'"),
      category: z
        .enum(CATEGORIES)
        .optional()
        .describe("One of the store categories, when the request names one"),
      minPrice: z.number().min(0).max(100_000).optional().describe("Minimum price in USD"),
      maxPrice: z.number().min(0).max(100_000).optional().describe("Maximum price in USD"),
      keywords: z.array(z.string()).max(8).optional().describe("Specific product nouns or uses"),
    }),
    execute: async ({ query, category: requestedCategory, minPrice, maxPrice, keywords }) => {
      const parsed = parseGearQuery([query, ...(keywords ?? [])].filter(Boolean).join(" "));
      const filters: AssistantFilters = {
        query: query?.trim() || parsed.query,
        category: category(requestedCategory) ?? parsed.category,
        minPriceCents: dollarsToCents(minPrice) ?? parsed.minPriceCents,
        maxPriceCents: dollarsToCents(maxPrice) ?? parsed.maxPriceCents,
        keywords: Array.from(new Set([...(parsed.keywords ?? []), ...(keywords ?? [])]))
          .map((word) => word.trim().toLowerCase())
          .filter((word) => word.length > 1 && word.length < 40)
          .slice(0, 8),
      };

      const matches = matchProducts(listProducts(), filters);
      return {
        total: matches.length,
        filters,
        products: matches.slice(0, 8),
      };
    },
  });

  const findProduct = tool({
    description:
      "Look up one exact product by id or by its full name. Use this when the user asks for details about a named item.",
    inputSchema: z.object({
      id: z.string().max(80).optional().describe("Catalog id, for example iphone-15-pro"),
      name: z.string().max(160).optional().describe("Full product name"),
    }),
    execute: async ({ id, name }) => {
      if (!id && !name) return { product: null };
      const products = listProducts();
      const needle = (id ?? name ?? "").trim().toLowerCase();
      const product =
        (id ? getProduct(id) : null) ??
        products.find((item) => item.name.toLowerCase() === needle) ??
        products.find((item) => item.name.toLowerCase().includes(needle)) ??
        null;
      return { product };
    },
  });

  const listCategories = tool({
    description: "List the store's product categories with the number of products in each.",
    inputSchema: z.object({}),
    execute: async () => {
      const products = listProducts();
      return {
        categories: CATEGORIES.map((item) => ({
          name: item,
          count: products.filter((product) => product.category === item).length,
        })),
      };
    },
  });

  const viewCart = tool({
    description:
      "Read the signed-in user's shopping bag, item quantities and checkout total. Returns signedIn: false when there is no session.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!user) return { signedIn: false };
      const lines = getCartLines(user.id);
      const subtotalCents = lines.reduce(
        (sum, line) => sum + line.product.priceCents * line.qty,
        0,
      );
      const totals = totalsFor(subtotalCents);
      return {
        signedIn: true,
        lines,
        count: lines.reduce((sum, line) => sum + line.qty, 0),
        subtotalCents,
        shippingCents: totals.shippingCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
      };
    },
  });

  const viewOrders = tool({
    description:
      "List the signed-in user's orders with status, total and items. Returns signedIn: false when there is no session.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(10).optional().describe("Maximum orders to return"),
      status: z.string().optional().describe("Optional exact order status filter"),
    }),
    execute: async ({ limit, status }) => {
      if (!user) return { signedIn: false };
      const orders = listOrders(user.id);
      const filtered = status
        ? orders.filter((order) => order.status.toLowerCase() === status.toLowerCase())
        : orders;
      return {
        signedIn: true,
        total: filtered.length,
        orders: filtered.slice(0, limit ?? 3),
      };
    },
  });

  const viewOrder = tool({
    description:
      "Read one of the signed-in user's orders by id, including status, items and shipping address. Returns signedIn: false when there is no session.",
    inputSchema: z.object({
      orderId: z.string().min(1).max(40).describe("Order id, for example NL-1051"),
    }),
    execute: async ({ orderId }) => {
      if (!user) return { signedIn: false };
      return { signedIn: true, order: getOrder(user.id, orderId) };
    },
  });

  return new ToolLoopAgent({
    model: provider(modelId),
    instructions: [
      "You are the Northline tech guide, a shopping agent for an electronics store.",
      "Use the search_products tool for every product recommendation, comparison, price, stock or category question.",
      "Only recommend products that a tool returned. Never invent products, prices, stock or categories.",
      "If a search returns no products, say the catalog has no match and suggest only a category or budget the user can try; never name any product or product type that did not come from a tool result.",
      "Use find_product for details about a named item and list_categories when asked what the store carries.",
      "Use view_cart for bag or checkout questions, and view_orders or view_order for order questions.",
      "When a tool returns signedIn: false, ask the user to sign in. Never claim to know their bag or orders without a tool result.",
      "You cannot place, cancel or modify orders. Direct the user to the checkout, order page or bag instead.",
      "Prices are USD. Reply in one short plain-text paragraph, at most 90 words, without markdown tables, headings or bullet lists.",
    ].join(" "),
    tools: {
      search_products: searchProducts,
      find_product: findProduct,
      list_categories: listCategories,
      view_cart: viewCart,
      view_orders: viewOrders,
      view_order: viewOrder,
    },
    stopWhen: isStepCount(6),
    temperature: 0.1,
    maxOutputTokens: 900,
  });
}

type ToolResult = {
  toolName: string;
  output?: unknown;
};

function buildResponse(toolResults: ToolResult[], text: string): AssistantResponse {
  const products = new Map<string, Product>();
  const orders = new Map<string, OrderSummary>();
  let filters: AssistantFilters | null = null;
  let totalMatches: number | null = null;
  let authRequired = false;
  let cartCount = 0;
  let usedCart = false;
  let usedOrders = false;
  let usedCatalog = false;
  let usedCategories = false;

  for (const toolResult of toolResults) {
    const payload = (toolResult.output ?? {}) as CatalogToolPayload;

    if (payload.signedIn === false) authRequired = true;

    switch (toolResult.toolName) {
      case "search_products": {
        usedCatalog = true;
        if (Array.isArray(payload.products)) {
          for (const product of payload.products) products.set(product.id, product);
        }
        if (typeof payload.total === "number") totalMatches = payload.total;
        if (payload.filters) filters = payload.filters;
        break;
      }
      case "find_product": {
        usedCatalog = true;
        if (payload.product) products.set(payload.product.id, payload.product);
        break;
      }
      case "list_categories": {
        usedCategories = true;
        break;
      }
      case "view_cart": {
        usedCart = true;
        if (typeof payload.count === "number") cartCount = payload.count;
        if (Array.isArray(payload.lines)) {
          for (const line of payload.lines) products.set(line.product.id, line.product);
        }
        break;
      }
      case "view_orders": {
        usedOrders = true;
        if (Array.isArray(payload.orders)) {
          for (const order of payload.orders) orders.set(order.id, order);
        }
        break;
      }
      case "view_order": {
        usedOrders = true;
        if (payload.order) orders.set(payload.order.id, payload.order);
        break;
      }
    }
  }

  const productList = Array.from(products.values()).slice(0, 4);
  const orderList = Array.from(orders.values()).slice(0, 3);
  const reply = plainText(text) || fallbackReply(productList, orderList, !authRequired);

  const actions: AssistantAction[] = [];

  if (authRequired) {
    addAction(actions, { label: "Sign in", href: "/signin", primary: true });
    addAction(actions, { label: "Create account", href: "/signup" });
  } else if (usedCart) {
    addAction(actions, { label: "Open bag", href: "/cart", primary: true });
    if (cartCount > 0) addAction(actions, { label: "Checkout", href: "/checkout" });
  } else if (usedOrders) {
    if (orderList.length === 1) {
      addAction(actions, {
        label: `Open ${orderList[0].id}`,
        href: `/orders/${orderList[0].id}`,
        primary: true,
      });
      addAction(actions, { label: "All orders", href: "/orders" });
    } else {
      addAction(actions, { label: "View all orders", href: "/orders", primary: true });
    }
  } else if (productList.length === 1) {
    addAction(actions, {
      label: `View ${productList[0].name}`,
      href: `/product/${productList[0].id}`,
      primary: true,
    });
    addAction(actions, { label: "Browse the catalog", href: "/" });
  } else if (productList.length > 1 || usedCatalog || usedCategories) {
    addAction(actions, { label: "Browse the catalog", href: "/", primary: true });
  }

  if (totalMatches !== null && totalMatches > productList.length && filters) {
    addAction(actions, {
      label: `See all ${totalMatches} in the catalog`,
      href: filtersToHref(filters),
    });
  }

  if (actions.length === 0) {
    addAction(actions, { label: "Browse the catalog", href: "/", primary: true });
  }

  return {
    intent: usedOrders
      ? "orders"
      : usedCart
        ? "cart"
        : usedCatalog
          ? "shopping"
          : usedCategories
            ? "catalog"
            : "help",
    reply,
    products: productList,
    orders: orderList,
    actions,
    filters,
    source: "agent",
  };
}

function streamSingleResponse(response: AssistantResponse): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`${JSON.stringify({ type: "text", text: response.reply })}\n`),
      );
      controller.enqueue(encoder.encode(`${JSON.stringify({ type: "done", response })}\n`));
      controller.close();
    },
  });
}

export async function streamAssistantReply(
  query: string,
  user: SessionUser | null,
  requestSignal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const agent = buildAgent(user);
  if (!agent) return streamSingleResponse(await buildFallbackReply(query, user));

  const encoder = new TextEncoder();
  let cancelled = false;
  let abortController: AbortController | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const toolResults: ToolResult[] = [];
      const pendingToolCalls = new Set<string>();
      let text = "";
      let reasoningSeen = false;
      let closed = false;

      const send = (event: AssistantStreamEvent) => {
        if (cancelled || closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          cancelled = true;
        }
      };

      const failPendingToolCalls = () => {
        for (const id of pendingToolCalls) {
          send({ type: "tool-result", id, status: "error" });
        }
        pendingToolCalls.clear();
      };

      const abort = new AbortController();
      abortController = abort;
      const timeout = setTimeout(() => abort.abort(), 25_000);
      const onRequestAbort = () => abort.abort();
      if (requestSignal?.aborted) {
        abort.abort();
      } else {
        requestSignal?.addEventListener("abort", onRequestAbort, { once: true });
      }

      try {
        const result = await agent.stream({
          prompt: query,
          abortSignal: abort.signal,
        });

        for await (const part of result.stream) {
          if (part.type === "reasoning-delta") {
            reasoningSeen = true;
            send({ type: "reasoning", text: part.text });
          } else if (part.type === "text-delta") {
            text += part.text;
            send({ type: "text", text: part.text });
          } else if (part.type === "tool-call") {
            pendingToolCalls.add(part.toolCallId);
            send({
              type: "tool-call",
              id: part.toolCallId,
              name: part.toolName,
              input: part.input,
            });
          } else if (part.type === "tool-result") {
            pendingToolCalls.delete(part.toolCallId);
            toolResults.push({ toolName: part.toolName, output: part.output });
            send({ type: "tool-result", id: part.toolCallId, status: "done" });
          } else if (part.type === "tool-error") {
            pendingToolCalls.delete(part.toolCallId);
            send({ type: "tool-result", id: part.toolCallId, status: "error" });
          } else if (part.type === "error") {
            throw part.error;
          }
        }

        failPendingToolCalls();
        send({ type: "done", response: buildResponse(toolResults, text) });
      } catch (error) {
        console.warn(
          "Tech guide agent request failed",
          error instanceof Error ? error.message : error,
        );
        failPendingToolCalls();
        if (reasoningSeen) send({ type: "reasoning-reset" });
        try {
          send({ type: "done", response: await buildFallbackReply(query, user) });
        } catch (fallbackError) {
          console.error(fallbackError);
          send({ type: "error", message: "The guide could not answer that. Please try again." });
        }
      } finally {
        clearTimeout(timeout);
        requestSignal?.removeEventListener("abort", onRequestAbort);
        abortController = null;
        closed = true;
        if (!cancelled) {
          try {
            controller.close();
          } catch {
            // The client may have already closed the stream.
          }
        }
      }
    },
    cancel() {
      cancelled = true;
      abortController?.abort();
    },
  });
}
