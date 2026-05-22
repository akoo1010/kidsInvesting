import { STARTING_CASH_AMOUNT } from "@/lib/constants";
import type { PortfolioState } from "@/lib/types";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-trade",
    title: "First trade",
    description: "Make your first buy or sell.",
    emoji: "🎉",
  },
  {
    id: "bull-run",
    title: "Bull run",
    description: "Push your total value above the starting cash.",
    emoji: "📈",
  },
  {
    id: "diversified",
    title: "Diversified",
    description: "Own 5 different stocks at the same time.",
    emoji: "🧺",
  },
  {
    id: "long-term-holder",
    title: "Long-term holder",
    description: "Hold any stock for 30 days.",
    emoji: "🕰️",
  },
  {
    id: "active-investor",
    title: "Active investor",
    description: "Place 10 trades.",
    emoji: "⚡",
  },
  {
    id: "goal-crusher",
    title: "Goal crusher",
    description: "Reach the goal you set.",
    emoji: "🏆",
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluateAchievements(
  state: PortfolioState,
  totalValue: number,
): string[] {
  const earned: string[] = [];

  if (state.trades.length >= 1) earned.push("first-trade");
  if (totalValue > STARTING_CASH_AMOUNT) earned.push("bull-run");

  const heldLots = Object.entries(state.holdings).filter(
    ([, lot]) => lot.shares > 0,
  );
  if (heldLots.length >= 5) earned.push("diversified");

  const now = Date.now();
  // Use each lot's firstAcquiredAt — set when shares went from 0 -> >0 and
  // cleared on full sell-out, so a sell-and-rebuy correctly restarts the
  // clock. Falls back to the oldest buy in `trades` for portfolios saved
  // before firstAcquiredAt existed.
  for (const [, lot] of heldLots) {
    if (now - lot.firstAcquiredAt >= 30 * DAY_MS) {
      earned.push("long-term-holder");
      break;
    }
  }

  if (state.trades.length >= 10) earned.push("active-investor");

  // Goal must exceed the free starting cash so a kid can't "earn" the badge
  // by setting an artificially-low target.
  if (
    state.goal &&
    state.goal.target > STARTING_CASH_AMOUNT &&
    totalValue >= state.goal.target
  ) {
    earned.push("goal-crusher");
  }

  return earned;
}
