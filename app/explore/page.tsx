import { SearchBox } from "@/components/SearchBox";
import { QuoteCard } from "@/components/QuoteCard";
import { getQuotes } from "@/lib/stocks";

const CATEGORIES: { name: string; emoji: string; symbols: string[] }[] = [
  {
    name: "Things you use every day",
    emoji: "🧃",
    symbols: ["AAPL", "GOOGL", "AMZN", "NFLX", "DIS", "MCD", "KO", "NKE"],
  },
  {
    name: "Cars & rockets",
    emoji: "🚗",
    symbols: ["TSLA", "F", "GM", "RIVN", "BA", "LMT"],
  },
  {
    name: "Games & toys",
    emoji: "🎮",
    symbols: ["NTDOY", "SONY", "EA", "TTWO", "HAS", "MAT"],
  },
  {
    name: "Big tech & chips",
    emoji: "💻",
    symbols: ["MSFT", "NVDA", "AMD", "META", "INTC", "ORCL"],
  },
];

export const revalidate = 60;

export default async function ExplorePage() {
  const allSymbols = Array.from(
    new Set(CATEGORIES.flatMap((c) => c.symbols)),
  );
  let quotes: Awaited<ReturnType<typeof getQuotes>> = [];
  try {
    quotes = await getQuotes(allSymbols);
  } catch (err) {
    console.error("Failed to fetch explore page stock quotes:", err);
    quotes = [];
  }
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-6 flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Explore stocks</h1>
        <p className="text-slate-600">
          Find a company you already know — chances are, you can own a tiny
          piece of it. Search for any company name or ticker symbol.
        </p>
        <SearchBox autoFocus />
      </section>

      {CATEGORIES.map((cat) => (
        <section key={cat.name} className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">
            {cat.emoji} {cat.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {cat.symbols.map((sym) => {
              const q = bySymbol.get(sym);
              if (!q) {
                return (
                  <div key={sym} className="card p-4 opacity-60">
                    <div className="font-bold">{sym}</div>
                    <div className="text-xs text-slate-500">
                      price unavailable
                    </div>
                  </div>
                );
              }
              return <QuoteCard key={sym} quote={q} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
