export type Lot = {
  shares: number;
  costBasis: number;
  firstAcquiredAt: number;
};

export type Trade = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  timestamp: number;
  note?: string;
};

export type Goal = {
  target: number;
  deadline: number | null;
  setAt: number;
};

export type ValueSnapshot = {
  date: string; // YYYY-MM-DD (UTC)
  value: number;
};

export type PortfolioState = {
  cash: number;
  holdings: Record<string, Lot>;
  watchlist: string[];
  trades: Trade[];
  goal?: Goal | null;
  valueHistory?: ValueSnapshot[];
  achievements?: Record<string, number>;
  lessonsCompleted?: Record<string, number>;
};

export type CubProfile = {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
};

export type ParentLockSnapshot = {
  salt: string;
  hash: string;
  setAt: number;
};

export type SyncStatus =
  | "idle"
  | "syncing"
  | "synced"
  | "offline"
  | "error";
