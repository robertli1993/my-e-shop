import { jsonError, handleRouteError, readJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { placeOrder } from "@/lib/store";
import { fieldErrors, orderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Sign in or create an account to place an order.");

  try {
    const parsed = orderSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return jsonError(422, "Please check the fields and try again.", fieldErrors(parsed.error));
    }
    const { orderId } = placeOrder(user.id, parsed.data);
    return Response.json({ orderId }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
