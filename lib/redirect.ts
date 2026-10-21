export function safeNextPath(
  input: string | string[] | undefined,
  fallback = "/",
): string {
  const raw = Array.isArray(input) ? input[0] : input;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }
  return raw;
}
