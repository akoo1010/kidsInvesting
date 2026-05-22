import YahooFinance from "yahoo-finance2";
import type { ChartResultArrayQuote } from "yahoo-finance2/modules/chart";

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

import type { Quote, HistoryPoint, SearchHit, StockProfile, StockHistoryRange } from "@/lib/types";

export async function getQuote(symbol: string): Promise<Quote> {
  const q = await yf.quote(symbol);
  const price =
    q.regularMarketPrice ?? q.postMarketPrice ?? q.preMarketPrice ?? 0;
  const previousClose = q.regularMarketPreviousClose ?? price;
  const change = q.regularMarketChange ?? price - previousClose;
  const changePercent =
    q.regularMarketChangePercent ??
    (previousClose ? (change / previousClose) * 100 : 0);
  return {
    symbol: q.symbol ?? symbol.toUpperCase(),
    name: q.shortName ?? q.longName ?? q.symbol ?? symbol.toUpperCase(),
    price,
    currency: q.currency ?? "USD",
    change,
    changePercent,
    previousClose,
    marketState: q.marketState,
    exchange: q.fullExchangeName,
    marketCap: q.marketCap,
    trailingPE: q.trailingPE,
    forwardPE: q.forwardPE,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    dividendYield: q.dividendYield,
  };
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  const results = await Promise.allSettled(symbols.map((s) => getQuote(s)));
  return results
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function getHistory(
  symbol: string,
  range: StockHistoryRange = "6mo",
): Promise<HistoryPoint[]> {
  const period2 = new Date();
  const period1 = new Date(period2);
  const monthsBack: Record<typeof range, number> = {
    "1mo": 1,
    "3mo": 3,
    "6mo": 6,
    "1y": 12,
    "5y": 60,
  };
  period1.setMonth(period1.getMonth() - monthsBack[range]);

  const interval: "1d" | "1wk" =
    range === "5y" || range === "1y" ? "1wk" : "1d";

  const result = await yf.chart(symbol, { period1, period2, interval });

  return (result.quotes ?? [])
    .filter(
      (q): q is ChartResultArrayQuote & { close: number } =>
        q.close != null && q.date != null,
    )
    .map((q) => ({
      date: q.date.toISOString(),
      close: q.close,
    }));
}

export async function getHistoryBetween(
  symbol: string,
  period1: Date,
  period2: Date,
): Promise<HistoryPoint[]> {
  const result = await yf.chart(symbol, {
    period1,
    period2,
    interval: "1d",
  });
  return (result.quotes ?? [])
    .filter(
      (q): q is ChartResultArrayQuote & { close: number } =>
        q.close != null && q.date != null,
    )
    .map((q) => ({
      date: q.date.toISOString(),
      close: q.close,
    }));
}

export async function searchSymbols(query: string): Promise<SearchHit[]> {
  if (!query.trim()) return [];
  const res = await yf.search(query, { quotesCount: 10 });
  const yahooQuotes = (res.quotes ?? []).filter(
    (q): q is Extract<typeof res.quotes[number], { isYahooFinance: true }> =>
      q.isYahooFinance === true,
  );
  return yahooQuotes.map((q) => ({
    symbol: q.symbol,
    name: q.shortname || q.longname || q.symbol,
    exchange: q.exchange,
    type: q.quoteType,
  }));
}

export async function getProfile(symbol: string): Promise<StockProfile> {
  const res = await yf.quoteSummary(symbol, { modules: ["assetProfile"] });
  const p = res.assetProfile;
  return {
    symbol: symbol.toUpperCase(),
    sector: p?.sector,
    industry: p?.industry,
    summary: p?.longBusinessSummary,
    website: p?.website,
    country: p?.country,
  };
}

export async function getProfiles(symbols: string[]): Promise<StockProfile[]> {
  if (symbols.length === 0) return [];
  const results = await Promise.allSettled(symbols.map((s) => getProfile(s)));
  return results
    .filter((r): r is PromiseFulfilledResult<StockProfile> => r.status === "fulfilled")
    .map((r) => r.value);
}
