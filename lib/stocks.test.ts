import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/stocks.ts builds a YahooFinance client at import time; swap in a fake
// whose `quote` each test controls.
const quoteMock = vi.hoisted(() => vi.fn());
vi.mock("yahoo-finance2", () => ({
  default: class {
    quote = quoteMock;
  },
}));

import { findQuotes, getQuote, QuoteNotFoundError } from "@/lib/stocks";

function yahooQuote(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    shortName: "Apple Inc.",
    quoteType: "EQUITY",
    currency: "USD",
    regularMarketPrice: 200,
    regularMarketPreviousClose: 190,
    regularMarketChange: 10,
    regularMarketChangePercent: 5.26,
    ...overrides,
  };
}

beforeEach(() => {
  quoteMock.mockReset();
});

describe("getQuote", () => {
  it("maps a normal quote", async () => {
    quoteMock.mockResolvedValueOnce(yahooQuote());
    expect(await getQuote("AAPL")).toMatchObject({
      symbol: "AAPL",
      price: 200,
      currency: "USD",
      quoteType: "EQUITY",
      change: 10,
    });
  });

  it("throws QuoteNotFoundError when Yahoo doesn't know the symbol", async () => {
    // yahoo-finance2 returns nothing for unknown and delisted symbols.
    quoteMock.mockResolvedValueOnce(undefined);
    const err = await getQuote("gone").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(QuoteNotFoundError);
    expect((err as QuoteNotFoundError).symbol).toBe("GONE");
    // The stock page turns "not found" errors into a 404.
    expect((err as Error).message.toLowerCase()).toContain("not found");
  });

  it("reports no price as 0 without a fake -100% change", async () => {
    quoteMock.mockResolvedValueOnce(
      yahooQuote({
        regularMarketPrice: undefined,
        regularMarketChange: undefined,
        regularMarketChangePercent: undefined,
      }),
    );
    expect(await getQuote("AAPL")).toMatchObject({ price: 0, change: 0, changePercent: 0 });
  });

  it("leaves an unknown currency undefined instead of assuming dollars", async () => {
    quoteMock.mockResolvedValueOnce(yahooQuote({ currency: undefined }));
    expect((await getQuote("AAPL")).currency).toBeUndefined();
  });
});

describe("findQuotes", () => {
  it("separates unknown symbols from ones that failed for other reasons", async () => {
    quoteMock.mockImplementation(async (symbol: string) => {
      if (symbol === "AAPL") return yahooQuote();
      if (symbol === "gone") return undefined;
      throw new Error("429 Too Many Requests");
    });
    expect(await findQuotes(["AAPL", "gone", "KO"])).toEqual({
      quotes: [expect.objectContaining({ symbol: "AAPL" })],
      notFound: ["GONE"],
    });
  });
});
