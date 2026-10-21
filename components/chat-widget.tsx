"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Send, Sparkles, X } from "lucide-react";
import { ChatMessage } from "@/components/chat-widget-views";
import type {
  AssistantResponse,
  AssistantStreamEvent,
  AssistantToolCall,
} from "@/lib/assistant";
import { OPEN_GUIDE_EVENT } from "@/components/chat-events";

type Message = {
  id: number;
  role: "user" | "bot";
  text?: string;
  response?: AssistantResponse;
  toolCalls?: AssistantToolCall[];
  pending?: boolean;
};

async function readAssistantStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onText: (text: string) => void;
    onToolCall: (call: Omit<AssistantToolCall, "status">) => void;
    onToolResult: (id: string, status: AssistantToolCall["status"]) => void;
  },
): Promise<AssistantResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const outcome: { response?: AssistantResponse; error?: string } = {};
  let buffer = "";
  let streamed = "";

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AssistantStreamEvent;
    if (event.type === "text") {
      streamed += event.text;
      handlers.onText(streamed);
    } else if (event.type === "tool-call") {
      handlers.onToolCall({ id: event.id, name: event.name, input: event.input });
    } else if (event.type === "tool-result") {
      handlers.onToolResult(event.id, event.status);
    } else if (event.type === "done") {
      outcome.response = event.response;
    } else if (event.type === "error") {
      outcome.error = event.message;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        handleLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer) handleLine(buffer);
  } finally {
    reader.releaseLock();
  }

  if (outcome.error) throw new Error(outcome.error);
  if (!outcome.response) throw new Error("The guide could not answer that. Please try again.");
  return outcome.response;
}

const SUGGESTIONS = [
  { label: "Laptops under $1,500", prompt: "Laptops under $1,500" },
  { label: "Headphones under $400", prompt: "Headphones under $400" },
  { label: "Where's my order?", prompt: "Where's my order?" },
  { label: "What's in my bag?", prompt: "What's in my bag?" },
];

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const widgetRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  const hiddenRoute = pathname === "/signin" || pathname === "/signup";

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!widgetRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, open]);

  const sendChat = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      const userMessage: Message = { id: nextId.current++, role: "user", text };
      const pendingId = nextId.current++;
      setMessages((current) => [
        ...current,
        userMessage,
        { id: pendingId, role: "bot", pending: true },
      ]);
      setInput("");
      setBusy(true);

      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/x-ndjson" },
          body: JSON.stringify({ query: text }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "The guide could not answer that.");
        }
        if (!response.body) throw new Error("The guide could not answer that. Please try again.");

        const payload = await readAssistantStream(response.body, {
          onText(streamed) {
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingId ? { ...message, text: streamed } : message,
              ),
            );
          },
          onToolCall(call) {
            setMessages((current) =>
              current.map((message) => {
                if (message.id !== pendingId) return message;
                const toolCalls = message.toolCalls ?? [];
                if (toolCalls.some((item) => item.id === call.id)) return message;
                return {
                  ...message,
                  toolCalls: [...toolCalls, { ...call, status: "running" }],
                };
              }),
            );
          },
          onToolResult(id, status) {
            setMessages((current) =>
              current.map((message) =>
                message.id === pendingId
                  ? {
                      ...message,
                      toolCalls: (message.toolCalls ?? []).map((call) =>
                        call.id === id ? { ...call, status } : call,
                      ),
                    }
                  : message,
              ),
            );
          },
        });

        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? { ...message, pending: false, text: undefined, response: payload }
              : message,
          ),
        );
      } catch (error) {
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? {
                  ...message,
                  pending: false,
                  text:
                    error instanceof Error
                      ? error.message
                      : "The guide could not answer that. Please try again.",
                }
              : message,
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  useEffect(() => {
    function onOpen(event: Event) {
      setOpen(true);
      const query = (event as CustomEvent<string | undefined>).detail;
      if (query) void sendChat(query);
    }
    window.addEventListener(OPEN_GUIDE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, onOpen);
  }, [sendChat]);

  useEffect(() => {
    if (!open) return;
    setMessages((current) => {
      if (current.length > 0) return current;
      return [
        {
          id: nextId.current++,
          role: "bot",
          text:
            "Hi — I'm the Northline guide. I can find tech from the live catalog, explain a product, or help with your bag and orders. Try a category, a budget, or ask “where's my order?”",
        },
      ];
    });
  }, [open]);

  if (hiddenRoute) return null;

  return (
    <div className="chat-widget" ref={widgetRef}>
      <section
        className="chat-panel"
        id="chatPanel"
        role="dialog"
        aria-labelledby="chatTitle"
        hidden={!open}
      >
        <header className="chat-head">
          <span className="chat-mark" aria-hidden="true">
            <Sparkles className="icon" strokeWidth={1.75} />
          </span>
          <div className="chat-head-copy">
            <h2 id="chatTitle">Northline guide</h2>
            <p>Catalog, orders and checkout help</p>
          </div>
          <button
            className="chat-close"
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close guide"
          >
            <X className="icon" strokeWidth={1.75} />
          </button>
        </header>

        <div className="chat-log" id="chatLog" ref={logRef} role="log" aria-live="polite">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </div>

        <div className="chat-quick" aria-label="Suggested questions">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => void sendChat(suggestion.prompt)}
              disabled={busy}
            >
              {suggestion.label}
            </button>
          ))}
        </div>

        <form
          className="chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            void sendChat(input);
          }}
        >
          <label className="sr-only" htmlFor="chatInput">
            Ask the Northline guide
          </label>
          <input
            ref={inputRef}
            id="chatInput"
            name="query"
            type="text"
            placeholder="Ask about tech, orders or checkout…"
            autoComplete="off"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit" aria-label="Send message" disabled={busy}>
            <Send className="icon" strokeWidth={1.75} />
          </button>
        </form>
        <p className="chat-note">AI agent · live catalog · no-card checkout</p>
      </section>

      <button
        className="chat-fab"
        id="chatFab"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="chatPanel"
        aria-label="Ask Northline"
      >
        <Sparkles className="icon" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
