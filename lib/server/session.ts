// Server-only session lookup. Extracts the Bearer token from a Request and
// returns the family record + session, or null. Touches `lastUsedAt` so the
// session sliding-window TTL works.
import { SYNC } from "@/lib/constants";
import { getRepository } from "@/lib/server/repo";
import type { FamilyRecord, SessionRecord } from "@/lib/server/repo";

export type ResolvedSession = {
  session: SessionRecord;
  family: FamilyRecord;
};

const BEARER_RE = /^Bearer\s+([A-Fa-f0-9]{16,128})$/;

export async function resolveSession(
  req: Request,
): Promise<ResolvedSession | null> {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(BEARER_RE);
  if (!match) return null;
  const token = match[1];

  const repo = getRepository();
  const session = await repo.getSession(token);
  if (!session) return null;

  const now = Date.now();
  if (now - session.lastUsedAt > SYNC.sessionTtlMs) {
    await repo.deleteSession(token);
    return null;
  }

  const family = await repo.getFamilyById(session.familyId);
  if (!family) {
    await repo.deleteSession(token);
    return null;
  }

  if (now - session.lastUsedAt > 60_000) {
    repo.touchSession(token, now).catch((err) => {
      console.error("Background session touch failed:", err);
    });
  }

  return { session, family };
}
