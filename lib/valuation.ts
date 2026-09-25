// What a portfolio is worth right now, given whatever quotes loaded. Shared by
// the portfolio page and the leaderboard so they value holdings the same way.

import { isUsablePrice } from "@/lib/trading";
import type { Lot, PortfolioState, Quote } from "@/lib/types";

export type HoldingValue = {
  symbol: string;
  lot: Lot;
  // The live quote, or undefined when no usable price loaded.
  quote: Quote | undefined;
  // Live value, or the cost basis when the price is unknown.
  value: number;
  // Null when the price is unknown.
  gain: number | null;
  gainPct: number | null;
};

export type PortfolioValuation = {
  rows: HoldingValue[];
  investedValue: number;
  totalValue: number;
  // Held symbols with no usable live price.
  missing: string[];
  // True when every holding was valued at a live price. Only a complete
  // valuation should be saved or used to judge achievements.
  complete: boolean;
};

export function valuePortfolio(
  portfolio: Pick<PortfolioState, "cash" | "holdings">,
  quotes: Record<string, Quote>,
): PortfolioValuation {
  const rows: HoldingValue[] = [];
  const missing: string[] = [];
  let investedValue = 0;

  for (const [symbol, lot] of Object.entries(portfolio.holdings)) {
    const q = quotes[symbol];
    const quote = q && isUsablePrice(q.price) ? q : undefined;
    if (!quote) {
      // A missing price is not a $0 price. Count the shares at what the Cub
      // paid, so a failed quote doesn't look like a crash.
      missing.push(symbol);
      investedValue += lot.costBasis;
      rows.push({ symbol, lot, quote, value: lot.costBasis, gain: null, gainPct: null });
      continue;
    }
    const value = lot.shares * quote.price;
    const gain = value - lot.costBasis;
    investedValue += value;
    rows.push({
      symbol,
      lot,
      quote,
      value,
      gain,
      gainPct: lot.costBasis > 0 ? (gain / lot.costBasis) * 100 : 0,
    });
  }

  return {
    rows,
    investedValue,
    totalValue: portfolio.cash + investedValue,
    missing,
    complete: missing.length === 0,
  };
}
