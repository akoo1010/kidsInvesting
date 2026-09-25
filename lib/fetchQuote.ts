import type { Quote } from "@/lib/types";

// Client-side fetch of one live quote, bypassing every cache. Used to
// re-price a trade right before it fills.
export async function fetchQuote(symbol: string, signal?: AbortSignal): Promise<Quote> {
  const r = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, {
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw new Error(`Quote request failed (${r.status}).`);
  const data = (await r.json()) as Partial<Quote> | null;
  if (!data || typeof data.price !== "number") {
    throw new Error("Quote response was malformed.");
  }
  return data as Quote;
}
