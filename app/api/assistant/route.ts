import { jsonError, readJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { buildAssistantReply } from "@/lib/assistant";
import { assistantSchema, fieldErrors } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = assistantSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return jsonError(422, "Ask a question about the catalog or your order.", fieldErrors(parsed.error));
    }

    const user = await getSessionUser();
    const response = await buildAssistantReply(parsed.data.query, user);
    return Response.json(response);
  } catch (error) {
    console.error(error);
    return jsonError(500, "The guide could not answer that. Please try again.");
  }
}
