import { StoreError } from "@/lib/store";

export function jsonError(status: number, message: string, fields?: Record<string, string>) {
  return Response.json({ error: message, ...(fields ? { fields } : {}) }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof StoreError) {
    return jsonError(error.status, error.message);
  }
  console.error(error);
  return jsonError(500, "Something went wrong on the server. Please try again.");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new StoreError(400, "Send a valid JSON body.");
  }
}
