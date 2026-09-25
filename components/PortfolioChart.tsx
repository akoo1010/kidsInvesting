"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { STARTING_CASH_AMOUNT } from "@/lib/constants";
import type { HistoryPoint, ValueSnapshot } from "@/lib/types";
import { formatMoney } from "@/lib/format";

type ChartRow = {
  date: string;
  label: string;
  value: number;
  spx?: number | null;
};

export function PortfolioChart({
  history,
  currentValue,
}: {
  history: ValueSnapshot[];
  // Today's live value, or null while prices are incomplete (then only the
  // saved history is drawn).
  currentValue: number | null;
}) {
  const [spxByDate, setSpxByDate] = useState<Record<string, number>>({});
  const [spxLoading, setSpxLoading] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const mergedHistory = useMemo(() => {
    const merged = [...history];
    if (currentValue === null) return merged;
    const last = merged[merged.length - 1];
    if (!last || last.date !== today) {
      merged.push({ date: today, value: currentValue });
    } else if (Math.abs(last.value - currentValue) > 1e-6) {
      merged[merged.length - 1] = { date: today, value: currentValue };
    }
    return merged;
  }, [history, currentValue, today]);

  // Fetch SPX history covering the snapshot range (with a small lead-in
  // buffer so weekends/holidays before the first snapshot resolve). The dep
  // is just the first-date / today strings so a `currentValue` wiggle that
  // only changes today's value doesn't re-trigger an SPX refetch.
  const firstDate = mergedHistory[0]?.date ?? null;
  const enoughHistory = mergedHistory.length >= 2;
  useEffect(() => {
    if (!enoughHistory || !firstDate) {
      setSpxByDate({});
      return;
    }
    const from = new Date(firstDate + "T00:00:00Z");
    from.setUTCDate(from.getUTCDate() - 7);
    const to = new Date(today + "T00:00:00Z");
    to.setUTCDate(to.getUTCDate() + 1);

    let cancelled = false;
    setSpxLoading(true);
    fetch(
      `/api/history?symbol=${encodeURIComponent("^GSPC")}&from=${from.toISOString()}&to=${to.toISOString()}`,
    )
      .then((r) => r.json())
      .then((data: { points?: HistoryPoint[] }) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const p of data.points ?? []) {
          map[p.date.slice(0, 10)] = p.close;
        }
        setSpxByDate(map);
      })
      .catch((err) => {
        console.error("Failed to fetch S&P 500 history for portfolio chart:", err);
        if (!cancelled) setSpxByDate({});
      })
      .finally(() => {
        if (!cancelled) setSpxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enoughHistory, firstDate, today]);

  const data: ChartRow[] = useMemo(() => {
    if (mergedHistory.length === 0) return [];
    const portfolioBase = mergedHistory[0].value;
    // Resolve SPX baseline: latest SPX close on or before the first snapshot.
    const sortedSpxDates = Object.keys(spxByDate).sort();
    let spxBase: number | null = null;
    for (const d of sortedSpxDates) {
      if (d <= mergedHistory[0].date) spxBase = spxByDate[d];
      else break;
    }
    if (spxBase === null && sortedSpxDates.length > 0) {
      spxBase = spxByDate[sortedSpxDates[0]];
    }

    return mergedHistory.map((p) => {
      let spxVal: number | null = null;
      if (spxBase) {
        // Carry-forward SPX close (markets closed on weekends/holidays).
        let close: number | null = null;
        for (const d of sortedSpxDates) {
          if (d <= p.date) close = spxByDate[d];
          else break;
        }
        if (close !== null) {
          spxVal = portfolioBase * (close / spxBase);
        }
      }
      return {
        date: p.date,
        label: new Date(p.date + "T00:00:00Z").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: p.value,
        spx: spxVal,
      };
    });
  }, [mergedHistory, spxByDate]);

  if (data.length < 2) {
    return (
      <div className="card p-5 flex flex-col gap-2">
        <h2 className="font-bold">Your portfolio value</h2>
        <p className="text-sm text-slate-700">
          Come back tomorrow to see your value charted over time. Each day you
          visit we save a snapshot — and we&apos;ll show you how the S&amp;P 500
          did over the same days.
        </p>
      </div>
    );
  }

  const first = data[0].value;
  const last = data[data.length - 1];
  const trend = last.value - first;
  const color = trend >= 0 ? "#059669" : "#e11d48";

  const finalSpx = last.spx ?? null;
  const spxTrend = finalSpx !== null ? finalSpx - first : null;
  const portfolioPct = first === 0 ? 0 : (trend / first) * 100;
  const spxPct =
    spxTrend !== null && first !== 0 ? (spxTrend / first) * 100 : null;
  const spxDelta =
    spxPct !== null ? portfolioPct - spxPct : null;
  const beatingMarket = spxDelta !== null && spxDelta > 0.05;
  const tracking = spxDelta !== null && Math.abs(spxDelta) <= 0.05;

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-bold">Your portfolio vs the S&amp;P 500</h2>
        <div
          className={`text-sm font-semibold ${
            trend > 0
              ? "text-emerald-700"
              : trend < 0
                ? "text-rose-700"
                : "text-slate-600"
          }`}
        >
          {trend >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(trend))} since first
          snapshot
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="grad-portfolio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
              domain={["auto", "auto"]}
              width={64}
              tickFormatter={(v: number) =>
                v.toLocaleString("en-US", { maximumFractionDigits: 0 })
              }
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                fontSize: 12,
              }}
              formatter={(value, name) => [
                value == null
                  ? "—"
                  : formatMoney(Number(value) || 0),
                name === "spx" ? "S&P 500 (same start)" : "Your portfolio",
              ]}
            />
            <Legend
              verticalAlign="top"
              height={24}
              wrapperStyle={{ fontSize: 12 }}
              formatter={(v) => (v === "spx" ? "S&P 500" : "Your portfolio")}
            />
            <ReferenceLine
              y={STARTING_CASH_AMOUNT}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{
                value: "Start",
                position: "insideTopRight",
                fontSize: 10,
                fill: "#475569",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill="url(#grad-portfolio)"
              name="value"
            />
            <Line
              type="monotone"
              dataKey="spx"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              name="spx"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-slate-700">
        {spxLoading ? (
          <>Loading S&amp;P 500…</>
        ) : spxPct === null ? (
          <>The S&amp;P 500 line will appear once we have market data for your snapshots.</>
        ) : (
          <>
            Your picks:{" "}
            <strong
              className={portfolioPct >= 0 ? "text-emerald-700" : "text-rose-700"}
            >
              {portfolioPct >= 0 ? "+" : ""}
              {portfolioPct.toFixed(2)}%
            </strong>
            {" "}· S&amp;P 500:{" "}
            <strong
              className={spxPct >= 0 ? "text-emerald-700" : "text-rose-700"}
            >
              {spxPct >= 0 ? "+" : ""}
              {spxPct.toFixed(2)}%
            </strong>
            {" "}·{" "}
            {beatingMarket
              ? "🎉 You're beating the market"
              : tracking
                ? "About even with the market"
                : "Trailing the market — pros do, too"}
            .
          </>
        )}
      </div>
    </div>
  );
}
