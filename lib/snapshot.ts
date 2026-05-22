// Single canonical shape for "all the data we round-trip between the app
// and a server / backup file". Sync and backup-restore both share this so
// validation and types can't drift.

import type { PortfolioState, CubProfile, ParentLockSnapshot } from "@/lib/types";

export const BACKUP_VERSION = 1;
export const APP_TAG = "wall-street-cubs";

export type SyncedSnapshot = {
  portfolios: {
    profiles: CubProfile[];
    currentProfileId: string | null;
    portfolios: Record<string, PortfolioState>;
  };
  parentLock: ParentLockSnapshot | null;
};

export type BackupV1 = {
  version: typeof BACKUP_VERSION;
  app: typeof APP_TAG;
  exportedAt: number;
  snapshot: SyncedSnapshot;
};

export type Preview = {
  data: BackupV1;
  cubNames: string[];
  hasPassword: boolean;
  exportedAt: number;
};


function isObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object";
}

export function validatePortfoliosShape(
  p: unknown
): { ok: true; data: SyncedSnapshot["portfolios"] } | { ok: false; reason: string } {
  if (!isObject(p)) {
    return { ok: false, reason: "Portfolios must be an object." };
  }
  const profiles = p.profiles;
  if (!Array.isArray(profiles)) {
    return { ok: false, reason: "`profiles` must be an array." };
  }
  if (
    p.currentProfileId !== null &&
    typeof p.currentProfileId !== "string"
  ) {
    return {
      ok: false,
      reason: "`currentProfileId` must be a string or null.",
    };
  }
  const portfolios = p.portfolios;
  if (!isObject(portfolios)) {
    return { ok: false, reason: "`portfolios.portfolios` must be an object." };
  }
  for (const prof of profiles) {
    if (
      !isObject(prof) ||
      typeof prof.id !== "string" ||
      typeof prof.name !== "string" ||
      typeof prof.emoji !== "string" ||
      typeof prof.createdAt !== "number"
    ) {
      return { ok: false, reason: "One Cub profile is malformed." };
    }
  }
  // Each per-Cub PortfolioState must at minimum have cash + holdings +
  // watchlist + trades. Optional new fields (goal, valueHistory,
  // achievements) are allowed to be absent.
  for (const [id, state] of Object.entries(portfolios)) {
    if (!isObject(state)) {
      return { ok: false, reason: `Portfolio for ${id} is malformed.` };
    }
    if (typeof state.cash !== "number" || !Number.isFinite(state.cash)) {
      return { ok: false, reason: `Portfolio for ${id} has invalid cash.` };
    }
    const holdings = state.holdings;
    if (!isObject(holdings)) {
      return { ok: false, reason: `Portfolio for ${id} has invalid holdings.` };
    }
    if (!Array.isArray(state.watchlist)) {
      return {
        ok: false,
        reason: `Portfolio for ${id} has invalid watchlist.`,
      };
    }
    if (!Array.isArray(state.trades)) {
      return { ok: false, reason: `Portfolio for ${id} has invalid trades.` };
    }
  }
  return { ok: true, data: p as SyncedSnapshot["portfolios"] };
}

// Validator used by both the backup-restore flow and the server's
// `PUT /api/sync/state` endpoint. Returns the typed snapshot on success or
// a friendly error message on failure. Intentionally permissive about
// inner PortfolioState shape (newer optional fields like `valueHistory`
// might or might not be present in older snapshots).
export function validateSnapshot(
  raw: unknown,
): { ok: true; snapshot: SyncedSnapshot } | { ok: false; reason: string } {
  if (!isObject(raw)) {
    return { ok: false, reason: "Snapshot must be an object." };
  }
  const p = raw.portfolios;
  if (!isObject(p)) {
    return { ok: false, reason: "Snapshot is missing `portfolios`." };
  }
  
  const portfoliosResult = validatePortfoliosShape(p);
  if (!portfoliosResult.ok) {
    return portfoliosResult;
  }

  // Parent lock is nullable; if present, it must have salt/hash/setAt.
  const pl = raw.parentLock;
  if (pl !== null && pl !== undefined) {
    if (
      !isObject(pl) ||
      typeof pl.salt !== "string" ||
      typeof pl.hash !== "string" ||
      typeof pl.setAt !== "number"
    ) {
      return { ok: false, reason: "Parent lock snapshot is malformed." };
    }
  }
  return { ok: true, snapshot: raw as SyncedSnapshot };
}

export function normalizeBackup(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  if (raw.app !== APP_TAG) return raw;
  if ("snapshot" in raw) return raw;

  if ("portfolios" in raw || "parentLock" in raw) {
    const { portfolios, parentLock, ...rest } = raw;
    return {
      ...rest,
      snapshot: {
        portfolios,
        parentLock: parentLock ?? null,
      },
    };
  }
  return raw;
}
