"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortfolio } from "@/lib/portfolio";
import { STARTING_CASH_AMOUNT } from "@/lib/constants";
import { formatChange, formatMoney, formatPercent, gainColor } from "@/lib/format";
import { MoodBadge } from "@/components/MoodBadge";
import { moodForHoldings, type Mood } from "@/lib/mood";
import { useQuotes } from "@/lib/useQuotes";

type Row = {
  id: string;
  name: string;
  emoji: string;
  totalValue: number;
  gain: number;
  gainPct: number;
  trades: number;
  mood: Mood;
  isCurrent: boolean;
};

export function Leaderboard() {
  const { ready, profiles, portfolios, currentProfile } = usePortfolio();

  const allSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      const port = portfolios[p.id];
      if (!port) continue;
      for (const sym of Object.keys(port.holdings)) set.add(sym);
    }
    return Array.from(set).sort();
  }, [profiles, portfolios]);

  const { quotesMap: quotes, loading } = useQuotes(allSymbols, ready);

  const rows: Row[] = profiles
    .map((p) => {
      const port = portfolios[p.id];
      if (!port) {
        return {
          id: p.id,
          name: p.name,
          emoji: p.emoji,
          totalValue: STARTING_CASH_AMOUNT,
          gain: 0,
          gainPct: 0,
          trades: 0,
          mood: moodForHoldings({}, {}),
          isCurrent: p.id === currentProfile?.id,
        };
      }
      // While quotes are still loading we fall back to each lot's cost
      // basis so the ranking shows ~0% rather than wildly-wrong losses.
      let invested = 0;
      for (const [sym, lot] of Object.entries(port.holdings)) {
        const q = quotes[sym];
        invested += q ? q.price * lot.shares : lot.costBasis;
      }
      const totalValue = port.cash + invested;
      const gain = totalValue - STARTING_CASH_AMOUNT;
      const gainPct = (gain / STARTING_CASH_AMOUNT) * 100;
      return {
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        totalValue,
        gain,
        gainPct,
        trades: port.trades.length,
        mood: moodForHoldings(port.holdings, quotes),
        isCurrent: p.id === currentProfile?.id,
      };
    })
    .sort((a, b) => b.gainPct - a.gainPct);

  if (!ready) {
    return <div className="card p-6 animate-pulse h-40" />;
  }

  if (profiles.length === 0) {
    return (
      <div className="card p-6 text-slate-700 text-sm">
        No Cubs yet. Ask a parent to add one.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="card p-6 flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">🏆 Leaderboard</h1>
        <p className="text-slate-700">
          Who&apos;s growing their pretend $10,000 fastest? Total return
          percentage decides the winner.
        </p>
      </header>

      <ol className="flex flex-col gap-3">
        {rows.map((r, idx) => {
          const place = idx + 1;
          const medal =
            place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "";
          return (
            <li
              key={r.id}
              className={`card p-5 flex items-center gap-4 ${
                r.isCurrent ? "ring-2 ring-indigo-300" : ""
              }`}
            >
              <div className="text-2xl w-10 text-center font-bold text-slate-700">
                {medal || `#${place}`}
              </div>
              <span
                className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-3xl"
                aria-hidden="true"
              >
                {r.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg">{r.name}</span>
                  {r.isCurrent && (
                    <span className="chip !bg-indigo-100 !text-indigo-800">
                      You
                    </span>
                  )}
                  <MoodBadge mood={r.mood} size="sm" />
                </div>
                <div className="text-xs text-slate-700">
                  {r.trades} trade{r.trades === 1 ? "" : "s"}
                  {loading && allSymbols.length > 0 && (
                    <span className="ml-2 text-slate-500">· refreshing…</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-extrabold tabular-nums">
                  {formatMoney(r.totalValue)}
                </div>
                <div
                  className={`text-sm font-semibold ${gainColor(r.gain)} tabular-nums`}
                >
                  {formatChange(r.gain)} ({formatPercent(r.gainPct)})
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-slate-700 text-center">
        Want to climb? Open{" "}
        <a className="text-indigo-700 hover:underline" href="/explore">
          Explore
        </a>{" "}
        and pick a stock you believe in.
      </p>
    </div>
  );
}
