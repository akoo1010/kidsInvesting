import { RATE_LIMIT } from "@/lib/constants";
import {
  constantTimeVerify,
  isValidPassword,
  newSessionToken,
  normalizeHandle,
} from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repo";
import {
  ApiError,
  apiHandler,
  parseJsonBody,
} from "@/lib/server/apiHandler";
import { clientKey, rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  const limit = await rateLimit(
    clientKey(req, "login"),
    RATE_LIMIT.loginMaxPerWindow,
  );
  if (!limit.ok) {
    throw new ApiError(
      429,
      "Too many sign-in attempts. Try again later.",
      { retryAfterMs: limit.retryAfterMs },
    );
  }

  const body = await parseJsonBody<{ handle?: unknown; password?: unknown }>(
    req,
    4096,
  );

  // Normalize *outside* the credential check so timing doesn't differ for
  // invalid handles. We pass `null` to constantTimeVerify when the handle
  // is malformed or the family doesn't exist — same scrypt time either way.
  const handle = normalizeHandle(body.handle);
  const password = isValidPassword(body.password) ? body.password : "";

  const repo = getRepository();
  const family = handle ? await repo.getFamilyById(handle) : null;
  const ok = await constantTimeVerify(password, family);

  if (!ok || !family) {
    // Single shared error message — never reveals whether the handle existed.
    throw new ApiError(401, "Wrong handle or password.");
  }

  const token = newSessionToken();
  const now = Date.now();
  await repo.createSession({
    token,
    familyId: family.id,
    createdAt: now,
    lastUsedAt: now,
  });

  return {
    token,
    handle: family.id,
    stateUpdatedAt: family.stateUpdatedAt,
  };
});
