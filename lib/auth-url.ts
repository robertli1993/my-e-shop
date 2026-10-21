export type PendingAdd = { productId: string; qty: number };

export function authHref(
  path: "/signin" | "/signup",
  nextPath: string,
  pendingAdd?: PendingAdd,
): string {
  const params = new URLSearchParams({ next: nextPath });
  if (pendingAdd) {
    params.set("add", pendingAdd.productId);
    params.set("qty", String(pendingAdd.qty));
  }
  return `${path}?${params.toString()}`;
}

export function parsePendingAdd(
  add: string | string[] | undefined,
  qty: string | string[] | undefined,
): PendingAdd | undefined {
  const productId = Array.isArray(add) ? add[0] : add;
  if (!productId) return undefined;
  const raw = Number(Array.isArray(qty) ? qty[0] : qty);
  const quantity = Number.isFinite(raw) ? Math.max(1, Math.min(99, Math.floor(raw))) : 1;
  return { productId, qty: quantity };
}
