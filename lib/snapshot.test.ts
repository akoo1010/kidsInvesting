import { describe, expect, it } from "vitest";
import { APP_TAG, normalizeBackup, validateSnapshot } from "@/lib/snapshot";

function validSnapshot() {
  return {
    portfolios: {
      profiles: [{ id: "cub-1", name: "Sam", emoji: "🐻", createdAt: 1 }],
      currentProfileId: "cub-1",
      portfolios: {
        "cub-1": { cash: 10_000, holdings: {}, watchlist: ["AAPL"], trades: [] },
      },
    },
    parentLock: { salt: "abc", hash: "def", setAt: 1 },
  };
}

describe("validateSnapshot", () => {
  it("accepts a well-formed snapshot", () => {
    const result = validateSnapshot(validSnapshot());
    expect(result.ok).toBe(true);
  });

  it("accepts a snapshot with no parent lock", () => {
    expect(validateSnapshot({ ...validSnapshot(), parentLock: null }).ok).toBe(true);
  });

  it.each([
    ["a non-object", "nope", "Snapshot must be an object."],
    ["missing portfolios", { parentLock: null }, "Snapshot is missing `portfolios`."],
  ])("rejects %s", (_label, raw, reason) => {
    expect(validateSnapshot(raw)).toEqual({ ok: false, reason });
  });

  it("rejects a malformed profile", () => {
    const snap = validSnapshot();
    (snap.portfolios.profiles[0] as { name: unknown }).name = 42;
    expect(validateSnapshot(snap)).toEqual({
      ok: false,
      reason: "One Cub profile is malformed.",
    });
  });

  it("rejects non-finite cash", () => {
    const snap = validSnapshot();
    snap.portfolios.portfolios["cub-1"].cash = Number.POSITIVE_INFINITY;
    expect(validateSnapshot(snap)).toEqual({
      ok: false,
      reason: "Portfolio for cub-1 has invalid cash.",
    });
  });

  it("rejects a malformed parent lock", () => {
    const snap = { ...validSnapshot(), parentLock: { salt: "abc" } };
    expect(validateSnapshot(snap)).toEqual({
      ok: false,
      reason: "Parent lock snapshot is malformed.",
    });
  });
});

describe("normalizeBackup", () => {
  it("wraps a legacy flat backup into the snapshot shape", () => {
    const { portfolios, parentLock } = validSnapshot();
    const legacy = { app: APP_TAG, version: 1, exportedAt: 5, portfolios, parentLock };
    expect(normalizeBackup(legacy)).toEqual({
      app: APP_TAG,
      version: 1,
      exportedAt: 5,
      snapshot: { portfolios, parentLock },
    });
  });

  it("leaves current-format and foreign files untouched", () => {
    const current = { app: APP_TAG, version: 1, snapshot: validSnapshot() };
    expect(normalizeBackup(current)).toBe(current);
    const foreign = { app: "something-else", portfolios: {} };
    expect(normalizeBackup(foreign)).toBe(foreign);
  });
});
