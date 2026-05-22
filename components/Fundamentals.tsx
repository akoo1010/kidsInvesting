"use client";

import { useEffect, useState } from "react";
import type { StockProfile as Profile, Quote } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export function Fundamentals({ quote }: { quote: Quote }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    // Clear stale profile data immediately on symbol change so we don't
    // show e.g. AAPL's sector while the MSFT fetch is still in flight.
    setProfile(null);
    let cancelled = false;
    fetch(`/api/profile?symbol=${encodeURIComponent(quote.symbol)}`)
      .then((r) => r.json())
      .then((p: Profile) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => {
        console.error("Failed to fetch stock profile:", err);
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [quote.symbol]);

  const fmtCap = (n?: number) => {
    if (n == null || !Number.isFinite(n)) return "—";
    if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`;
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    return n.toLocaleString();
  };

  const fmtPe = (n?: number) =>
    n == null || !Number.isFinite(n) ? "—" : n.toFixed(1);

  const fmtPct = (n?: number) => {
    if (n == null || !Number.isFinite(n) || n === 0) return "—";
    return `${n.toFixed(2)}%`;
  };

  const range =
    quote.fiftyTwoWeekLow != null && quote.fiftyTwoWeekHigh != null
      ? `${formatMoney(quote.fiftyTwoWeekLow, quote.currency)} – ${formatMoney(
          quote.fiftyTwoWeekHigh,
          quote.currency,
        )}`
      : "—";

  const rangePct = (() => {
    if (
      quote.fiftyTwoWeekLow == null ||
      quote.fiftyTwoWeekHigh == null ||
      quote.fiftyTwoWeekHigh <= quote.fiftyTwoWeekLow
    ) {
      return null;
    }
    const pct =
      ((quote.price - quote.fiftyTwoWeekLow) /
        (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow)) *
      100;
    return Math.max(0, Math.min(100, pct));
  })();

  return (
    <div className="card p-5 flex flex-col gap-4">
      <h2 className="font-bold">What does this company do?</h2>
      <div className="text-sm text-slate-700">
        {profile?.sector ? (
          <span>
            <strong>{quote.name}</strong> is in the{" "}
            <strong>{profile.sector}</strong> sector
            {profile.industry ? (
              <>
                {" "}
                — specifically <em>{profile.industry}</em>
              </>
            ) : null}
            .
          </span>
        ) : (
          <span>
            <strong>{quote.name}</strong> — a publicly traded company on{" "}
            {quote.exchange ?? "the market"}.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat
          label="Market cap"
          value={fmtCap(quote.marketCap)}
          help="How much the whole company is worth right now."
        />
        <Stat
          label="P/E ratio"
          value={fmtPe(quote.trailingPE)}
          help="Dollars investors pay for every $1 the company earns."
        />
        <Stat
          label="Dividend yield"
          value={fmtPct(quote.dividendYield)}
          help="Yearly cash payout to shareholders, as a % of the price."
        />
        <Stat
          label="52-week range"
          value={range}
          help="Lowest and highest the price has hit in the last year."
        />
      </div>

      {rangePct !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-slate-700">
            <span>52-week low</span>
            <span>Today</span>
            <span>52-week high</span>
          </div>
          <div
            className="relative h-2 bg-slate-100 rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(rangePct)}
            aria-label="Price within 52-week range"
          >
            <div
              className="absolute top-0 h-full w-1 bg-indigo-600 rounded-full"
              style={{ left: `calc(${rangePct}% - 2px)` }}
            />
          </div>
        </div>
      )}

      {profile?.summary && (
        <details className="text-sm text-slate-700">
          <summary className="cursor-pointer font-semibold">
            About the company
          </summary>
          <p className="mt-2 leading-relaxed">
            {profile.summary.slice(0, 400)}
            {profile.summary.length > 400 ? "…" : ""}
          </p>
          {profile.website && (
            <p className="mt-2">
              <a
                className="text-indigo-700 hover:underline"
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit website →
              </a>
            </p>
          )}
        </details>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-xs uppercase text-slate-600 font-semibold">
        {label}
      </div>
      <div className="font-bold tabular-nums">{value}</div>
      <div className="text-xs text-slate-700">{help}</div>
    </div>
  );
}
