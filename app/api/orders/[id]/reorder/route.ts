import { handleRouteError, jsonError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { reorder } from "@/lib/store";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Sign in to order these items again.");

  try {
    const { id } = await context.params;
    const result = reorder(user.id, id);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
