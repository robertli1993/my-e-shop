import { jsonError, readJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getCartCount, getCartLines } from "@/lib/db/queries";
import { setCartQty, StoreError } from "@/lib/store";
import { cartQtySchema, fieldErrors } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Sign in to change your bag.");

  try {
    const parsed = cartQtySchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return jsonError(422, "Choose a valid quantity.", fieldErrors(parsed.error));
    }
    const { productId } = await context.params;
    setCartQty(user.id, productId, parsed.data.qty);
    return Response.json({
      count: getCartCount(user.id),
      lines: getCartLines(user.id),
    });
  } catch (error) {
    if (error instanceof StoreError) {
      return jsonError(error.status, error.message);
    }
    console.error(error);
    return jsonError(500, "The bag could not be updated.");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Sign in to change your bag.");

  try {
    const { productId } = await context.params;
    setCartQty(user.id, productId, 0);
    return Response.json({
      count: getCartCount(user.id),
      lines: getCartLines(user.id),
    });
  } catch (error) {
    if (error instanceof StoreError) {
      return jsonError(error.status, error.message);
    }
    console.error(error);
    return jsonError(500, "The item could not be removed.");
  }
}
