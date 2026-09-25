// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TradePanel } from "@/components/TradePanel";
import { STORAGE_KEYS } from "@/lib/constants";
import { PortfolioProvider } from "@/lib/portfolio";
import type { PortfolioState, Quote } from "@/lib/types";

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 100,
    currency: "USD",
    change: 0,
    changePercent: 0,
    previousClose: 100,
    quoteType: "EQUITY",
    ...overrides,
  };
}

function seedCub(portfolio: Partial<PortfolioState> = {}) {
  localStorage.setItem(
    STORAGE_KEYS.profiles,
    JSON.stringify({
      profiles: [{ id: "cub", name: "Sam", emoji: "🐻", createdAt: 1 }],
      currentProfileId: "cub",
      portfolios: {
        cub: { cash: 10_000, holdings: {}, watchlist: [], trades: [], ...portfolio },
      },
    }),
  );
}

function savedCub(): PortfolioState {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.profiles) ?? "null").portfolios.cub;
}

// Each call to /api/quote gets the next response in line.
function mockFreshQuotes(...responses: Array<Quote | Error>) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fetchMock.mockRejectedValueOnce(r);
    else fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => r });
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPanel(q: Quote) {
  render(
    <PortfolioProvider>
      <TradePanel quote={q} />
    </PortfolioProvider>,
  );
}

function setShares(n: number) {
  fireEvent.change(screen.getByLabelText("How many shares?"), {
    target: { value: String(n) },
  });
}

const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TradePanel: re-pricing at confirm time", () => {
  it("fills at the fresh price when it barely moved", async () => {
    seedCub();
    const fetchMock = mockFreshQuotes(quote({ price: 100.5 }));
    renderPanel(quote({ price: 100 }));

    setShares(10);
    click("Buy");
    click("Yes, buy now");

    expect(
      await screen.findByText("Bought 10 shares of AAPL at $100.50 each!"),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/quote?symbol=AAPL", { cache: "no-store" });
    expect(savedCub().cash).toBeCloseTo(10_000 - 1_005, 6);
    expect(savedCub().holdings.AAPL.shares).toBe(10);
  });

  it("asks again at the new price when the price jumped since the page loaded", async () => {
    seedCub();
    mockFreshQuotes(quote({ price: 120 }), quote({ price: 120 }));
    renderPanel(quote({ price: 100 }));

    setShares(5);
    click("Buy");
    click("Yes, buy now");

    expect(
      await screen.findByText(/The price just changed from \$100\.00 to \$120\.00/),
    ).toBeTruthy();
    expect(screen.getByText(/Total/).textContent).toContain("$600.00");
    expect(savedCub().holdings).toEqual({});

    click("Yes, buy now");
    expect(await screen.findByText("Bought 5 shares of AAPL at $120.00 each!")).toBeTruthy();
    expect(savedCub().cash).toBe(9_400);
  });

  it("does not trade when the fresh price can't be fetched", async () => {
    seedCub();
    mockFreshQuotes(new Error("offline"));
    renderPanel(quote());

    click("Buy");
    click("Yes, buy now");

    expect(await screen.findByText(/Couldn't check the latest price/)).toBeTruthy();
    expect(screen.getByRole("alertdialog", { name: "Confirm trade" })).toBeTruthy();
    expect(savedCub().holdings).toEqual({});
    expect(savedCub().cash).toBe(10_000);
  });

  it("cancels the trade when the fresh quote has no price", async () => {
    seedCub();
    mockFreshQuotes(quote({ price: 0 }));
    renderPanel(quote());

    click("Buy");
    click("Yes, buy now");

    expect(await screen.findByText("Nothing was bought.")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toMatch(/no live price/);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(savedCub().holdings).toEqual({});
  });

  it("reports a buy the fresh price makes unaffordable", async () => {
    seedCub({ cash: 1_000 });
    mockFreshQuotes(quote({ price: 100.5 }));
    renderPanel(quote({ price: 100 }));

    setShares(10);
    click("Buy");
    click("Yes, buy now");

    expect(
      await screen.findByText("Not enough cash. You need $1,005.00 but have $1,000.00."),
    ).toBeTruthy();
    expect(savedCub().cash).toBe(1_000);
  });
});

describe("TradePanel: what can be traded", () => {
  it("makes a stock priced in yen watch-only", () => {
    seedCub();
    renderPanel(quote({ symbol: "7203.T", price: 3_000, currency: "JPY" }));

    expect(screen.getByRole("note").textContent).toMatch(/priced in JPY/);
    expect(screen.queryByRole("button", { name: "Buy" })).toBeNull();
    expect(screen.queryByLabelText("How many shares?")).toBeNull();
    expect(screen.getByRole("button", { name: /watchlist/ })).toBeTruthy();
  });

  it("makes crypto watch-only", () => {
    seedCub();
    renderPanel(quote({ symbol: "BTC-USD", quoteType: "CRYPTOCURRENCY" }));

    expect(screen.getByRole("note").textContent).toMatch(/Crypto is watch-only/);
    expect(screen.queryByRole("button", { name: "Buy" })).toBeNull();
  });

  it("pauses trading when there's no price", () => {
    seedCub({ holdings: { AAPL: { shares: 1, costBasis: 100, firstAcquiredAt: 1 } } });
    renderPanel(quote({ price: 0 }));

    expect(screen.getByRole("note").textContent).toMatch(/no live price/);
    expect(screen.queryByRole("button", { name: "Buy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sell" })).toBeNull();
  });

  it("still lets a Cub sell a non-dollar stock they already own", async () => {
    seedCub({
      cash: 0,
      holdings: { "7203.T": { shares: 2, costBasis: 6_000, firstAcquiredAt: 1 } },
    });
    mockFreshQuotes(quote({ symbol: "7203.T", price: 3_000, currency: "JPY" }));
    renderPanel(quote({ symbol: "7203.T", price: 3_000, currency: "JPY" }));

    expect(screen.getByRole("note").textContent).toMatch(/You can still sell/);
    expect(screen.queryByRole("button", { name: "Buy" })).toBeNull();

    click("Sell");
    click("Yes, sell now");

    expect(await screen.findByText(/Sold 1 share of 7203\.T/)).toBeTruthy();
    expect(savedCub().holdings["7203.T"].shares).toBe(1);
  });
});
