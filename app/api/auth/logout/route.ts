import { destroySession } from "@/lib/auth/session";

export async function POST(request: Request) {
  await destroySession();
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return Response.redirect(new URL("/", request.url), 303);
  }
  return Response.json({ ok: true });
}
