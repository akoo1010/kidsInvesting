import { describe, expect, it } from "vitest";
import { TRADING } from "@/lib/constants";
import {
  applyBuy,
  applySell,
  buyBlockReason,
  isUsablePrice,
  priceMovedTooMuch,
  sellBlockReason,
  type TradeOrder,
} from "@/lib/trading";
import type { PortfolioState, Trade } from "@/lib/types";

function portfolio(overrides: Partial<PortfolioState> = {}): PortfolioState {
  return {
    cash: 10_000,
    holdings: {},
    watchlist: [],
    trades: [],
    ...overrides,
  };
}

function order(overrides: Partial<TradeOrder> = {}): TradeOrder {
  return {
    symbol: "AAPL",
    shares: 10,
    price: 100,
    id: "trade-1",
    timestamp: 1_000,
    ...overrides,
  };
}

function expectOk(outcome: ReturnType<typeof applyBuy>) {
  if (!outcome.ok) throw new Error(`expected ok, got: ${outcome.reason}`);
  return outcome;
}

function expectRejected(outcome: ReturnType<typeof applyBuy>) {
  if (outcome.ok) throw new Error("expected the trade to be rejected");
  return outcome.reason;
}

describe("isUsablePrice", () => {
  it("accepts positive finite numbers only", () => {
    expect(isUsablePrice(0.01)).toBe(true);
    expect(isUsablePrice(0)).toBe(false);
    expect(isUsablePrice(-5)).toBe(false);
    expect(isUsablePrice(Number.NaN)).toBe(false);
    expect(isUsablePrice(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isUsablePrice(undefined)).toBe(false);
    expect(isUsablePrice("100")).toBe(false);
  });
});

describe("applyBuy", () => {
  it("spends cash, opens a lot, and records the trade", () => {
    const { state, trade } = expectOk(applyBuy(portfolio(), order({ note: "  I like phones  " })));
    expect(state.cash).toBe(9_000);
    expect(state.holdings.AAPL).toEqual({ shares: 10, costBasis: 1_000, firstAcquiredAt: 1_000 });
    expect(trade).toEqual({
      id: "trade-1",
      symbol: "AAPL",
      side: "buy",
      shares: 10,
      price: 100,
      timestamp: 1_000,
      note: "I like phones",
    });
    expect(state.trades).toEqual([trade]);
  });

  it("adds to an existing lot and keeps the original acquisition time", () => {
    const start = portfolio({
      cash: 5_000,
      holdings: { AAPL: { shares: 5, costBasis: 400, firstAcquiredAt: 42 } },
    });
    const { state } = expectOk(applyBuy(start, order({ shares: 2, price: 150, timestamp: 9_999 })));
    expect(state.holdings.AAPL).toEqual({ shares: 7, costBasis: 700, firstAcquiredAt: 42 });
    expect(state.cash).toBe(4_700);
  });

  it("upper-cases the symbol", () => {
    const { state, trade } = expectOk(applyBuy(portfolio(), order({ symbol: "msft" })));
    expect(Object.keys(state.holdings)).toEqual(["MSFT"]);
    expect(trade.symbol).toBe("MSFT");
  });

  it("allows spending exactly all the cash", () => {
    const { state } = expectOk(applyBuy(portfolio({ cash: 1_000 }), order()));
    expect(state.cash).toBe(0);
  });

  it("never leaves cash negative from floating-point rounding", () => {
    const { state } = expectOk(
      applyBuy(portfolio({ cash: 0.3 }), order({ shares: 3, price: 0.1 })),
    );
    expect(state.cash).toBeGreaterThanOrEqual(0);
  });

  it("rejects a buy that costs more than the cash on hand", () => {
    const start = portfolio({ cash: 999 });
    const reason = expectRejected(applyBuy(start, order()));
    expect(reason).toBe("Not enough cash. You need $1,000.00 but have $999.00.");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects %s shares",
    (shares) => {
      expect(expectRejected(applyBuy(portfolio(), order({ shares })))).toMatch(
        /greater than 0/,
      );
    },
  );

  it.each([0, -100, Number.NaN])("rejects a price of %s (no free shares)", (price) => {
    expect(expectRejected(applyBuy(portfolio(), order({ price })))).toMatch(
      /no live price/,
    );
  });

  it("trims long notes to 140 characters and drops blank ones", () => {
    const long = expectOk(applyBuy(portfolio(), order({ note: "x".repeat(200) })));
    expect(long.trade.note).toHaveLength(140);
    const blank = expectOk(applyBuy(portfolio(), order({ note: "   " })));
    expect(blank.trade).not.toHaveProperty("note");
  });

  it(`keeps only the newest ${TRADING.maxTradesKept} trades`, () => {
    const trades: Trade[] = Array.from({ length: TRADING.maxTradesKept }, (_, i) => ({
      id: `old-${i}`,
      symbol: "KO",
      side: "buy",
      shares: 1,
      price: 1,
      timestamp: i,
    }));
    const { state } = expectOk(applyBuy(portfolio({ trades }), order({ id: "newest" })));
    expect(state.trades).toHaveLength(TRADING.maxTradesKept);
    expect(state.trades[0].id).toBe("newest");
    expect(state.trades.at(-1)?.id).toBe(`old-${TRADING.maxTradesKept - 2}`);
  });

  it("does not mutate the input portfolio", () => {
    const start = portfolio({
      holdings: { AAPL: { shares: 1, costBasis: 100, firstAcquiredAt: 1 } },
    });
    const snapshot = structuredClone(start);
    applyBuy(start, order());
    expect(start).toEqual(snapshot);
  });
});

describe("applySell", () => {
  const owning = (shares: number, costBasis: number) =>
    portfolio({
      cash: 0,
      holdings: { AAPL: { shares, costBasis, firstAcquiredAt: 7 } },
    });

  it("adds proceeds and keeps the average cost of the remaining shares", () => {
    const { state, trade } = expectOk(
      applySell(owning(10, 1_000), order({ shares: 4, price: 150 })),
    );
    expect(state.cash).toBe(600);
    expect(state.holdings.AAPL).toEqual({ shares: 6, costBasis: 600, firstAcquiredAt: 7 });
    expect(trade.side).toBe("sell");
  });

  it("removes the lot when every share is sold", () => {
    const { state } = expectOk(applySell(owning(10, 1_000), order({ shares: 10 })));
    expect(state.holdings).not.toHaveProperty("AAPL");
    expect(state.cash).toBe(1_000);
  });

  it("treats a sale within rounding error of the whole lot as selling out", () => {
    const { state } = expectOk(
      applySell(owning(0.3, 30), order({ shares: 0.1 + 0.2, price: 100 })),
    );
    expect(state.holdings).not.toHaveProperty("AAPL");
  });

  it("rejects selling more shares than owned", () => {
    expect(expectRejected(applySell(owning(3, 300), order({ shares: 4 })))).toBe(
      "You only own 3 shares of AAPL.",
    );
  });

  it("rejects selling a stock that isn't owned", () => {
    expect(expectRejected(applySell(portfolio(), order()))).toBe(
      "You only own 0 shares of AAPL.",
    );
  });

  it("rejects a sell with no usable price", () => {
    expect(expectRejected(applySell(owning(10, 1_000), order({ price: 0 })))).toMatch(
      /no live price/,
    );
  });
});

describe("buyBlockReason", () => {
  const usd = (quoteType: string | undefined, price = 100) => ({
    price,
    currency: "USD",
    quoteType,
  });

  it.each(["EQUITY", "ETF"])("allows a US-dollar %s", (type) => {
    expect(buyBlockReason(usd(type))).toBeNull();
  });

  it("blocks stocks priced in other currencies (¥3,000 must not cost $3,000)", () => {
    expect(
      buyBlockReason({ price: 3_000, currency: "JPY", quoteType: "EQUITY" }),
    ).toMatch(/priced in JPY/);
    expect(
      buyBlockReason({ price: 250, currency: "GBp", quoteType: "EQUITY" }),
    ).toMatch(/priced in GBp/);
  });

  it("blocks crypto, indexes, and other instrument types", () => {
    expect(buyBlockReason(usd("CRYPTOCURRENCY"))).toMatch(/Crypto is watch-only/);
    expect(buyBlockReason(usd("INDEX"))).toMatch(/can't buy it directly/);
    for (const type of ["MUTUALFUND", "FUTURE", "OPTION", "CURRENCY", undefined]) {
      expect(buyBlockReason(usd(type))).toMatch(/watch-only/);
    }
  });

  it("blocks an unknown currency instead of assuming dollars", () => {
    expect(buyBlockReason({ price: 100, currency: undefined, quoteType: "EQUITY" })).toMatch(
      /can't tell what currency/,
    );
  });

  it("blocks when there's no usable price", () => {
    expect(buyBlockReason(usd("EQUITY", 0))).toMatch(/no live price/);
  });
});

describe("sellBlockReason", () => {
  it("only needs a usable price, so non-dollar holdings can still be sold", () => {
    expect(sellBlockReason({ price: 3_000, currency: "JPY", quoteType: "EQUITY" })).toBeNull();
    expect(sellBlockReason({ price: 0, currency: "USD", quoteType: "EQUITY" })).toMatch(
      /no live price/,
    );
  });
});

describe("priceMovedTooMuch", () => {
  it("lets small moves through and flags big ones", () => {
    expect(priceMovedTooMuch(100, 100)).toBe(false);
    expect(priceMovedTooMuch(100, 101)).toBe(false); // exactly the threshold
    expect(priceMovedTooMuch(100, 99)).toBe(false);
    expect(priceMovedTooMuch(100, 101.01)).toBe(true);
    expect(priceMovedTooMuch(100, 98.9)).toBe(true);
  });

  it("respects a custom threshold", () => {
    expect(priceMovedTooMuch(100, 104, 5)).toBe(false);
    expect(priceMovedTooMuch(100, 106, 5)).toBe(true);
  });

  it("flags unusable prices", () => {
    expect(priceMovedTooMuch(0, 100)).toBe(true);
    expect(priceMovedTooMuch(100, 0)).toBe(true);
  });
});
