import { randomUUID } from "node:crypto";
import { jsonError, readJson } from "@/lib/api";
import { createSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getUserByEmail } from "@/lib/db/queries";
import { fieldErrors, signupSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = signupSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return jsonError(422, "Please check the fields and try again.", fieldErrors(parsed.error));
    }

    const { name, email, password } = parsed.data;
    if (getUserByEmail(email)) {
      return jsonError(409, "An account with that email already exists. Try signing in.", {
        email: "An account with that email already exists.",
      });
    }

    const id = randomUUID();
    try {
      db.insert(users)
        .values({
          id,
          name,
          email,
          passwordHash: hashPassword(password),
          createdAt: new Date().toISOString(),
        })
        .run();
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return jsonError(409, "An account with that email already exists. Try signing in.", {
          email: "An account with that email already exists.",
        });
      }
      throw error;
    }

    await createSession(id);
    return Response.json({ user: { id, name, email } }, { status: 201 });
  } catch (error) {
    console.error(error);
    return jsonError(500, "The account could not be created. Please try again.");
  }
}
