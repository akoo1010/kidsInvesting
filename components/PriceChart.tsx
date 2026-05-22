"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";
import { usePortfolio } from "@/lib/portfolio";
import type { HistoryPoint, Trade, StockHistoryRange as Range } from "@/lib/types";

const RANGES: { value: Range; label: string }[] = [
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

type Row = {
  date: string;
  label: string;
  close: number;
  buyPrice: number | null;
  sellPrice: number | null;
  buys: Trade[];
  sells: Trade[];
};

export function PriceChart({
  symbol,
  currency = "USD",
}: {
  symbol: string;
  currency?: string;
}) {
  const [range, setRange] = useState<Range>("6mo");
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { state, ready: portfolioReady } = usePortfolio();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`)
      .then((r) => r.json())
      .then((data: { points?: HistoryPoint[] }) => {
        if (!cancelled) setPoints(data.points ?? []);
      })
      .catch((err) => {
        console.error(`Failed to fetch stock history for symbol ${symbol}:`, err);
        if (!cancelled) setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  const data: Row[] = useMemo(() => {
    const rows: Row[] = points.map((p) => ({
      date: p.date,
      label: new Date(p.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: range === "5y" || range === "1y" ? "2-digit" : undefined,
      }),
      close: p.close,
      buyPrice: null,
      sellPrice: null,
      buys: [],
      sells: [],
    }));
    if (rows.length === 0) return rows;

    // Snap each in-range trade to the closest data point (weekly buckets
    // for 1y/5y, daily for shorter ranges). Last trade on a bucket wins
    // for the marker's y; the full list still shows in the tooltip + footer.
    const rowTs = rows.map((r) => new Date(r.date).getTime());
    const start = rowTs[0] - DAY_MS;
    const end = rowTs[rowTs.length - 1] + DAY_MS;
    const trades = state.trades.filter(
      (t) => t.symbol === symbol && t.timestamp >= start && t.timestamp <= end,
    );
    for (const t of trades) {
      let bestIdx = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < rowTs.length; i++) {
        const d = Math.abs(rowTs[i] - t.timestamp);
        if (d < bestDiff) {
          bestDiff = d;
          bestIdx = i;
        }
      }
      const row = rows[bestIdx];
      if (t.side === "buy") {
        row.buys.push(t);
        row.buyPrice = t.price;
      } else {
        row.sells.push(t);
        row.sellPrice = t.price;
      }
    }
    return rows;
  }, [points, range, state.trades, symbol]);

  const myTrades = useMemo(
    () =>
      state.trades
        .filter((t) => t.symbol === symbol)
        .sort((a, b) => b.timestamp - a.timestamp),
    [state.trades, symbol],
  );

  const trend =
    data.length > 1 ? data[data.length - 1].close - data[0].close : 0;
  const color = trend >= 0 ? "#059669" : "#e11d48";
  const visibleTradeCount = data.reduce(
    (acc, r) => acc + r.buys.length + r.sells.length,
    0,
  );

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Price over time</h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`text-xs px-2 py-1 rounded-md font-semibold ${
                range === r.value
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64">
        {loading ? (
          <div className="h-full w-full bg-slate-100 rounded-lg animate-pulse" />
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">
            No price history available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
                width={56}
                tickFormatter={(v: number) =>
                  v.toLocaleString("en-US", { maximumFractionDigits: 0 })
                }
              />
              <Tooltip
                content={(props) => (
                  <ChartTooltip {...props} currency={currency} />
                )}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${symbol})`}
                name="Price"
              />
              <Scatter
                dataKey="buyPrice"
                fill="#059669"
                stroke="#ffffff"
                strokeWidth={2}
                shape="circle"
                name="Your buy"
                legendType="none"
                isAnimationActive={false}
              />
              <Scatter
                dataKey="sellPrice"
                fill="#e11d48"
                stroke="#ffffff"
                strokeWidth={2}
                shape="circle"
                name="Your sell"
                legendType="none"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {portfolioReady && myTrades.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600 ring-2 ring-white"
                />
                Your buys
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full bg-rose-600 ring-2 ring-white"
                />
                Your sells
              </span>
            </div>
            {visibleTradeCount < myTrades.length && (
              <span className="text-slate-500">
                Showing {visibleTradeCount} of {myTrades.length} in this range
              </span>
            )}
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {myTrades.slice(0, 8).map((t) => (
              <li
                key={t.id}
                className={`text-xs rounded-full px-2 py-1 font-semibold ${
                  t.side === "buy"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-rose-50 text-rose-800"
                }`}
                title={
                  t.note
                    ? `${t.note} · ${new Date(t.timestamp).toLocaleString()}`
                    : new Date(t.timestamp).toLocaleString()
                }
              >
                {t.side === "buy" ? "Bought" : "Sold"} {t.shares} @{" "}
                {formatMoney(t.price, currency)} ·{" "}
                {new Date(t.timestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type TooltipEntry = { payload?: Row };

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: string | number;
  currency: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-slate-800">{label}</div>
      <div className="text-slate-700">
        Price{" "}
        <strong className="tabular-nums">
          {formatMoney(row.close, currency)}
        </strong>
      </div>
      {row.buys.map((t) => (
        <div key={t.id} className="text-emerald-700">
          ● You bought {t.shares} @ {formatMoney(t.price, currency)}
        </div>
      ))}
      {row.sells.map((t) => (
        <div key={t.id} className="text-rose-700">
          ● You sold {t.shares} @ {formatMoney(t.price, currency)}
        </div>
      ))}
    </div>
  );
}
