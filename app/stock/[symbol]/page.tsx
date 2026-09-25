import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuote, QuoteNotFoundError } from "@/lib/stocks";
import { PriceChart } from "@/components/PriceChart";
import { TradePanel } from "@/components/TradePanel";
import { Fundamentals } from "@/components/Fundamentals";
import { formatChange, formatMoney, formatPercent, gainColor } from "@/lib/format";

export const revalidate = 30;

export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol).toUpperCase();

  let quote;
  try {
    quote = await getQuote(sym);
  } catch (err) {
    const isNotFound =
      err instanceof QuoteNotFoundError ||
      (err instanceof Error &&
        (err.message.toLowerCase().includes("not found") ||
          err.message.includes("404") ||
          err.message.toLowerCase().includes("does not exist")));
    if (isNotFound) {
      notFound();
    }
    console.error(`Failed to fetch stock quote for symbol ${sym}:`, err);
    throw err;
  }

  const up = quote.change > 0;
  const flat = quote.change === 0;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/explore" className="text-sm text-indigo-600 hover:underline w-fit">
        ← Back to explore
      </Link>
      <header className="card p-6 flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm text-slate-500">{quote.exchange}</div>
            <h1 className="text-3xl font-extrabold">{quote.symbol}</h1>
            <div className="text-slate-600">{quote.name}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-extrabold">
              {formatMoney(quote.price, quote.currency)}
            </div>
            <div className={`text-sm font-semibold ${gainColor(quote.change)}`}>
              {up ? "▲" : flat ? "■" : "▼"}{" "}
              {formatChange(quote.change, quote.currency)} (
              {formatPercent(quote.changePercent)}) today
            </div>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PriceChart symbol={quote.symbol} currency={quote.currency} />
        </div>
        <TradePanel key={quote.symbol} quote={quote} />
      </div>

      <Fundamentals quote={quote} />

      <div className="card p-5 flex flex-col gap-2 text-sm text-slate-700">
        <h2 className="font-bold text-base">💡 Kid-tip</h2>
        <p>
          When you buy a share of <strong>{quote.symbol}</strong>, you own a
          tiny piece of {quote.name}. If the company does well, your share might
          be worth more later. If it does poorly, it might be worth less. That&apos;s
          why investors think long-term and spread their money across many
          companies.
        </p>
      </div>
    </div>
  );
}
