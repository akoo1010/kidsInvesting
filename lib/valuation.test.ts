import { describe, expect, it } from "vitest";
import { valuePortfolio } from "@/lib/valuation";
import type { Lot, Quote } from "@/lib/types";

function quote(symbol: string, price: number): Quote {
  return {
    symbol,
    name: symbol,
    price,
    currency: "USD",
    change: 0,
    changePercent: 0,
    previousClose: price,
    quoteType: "EQUITY",
  };
}

const lot = (shares: number, costBasis: number): Lot => ({
  shares,
  costBasis,
  firstAcquiredAt: 0,
});

describe("valuePortfolio", () => {
  it("values every holding at its live price", () => {
    const v = valuePortfolio(
      { cash: 500, holdings: { AAPL: lot(2, 300), KO: lot(10, 500) } },
      { AAPL: quote("AAPL", 200), KO: quote("KO", 45) },
    );
    expect(v.complete).toBe(true);
    expect(v.missing).toEqual([]);
    expect(v.investedValue).toBe(850);
    expect(v.totalValue).toBe(1_350);
    expect(v.rows.map((r) => [r.symbol, r.value, r.gain])).toEqual([
      ["AAPL", 400, 100],
      ["KO", 450, -50],
    ]);
    expect(v.rows[0].gainPct).toBeCloseTo(33.333, 3);
    expect(v.rows[1].gainPct).toBeCloseTo(-10, 10);
  });

  it("counts a holding with no quote at cost basis, not $0", () => {
    const v = valuePortfolio(
      { cash: 1_000, holdings: { AAPL: lot(2, 300), KO: lot(10, 500) } },
      { AAPL: quote("AAPL", 200) },
    );
    expect(v.complete).toBe(false);
    expect(v.missing).toEqual(["KO"]);
    expect(v.totalValue).toBe(1_000 + 400 + 500);
    const ko = v.rows.find((r) => r.symbol === "KO");
    expect(ko).toMatchObject({ quote: undefined, value: 500, gain: null, gainPct: null });
  });

  it("treats a $0 or invalid price the same as a missing quote", () => {
    const v = valuePortfolio(
      { cash: 0, holdings: { AAPL: lot(1, 100), MSFT: lot(1, 50) } },
      { AAPL: quote("AAPL", 0), MSFT: quote("MSFT", Number.NaN) },
    );
    expect(v.missing).toEqual(["AAPL", "MSFT"]);
    expect(v.totalValue).toBe(150);
  });

  it("is complete when there are no holdings", () => {
    const v = valuePortfolio({ cash: 10_000, holdings: {} }, {});
    expect(v).toEqual({
      rows: [],
      investedValue: 0,
      totalValue: 10_000,
      missing: [],
      complete: true,
    });
  });

  it("reports a 0% gain for a lot with no cost basis", () => {
    const v = valuePortfolio(
      { cash: 0, holdings: { GIFT: lot(1, 0) } },
      { GIFT: quote("GIFT", 10) },
    );
    expect(v.rows[0].gainPct).toBe(0);
  });
});
