"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchHit } from "@/lib/types";

export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 1) {
      setHits([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!controller.signal.aborted) setHits(data.hits ?? []);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Failed to autocomplete search:", err);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(symbol: string) {
    setOpen(false);
    setQ("");
    router.push(`/stock/${encodeURIComponent(symbol.toUpperCase())}`);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Search a company or symbol (e.g. Apple, AAPL, Disney)"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) go(hits[0].symbol);
          }}
        />
      </div>
      {open && q.trim().length > 0 && (
        <div className="absolute z-20 mt-2 w-full card overflow-hidden">
          {loading && (
            <div className="px-4 py-3 text-sm text-slate-500">Searching…</div>
          )}
          {!loading && hits.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-500">
              No matches. Try a different word.
            </div>
          )}
          {hits.map((h) => (
            <button
              key={`${h.symbol}-${h.exchange ?? ""}`}
              onClick={() => go(h.symbol)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-3 border-t first:border-t-0 border-slate-100"
            >
              <div>
                <div className="font-semibold">{h.symbol}</div>
                <div className="text-xs text-slate-500">{h.name}</div>
              </div>
              <div className="text-xs text-slate-600">
                {h.exchange}
                {h.type ? ` • ${h.type}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
