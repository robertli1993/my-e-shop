import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { cancelOrder } from "@/lib/store";
import { jsonError } from "@/lib/api";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Sign in to cancel an order.");

  try {
    const { id } = await context.params;
    cancelOrder(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
