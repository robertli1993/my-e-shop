"use client";

import { openGuide } from "@/components/chat-events";

export function GuideButton({
  children,
  className,
  query,
}: {
  children: React.ReactNode;
  className?: string;
  query?: string;
}) {
  return (
    <button className={className} type="button" onClick={() => openGuide(query)}>
      {children}
    </button>
  );
}
