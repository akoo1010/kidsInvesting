import { isUsablePrice } from "@/lib/trading";
import type { Lot, Quote } from "@/lib/types";

export type Mood = {
  emoji: string;
  label: string;
  pct: number | null;
  tone: "good" | "ok" | "bad" | "idle";
};

const IDLE: Mood = { emoji: "💤", label: "Just chillin'", pct: null, tone: "idle" };

function moodForChange(pct: number | null): Mood {
  if (pct == null || !Number.isFinite(pct)) return IDLE;
  if (pct >= 3) return { emoji: "🚀", label: "On fire!", pct, tone: "good" };
  if (pct >= 1) return { emoji: "😄", label: "Great day", pct, tone: "good" };
  if (pct >= 0.1) return { emoji: "🙂", label: "Good day", pct, tone: "good" };
  if (pct > -0.1) return { emoji: "😐", label: "Flat day", pct, tone: "ok" };
  if (pct > -1) return { emoji: "😕", label: "Slow day", pct, tone: "bad" };
  if (pct > -3) return { emoji: "😣", label: "Rough day", pct, tone: "bad" };
  return { emoji: "🌧️", label: "Stormy day", pct, tone: "bad" };
}

// Weighted % daily change across a portfolio's holdings. Cash isn't
// "moving" so it's excluded. Returns null when there's nothing to score.
function dailyChangePct(
  holdings: Record<string, Lot>,
  quotes: Record<string, Quote>,
): number | null {
  let totalValue = 0;
  let totalChange = 0;
  let anyMatched = false;
  for (const [sym, lot] of Object.entries(holdings)) {
    const q = quotes[sym];
    if (!q || !isUsablePrice(q.price) || lot.shares <= 0) continue;
    anyMatched = true;
    totalValue += q.price * lot.shares;
    totalChange += q.change * lot.shares;
  }
  if (!anyMatched || totalValue < 1e-6) return null;
  return (totalChange / totalValue) * 100;
}

export function moodForHoldings(
  holdings: Record<string, Lot>,
  quotes: Record<string, Quote>,
): Mood {
  return moodForChange(dailyChangePct(holdings, quotes));
}
