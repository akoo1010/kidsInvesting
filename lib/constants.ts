// Single source of truth for storage keys, time intervals, validation
// bounds, and server limits. Anything used in more than one place lives here.

// ---- Money / portfolio ---------------------------------------------------

export const STARTING_CASH_AMOUNT = 10_000;

// ---- localStorage keys (client) ------------------------------------------
// Bumping a version means "shape changed, ignore old data" — see migration
// notes in each provider.

export const STORAGE_KEYS = {
  profiles: "wsc.profiles.v2",
  parentLock: "wsc.parentLock.v1",
  parentLockAttempts: "wsc.parentLockAttempts.v1",
  sync: "wsc.sync.v1",
} as const;

// ---- Parent lock (device-local) ------------------------------------------

export const PARENT_LOCK = {
  unlockTtlMs: 5 * 60 * 1000,
  maxAttempts: 5,
  cooldownMs: 10 * 60 * 1000,
  minPasswordLen: 4,
} as const;

// ---- Sync (cross-device) -------------------------------------------------

export const SYNC = {
  pushDebounceMs: 1_500,
  sessionTtlMs: 60 * 24 * 60 * 60 * 1000, // 60 days
  // Server-side caps.
  maxStateBytes: 2 * 1024 * 1024,
  // Allow at most a small skew so a malicious client can't poison the
  // future with `stateUpdatedAt = Date.MAX_VALUE`.
  maxStatePastSkewMs: 7 * 24 * 60 * 60 * 1000, // accept up to 7d old (clock skew)
  maxStateFutureSkewMs: 60 * 60 * 1000, // accept up to 1h ahead
  // Auth password bounds.
  minPasswordLen: 6,
  maxPasswordLen: 200,
  // Handle: 3-20 chars, lowercase letters/digits/_/-, must start alnum.
  handleRegex: /^[a-z0-9][a-z0-9_-]{2,19}$/,
} as const;

// ---- Per-IP rate limit (sync auth endpoints) -----------------------------

export const RATE_LIMIT = {
  loginMaxPerWindow: 10,
  registerMaxPerWindow: 5,
  windowMs: 10 * 60 * 1000, // 10 minutes
} as const;

// ---- Server env ----------------------------------------------------------

export const ENV = {
  dataDir: "WSC_DATA_DIR",
  trustedOrigins: "WSC_TRUSTED_ORIGINS", // CSV of allowed Origin headers
} as const;
