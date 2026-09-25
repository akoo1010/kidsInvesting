"use client";

import { useEffect, useRef, useState } from "react";
import { usePortfolio } from "@/lib/portfolio";
import { TRADING } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { fetchQuote } from "@/lib/fetchQuote";
import {
  buyBlockReason,
  priceMovedTooMuch,
  sellBlockReason,
} from "@/lib/trading";
import type { Quote } from "@/lib/types";

type Pending = {
  side: "buy" | "sell";
  shares: number;
  note: string;
  // The per-share price shown in the confirmation.
  price: number;
  // Set when the re-check found the price had moved: the price the kid had
  // just confirmed, so the dialog can explain the new total.
  movedFrom?: number;
};

// Why a price check was stopped early. Cancel and unmount end quietly with
// no trade; a timeout ends with a message and no trade.
type StopReason = "cancel" | "unmount" | "timeout";

export function TradePanel({ quote }: { quote: Quote }) {
  const { state, ready, buy, sell, addToWatchlist, removeFromWatchlist } =
    usePortfolio();
  // Starts as the server-rendered quote and is replaced by each fresh price
  // fetched when a trade is confirmed.
  const [live, setLive] = useState<Quote>(quote);
  const [shares, setShares] = useState<string>("1");
  const [note, setNote] = useState<string>("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [checking, setChecking] = useState(false);
  const checkRef = useRef<AbortController | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  // Abandon an in-flight price check when the panel goes away, so a trade
  // never fills after the kid has left the page.
  useEffect(() => () => checkRef.current?.abort("unmount" satisfies StopReason), []);

  // Amounts are shown in dollars, the currency cash is kept in. Only dollar
  // stocks can be bought; a non-dollar stock owned from before that rule is
  // still counted in dollars, the same as when it was bought.
  const symbol = quote.symbol;
  const price = live.price;
  const sharesNum = Number(shares) || 0;
  const total = sharesNum * price;
  const holding = state.holdings[symbol];
  const onWatchlist = state.watchlist.includes(symbol);
  const buyBlock = buyBlockReason(live);
  const sellBlock = sellBlockReason(live);
  const canSellHolding = !!holding && !sellBlock;
  const showTradeForm = !buyBlock || canSellHolding;
  const nonDollar = !!live.currency && live.currency !== TRADING.cashCurrency;

  const pendingTotal = pending ? pending.shares * pending.price : 0;
  // A re-check can raise the price past what the Cub can afford.
  const cantAfford =
    pending?.side === "buy" && pendingTotal > state.cash + 1e-6;

  function start(side: Pending["side"]) {
    setMsg(null);
    setPending({ side, shares: sharesNum, note, price });
  }

  function cancelPending() {
    checkRef.current?.abort("cancel" satisfies StopReason);
    checkRef.current = null;
    setChecking(false);
    setPending(null);
  }

  // Re-price right before filling, so a page left open for hours can't buy
  // at an old price. Small moves fill at the fresh price (like a real market
  // order); bigger ones go back to the kid to confirm the new total.
  async function confirmTrade() {
    if (!pending || checkRef.current || cantAfford) return;
    const controller = new AbortController();
    checkRef.current = controller;
    const timer = setTimeout(
      () => controller.abort("timeout" satisfies StopReason),
      TRADING.priceCheckTimeoutMs,
    );
    const stoppedByKid = () => {
      const reason = controller.signal.reason as StopReason | undefined;
      return reason === "cancel" || reason === "unmount";
    };
    setChecking(true);
    setMsg(null);
    const order = pending;
    try {
      let fresh: Quote;
      try {
        fresh = await fetchQuote(symbol, controller.signal);
      } catch {
        if (!stoppedByKid()) {
          setMsg({
            kind: "err",
            text: "Couldn't check the latest price. Check your internet and try again.",
          });
        }
        return;
      }
      if (stoppedByKid()) return;
      setLive(fresh);

      const blocked =
        order.side === "buy" ? buyBlockReason(fresh) : sellBlockReason(fresh);
      if (blocked) {
        setPending(null);
        const nothing = `Nothing was ${order.side === "buy" ? "bought" : "sold"}.`;
        // The watch-only note above already explains buy blocks.
        setMsg({
          kind: "err",
          text: blocked === buyBlockReason(fresh) ? nothing : `${nothing} ${blocked}`,
        });
        return;
      }
      if (priceMovedTooMuch(order.price, fresh.price)) {
        setPending({ ...order, price: fresh.price, movedFrom: order.price });
        return;
      }

      const action = order.side === "buy" ? buy : sell;
      const res = action(symbol, order.shares, fresh.price, order.note);
      setPending(null);
      if (res.ok) {
        const plural = order.shares === 1 ? "" : "s";
        const each = formatMoney(fresh.price);
        setMsg({
          kind: "ok",
          text:
            order.side === "buy"
              ? `Bought ${order.shares} share${plural} of ${symbol} at ${each} each!`
              : `Sold ${order.shares} share${plural} of ${symbol} at ${each} each.`,
        });
        setNote("");
      } else {
        setMsg({ kind: "err", text: res.reason });
      }
    } finally {
      clearTimeout(timer);
      // A cancel may already have handed control to a newer check.
      if (checkRef.current === controller) {
        checkRef.current = null;
        setChecking(false);
      }
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4" aria-busy={!ready}>
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Practice trade</h2>
        <button
          className="text-xs font-semibold text-indigo-700 hover:underline"
          onClick={() =>
            onWatchlist ? removeFromWatchlist(symbol) : addToWatchlist(symbol)
          }
        >
          {onWatchlist ? "★ On watchlist" : "☆ Add to watchlist"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-slate-600">Your cash</div>
          <div className="font-semibold">{formatMoney(state.cash)}</div>
        </div>
        <div>
          <div className="text-slate-600">You own</div>
          <div className="font-semibold">
            {holding
              ? `${holding.shares} share${holding.shares === 1 ? "" : "s"}`
              : "0 shares"}
          </div>
        </div>
      </div>

      {buyBlock && (
        <div
          role="note"
          className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
        >
          <span aria-hidden="true">👀 </span>
          {buyBlock}
          {canSellHolding &&
            (nonDollar
              ? " You can still sell the shares you own — they're counted in dollars, the same as when you bought them."
              : " You can still sell the shares you own.")}
        </div>
      )}

      {showTradeForm && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">How many shares?</span>
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              disabled={!!pending}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Why? (optional, up to 140 chars)</span>
            <textarea
              className="input"
              rows={2}
              maxLength={140}
              placeholder="I think this company will grow because…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!!pending}
            />
          </label>

          <div className="text-sm text-slate-700">
            At {formatMoney(price)} each, that {buyBlock ? "is worth" : "costs"}{" "}
            <strong>{formatMoney(total)}</strong>.
          </div>

          {!pending && (
            <div className={`grid gap-2 ${buyBlock ? "grid-cols-1" : "grid-cols-2"}`}>
              {!buyBlock && (
                <button
                  className="btn btn-success"
                  onClick={() => start("buy")}
                  disabled={sharesNum <= 0 || total > state.cash}
                  title={total > state.cash ? "Not enough cash" : ""}
                >
                  Buy
                </button>
              )}
              <button
                className="btn btn-danger"
                onClick={() => start("sell")}
                disabled={
                  !canSellHolding ||
                  sharesNum <= 0 ||
                  (holding?.shares ?? 0) < sharesNum
                }
              >
                Sell
              </button>
            </div>
          )}
        </>
      )}

      {pending && (
        <div
          role="alertdialog"
          aria-label="Confirm trade"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-col gap-3"
        >
          {pending.movedFrom !== undefined && (
            <div role="alert" className="text-sm font-semibold text-amber-900">
              ⚠️ The price just changed from {formatMoney(pending.movedFrom)} to{" "}
              {formatMoney(pending.price)}.{" "}
              {cantAfford
                ? `Now ${pending.shares} share${pending.shares === 1 ? "" : "s"} would cost more than your ${formatMoney(state.cash)} cash. Cancel and pick fewer shares.`
                : "Here's the new total — confirm again if you still want it."}
            </div>
          )}
          <div className="font-semibold text-amber-900">
            Confirm: {pending.side === "buy" ? "Buy" : "Sell"}{" "}
            <strong>{pending.shares}</strong> share
            {pending.shares === 1 ? "" : "s"} of <strong>{symbol}</strong> at{" "}
            <strong>{formatMoney(pending.price)}</strong> each.
          </div>
          <div className="text-sm text-amber-900">
            Total <strong>{formatMoney(pendingTotal)}</strong>
            {pending.side === "sell"
              ? `. You'll have ${formatMoney(state.cash + pendingTotal)} cash after.`
              : cantAfford
                ? "."
                : `. You'll have ${formatMoney(state.cash - pendingTotal)} cash left.`}
          </div>
          {pending.note && (
            <div className="text-sm text-amber-900 italic">
              Note: “{pending.note}”
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {/* aria-disabled rather than disabled, so keyboard focus stays on
                the button while the price is checked. */}
            <button
              className={`btn ${pending.side === "buy" ? "btn-success" : "btn-danger"}`}
              onClick={confirmTrade}
              aria-disabled={checking || cantAfford}
              autoFocus
            >
              {checking
                ? "Checking price…"
                : `Yes, ${pending.side === "buy" ? "buy" : "sell"} now`}
            </button>
            <button className="btn btn-ghost" onClick={cancelPending}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Always rendered, so screen readers announce new messages. The
          negative margin cancels the card's gap while it's empty. */}
      <div role="status" className="empty:-mt-4">
        {msg && (
          <div
            className={`text-sm rounded-lg px-3 py-2 ${
              msg.kind === "ok"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-rose-50 text-rose-800"
            }`}
          >
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
