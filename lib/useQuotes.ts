import { useState, useEffect, useMemo } from "react";
import type { Quote } from "@/lib/types";

export function useQuotes(symbols: string[], ready: boolean) {
  const [quotesMap, setQuotesMap] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);

  const symbolsKey = symbols.join(",");

  useEffect(() => {
    if (!ready) return;
    if (symbolsKey.length === 0) {
      setQuotesMap({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/quote?symbols=${encodeURIComponent(symbolsKey)}`)
      .then((r) => r.json())
      .then((data: { quotes?: Quote[] }) => {
        if (cancelled) return;
        const map: Record<string, Quote> = {};
        for (const q of data.quotes ?? []) {
          map[q.symbol] = q;
        }
        setQuotesMap(map);
      })
      .catch((err) => {
        console.error("Failed to fetch stock quotes:", err);
        if (!cancelled) setQuotesMap({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, symbolsKey]);

  const quotesList = useMemo(() => {
    return symbols.map((s) => quotesMap[s]).filter(Boolean);
  }, [symbols, quotesMap]);

  return { quotesMap, quotesList, loading };
}
