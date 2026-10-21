import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { getSessionUserByToken } from "@/lib/db/queries";
import type { SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "northline_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUserByToken(token);
});

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  db.insert(sessions).values({ token, userId, expiresAt }).run();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    db.delete(sessions).where(eq(sessions.token, token)).run();
  }
  store.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}
