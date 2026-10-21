import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const cartAddSchema = z.object({
  productId: z.string().min(1).max(80),
  qty: z.number().int().min(1).max(99),
});

export const cartQtySchema = z.object({
  qty: z.number().int().min(0).max(99),
});

export const shippingSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's full name.").max(80),
  line1: z.string().trim().min(4, "Enter a street address.").max(120),
  line2: z.string().trim().max(120).default(""),
  city: z.string().trim().min(2, "Enter a city.").max(80),
  region: z.string().trim().min(2, "Enter a state or region.").max(80),
  postal: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/, "Enter a valid postal code."),
  country: z.string().trim().min(2, "Choose a country.").max(80),
});

export const orderSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("cart"), shipping: shippingSchema }),
  z.object({
    source: z.literal("buy-now"),
    productId: z.string().min(1).max(80),
    qty: z.number().int().min(1).max(99),
    shipping: shippingSchema,
  }),
]);

export const assistantSchema = z.object({
  query: z.string().trim().min(1).max(500),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const flattened = error.flatten().fieldErrors;
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flattened)) {
    if (Array.isArray(messages) && messages.length > 0) result[key] = messages[0];
  }
  return result;
}
