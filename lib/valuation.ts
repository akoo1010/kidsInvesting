// What a portfolio is worth right now, given whatever quotes loaded. Shared by
// the portfolio page and the leaderboard so they value holdings the same way.

import { isUsablePrice } from "@/lib/trading";
import type { Lot, PortfolioState, Quote } from "@/lib/types";

export type HoldingValue = {
  symbol: string;
  lot: Lot;
  // "live": priced from a quote. "unpriced": Yahoo answered but has no price
  // (e.g. the stock stopped trading) — counted as $0. "missing": no answer
  // yet (still loading, or the request failed) — counted at cost basis.
  status: "live" | "unpriced" | "missing";
  // The live quote, or undefined unless status is "live".
  quote: Quote | undefined;
  value: number;
  // Null unless status is "live".
  gain: number | null;
  gainPct: number | null;
};

export type PortfolioValuation = {
  rows: HoldingValue[];
  investedValue: number;
  totalValue: number;
  // Held symbols with no answer yet (status "missing").
  missing: string[];
  // Held symbols Yahoo can't price (status "unpriced").
  unpriced: string[];
  // True when nothing is missing, so the total rests on real answers. Only a
  // complete valuation should be saved or used to judge achievements.
  // Unpriced holdings don't block it — otherwise one delisted stock would
  // freeze the chart forever.
  complete: boolean;
};

export function valuePortfolio(
  portfolio: Pick<PortfolioState, "cash" | "holdings">,
  quotes: Record<string, Quote>,
  // Symbols Yahoo reported it doesn't know at all.
  notFound: readonly string[] = [],
): PortfolioValuation {
  const rows: HoldingValue[] = [];
  const missing: string[] = [];
  const unpriced: string[] = [];
  let investedValue = 0;

  for (const [symbol, lot] of Object.entries(portfolio.holdings)) {
    const q = quotes[symbol];
    if (q && isUsablePrice(q.price)) {
      const value = lot.shares * q.price;
      const gain = value - lot.costBasis;
      investedValue += value;
      rows.push({
        symbol,
        lot,
        status: "live",
        quote: q,
        value,
        gain,
        gainPct: lot.costBasis > 0 ? (gain / lot.costBasis) * 100 : 0,
      });
    } else if (q || notFound.includes(symbol)) {
      unpriced.push(symbol);
      rows.push({ symbol, lot, status: "unpriced", quote: undefined, value: 0, gain: null, gainPct: null });
    } else {
      // No answer is not a $0 price. Count the shares at what the Cub paid,
      // so a failed quote doesn't look like a crash.
      missing.push(symbol);
      investedValue += lot.costBasis;
      rows.push({
        symbol,
        lot,
        status: "missing",
        quote: undefined,
        value: lot.costBasis,
        gain: null,
        gainPct: null,
      });
    }
  }

  return {
    rows,
    investedValue,
    totalValue: portfolio.cash + investedValue,
    missing,
    unpriced,
    complete: missing.length === 0,
  };
}
