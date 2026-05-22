"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { STARTING_CASH_AMOUNT, STORAGE_KEYS } from "@/lib/constants";

import type { Lot, Trade, Goal, ValueSnapshot, PortfolioState, CubProfile, ActionResult } from "@/lib/types";
import { validatePortfoliosShape } from "@/lib/snapshot";

type Store = {
  profiles: CubProfile[];
  currentProfileId: string | null;
  portfolios: Record<string, PortfolioState>;
};

const DEFAULT_PORTFOLIO: PortfolioState = {
  cash: STARTING_CASH_AMOUNT,
  holdings: {},
  watchlist: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "DIS"],
  trades: [],
};

const EMPTY_STORE: Store = {
  profiles: [],
  currentProfileId: null,
  portfolios: {},
};

export const AVAILABLE_EMOJIS = [
  "🐻","🦊","🐯","🐼","🦁","🐸","🐵","🐧","🦄","🐲","🦖","🐙","🐳","🐝","🦉",
];

type Ctx = {
  ready: boolean;
  profiles: CubProfile[];
  portfolios: Record<string, PortfolioState>;
  currentProfile: CubProfile | null;
  state: PortfolioState;
  switchProfile: (id: string) => void;
  createProfile: (name: string, emoji: string) => CubProfile | null;
  deleteProfile: (id: string) => void;
  renameProfile: (id: string, name: string, emoji: string) => void;
  signOut: () => void;
  buy: (symbol: string, shares: number, price: number, note?: string) => ActionResult;
  sell: (symbol: string, shares: number, price: number, note?: string) => ActionResult;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  resetProfile: (id: string) => void;
  setGoal: (target: number, deadlineMs: number | null) => void;
  clearGoal: () => void;
  recordTodayValue: (value: number) => void;
  awardAchievements: (ids: string[]) => void;
  markLessonComplete: (id: string) => void;
  resetLessonProgress: () => void;
  // Wholesale replacement, used by the admin backup-import flow. The caller
  // is responsible for validating the shape.
  replaceStore: (next: {
    profiles: CubProfile[];
    currentProfileId: string | null;
    portfolios: Record<string, PortfolioState>;
  }) => void;
};

const PortfolioContext = createContext<Ctx | null>(null);

function freshPortfolio(): PortfolioState {
  return {
    cash: DEFAULT_PORTFOLIO.cash,
    holdings: {},
    watchlist: [...DEFAULT_PORTFOLIO.watchlist],
    trades: [],
    goal: null,
    valueHistory: [],
    achievements: {},
    lessonsCompleted: {},
  };
}

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object";
}

function isValidStore(raw: unknown): raw is Store {
  return validatePortfoliosShape(raw).ok;
}

function migrateStore(store: Store): Store {
  const updatedPortfolios = { ...store.portfolios };
  let storeModified = false;
  for (const [profileId, portfolio] of Object.entries(store.portfolios)) {
    if (!portfolio || !portfolio.holdings) continue;
    let holdingsModified = false;
    const updatedHoldings = { ...portfolio.holdings };
    
    const profile = store.profiles.find((p) => p.id === profileId);
    const fallbackTime = profile ? profile.createdAt : Date.now();

    for (const [symbol, lot] of Object.entries(portfolio.holdings)) {
      if (lot.firstAcquiredAt === undefined) {
        let oldestBuyTime: number | null = null;
        if (Array.isArray(portfolio.trades)) {
          for (const t of portfolio.trades) {
            if (t.side === "buy" && t.symbol === symbol) {
              if (oldestBuyTime === null || t.timestamp < oldestBuyTime) {
                oldestBuyTime = t.timestamp;
              }
            }
          }
        }
        updatedHoldings[symbol] = {
          ...lot,
          firstAcquiredAt: oldestBuyTime ?? fallbackTime,
        };
        holdingsModified = true;
      }
    }
    if (holdingsModified) {
      updatedPortfolios[profileId] = {
        ...portfolio,
        holdings: updatedHoldings,
      };
      storeModified = true;
    }
  }
  return storeModified
    ? { ...store, portfolios: updatedPortfolios }
    : store;
}

function loadStore(): Store {
  if (typeof window === "undefined") return EMPTY_STORE;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profiles);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isValidStore(parsed)) {
        const store: Store = {
          profiles: parsed.profiles ?? [],
          currentProfileId: parsed.currentProfileId ?? null,
          portfolios: parsed.portfolios ?? {},
        };
        return migrateStore(store);
      }
    }
  } catch {
  }
  return EMPTY_STORE;
}

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>(EMPTY_STORE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStore(loadStore());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEYS.profiles, JSON.stringify(store));
    } catch {
      // localStorage can throw on quota or in private modes — best effort.
    }
  }, [store, ready]);

  const currentProfile =
    store.profiles.find((p) => p.id === store.currentProfileId) ?? null;
  const state: PortfolioState =
    (currentProfile && store.portfolios[currentProfile.id]) ||
    DEFAULT_PORTFOLIO;

  const updateCurrent = useCallback(
    (updater: (prev: PortfolioState) => PortfolioState) => {
      setStore((prev) => {
        if (!prev.currentProfileId) return prev;
        const existing = prev.portfolios[prev.currentProfileId] ?? freshPortfolio();
        return {
          ...prev,
          portfolios: {
            ...prev.portfolios,
            [prev.currentProfileId]: updater(existing),
          },
        };
      });
    },
    [],
  );

  const switchProfile = useCallback<Ctx["switchProfile"]>((id) => {
    setStore((prev) =>
      prev.profiles.some((p) => p.id === id)
        ? { ...prev, currentProfileId: id }
        : prev,
    );
  }, []);

  const createProfile = useCallback<Ctx["createProfile"]>((name, emoji) => {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) return null;
    const profile: CubProfile = {
      id: crypto.randomUUID(),
      name: trimmed,
      emoji: emoji || "🐻",
      createdAt: Date.now(),
    };
    setStore((prev) => ({
      profiles: [...prev.profiles, profile],
      currentProfileId: profile.id,
      portfolios: { ...prev.portfolios, [profile.id]: freshPortfolio() },
    }));
    return profile;
  }, []);

  const deleteProfile = useCallback<Ctx["deleteProfile"]>((id) => {
    setStore((prev) => {
      const profiles = prev.profiles.filter((p) => p.id !== id);
      const portfolios = { ...prev.portfolios };
      delete portfolios[id];
      const currentProfileId =
        prev.currentProfileId === id
          ? profiles[0]?.id ?? null
          : prev.currentProfileId;
      return { profiles, currentProfileId, portfolios };
    });
  }, []);

  const renameProfile = useCallback<Ctx["renameProfile"]>(
    (id, name, emoji) => {
      const trimmed = name.trim().slice(0, 20);
      if (!trimmed) return;
      setStore((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === id ? { ...p, name: trimmed, emoji: emoji || p.emoji } : p,
        ),
      }));
    },
    [],
  );

  const signOut = useCallback<Ctx["signOut"]>(() => {
    setStore((prev) => ({ ...prev, currentProfileId: null }));
  }, []);

  const buy = useCallback<Ctx["buy"]>((symbol, shares, price, note) => {
    symbol = symbol.toUpperCase();
    if (!Number.isFinite(shares) || shares <= 0) {
      return { ok: false, reason: "Pick a number of shares greater than 0." };
    }
    const cost = shares * price;
    let result: ActionResult = { ok: true };
    updateCurrent((prev) => {
      if (cost > prev.cash + 1e-6) {
        result = {
          ok: false,
          reason: `Not enough cash. You need ${cost.toFixed(2)} but have ${prev.cash.toFixed(2)}.`,
        };
        return prev;
      }
      const existing = prev.holdings[symbol];
      const now = Date.now();
      const trade: Trade = {
        id: crypto.randomUUID(),
        symbol,
        side: "buy",
        shares,
        price,
        timestamp: now,
        ...(note?.trim() ? { note: note.trim().slice(0, 140) } : {}),
      };
      const nextLot: Lot = existing && existing.shares > 1e-9
        ? {
            shares: existing.shares + shares,
            costBasis: existing.costBasis + cost,
            firstAcquiredAt: existing.firstAcquiredAt ?? now,
          }
        : { shares, costBasis: cost, firstAcquiredAt: now };
      return {
        ...prev,
        cash: prev.cash - cost,
        holdings: { ...prev.holdings, [symbol]: nextLot },
        trades: [trade, ...prev.trades].slice(0, 100),
      };
    });
    return result;
  }, [updateCurrent]);

  const sell = useCallback<Ctx["sell"]>((symbol, shares, price, note) => {
    symbol = symbol.toUpperCase();
    if (!Number.isFinite(shares) || shares <= 0) {
      return { ok: false, reason: "Pick a number of shares greater than 0." };
    }
    let result: ActionResult = { ok: true };
    updateCurrent((prev) => {
      const existing = prev.holdings[symbol];
      if (!existing || existing.shares < shares - 1e-9) {
        result = {
          ok: false,
          reason: `You only own ${existing?.shares ?? 0} shares of ${symbol}.`,
        };
        return prev;
      }
      const proceeds = shares * price;
      const remainingShares = existing.shares - shares;
      const remainingBasis =
        existing.shares === 0
          ? 0
          : existing.costBasis * (remainingShares / existing.shares);
      const nextHoldings = { ...prev.holdings };
      if (remainingShares < 1e-9) {
        delete nextHoldings[symbol];
      } else {
        nextHoldings[symbol] = {
          shares: remainingShares,
          costBasis: remainingBasis,
          firstAcquiredAt: existing.firstAcquiredAt,
        };
      }
      const trade: Trade = {
        id: crypto.randomUUID(),
        symbol,
        side: "sell",
        shares,
        price,
        timestamp: Date.now(),
        ...(note?.trim() ? { note: note.trim().slice(0, 140) } : {}),
      };
      return {
        ...prev,
        cash: prev.cash + proceeds,
        holdings: nextHoldings,
        trades: [trade, ...prev.trades].slice(0, 100),
      };
    });
    return result;
  }, [updateCurrent]);

  const setGoal = useCallback<Ctx["setGoal"]>((target, deadlineMs) => {
    if (!Number.isFinite(target) || target <= 0) return;
    updateCurrent((prev) => ({
      ...prev,
      goal: { target, deadline: deadlineMs, setAt: Date.now() },
    }));
  }, [updateCurrent]);

  const clearGoal = useCallback<Ctx["clearGoal"]>(() => {
    updateCurrent((prev) => ({ ...prev, goal: null }));
  }, [updateCurrent]);

  const recordTodayValue = useCallback<Ctx["recordTodayValue"]>((value) => {
    if (!Number.isFinite(value)) return;
    const date = todayUtcDateString();
    updateCurrent((prev) => {
      const history = prev.valueHistory ?? [];
      const last = history[history.length - 1];
      if (last && last.date === date) {
        // Keep the latest value for today so the chart reflects current state.
        if (Math.abs(last.value - value) < 1e-6) return prev;
        const next = history.slice(0, -1).concat({ date, value });
        return { ...prev, valueHistory: next };
      }
      const next = history.concat({ date, value }).slice(-90);
      return { ...prev, valueHistory: next };
    });
  }, [updateCurrent]);

  const markLessonComplete = useCallback<Ctx["markLessonComplete"]>((id) => {
    if (!id) return;
    updateCurrent((prev) => {
      const existing = prev.lessonsCompleted ?? {};
      if (id in existing) return prev;
      return {
        ...prev,
        lessonsCompleted: { ...existing, [id]: Date.now() },
      };
    });
  }, [updateCurrent]);

  const resetLessonProgress = useCallback<Ctx["resetLessonProgress"]>(() => {
    updateCurrent((prev) =>
      prev.lessonsCompleted && Object.keys(prev.lessonsCompleted).length > 0
        ? { ...prev, lessonsCompleted: {} }
        : prev,
    );
  }, [updateCurrent]);

  const awardAchievements = useCallback<Ctx["awardAchievements"]>((ids) => {
    if (ids.length === 0) return;
    updateCurrent((prev) => {
      const existing = prev.achievements ?? {};
      let changed = false;
      const next: Record<string, number> = { ...existing };
      const now = Date.now();
      for (const id of ids) {
        if (!(id in next)) {
          next[id] = now;
          changed = true;
        }
      }
      return changed ? { ...prev, achievements: next } : prev;
    });
  }, [updateCurrent]);

  const addToWatchlist = useCallback<Ctx["addToWatchlist"]>((symbol) => {
    const s = symbol.toUpperCase();
    updateCurrent((prev) =>
      prev.watchlist.includes(s)
        ? prev
        : { ...prev, watchlist: [...prev.watchlist, s] },
    );
  }, [updateCurrent]);

  const removeFromWatchlist = useCallback<Ctx["removeFromWatchlist"]>(
    (symbol) => {
      const s = symbol.toUpperCase();
      updateCurrent((prev) => ({
        ...prev,
        watchlist: prev.watchlist.filter((x) => x !== s),
      }));
    },
    [updateCurrent],
  );

  const replaceStore = useCallback<Ctx["replaceStore"]>((next) => {
    setStore({
      profiles: next.profiles,
      currentProfileId: next.currentProfileId,
      portfolios: next.portfolios,
    });
  }, []);

  const resetProfile = useCallback<Ctx["resetProfile"]>((id) => {
    setStore((prev) =>
      prev.profiles.some((p) => p.id === id)
        ? {
            ...prev,
            portfolios: { ...prev.portfolios, [id]: freshPortfolio() },
          }
        : prev,
    );
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      profiles: store.profiles,
      portfolios: store.portfolios,
      currentProfile,
      state,
      switchProfile,
      createProfile,
      deleteProfile,
      renameProfile,
      signOut,
      buy,
      sell,
      addToWatchlist,
      removeFromWatchlist,
      resetProfile,
      setGoal,
      clearGoal,
      recordTodayValue,
      awardAchievements,
      markLessonComplete,
      resetLessonProgress,
      replaceStore,
    }),
    [
      ready,
      store.profiles,
      store.portfolios,
      currentProfile,
      state,
      switchProfile,
      createProfile,
      deleteProfile,
      renameProfile,
      signOut,
      buy,
      sell,
      addToWatchlist,
      removeFromWatchlist,
      resetProfile,
      setGoal,
      clearGoal,
      recordTodayValue,
      awardAchievements,
      markLessonComplete,
      resetLessonProgress,
      replaceStore,
    ],
  );

  return (
    <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
  );
}

export function usePortfolio(): Ctx {
  const ctx = useContext(PortfolioContext);
  if (!ctx) {
    throw new Error("usePortfolio must be used inside <PortfolioProvider>");
  }
  return ctx;
}
