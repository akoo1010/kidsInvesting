"use client";

import Link from "next/link";
import type { Quote } from "@/lib/types";
import { formatChange, formatMoney, formatPercent, gainColor } from "@/lib/format";

export function QuoteCard({ quote }: { quote: Quote }) {
  const up = quote.change > 0;
  const flat = quote.change === 0;
  return (
    <Link
      href={`/stock/${encodeURIComponent(quote.symbol)}`}
      className="card p-4 hover:shadow-md transition-shadow flex flex-col gap-1"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold">{quote.symbol}</div>
          <div className="text-xs text-slate-500 truncate max-w-[12rem]">
            {quote.name}
          </div>
        </div>
        <span
          className={`text-xs font-semibold ${
            up ? "text-emerald-700" : flat ? "text-slate-600" : "text-rose-700"
          }`}
        >
          {up ? "▲" : flat ? "■" : "▼"} {formatPercent(quote.changePercent)}
        </span>
      </div>
      <div className="mt-2 text-xl font-bold">
        {formatMoney(quote.price, quote.currency)}
      </div>
      <div className={`text-xs ${gainColor(quote.change)}`}>
        {formatChange(quote.change, quote.currency)} today
      </div>
    </Link>
  );
}
