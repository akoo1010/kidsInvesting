export type Quote = {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  previousClose: number;
  marketState?: string;
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
