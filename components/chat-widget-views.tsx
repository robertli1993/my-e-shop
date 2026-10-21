"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Sparkles } from "lucide-react";
import { StatusPill } from "@/components/order-visuals";
import type { AssistantResponse, AssistantToolCall } from "@/lib/assistant";
import { formatDate, formatMoney, formatPrice } from "@/lib/money";

type Message = {
  id: number;
  role: "user" | "bot";
  text?: string;
  response?: AssistantResponse;
  toolCalls?: AssistantToolCall[];
  pending?: boolean;
};

function toolSummary(input: unknown): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "";
  const parts = Object.entries(input as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  if (parts.length === 0) return "";
  const summary = parts.join(" · ");
  return summary.length > 90 ? `${summary.slice(0, 87)}…` : summary;
}

export function ChatMessage({
  message,
  onNavigate,
}: {
  message: Message;
  onNavigate: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="chat-msg is-user">
        <div className="chat-bubble">
          <p>{message.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="chat-msg is-bot"
      aria-label={
        message.pending && !message.text && !message.toolCalls?.length
          ? "Guide is working"
          : undefined
      }
    >
      <span className="chat-avatar" aria-hidden="true">
        <Sparkles className="icon-sm" strokeWidth={1.75} />
      </span>
      <div className="chat-bubble">
        {message.pending && !message.text && !message.toolCalls?.length ? (
          <span className="chat-typing" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        ) : null}

        {message.toolCalls?.length ? (
          <div className="chat-tools">
            {message.toolCalls.map((call) => {
              const summary = toolSummary(call.input);
              return (
                <div
                  className={`chat-tool is-${call.status}`}
                  key={call.id}
                  title={summary || undefined}
                >
                  <span className="chat-tool-dot" aria-hidden="true" />
                  <span className="chat-tool-copy">
                    <code>{call.name}</code>
                    {summary ? <span className="chat-tool-args"> {summary}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        {message.text ? <p>{message.text}</p> : null}

        {message.response ? (
          <>
            <p>{message.response.reply}</p>

            {message.response.products.length > 0 ? (
              <div className="chat-products">
                {message.response.products.map((product) => (
                  <Link
                    className="chat-product"
                    href={`/product/${product.id}`}
                    key={product.id}
                    onClick={onNavigate}
                  >
                    <Image src={product.image} width={42} height={42} alt="" sizes="40px" />
                    <span className="chat-product-copy">
                      <strong>{product.name}</strong>
                      <small>
                        {product.category} · {formatPrice(product.priceCents)}
                      </small>
                    </span>
                    <ChevronRight className="icon-sm" strokeWidth={1.75} />
                  </Link>
                ))}
              </div>
            ) : null}

            {message.response.orders.length > 0 ? (
              <div className="chat-list">
                {message.response.orders.map((order) => (
                  <Link
                    className="chat-order"
                    href={`/orders/${order.id}`}
                    key={order.id}
                    onClick={onNavigate}
                  >
                    <span>
                      <strong>{order.id}</strong>
                      <small>
                        {formatDate(order.createdAt)} · {formatMoney(order.totalCents)}
                      </small>
                    </span>
                    <StatusPill status={order.status} />
                  </Link>
                ))}
              </div>
            ) : null}

            {message.response.actions.length > 0 ? (
              <div className="chat-actions">
                {message.response.actions.map((action) => (
                  <Link
                    className={`chat-action${action.primary ? " is-primary" : ""}`}
                    href={action.href}
                    key={`${action.label}-${action.href}`}
                    onClick={onNavigate}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
