"use client";

import { usePortfolio } from "@/lib/portfolio";
import { QuoteCard } from "@/components/QuoteCard";
import { useQuotes } from "@/lib/useQuotes";

export function WatchlistGrid() {
  const { state, ready } = usePortfolio();
  const { quotesList: quotes, loading } = useQuotes(state.watchlist, ready);

  if (!ready || loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 w-20 bg-slate-200 rounded mb-3" />
            <div className="h-6 w-24 bg-slate-200 rounded mb-2" />
            <div className="h-3 w-16 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (state.watchlist.length === 0) {
    return (
      <div className="card p-6 text-center text-slate-600">
        Your watchlist is empty. Search for a company up top and add it from
        the stock page.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {quotes.map((q) => (
        <QuoteCard key={q.symbol} quote={q} />
      ))}
    </div>
  );
}
