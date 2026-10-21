import { jsonError, handleRouteError, readJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getCartCount, getCartLines } from "@/lib/db/queries";
import { addToCart } from "@/lib/store";
import { cartAddSchema, fieldErrors } from "@/lib/validation";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Sign in to see your bag.");
  const lines = getCartLines(user.id);
  return Response.json({ lines, count: getCartCount(user.id) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Sign in to add items to your bag.");

  try {
    const parsed = cartAddSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return jsonError(422, "That item could not be added.", fieldErrors(parsed.error));
    }
    addToCart(user.id, parsed.data.productId, parsed.data.qty);
    return Response.json({
      count: getCartCount(user.id),
      lines: getCartLines(user.id),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
