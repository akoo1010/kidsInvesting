import { describe, expect, it } from "vitest";
import { moodForHoldings } from "@/lib/mood";
import type { Lot, Quote } from "@/lib/types";

const lot = (shares: number): Lot => ({ shares, costBasis: 1, firstAcquiredAt: 0 });

function quote(symbol: string, price: number, change: number): Quote {
  return {
    symbol,
    name: symbol,
    price,
    currency: "USD",
    change,
    changePercent: 0,
    previousClose: price - change,
    quoteType: "EQUITY",
  };
}

describe("moodForHoldings", () => {
  it("weights each holding's daily change by its value", () => {
    const mood = moodForHoldings(
      { AAPL: lot(1), KO: lot(1) },
      { AAPL: quote("AAPL", 100, 4), KO: quote("KO", 100, 0) },
    );
    expect(mood.pct).toBeCloseTo(2, 10);
    expect(mood.emoji).toBe("😄");
  });

  it("is idle when nothing is priced", () => {
    expect(moodForHoldings({ AAPL: lot(1) }, {}).tone).toBe("idle");
  });

  it("ignores holdings with no usable price instead of showing a crash", () => {
    const mood = moodForHoldings(
      { AAPL: lot(1), GONE: lot(100) },
      { AAPL: quote("AAPL", 100, 1), GONE: quote("GONE", 0, -50) },
    );
    expect(mood.pct).toBeCloseTo(1, 10);
  });
});
