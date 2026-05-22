import { resolveSession } from "@/lib/server/session";
import { getRepository } from "@/lib/server/repo";
import { apiHandler } from "@/lib/server/apiHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  const resolved = await resolveSession(req);
  if (resolved) {
    await getRepository().deleteSession(resolved.session.token);
  }
  // Idempotent: returns ok whether or not we had a valid session.
  return { ok: true };
});
