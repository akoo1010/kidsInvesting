import { apiHandler, parseSymbolsParam, ApiError } from "@/lib/server/apiHandler";
import { findQuotes, getQuote } from "@/lib/stocks";

export const revalidate = 30;

export const GET = apiHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols");
  const symbol = searchParams.get("symbol");

  if (symbolsParam) {
    const symbols = parseSymbolsParam(req);
    return await findQuotes(symbols);
  }

  if (!symbol) {
    throw new ApiError(400, "Provide ?symbol=AAPL or ?symbols=AAPL,MSFT");
  }

  const quote = await getQuote(symbol);
  return quote;
});
