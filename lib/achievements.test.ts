import { describe, expect, it } from "vitest";
import { evaluateAchievements } from "@/lib/achievements";
import { STARTING_CASH_AMOUNT } from "@/lib/constants";
import type { PortfolioState, Trade } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function trades(count: number): Trade[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    symbol: "AAPL",
    side: "buy",
    shares: 1,
    price: 1,
    timestamp: i,
  }));
}

function portfolio(overrides: Partial<PortfolioState> = {}): PortfolioState {
  return { cash: STARTING_CASH_AMOUNT, holdings: {}, watchlist: [], trades: [], ...overrides };
}

describe("evaluateAchievements", () => {
  it("awards nothing to a brand-new portfolio", () => {
    expect(evaluateAchievements(portfolio(), STARTING_CASH_AMOUNT)).toEqual([]);
  });

  it("awards trade-count badges", () => {
    expect(evaluateAchievements(portfolio({ trades: trades(1) }), null)).toEqual([
      "first-trade",
    ]);
    expect(evaluateAchievements(portfolio({ trades: trades(10) }), null)).toEqual([
      "first-trade",
      "active-investor",
    ]);
  });

  it("awards bull-run only above the starting cash", () => {
    expect(evaluateAchievements(portfolio(), STARTING_CASH_AMOUNT)).not.toContain("bull-run");
    expect(evaluateAchievements(portfolio(), STARTING_CASH_AMOUNT + 0.01)).toContain(
      "bull-run",
    );
  });

  it("skips value-based badges when the total isn't known", () => {
    const state = portfolio({
      goal: { target: STARTING_CASH_AMOUNT + 1, deadline: null, setAt: 0 },
    });
    expect(evaluateAchievements(state, null)).toEqual([]);
    expect(evaluateAchievements(state, STARTING_CASH_AMOUNT * 2)).toEqual([
      "bull-run",
      "goal-crusher",
    ]);
  });

  it("ignores goals at or below the free starting cash", () => {
    const state = portfolio({
      goal: { target: STARTING_CASH_AMOUNT, deadline: null, setAt: 0 },
    });
    expect(evaluateAchievements(state, STARTING_CASH_AMOUNT)).not.toContain("goal-crusher");
  });

  it("awards diversified for 5 different holdings", () => {
    const holdings = Object.fromEntries(
      ["A", "B", "C", "D", "E"].map((s) => [
        s,
        { shares: 1, costBasis: 1, firstAcquiredAt: Date.now() },
      ]),
    );
    expect(evaluateAchievements(portfolio({ holdings }), null)).toContain("diversified");
  });

  it("awards long-term-holder after 30 days", () => {
    const held = (ageMs: number) =>
      portfolio({
        holdings: { KO: { shares: 1, costBasis: 1, firstAcquiredAt: Date.now() - ageMs } },
      });
    expect(evaluateAchievements(held(29 * DAY_MS), null)).not.toContain("long-term-holder");
    expect(evaluateAchievements(held(31 * DAY_MS), null)).toContain("long-term-holder");
  });
});
