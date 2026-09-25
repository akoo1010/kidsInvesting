export type Quote = {
  symbol: string;
  name: string;
  price: number;
  // Undefined when Yahoo didn't say. Display code falls back to USD, but
  // trading treats an unknown currency as not-dollars.
  currency?: string;
  change: number;
  changePercent: number;
  previousClose: number;
  marketState?: string;
  // Yahoo's instrument type: "EQUITY", "ETF", "CRYPTOCURRENCY", "INDEX", …
  quoteType?: string;
  exchange?: string;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  dividendYield?: number;
};

export type HistoryPoint = {
  date: string;
  close: number;
};

export type SearchHit = {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
};

export type StockProfile = {
  symbol: string;
  sector?: string;
  industry?: string;
  summary?: string;
  website?: string;
  country?: string;
};

export const HISTORY_RANGES = ["1mo", "3mo", "6mo", "1y", "5y"] as const;
export type StockHistoryRange = (typeof HISTORY_RANGES)[number];
