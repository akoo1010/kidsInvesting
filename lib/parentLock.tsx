"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { PARENT_LOCK, STORAGE_KEYS } from "@/lib/constants";

const LOCK_KEY = STORAGE_KEYS.parentLock;
const ATTEMPTS_KEY = STORAGE_KEYS.parentLockAttempts;
const UNLOCK_TTL_MS = PARENT_LOCK.unlockTtlMs;
const MAX_ATTEMPTS = PARENT_LOCK.maxAttempts;
const COOLDOWN_MS = PARENT_LOCK.cooldownMs;
const MIN_PW = PARENT_LOCK.minPasswordLen;

import type { ParentLockSnapshot, ActionResult } from "@/lib/types";
import { formatDuration } from "@/lib/format";

type Stored = ParentLockSnapshot;

type AttemptsState = {
  failedCount: number;
  cooldownUntil: number | null;
};

type Ctx = {
  ready: boolean;
  hasPassword: boolean;
  isUnlocked: boolean;
  failedAttempts: number;
  attemptsRemaining: number;
  cooldownUntil: number | null;
  setPassword: (pw: string) => Promise<ActionResult>;
  changePassword: (oldPw: string, newPw: string) => Promise<ActionResult>;
  unlock: (pw: string) => Promise<ActionResult>;
  lock: () => void;
  // The raw stored snapshot (or null), used by the admin backup-export flow.
  storedSnapshot: ParentLockSnapshot | null;
  // Replace the stored password from an imported backup (or clear it). Does
  // not touch isUnlocked — the next auto-lock or manual lock will re-prompt.
  replaceParentLock: (next: ParentLockSnapshot | null) => void;
};

const LockContext = createContext<Ctx | null>(null);

async function hashPin(pw: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${pw}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ParentLockProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [stored, setStored] = useState<Stored | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempts, setAttempts] = useState<AttemptsState>({
    failedCount: 0,
    cooldownUntil: null,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCK_KEY);
      if (raw) setStored(JSON.parse(raw) as Stored);
    } catch {
    }
    try {
      const rawA = localStorage.getItem(ATTEMPTS_KEY);
      if (rawA) {
        const parsed = JSON.parse(rawA) as AttemptsState;
        // Expire stale cooldowns automatically.
        if (parsed.cooldownUntil && parsed.cooldownUntil < Date.now()) {
          setAttempts({ failedCount: 0, cooldownUntil: null });
          localStorage.removeItem(ATTEMPTS_KEY);
        } else {
          setAttempts(parsed);
        }
      }
    } catch {
    }
    setReady(true);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // While a cooldown is active, tick once per second so the countdown UI
  // refreshes and the cooldown auto-clears when it ends.
  useEffect(() => {
    if (!attempts.cooldownUntil) return;
    const t = setInterval(() => {
      if (attempts.cooldownUntil && attempts.cooldownUntil <= Date.now()) {
        setAttempts({ failedCount: 0, cooldownUntil: null });
        localStorage.removeItem(ATTEMPTS_KEY);
        clearInterval(t);
      } else {
        setTick((n) => n + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [attempts.cooldownUntil]);

  const persistAttempts = useCallback((next: AttemptsState) => {
    setAttempts(next);
    if (next.failedCount === 0 && next.cooldownUntil === null) {
      localStorage.removeItem(ATTEMPTS_KEY);
    } else {
      localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next));
    }
  }, []);

  const scheduleAutoLock = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsUnlocked(false);
      timerRef.current = null;
    }, UNLOCK_TTL_MS);
  }, []);

  const setPassword = useCallback<Ctx["setPassword"]>(
    async (pw) => {
      const trimmed = pw.trim();
      if (trimmed.length < MIN_PW) {
        return {
          ok: false,
          reason: `Pick at least ${MIN_PW} characters.`,
        };
      }
      const salt = randomSalt();
      const hash = await hashPin(trimmed, salt);
      const next: Stored = { salt, hash, setAt: Date.now() };
      localStorage.setItem(LOCK_KEY, JSON.stringify(next));
      setStored(next);
      setIsUnlocked(true);
      persistAttempts({ failedCount: 0, cooldownUntil: null });
      scheduleAutoLock();
      return { ok: true };
    },
    [scheduleAutoLock, persistAttempts],
  );

  const unlock = useCallback<Ctx["unlock"]>(
    async (pw) => {
      if (!stored) return { ok: false, reason: "No password set yet." };
      if (attempts.cooldownUntil && attempts.cooldownUntil > Date.now()) {
        const ms = attempts.cooldownUntil - Date.now();
        return {
          ok: false,
          reason: `Too many tries. Wait ${formatDuration(ms)} before trying again.`,
        };
      }
      const h = await hashPin(pw.trim(), stored.salt);
      if (h !== stored.hash) {
        const failed = attempts.failedCount + 1;
        if (failed >= MAX_ATTEMPTS) {
          persistAttempts({
            failedCount: failed,
            cooldownUntil: Date.now() + COOLDOWN_MS,
          });
          return {
            ok: false,
            reason: `Too many wrong tries. Locked for ${formatDuration(COOLDOWN_MS)}.`,
          };
        }
        persistAttempts({ failedCount: failed, cooldownUntil: null });
        const left = MAX_ATTEMPTS - failed;
        return {
          ok: false,
          reason: `Wrong password. ${left} tr${left === 1 ? "y" : "ies"} left.`,
        };
      }
      persistAttempts({ failedCount: 0, cooldownUntil: null });
      setIsUnlocked(true);
      scheduleAutoLock();
      return { ok: true };
    },
    [stored, attempts, scheduleAutoLock, persistAttempts],
  );

  const lock = useCallback<Ctx["lock"]>(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsUnlocked(false);
  }, []);

  const changePassword = useCallback<Ctx["changePassword"]>(
    async (oldPw, newPw) => {
      if (!stored) return { ok: false, reason: "No password set yet." };
      const h = await hashPin(oldPw.trim(), stored.salt);
      if (h !== stored.hash) {
        return { ok: false, reason: "Old password was wrong." };
      }
      return setPassword(newPw);
    },
    [stored, setPassword],
  );

  const replaceParentLock = useCallback<Ctx["replaceParentLock"]>((next) => {
    if (next === null) {
      localStorage.removeItem(LOCK_KEY);
      setStored(null);
    } else {
      localStorage.setItem(LOCK_KEY, JSON.stringify(next));
      setStored(next);
    }
    persistAttempts({ failedCount: 0, cooldownUntil: null });
  }, [persistAttempts]);

  const cooldownActive =
    !!attempts.cooldownUntil && attempts.cooldownUntil > Date.now();
  const value = useMemo<Ctx>(
    () => ({
      ready,
      hasPassword: !!stored,
      isUnlocked,
      failedAttempts: attempts.failedCount,
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - attempts.failedCount),
      cooldownUntil: cooldownActive ? attempts.cooldownUntil : null,
      setPassword,
      changePassword,
      unlock,
      lock,
      storedSnapshot: stored,
      replaceParentLock,
    }),
    [
      ready,
      stored,
      isUnlocked,
      attempts.failedCount,
      attempts.cooldownUntil,
      cooldownActive,
      setPassword,
      changePassword,
      unlock,
      lock,
      replaceParentLock,
    ],
  );

  return (
    <LockContext.Provider value={value}>{children}</LockContext.Provider>
  );
}

export function useParentLock(): Ctx {
  const ctx = useContext(LockContext);
  if (!ctx) {
    throw new Error("useParentLock must be used inside <ParentLockProvider>");
  }
  return ctx;
}
