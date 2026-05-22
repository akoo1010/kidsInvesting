"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortfolio } from "@/lib/portfolio";
import { useParentLock } from "@/lib/parentLock";
import { formatMoney } from "@/lib/format";

const links = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/learn", label: "Learn" },
];

export function NavBar() {
  const pathname = usePathname();
  const { ready, state, currentProfile } = usePortfolio();
  const { isUnlocked } = useParentLock();

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white">
            🐻
          </span>
          <span>Wall Street Cubs</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1 ml-4">
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="chip" title="Practice cash">
            💰 {ready && currentProfile ? formatMoney(state.cash) : "—"}
          </span>
          {currentProfile && (
            <div
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50"
              aria-label={`Playing as ${currentProfile.name}`}
            >
              <span className="text-xl" aria-hidden="true">
                {currentProfile.emoji}
              </span>
              <span className="hidden sm:inline text-sm font-semibold">
                {currentProfile.name}
              </span>
            </div>
          )}
          <Link
            href="/admin"
            className={`px-2 py-1.5 rounded-lg text-sm font-semibold ${
              pathname.startsWith("/admin")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-700 hover:bg-slate-100"
            }`}
            aria-label={isUnlocked ? "Parent admin (unlocked)" : "Parent admin (locked)"}
            title={isUnlocked ? "Parent admin (unlocked)" : "Parent admin (locked)"}
          >
            <span aria-hidden="true">{isUnlocked ? "🔓" : "🔒"}</span>
            <span className="hidden sm:inline ml-1">Parent</span>
          </Link>
        </div>
      </div>
      <nav className="flex sm:hidden gap-1 px-4 pb-2 overflow-x-auto">
        {links.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
