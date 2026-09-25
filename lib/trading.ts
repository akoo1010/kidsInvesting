// Pure trading rules: what can be traded, and how a buy or sell changes a
// portfolio. No React, no storage, no clock — callers pass in the trade id
// and timestamp — so every rule here is directly unit-testable.

import { TRADING } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { Lot, PortfolioState, Quote, Trade } from "@/lib/types";

export type TradeOrder = {
  symbol: string;
  shares: number;
  price: number;
  note?: string;
  id: string;
  timestamp: number;
};

export type TradeOutcome =
  | { ok: true; state: PortfolioState; trade: Trade }
  | { ok: false; reason: string };

// Floating-point slack: a buy that costs a hair more than the cash on hand
// (or a sell of a hair more shares than owned) is treated as exact.
const CASH_EPSILON = 1e-6;
const SHARES_EPSILON = 1e-9;

export function isUsablePrice(price: unknown): price is number {
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

type PricedInstrument = Pick<Quote, "price" | "currency" | "quoteType">;

const NO_PRICE_REASON =
  "There's no live price for this one right now, so trading is paused. Try again later.";

// Why this instrument can't be bought, or null if it can.
export function buyBlockReason(quote: PricedInstrument): string | null {
  const type = quote.quoteType;
  if (!type || !(TRADING.buyableQuoteTypes as readonly string[]).includes(type)) {
    if (type === "CRYPTOCURRENCY") {
      return "Crypto is watch-only here. Cubs can buy stocks and funds (ETFs).";
    }
    if (type === "INDEX") {
      return "An index is a scoreboard for lots of stocks, so you can't buy it directly. Try a fund that tracks it, like SPY.";
    }
    return "This one is watch-only. Cubs can buy stocks and funds (ETFs).";
  }
  if (!quote.currency) {
    return "We can't tell what currency this one is priced in, so it's watch-only for now.";
  }
  if (quote.currency !== TRADING.cashCurrency) {
    return `This one is priced in ${quote.currency}, but your cash is in US dollars, so it's watch-only. Many foreign companies also trade in the US — try searching for the company's name.`;
  }
  if (!isUsablePrice(quote.price)) return NO_PRICE_REASON;
  return null;
}

// Selling only needs a live price. Instruments that can no longer be bought
// (e.g. bought before the dollars-only rule) can still be sold, so no Cub
// gets stuck holding them.
export function sellBlockReason(quote: PricedInstrument): string | null {
  return isUsablePrice(quote.price) ? null : NO_PRICE_REASON;
}

// True when the fresh price is far enough from the one the kid confirmed
// that they should see the new total before the trade fills.
export function priceMovedTooMuch(
  confirmedPrice: number,
  freshPrice: number,
  thresholdPct: number = TRADING.reconfirmMovePct,
): boolean {
  if (!isUsablePrice(confirmedPrice) || !isUsablePrice(freshPrice)) return true;
  const movePct = (Math.abs(freshPrice - confirmedPrice) / confirmedPrice) * 100;
  return movePct > thresholdPct;
}

function validateOrder(order: TradeOrder): string | null {
  if (!Number.isFinite(order.shares) || order.shares <= 0) {
    return "Pick a number of shares greater than 0.";
  }
  if (!isUsablePrice(order.price)) return NO_PRICE_REASON;
  return null;
}

function makeTrade(side: Trade["side"], symbol: string, order: TradeOrder): Trade {
  const note = order.note?.trim();
  return {
    id: order.id,
    symbol,
    side,
    shares: order.shares,
    price: order.price,
    timestamp: order.timestamp,
    ...(note ? { note: note.slice(0, 140) } : {}),
  };
}

function withTrade(trades: Trade[], trade: Trade): Trade[] {
  return [trade, ...trades].slice(0, TRADING.maxTradesKept);
}

export function applyBuy(state: PortfolioState, order: TradeOrder): TradeOutcome {
  const invalid = validateOrder(order);
  if (invalid) return { ok: false, reason: invalid };

  const symbol = order.symbol.toUpperCase();
  const cost = order.shares * order.price;
  if (cost > state.cash + CASH_EPSILON) {
    return {
      ok: false,
      reason: `Not enough cash. You need ${formatMoney(cost)} but have ${formatMoney(state.cash)}.`,
    };
  }

  const existing = state.holdings[symbol];
  const lot: Lot =
    existing && existing.shares > SHARES_EPSILON
      ? {
          shares: existing.shares + order.shares,
          costBasis: existing.costBasis + cost,
          firstAcquiredAt: existing.firstAcquiredAt ?? order.timestamp,
        }
      : { shares: order.shares, costBasis: cost, firstAcquiredAt: order.timestamp };

  const trade = makeTrade("buy", symbol, order);
  return {
    ok: true,
    trade,
    state: {
      ...state,
      cash: Math.max(0, state.cash - cost),
      holdings: { ...state.holdings, [symbol]: lot },
      trades: withTrade(state.trades, trade),
    },
  };
}

export function applySell(state: PortfolioState, order: TradeOrder): TradeOutcome {
  const invalid = validateOrder(order);
  if (invalid) return { ok: false, reason: invalid };

  const symbol = order.symbol.toUpperCase();
  const existing = state.holdings[symbol];
  if (!existing || existing.shares < order.shares - SHARES_EPSILON) {
    return {
      ok: false,
      reason: `You only own ${existing?.shares ?? 0} shares of ${symbol}.`,
    };
  }

  const remainingShares = existing.shares - order.shares;
  const holdings = { ...state.holdings };
  if (remainingShares < SHARES_EPSILON) {
    delete holdings[symbol];
  } else {
    holdings[symbol] = {
      shares: remainingShares,
      // Average-cost basis: selling part of a lot keeps the per-share cost.
      costBasis: existing.costBasis * (remainingShares / existing.shares),
      firstAcquiredAt: existing.firstAcquiredAt,
    };
  }

  const trade = makeTrade("sell", symbol, order);
  return {
    ok: true,
    trade,
    state: {
      ...state,
      cash: state.cash + order.shares * order.price,
      holdings,
      trades: withTrade(state.trades, trade),
    },
  };
}
