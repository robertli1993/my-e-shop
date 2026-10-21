import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/money";
import type { OrderItem, OrderSummary } from "@/lib/types";

const STATUS_CLASS: Record<string, string> = {
  Processing: "processing",
  Packed: "packed",
  Shipped: "shipped",
  Delivered: "delivered",
  Cancelled: "cancelled",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`status h-6 px-2.5 status-${STATUS_CLASS[status] ?? "processing"}`}>
      <span className="status-dot" aria-hidden="true" />
      {status}
    </Badge>
  );
}

export function OrderCard({ order }: { order: OrderSummary }) {
  return (
    <Card className="order-card gap-0 py-0">
      <div className="order-card-head">
        <div>
          <div className="order-id">{order.id}</div>
          <div className="order-meta">
            {formatDate(order.createdAt)} · {order.itemCount}{" "}
            {order.itemCount === 1 ? "item" : "items"}
          </div>
        </div>
        <StatusPill status={order.status} />
      </div>
      <div className="order-thumbs">
        {order.items.slice(0, 4).map((item) => (
          <span className="order-thumb" key={`${order.id}-${item.productId}`}>
            <Image src={item.image} width={52} height={52} alt={item.name} sizes="48px" />
          </span>
        ))}
        {order.items.length > 4 ? (
          <span className="order-more">+{order.items.length - 4} more</span>
        ) : null}
      </div>
      <div className="order-card-foot">
        <span className="order-total">
          Total<strong>{formatMoney(order.totalCents)}</strong>
        </span>
        <Link className="btn btn-secondary btn-small" href={`/orders/${order.id}`}>
          View details
        </Link>
      </div>
    </Card>
  );
}

export function OrderItemRow({ item }: { item: OrderItem }) {
  return (
    <div className="order-item">
      <span className="order-item-thumb">
        <Image src={item.image} width={64} height={64} alt="" sizes="56px" />
      </span>
      <div>
        <div className="order-item-name">{item.name}</div>
        <div className="order-item-meta">
          {item.category} · Qty {item.qty} · ${(item.priceCents / 100).toFixed(0)} each
        </div>
      </div>
      <span className="order-item-price">
        {formatMoney(item.priceCents * item.qty)}
      </span>
    </div>
  );
}
