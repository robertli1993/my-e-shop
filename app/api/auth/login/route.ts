import { jsonError, readJson } from "@/lib/api";
import { createSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { getUserByEmail } from "@/lib/db/queries";
import { fieldErrors, loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return jsonError(422, "Please check the fields and try again.", fieldErrors(parsed.error));
    }

    const { email, password } = parsed.data;
    const user = getUserByEmail(email);
    if (!user) {
      return jsonError(401, "No account found for that email.", {
        email: "No account found for that email.",
      });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return jsonError(401, "That password does not match this account.", {
        password: "That password does not match this account.",
      });
    }

    await createSession(user.id);
    return Response.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error(error);
    return jsonError(500, "Sign-in failed. Please try again.");
  }
}
