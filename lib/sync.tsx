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
import { STORAGE_KEYS, SYNC } from "@/lib/constants";
import { usePortfolio } from "@/lib/portfolio";
import { useParentLock } from "@/lib/parentLock";
import type { SyncedSnapshot } from "@/lib/snapshot";

const SYNC_KEY = STORAGE_KEYS.sync;
const PUSH_DEBOUNCE_MS = SYNC.pushDebounceMs;

import type { SyncStatus, ActionResult } from "@/lib/types";

type SyncAuth = { token: string; handle: string };

type Ctx = {
  ready: boolean;
  status: SyncStatus;
  signedInAs: string | null;
  lastSyncedAt: number | null;
  errorMessage: string | null;
  register: (handle: string, password: string) => Promise<ActionResult>;
  signIn: (handle: string, password: string) => Promise<ActionResult>;
  signOut: () => Promise<void>;
  pullNow: () => Promise<ActionResult>;
};

const SyncContext = createContext<Ctx | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const portfolio = usePortfolio();
  const lock = useParentLock();

  const [auth, setAuth] = useState<SyncAuth | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // The snapshot string we last successfully reconciled with the server.
  // Used to decide whether the current local state needs pushing, and to
  // avoid echoing a freshly-pulled state right back to the server.
  const lastReconciledRef = useRef<string>("");
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SYNC_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SyncAuth;
        if (parsed?.token && parsed?.handle) setAuth(parsed);
      }
    } catch {
    }
    setReady(true);
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, []);

  // Persist auth changes
  useEffect(() => {
    if (!ready) return;
    if (auth) {
      localStorage.setItem(SYNC_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(SYNC_KEY);
    }
  }, [auth, ready]);

  const snapshot: SyncedSnapshot = useMemo(
    () => ({
      portfolios: {
        profiles: portfolio.profiles,
        currentProfileId: portfolio.currentProfile?.id ?? null,
        portfolios: portfolio.portfolios,
      },
      parentLock: lock.storedSnapshot,
    }),
    [
      portfolio.profiles,
      portfolio.portfolios,
      portfolio.currentProfile?.id,
      lock.storedSnapshot,
    ],
  );

  const snapshotJson = useMemo(() => JSON.stringify(snapshot), [snapshot]);

  const applyServerState = useCallback(
    (state: SyncedSnapshot | null, serverTs: number) => {
      if (state) {
        portfolio.replaceStore(state.portfolios);
        lock.replaceParentLock(state.parentLock);
        lastReconciledRef.current = JSON.stringify(state);
      }
      setLastSyncedAt(serverTs || null);
    },
    [portfolio, lock],
  );

  // Pull on (re)connect — fires when auth becomes set or providers ready.
  useEffect(() => {
    if (!ready || !auth || !portfolio.ready || !lock.ready) return;
    let cancelled = false;
    (async () => {
      setStatus("syncing");
      setErrorMessage(null);
      try {
        const r = await fetch("/api/sync/state", {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (cancelled) return;
        if (r.status === 401) {
          setAuth(null);
          setStatus("idle");
          return;
        }
        if (!r.ok) {
          setStatus("error");
          setErrorMessage(`Server returned ${r.status}.`);
          return;
        }
        const data = (await r.json()) as {
          state: SyncedSnapshot | null;
          stateUpdatedAt: number;
        };
        if (data.state && data.stateUpdatedAt > 0) {
          applyServerState(data.state, data.stateUpdatedAt);
        } else {
          // Fresh family — server has nothing yet. Force a push of local.
          lastReconciledRef.current = "";
        }
        setStatus("synced");
      } catch (err) {
        console.error("Failed to pull sync state from server:", err);
        if (!cancelled) {
          setStatus("offline");
          setErrorMessage("Could not reach the server.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-pull only when auth or provider-readiness changes.
  }, [auth, ready, portfolio.ready, lock.ready, applyServerState]);

  // Push on local state changes, debounced.
  useEffect(() => {
    if (!auth || !ready || !portfolio.ready || !lock.ready) return;
    if (snapshotJson === lastReconciledRef.current) return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      setStatus("syncing");
      const ts = Date.now();
      try {
        const r = await fetch("/api/sync/state", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${auth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ state: snapshot, stateUpdatedAt: ts }),
        });
        if (r.status === 401) {
          setAuth(null);
          setStatus("idle");
          return;
        }
        if (r.status === 409) {
          const data = (await r.json()) as {
            state: SyncedSnapshot | null;
            stateUpdatedAt: number;
          };
          applyServerState(data.state, data.stateUpdatedAt);
          setStatus("synced");
          setErrorMessage(
            "Another device had newer changes — applied them locally.",
          );
          return;
        }
        if (!r.ok) {
          setStatus("error");
          setErrorMessage(`Server returned ${r.status}.`);
          return;
        }
        lastReconciledRef.current = snapshotJson;
        setLastSyncedAt(ts);
        setStatus("synced");
        setErrorMessage(null);
      } catch (err) {
        console.error("Failed to push sync state to server:", err);
        setStatus("offline");
        setErrorMessage("Could not reach the server.");
      }
    }, PUSH_DEBOUNCE_MS);
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [snapshotJson, snapshot, auth, ready, portfolio.ready, lock.ready, applyServerState]);

  const register = useCallback<Ctx["register"]>(async (handle, password) => {
    try {
      const r = await fetch("/api/sync/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, password }),
      });
      const data = await r.json();
      if (!r.ok) {
        return { ok: false, reason: data.error ?? `Sign-up failed (${r.status}).` };
      }
      setAuth({ token: data.token, handle: data.handle });
      setLastSyncedAt(data.stateUpdatedAt ?? null);
      setErrorMessage(null);
      // Force a push of whatever's local now to seed the server.
      lastReconciledRef.current = "";
      return { ok: true };
    } catch (err) {
      console.error("Failed to register family handle:", err);
      return { ok: false, reason: "Could not reach the server." };
    }
  }, []);

  const signIn = useCallback<Ctx["signIn"]>(async (handle, password) => {
    try {
      const r = await fetch("/api/sync/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, password }),
      });
      const data = await r.json();
      if (!r.ok) {
        return { ok: false, reason: data.error ?? `Sign-in failed (${r.status}).` };
      }
      setAuth({ token: data.token, handle: data.handle });
      setLastSyncedAt(data.stateUpdatedAt ?? null);
      setErrorMessage(null);
      return { ok: true };
    } catch (err) {
      console.error("Failed to sign in family handle:", err);
      return { ok: false, reason: "Could not reach the server." };
    }
  }, []);

  const signOut = useCallback<Ctx["signOut"]>(async () => {
    if (auth) {
      try {
        await fetch("/api/sync/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${auth.token}` },
        });
      } catch (err) {
        console.error("Failed to cleanly log out from server:", err);
      }
    }
    setAuth(null);
    setLastSyncedAt(null);
    setErrorMessage(null);
    setStatus("idle");
    lastReconciledRef.current = "";
  }, [auth]);

  const pullNow = useCallback<Ctx["pullNow"]>(async () => {
    if (!auth) return { ok: false, reason: "Not signed in." };
    try {
      const r = await fetch("/api/sync/state", {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (r.status === 401) {
        setAuth(null);
        return { ok: false, reason: "Session expired — sign in again." };
      }
      if (!r.ok) {
        return { ok: false, reason: `Server returned ${r.status}.` };
      }
      const data = (await r.json()) as {
        state: SyncedSnapshot | null;
        stateUpdatedAt: number;
      };
      applyServerState(data.state, data.stateUpdatedAt);
      setStatus("synced");
      setErrorMessage(null);
      return { ok: true };
    } catch (err) {
      console.error("Failed to manually pull sync state from server:", err);
      setStatus("offline");
      return { ok: false, reason: "Could not reach the server." };
    }
  }, [auth, applyServerState]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      status,
      signedInAs: auth?.handle ?? null,
      lastSyncedAt,
      errorMessage,
      register,
      signIn,
      signOut,
      pullNow,
    }),
    [
      ready,
      status,
      auth,
      lastSyncedAt,
      errorMessage,
      register,
      signIn,
      signOut,
      pullNow,
    ],
  );

  return (
    <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
  );
}

export function useSync(): Ctx {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useSync must be used inside <SyncProvider>");
  }
  return ctx;
}
