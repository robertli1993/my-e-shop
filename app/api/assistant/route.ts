import { jsonError, readJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { streamAssistantReply } from "@/lib/assistant-agent";
import { assistantSchema, fieldErrors } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = assistantSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return jsonError(422, "Ask a question about the catalog or your order.", fieldErrors(parsed.error));
    }

    const user = await getSessionUser();
    const stream = await streamAssistantReply(parsed.data.query, user, request.signal);
    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    console.error(error);
    return jsonError(500, "The guide could not answer that. Please try again.");
  }
}
