import { apiHandler, ApiError } from "@/lib/server/apiHandler";
import { getHistory, getHistoryBetween } from "@/lib/stocks";
import { HISTORY_RANGES } from "@/lib/types";
import type { StockHistoryRange } from "@/lib/types";

export const revalidate = 300;

function isRange(value: string | null): value is StockHistoryRange {
  return !!value && (HISTORY_RANGES as readonly string[]).includes(value);
}

export const GET = apiHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const rangeParam = searchParams.get("range");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!symbol) {
    throw new ApiError(400, "Provide ?symbol=AAPL");
  }

  if (fromParam) {
    const from = new Date(fromParam);
    const to = toParam ? new Date(toParam) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new ApiError(400, "Invalid from/to date.");
    }
    const points = await getHistoryBetween(symbol, from, to);
    return { symbol: symbol.toUpperCase(), points };
  }
  const range: StockHistoryRange = isRange(rangeParam) ? rangeParam : "6mo";
  const points = await getHistory(symbol, range);
  return { symbol: symbol.toUpperCase(), range, points };
});
