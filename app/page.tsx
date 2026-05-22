import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "@/components/SearchBox";
import { WatchlistGrid } from "@/components/WatchlistGrid";
import { MarketSnapshot } from "@/components/MarketSnapshot";

export const revalidate = 60;

function MarketSnapshotSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="h-3 w-16 bg-slate-200 rounded" />
          <div className="mt-2 h-5 w-20 bg-slate-200 rounded" />
          <div className="mt-2 h-3 w-12 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="card p-6 sm:p-10 flex flex-col gap-4">
        <div className="flex items-center gap-2 chip w-fit">🐻 Welcome, Cub Investor</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Learn investing with{" "}
          <span className="text-indigo-600">real prices</span> and{" "}
          <span className="text-amber-600">pretend money</span>.
        </h1>
        <p className="text-slate-600 max-w-2xl">
          You start with <strong>$10,000</strong> of practice cash. Buy and sell
          real stocks at today&apos;s real prices. See how your choices grow (or
          shrink!) over time. No real money is ever used.
        </p>
        <div className="mt-2 max-w-2xl">
          <SearchBox />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/explore" className="btn btn-primary">
            🔎 Explore stocks
          </Link>
          <Link href="/portfolio" className="btn btn-ghost">
            💼 See my portfolio
          </Link>
          <Link href="/learn" className="btn btn-ghost">
            📘 What&apos;s a stock?
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Market today</h2>
          <span className="text-xs text-slate-500">
            Prices may be delayed up to 15 min
          </span>
        </div>
        <Suspense fallback={<MarketSnapshotSkeleton />}>
          <MarketSnapshot />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Your watchlist</h2>
        <WatchlistGrid />
      </section>
    </div>
  );
}
