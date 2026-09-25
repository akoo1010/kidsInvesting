"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
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
import { valuePortfolio } from "@/lib/valuation";

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

  const { quotesMap: quotes, notFound, loading } = useQuotes(symbols, ready);

  const { rows, investedValue, totalValue, missing, unpriced, complete } = useMemo(
    () => valuePortfolio(state, quotes, notFound),
    [state, quotes, notFound],
  );
  const totalGain = totalValue - STARTING_CASH_AMOUNT;
  const totalGainPct = (totalGain / STARTING_CASH_AMOUNT) * 100;
  const showQuotePlaceholders = loading && symbols.length > 0;
  // While prices load, show placeholders rather than an estimate.
  const totalsPending = !complete && loading;
  // Only a complete valuation feeds the goal and the chart's "today" point,
  // so an estimate can't claim a goal is reached.
  const liveTotalValue = complete ? totalValue : null;

  // Once quotes settle, snapshot today's value and re-evaluate achievements.
  // Both actions are idempotent — they only persist diffs. The value is only
  // trusted when every holding has a live price; otherwise a failed quote
  // would be saved into the chart as a fake crash.
  const quotesSettled = symbols.length === 0 || !loading;
  useEffect(() => {
    if (!ready || !currentProfile || !quotesSettled) return;
    const liveTotal = complete ? totalValue : null;
    if (liveTotal !== null) recordTodayValue(liveTotal);
    const earned = evaluateAchievements(state, liveTotal);
    const existing = state.achievements ?? {};
    const newOnes = earned.filter((id) => !(id in existing));
    if (newOnes.length > 0) awardAchievements(newOnes);
  }, [
    ready,
    currentProfile,
    quotesSettled,
    complete,
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
          <Stat
            label="Total value"
            value={totalsPending ? "…" : formatMoney(totalValue)}
          />
          <Stat label="Cash" value={formatMoney(state.cash)} />
          <Stat
            label="Invested"
            value={totalsPending ? "…" : formatMoney(investedValue)}
          />
          <Stat
            label="Gain / Loss"
            value={
              totalsPending
                ? "…"
                : `${formatChange(totalGain)} (${formatPercent(totalGainPct)})`
            }
            valueClass={totalsPending ? undefined : gainColor(totalGain)}
          />
        </div>
        {!loading && missing.length > 0 && (
          <p role="note" className="mt-3 text-xs text-amber-800">
            ⚠️ Couldn&apos;t get today&apos;s price for {missing.join(", ")}, so{" "}
            {missing.length === 1 ? "it's" : "they're"} counted at what you
            paid for now.
          </p>
        )}
        {!loading && unpriced.length > 0 && (
          <p role="note" className="mt-3 text-xs text-amber-800">
            ⚠️ {unpriced.join(", ")} {unpriced.length === 1 ? "has" : "have"} no
            price right now (a stock can stop trading, for example when another
            company buys it), so {unpriced.length === 1 ? "it's" : "they're"}{" "}
            counted as $0.
          </p>
        )}
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
            currentValue={liveTotalValue}
          />
        </div>
        <GoalCard
          goal={state.goal ?? null}
          totalValue={liveTotalValue}
          pricesLoading={loading}
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
                  <tr key={r.symbol} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link
                        href={`/stock/${encodeURIComponent(r.symbol)}`}
                        className="font-semibold text-indigo-700 hover:underline"
                      >
                        {r.symbol}
                      </Link>
                      <div className="text-xs text-slate-600">
                        {r.quote?.name ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{r.lot.shares}</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(
                        r.lot.shares > 0 ? r.lot.costBasis / r.lot.shares : 0,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.quote ? formatMoney(r.quote.price) : showQuotePlaceholders ? "…" : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.status === "missing"
                        ? showQuotePlaceholders ? "…" : "—"
                        : formatMoney(r.value)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${gainColor(r.gain ?? 0)}`}
                    >
                      {r.gain !== null ? formatChange(r.gain) : "—"}
                      <div className="text-xs font-normal">
                        {r.gainPct !== null ? formatPercent(r.gainPct) : ""}
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
