import { apiHandler, parseSymbolsParam, ApiError } from "@/lib/server/apiHandler";
import { getProfile, getProfiles } from "@/lib/stocks";

export const revalidate = 86400; // sectors rarely change

export const GET = apiHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols");
  const symbol = searchParams.get("symbol");

  if (symbolsParam) {
    const symbols = parseSymbolsParam(req);
    const profiles = await getProfiles(symbols);
    return { profiles };
  }

  if (!symbol) {
    throw new ApiError(400, "Provide ?symbol=AAPL or ?symbols=AAPL,MSFT");
  }

  const profile = await getProfile(symbol);
  return profile;
});
