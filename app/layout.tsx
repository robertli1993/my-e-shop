import type { Metadata } from "next";
import { io } from "next/cache";
import "./globals.css";
import { ChatWidget } from "@/components/chat-widget";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ToastProvider } from "@/components/toast-provider";
import { getSessionUser } from "@/lib/auth/session";
import { getCartCount, getOrderCount } from "@/lib/db/queries";

export const instant = false;

export const metadata: Metadata = {
  title: "Northline — Everyday Tech",
  description:
    "Northline is a demo electronics store: browse phones, computers, audio and gaming gear, sign in, build a bag, check out, and track orders.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await io();
  const user = await getSessionUser();
  const cartCount = user ? getCartCount(user.id) : 0;
  const orderCount = user ? getOrderCount(user.id) : 0;

  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full">
        <ToastProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>

          <div className="announcement-bar">
            <strong>Free shipping over $150</strong>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span className="hidden sm:inline">Everyday tech for work, play and everything between</span>
          </div>

          <SiteHeader user={user} cartCount={cartCount} orderCount={orderCount} />
          <main id="main">{children}</main>
          <SiteFooter />
          <ChatWidget />
        </ToastProvider>
      </body>
    </html>
  );
}
