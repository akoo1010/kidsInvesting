"use client";

import { useState } from "react";
import { usePortfolio } from "@/lib/portfolio";
import { formatMoney } from "@/lib/format";

type Pending =
  | { side: "buy"; shares: number; total: number; note: string }
  | { side: "sell"; shares: number; total: number; note: string };

export function TradePanel({
  symbol,
  price,
  currency = "USD",
}: {
  symbol: string;
  price: number;
  currency?: string;
}) {
  const { state, ready, buy, sell, addToWatchlist, removeFromWatchlist } =
    usePortfolio();
  const [shares, setShares] = useState<string>("1");
  const [note, setNote] = useState<string>("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const sharesNum = Number(shares) || 0;
  const total = sharesNum * price;
  const holding = state.holdings[symbol];
  const onWatchlist = state.watchlist.includes(symbol);

  function startBuy() {
    setMsg(null);
    setPending({ side: "buy", shares: sharesNum, total, note });
  }

  function startSell() {
    setMsg(null);
    setPending({ side: "sell", shares: sharesNum, total, note });
  }

  function confirmTrade() {
    if (!pending) return;
    const action = pending.side === "buy" ? buy : sell;
    const res = action(symbol, pending.shares, price, pending.note);
    if (res.ok) {
      setMsg({
        kind: "ok",
        text:
          pending.side === "buy"
            ? `Bought ${pending.shares} share${pending.shares === 1 ? "" : "s"} of ${symbol}!`
            : `Sold ${pending.shares} share${pending.shares === 1 ? "" : "s"} of ${symbol}.`,
      });
      setNote("");
    } else {
      setMsg({ kind: "err", text: res.reason ?? "Could not place trade." });
    }
    setPending(null);
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
        At {formatMoney(price, currency)} each, that costs{" "}
        <strong>{formatMoney(total, currency)}</strong>.
      </div>

      {!pending && (
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn btn-success"
            onClick={startBuy}
            disabled={sharesNum <= 0 || total > state.cash}
            title={total > state.cash ? "Not enough cash" : ""}
          >
            Buy
          </button>
          <button
            className="btn btn-danger"
            onClick={startSell}
            disabled={
              sharesNum <= 0 ||
              !holding ||
              (holding?.shares ?? 0) < sharesNum
            }
          >
            Sell
          </button>
        </div>
      )}

      {pending && (
        <div
          role="alertdialog"
          aria-label="Confirm trade"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-col gap-3"
        >
          <div className="font-semibold text-amber-900">
            Confirm: {pending.side === "buy" ? "Buy" : "Sell"}{" "}
            <strong>{pending.shares}</strong> share
            {pending.shares === 1 ? "" : "s"} of <strong>{symbol}</strong> at{" "}
            <strong>{formatMoney(price, currency)}</strong> each.
          </div>
          <div className="text-sm text-amber-900">
            Total{" "}
            <strong>{formatMoney(pending.total, currency)}</strong>
            {pending.side === "buy"
              ? `. You'll have ${formatMoney(state.cash - pending.total, currency)} cash left.`
              : `. You'll have ${formatMoney(state.cash + pending.total, currency)} cash after.`}
          </div>
          {pending.note && (
            <div className="text-sm text-amber-900 italic">
              Note: “{pending.note}”
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`btn ${pending.side === "buy" ? "btn-success" : "btn-danger"}`}
              onClick={confirmTrade}
              autoFocus
            >
              Yes, {pending.side === "buy" ? "buy" : "sell"} now
            </button>
            <button className="btn btn-ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && !pending && (
        <div
          role="status"
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
  );
}
