import { RATE_LIMIT } from "@/lib/constants";
import {
  hashPassword,
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
    clientKey(req, "register"),
    RATE_LIMIT.registerMaxPerWindow,
  );
  if (!limit.ok) {
    throw new ApiError(
      429,
      "Too many sign-up attempts. Try again later.",
      { retryAfterMs: limit.retryAfterMs },
    );
  }

  const body = await parseJsonBody<{ handle?: unknown; password?: unknown }>(
    req,
    4096,
  );

  const handle = normalizeHandle(body.handle);
  if (!handle) {
    throw new ApiError(
      400,
      "Handle must be 3–20 characters: lowercase letters, digits, _ or -, starting with a letter or digit.",
    );
  }
  if (!isValidPassword(body.password)) {
    throw new ApiError(
      400,
      "Password must be 6–200 characters.",
    );
  }

  const repo = getRepository();
  if (await repo.getFamilyById(handle)) {
    throw new ApiError(
      409,
      "That family handle is already taken — pick another.",
    );
  }

  const { hash, salt } = await hashPassword(body.password);
  const now = Date.now();
  await repo.createFamily({
    id: handle,
    passwordHash: hash,
    passwordSalt: salt,
    state: null,
    stateUpdatedAt: 0,
    createdAt: now,
  });

  const token = newSessionToken();
  await repo.createSession({
    token,
    familyId: handle,
    createdAt: now,
    lastUsedAt: now,
  });

  return { token, handle, stateUpdatedAt: 0 };
});
