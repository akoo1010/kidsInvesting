// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioView } from "@/components/PortfolioView";
import { STORAGE_KEYS } from "@/lib/constants";
import { PortfolioProvider } from "@/lib/portfolio";
import type { PortfolioState, Quote } from "@/lib/types";

const TODAY = new Date().toISOString().slice(0, 10);

function quote(symbol: string, price: number): Quote {
  return {
    symbol,
    name: symbol,
    price,
    currency: "USD",
    change: 0,
    changePercent: 0,
    previousClose: price,
    quoteType: "EQUITY",
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// $8,500 cash + AAPL and KO bought for $1,500 total: worth exactly the
// $10,000 starting cash at cost.
function seedCub(overrides: Partial<PortfolioState> = {}) {
  const portfolio: PortfolioState = {
    cash: 8_500,
    holdings: {
      AAPL: { shares: 10, costBasis: 1_000, firstAcquiredAt: Date.now() },
      KO: { shares: 10, costBasis: 500, firstAcquiredAt: Date.now() },
    },
    watchlist: [],
    trades: [],
    valueHistory: [],
    achievements: {},
    ...overrides,
  };
  localStorage.setItem(
    STORAGE_KEYS.profiles,
    JSON.stringify({
      profiles: [{ id: "cub", name: "Sam", emoji: "🐻", createdAt: 1 }],
      currentProfileId: "cub",
      portfolios: { cub: portfolio },
    }),
  );
}

function savedCub(): PortfolioState {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.profiles) ?? "null").portfolios.cub;
}

// Answers the page's API calls: /api/quote gets `quotes`, everything else
// (sector profiles, S&P history) gets an empty result.
// "pending" leaves the quote request in flight.
function mockApi(quotes: { quotes: Quote[]; notFound?: string[] } | Error | "pending") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/quote")) {
        if (quotes === "pending") return new Promise(() => {});
        if (quotes instanceof Error) throw quotes;
        return { ok: true, status: 200, json: async () => quotes };
      }
      return { ok: true, status: 200, json: async () => ({ profiles: [], points: [] }) };
    }),
  );
}

// Let every pending effect run (including a save that shouldn't happen)
// before asserting that nothing was saved.
async function settle() {
  await act(async () => {});
}

function renderPage() {
  render(
    <PortfolioProvider>
      <PortfolioView />
    </PortfolioProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  seedCub();
  // Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PortfolioView: saving today's value", () => {
  it("saves today's value and awards value badges when every price loads", async () => {
    mockApi({ quotes: [quote("AAPL", 150), quote("KO", 60)] });
    renderPage();

    await waitFor(() => {
      expect(savedCub().valueHistory).toEqual([{ date: TODAY, value: 10_600 }]);
      expect(savedCub().achievements).toHaveProperty("bull-run");
    });
  });

  // Regression: a failed quote used to count as $0 and be saved as a crash.
  it("saves nothing when one price didn't load, even if the estimate looks good", async () => {
    // Counting KO at cost, the estimate is $10,500 — above the starting cash —
    // but it isn't a real price, so no snapshot and no bull-run badge.
    mockApi({ quotes: [quote("AAPL", 150)] });
    renderPage();

    expect(await screen.findByText(/Couldn't get today's price for KO/)).toBeTruthy();
    await settle();
    expect(savedCub().valueHistory).toEqual([]);
    expect(savedCub().achievements).toEqual({});
  });

  it("saves nothing when the price request fails", async () => {
    mockApi(new Error("offline"));
    renderPage();

    expect(await screen.findByText(/Couldn't get today's price for AAPL, KO/)).toBeTruthy();
    await settle();
    expect(savedCub().valueHistory).toEqual([]);
  });

  // Regression: one delisted stock used to block saving forever.
  it("counts a stock Yahoo no longer knows as $0 and keeps saving", async () => {
    mockApi({ quotes: [quote("AAPL", 200)], notFound: ["KO"] });
    renderPage();

    expect(await screen.findByText(/KO has no price right now/)).toBeTruthy();
    await waitFor(() => {
      expect(savedCub().valueHistory).toEqual([{ date: TODAY, value: 10_500 }]);
    });
  });
});

describe("PortfolioView: goal progress", () => {
  const goal = { target: 10_200, deadline: Date.now() - 3 * DAY_MS, setAt: 0 };

  it("waits while prices load", async () => {
    seedCub({ goal });
    mockApi("pending");
    renderPage();

    expect(await screen.findByText("Waiting for prices…")).toBeTruthy();
    expect(screen.queryByText("Goal reached! 🏆")).toBeNull();
  });

  // Regression: after a failed load the card kept saying it was waiting,
  // and told screen readers the goal was at 0%.
  it("says prices didn't load, without a 0% bar or a missed-deadline label", async () => {
    seedCub({ goal });
    mockApi(new Error("offline"));
    renderPage();

    expect(await screen.findByText(/Some prices didn't load/)).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Goal progress" });
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
    expect(bar.getAttribute("aria-valuetext")).toBe("Unknown");
    expect(screen.queryByText(/days past/)).toBeNull();
    expect(screen.queryByText("Goal reached! 🏆")).toBeNull();
  });

  it("shows real progress once every price loads", async () => {
    seedCub({ goal });
    mockApi({ quotes: [quote("AAPL", 150), quote("KO", 60)] });
    renderPage();

    expect(await screen.findByText("Goal reached! 🏆")).toBeTruthy();
    expect(screen.getByText("$10,600.00 of $10,200.00 (100%)")).toBeTruthy();
  });
});
