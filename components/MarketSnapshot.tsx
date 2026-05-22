import { getQuotes } from "@/lib/stocks";
import { formatPercent, gainColor } from "@/lib/format";

const INDEX_SYMBOLS: { symbol: string; label: string; emoji: string }[] = [
  { symbol: "^GSPC", label: "S&P 500", emoji: "🇺🇸" },
  { symbol: "^IXIC", label: "Nasdaq", emoji: "💻" },
  { symbol: "^DJI", label: "Dow Jones", emoji: "🏭" },
  { symbol: "BTC-USD", label: "Bitcoin", emoji: "🪙" },
];

export async function MarketSnapshot() {
  let quotes: Awaited<ReturnType<typeof getQuotes>> = [];
  try {
    quotes = await getQuotes(INDEX_SYMBOLS.map((s) => s.symbol));
  } catch (err) {
    console.error("Failed to load market snapshot quotes:", err);
    // tolerate offline / API hiccups — show placeholder cards
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {INDEX_SYMBOLS.map((idx) => {
        const q = quotes.find((x) => x.symbol === idx.symbol);
        return (
          <div key={idx.symbol} className="card p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>{idx.emoji}</span>
              <span>{idx.label}</span>
            </div>
            <div className="mt-2 text-lg font-bold">
              {q
                ? q.price.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })
                : "—"}
            </div>
            <div className={`text-xs ${q ? gainColor(q.change) : "text-slate-600"}`}>
              {q ? formatPercent(q.changePercent) : "loading…"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
