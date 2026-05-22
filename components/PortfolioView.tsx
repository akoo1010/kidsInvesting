"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePortfolio } from "@/lib/portfolio";
import { STARTING_CASH_AMOUNT } from "@/lib/constants";
import { evaluateAchievements } from "@/lib/achievements";
import {
  formatChange,
  formatMoney,
  formatPercent,
  gainColor,
} from "@/lib/format";
import { useQuotes } from "@/lib/useQuotes";
import { PortfolioChart } from "@/components/PortfolioChart";
import { GoalCard } from "@/components/GoalCard";
import { AchievementGrid } from "@/components/AchievementGrid";
import { SectorBreakdown } from "@/components/SectorBreakdown";
import { MoodBadge } from "@/components/MoodBadge";
import { moodForHoldings } from "@/lib/mood";

export function PortfolioView() {
  const {
    state,
    ready,
    currentProfile,
    setGoal,
    clearGoal,
    recordTodayValue,
    awardAchievements,
  } = usePortfolio();

  const symbols = useMemo(() => Object.keys(state.holdings), [state.holdings]);

  const { quotesMap: quotes, loading } = useQuotes(symbols, ready);

  const rows = symbols.map((sym) => {
    const lot = state.holdings[sym];
    const q = quotes[sym];
    const price = q?.price ?? 0;
    const value = lot.shares * price;
    const gain = value - lot.costBasis;
    const gainPct = lot.costBasis > 0 ? (gain / lot.costBasis) * 100 : 0;
    return { sym, lot, q, price, value, gain, gainPct };
  });

  const investedValue = rows.reduce((acc, r) => acc + r.value, 0);
  const totalValue = state.cash + investedValue;
  const totalGain = totalValue - STARTING_CASH_AMOUNT;
  const totalGainPct = (totalGain / STARTING_CASH_AMOUNT) * 100;
  const showQuotePlaceholders = loading && symbols.length > 0;

  // Once we know the current value, snapshot it for today and re-evaluate
  // achievements. Both actions are idempotent — they only persist diffs.
  const quotesReady = symbols.length === 0 || !loading;
  useEffect(() => {
    if (!ready || !currentProfile || !quotesReady) return;
    recordTodayValue(totalValue);
    const earned = evaluateAchievements(state, totalValue);
    const existing = state.achievements ?? {};
    const newOnes = earned.filter((id) => !(id in existing));
    if (newOnes.length > 0) awardAchievements(newOnes);
  }, [
    ready,
    currentProfile,
    quotesReady,
    totalValue,
    state,
    recordTodayValue,
    awardAchievements,
  ]);

  return (
    <div className="flex flex-col gap-6">
      {currentProfile && (
        <section className="card p-5 flex items-center gap-4 flex-wrap">
          <span
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-3xl"
            aria-hidden="true"
          >
            {currentProfile.emoji}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase text-slate-600 font-semibold">
              Cub
            </div>
            <div className="text-xl font-bold">{currentProfile.name}</div>
          </div>
          <MoodBadge mood={moodForHoldings(state.holdings, quotes)} />
        </section>
      )}

      <section className="card p-6">
        <div className="grid sm:grid-cols-4 gap-4">
          <Stat label="Total value" value={formatMoney(totalValue)} />
          <Stat label="Cash" value={formatMoney(state.cash)} />
          <Stat label="Invested" value={formatMoney(investedValue)} />
          <Stat
            label="Gain / Loss"
            value={`${formatChange(totalGain)} (${formatPercent(totalGainPct)})`}
            valueClass={gainColor(totalGain)}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/explore" className="btn btn-primary">
            🔎 Find a stock
          </Link>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PortfolioChart
            history={state.valueHistory ?? []}
            currentValue={totalValue}
          />
        </div>
        <GoalCard
          goal={state.goal ?? null}
          totalValue={totalValue}
          onSet={setGoal}
          onClear={clearGoal}
        />
      </div>

      <SectorBreakdown holdings={state.holdings} quotes={quotes} />

      <AchievementGrid earned={state.achievements} />

      <section className="flex flex-col gap-3" aria-busy={!ready || loading}>
        <h2 className="text-xl font-bold">Your holdings</h2>
        {rows.length === 0 ? (
          <div className="card p-6 text-center text-slate-700">
            You haven&apos;t bought any stocks yet.{" "}
            <Link
              href="/explore"
              className="text-indigo-700 font-semibold hover:underline"
            >
              Pick your first one →
            </Link>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Stock</th>
                  <th className="text-right px-4 py-3">Shares</th>
                  <th className="text-right px-4 py-3">Avg. cost</th>
                  <th className="text-right px-4 py-3">Price now</th>
                  <th className="text-right px-4 py-3">Value</th>
                  <th className="text-right px-4 py-3">Gain</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sym} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link
                        href={`/stock/${encodeURIComponent(r.sym)}`}
                        className="font-semibold text-indigo-700 hover:underline"
                      >
                        {r.sym}
                      </Link>
                      <div className="text-xs text-slate-600">
                        {r.q?.name ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{r.lot.shares}</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(
                        r.lot.shares > 0 ? r.lot.costBasis / r.lot.shares : 0,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.q ? formatMoney(r.price) : showQuotePlaceholders ? "…" : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.q ? formatMoney(r.value) : showQuotePlaceholders ? "…" : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${gainColor(r.gain)}`}
                    >
                      {r.q ? formatChange(r.gain) : "—"}
                      <div className="text-xs font-normal">
                        {r.q ? formatPercent(r.gainPct) : ""}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Recent trades</h2>
        {state.trades.length === 0 ? (
          <div className="card p-6 text-slate-700 text-sm">No trades yet.</div>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {state.trades.slice(0, 15).map((t) => (
              <li
                key={t.id}
                className="px-4 py-3 flex flex-col gap-1 text-sm"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span
                      className={`chip ${
                        t.side === "buy"
                          ? "!bg-emerald-100 !text-emerald-800"
                          : "!bg-rose-100 !text-rose-800"
                      }`}
                    >
                      {t.side === "buy" ? "Bought" : "Sold"}
                    </span>{" "}
                    <strong>{t.shares}</strong> ×{" "}
                    <Link
                      href={`/stock/${encodeURIComponent(t.symbol)}`}
                      className="text-indigo-700 font-semibold hover:underline"
                    >
                      {t.symbol}
                    </Link>{" "}
                    at {formatMoney(t.price)}
                  </div>
                  <div className="text-xs text-slate-600">
                    {new Date(t.timestamp).toLocaleString()}
                  </div>
                </div>
                {t.note && (
                  <div className="text-xs text-slate-700 italic">
                    “{t.note}”
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-600">
        Parents:{" "}
        <Link href="/admin" className="text-indigo-700 hover:underline">
          open admin
        </Link>{" "}
        to switch, rename, reset, or delete Cubs (password required).
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-600 font-semibold">
        {label}
      </div>
      <div className={`text-2xl font-extrabold ${valueClass ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
