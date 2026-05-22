import { SYNC } from "@/lib/constants";
import { resolveSession } from "@/lib/server/session";
import { getRepository } from "@/lib/server/repo";
import {
  ApiError,
  apiHandler,
  parseJsonBody,
} from "@/lib/server/apiHandler";
import { validateSnapshot } from "@/lib/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  const resolved = await resolveSession(req);
  if (!resolved) throw new ApiError(401, "Not signed in.");
  return {
    handle: resolved.family.id,
    state: resolved.family.state,
    stateUpdatedAt: resolved.family.stateUpdatedAt,
  };
});

export const PUT = apiHandler(async (req) => {
  const resolved = await resolveSession(req);
  if (!resolved) throw new ApiError(401, "Not signed in.");

  const body = await parseJsonBody<{
    state?: unknown;
    stateUpdatedAt?: unknown;
  }>(req, SYNC.maxStateBytes);

  const validation = validateSnapshot(body.state);
  if (!validation.ok) {
    throw new ApiError(400, validation.reason);
  }

  // Clamp `stateUpdatedAt` to a small window around server time. Prevents
  // a malicious client from poisoning the future (or the deep past) so all
  // subsequent legitimate pushes are forced into conflict.
  const now = Date.now();
  const minTs = now - SYNC.maxStatePastSkewMs;
  const maxTs = now + SYNC.maxStateFutureSkewMs;
  const rawTs =
    typeof body.stateUpdatedAt === "number" &&
    Number.isFinite(body.stateUpdatedAt)
      ? body.stateUpdatedAt
      : now;
  const clientTs = Math.min(Math.max(rawTs, minTs), maxTs);

  // Stale-write guard: if the client's timestamp is older than the server's,
  // return 409 with the current state so the client can reconcile.
  if (clientTs < resolved.family.stateUpdatedAt) {
    throw new ApiError(409, "Stale state — pull and try again.", {
      state: resolved.family.state,
      stateUpdatedAt: resolved.family.stateUpdatedAt,
    });
  }

  await getRepository().updateFamilyState(
    resolved.family.id,
    validation.snapshot,
    clientTs,
  );

  return { ok: true, stateUpdatedAt: clientTs };
});
