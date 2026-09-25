// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/lib/constants";
import { PortfolioProvider, usePortfolio } from "@/lib/portfolio";
import type { ActionResult } from "@/lib/types";

function wrapper({ children }: { children: React.ReactNode }) {
  return <PortfolioProvider>{children}</PortfolioProvider>;
}

function setup() {
  return renderHook(() => usePortfolio(), { wrapper }).result;
}

function withCub() {
  const result = setup();
  act(() => {
    result.current.createProfile("Sam", "🐻");
  });
  return result;
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("PortfolioProvider trading", () => {
  it("reports failure when no Cub is selected", () => {
    const result = setup();
    let res: ActionResult | undefined;
    act(() => {
      res = result.current.buy("AAPL", 1, 100);
    });
    expect(res).toEqual({ ok: false, reason: "Pick a Cub first." });
  });

  it("buys and sells for the current Cub and reports each result", () => {
    const result = withCub();
    let res: ActionResult | undefined;

    act(() => {
      res = result.current.buy("aapl", 10, 100, "I like phones");
    });
    expect(res).toEqual({ ok: true });
    expect(result.current.state.cash).toBe(9_000);
    expect(result.current.state.holdings.AAPL.shares).toBe(10);
    expect(result.current.state.trades[0]).toMatchObject({
      symbol: "AAPL",
      side: "buy",
      note: "I like phones",
    });

    act(() => {
      res = result.current.sell("AAPL", 4, 150);
    });
    expect(res).toEqual({ ok: true });
    expect(result.current.state.cash).toBe(9_600);
    expect(result.current.state.holdings.AAPL.shares).toBe(6);
  });

  it("reports a rejected trade and leaves the state untouched", () => {
    const result = withCub();
    const before = result.current.state;
    let res: ActionResult | undefined;
    act(() => {
      res = result.current.buy("AAPL", 1_000, 100);
    });
    expect(res).toEqual({
      ok: false,
      reason: "Not enough cash. You need $100,000.00 but have $10,000.00.",
    });
    expect(result.current.state).toBe(before);
  });

  it("rejects a trade at a $0 price", () => {
    const result = withCub();
    let res: ActionResult | undefined;
    act(() => {
      res = result.current.buy("AAPL", 5, 0);
    });
    expect(res?.ok).toBe(false);
    expect(result.current.state.holdings).toEqual({});
  });

  // Regression: results used to be set inside a React state updater, which
  // React may run later — so a second trade in the same tick could report
  // success even though it was rejected.
  it("reports the right result for back-to-back trades in the same tick", () => {
    const result = withCub();
    let first: ActionResult | undefined;
    let second: ActionResult | undefined;
    act(() => {
      first = result.current.buy("AAPL", 60, 100);
      second = result.current.buy("MSFT", 50, 100);
    });
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({
      ok: false,
      reason: "Not enough cash. You need $5,000.00 but have $4,000.00.",
    });
    expect(result.current.state.cash).toBe(4_000);
    expect(result.current.state.holdings).not.toHaveProperty("MSFT");
  });

  it("saves trades to localStorage", () => {
    const result = withCub();
    act(() => {
      result.current.buy("KO", 2, 50);
    });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.profiles) ?? "null");
    const cubId = result.current.currentProfile?.id as string;
    expect(saved.portfolios[cubId].holdings.KO).toMatchObject({ shares: 2, costBasis: 100 });
  });
});
