"use client";

import { useState } from "react";
import { OrderCard } from "@/components/order-visuals";
import type { OrderSummary } from "@/lib/types";

const FILTERS = [
  { id: "all", label: "All", test: () => true },
  {
    id: "processing",
    label: "Processing",
    test: (order: OrderSummary) => order.status === "Processing",
  },
  {
    id: "transit",
    label: "In transit",
    test: (order: OrderSummary) => order.status === "Packed" || order.status === "Shipped",
  },
  {
    id: "delivered",
    label: "Delivered",
    test: (order: OrderSummary) => order.status === "Delivered",
  },
  {
    id: "cancelled",
    label: "Cancelled",
    test: (order: OrderSummary) => order.status === "Cancelled",
  },
] as const;

export function OrdersExplorer({ orders }: { orders: OrderSummary[] }) {
  const [active, setActive] = useState<(typeof FILTERS)[number]["id"]>("all");
  const filter = FILTERS.find((item) => item.id === active) ?? FILTERS[0];
  const visible = orders.filter(filter.test);

  return (
    <>
      <div className="orders-toolbar" role="group" aria-label="Filter orders">
        {FILTERS.map((item) => {
          const count = orders.filter(item.test).length;
          return (
            <button
              className={`chip${active === item.id ? " is-active" : ""}`}
              type="button"
              key={item.id}
              aria-pressed={active === item.id}
              onClick={() => setActive(item.id)}
            >
              {item.label}
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length > 0 ? (
        <div className="orders-list">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <div className="orders-filter-empty">
          <p>No {filter.label.toLowerCase()} orders right now.</p>
          <button
            className="btn btn-secondary btn-small"
            type="button"
            onClick={() => setActive("all")}
          >
            Show all orders
          </button>
        </div>
      )}
    </>
  );
}
