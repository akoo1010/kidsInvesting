"use client";

import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Lot, StockProfile as Profile, Quote } from "@/lib/types";
import { formatMoney } from "@/lib/format";

const SECTOR_COLORS = [
  "#4f46e5",
  "#059669",
  "#f59e0b",
  "#e11d48",
  "#0891b2",
  "#9333ea",
  "#0ea5e9",
  "#d97706",
  "#16a34a",
  "#db2777",
];

type Slice = {
  name: string;
  value: number;
  pct: number;
};

export function SectorBreakdown({
  holdings,
  quotes,
}: {
  holdings: Record<string, Lot>;
  quotes: Record<string, Quote>;
}) {
  const symbols = useMemo(
    () => Object.keys(holdings).sort(),
    [holdings],
  );
  // Stable identity for the symbol set so we only refetch profile data when
  // the *set* of held symbols actually changes, not on every quote refresh.
  const symbolsKey = symbols.join(",");
  const quotesReady = symbols.every((s) => quotes[s] != null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (symbolsKey.length === 0) {
      setProfiles({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/profile?symbols=${encodeURIComponent(symbolsKey)}`)
      .then((r) => r.json())
      .then((data: { profiles?: Profile[] }) => {
        if (cancelled) return;
        const map: Record<string, Profile> = {};
        for (const p of data.profiles ?? []) map[p.symbol] = p;
        setProfiles(map);
      })
      .catch((err) => {
        console.error("Failed to fetch sector profiles:", err);
        if (!cancelled) setProfiles({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  const slices: Slice[] = useMemo(() => {
    const totals = new Map<string, number>();
    let invested = 0;
    for (const sym of symbols) {
      const lot = holdings[sym];
      const q = quotes[sym];
      if (!q || !lot) continue;
      const value = q.price * lot.shares;
      invested += value;
      const sector = profiles[sym]?.sector?.trim() || "Other";
      totals.set(sector, (totals.get(sector) ?? 0) + value);
    }
    if (invested === 0) return [];
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value, pct: (value / invested) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [symbols, holdings, quotes, profiles]);

  if (symbols.length === 0) {
    return (
      <div className="card p-5 flex flex-col gap-2">
        <h2 className="font-bold">Sector mix</h2>
        <p className="text-sm text-slate-700">
          Buy a couple of stocks and you&apos;ll see what kinds of companies
          you own — tech, food, games, and more.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="font-bold">Sector mix</h2>
        <span className="text-xs text-slate-700">
          {loading ? "Loading…" : `${slices.length} sector${slices.length === 1 ? "" : "s"}`}
        </span>
      </div>
      {slices.length === 0 ? (
        <div className="text-sm text-slate-700">
          {loading || !quotesReady
            ? "Loading…"
            : "Couldn't load sectors right now."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={42}
                  outerRadius={78}
                  strokeWidth={1}
                  stroke="#fff"
                >
                  {slices.map((s, i) => (
                    <Cell
                      key={s.name}
                      fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [
                    formatMoney(Number(value) || 0),
                    name as string,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {slices.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{
                    backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length],
                  }}
                />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="font-semibold tabular-nums">
                  {s.pct.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {slices.length >= 5 && (
        <div className="text-xs text-emerald-700 font-semibold">
          🧺 Nicely diversified across {slices.length} sectors.
        </div>
      )}
      {slices.length > 0 && slices[0].pct >= 60 && (
        <div className="text-xs text-amber-800">
          ⚠️ {slices[0].pct.toFixed(0)}% of your money is in{" "}
          {slices[0].name}. Putting too much in one place is risky — try a
          stock from a different group.
        </div>
      )}
    </div>
  );
}
