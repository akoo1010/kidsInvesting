import { apiHandler } from "@/lib/server/apiHandler";
import { searchSymbols } from "@/lib/stocks";

export const GET = apiHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const hits = await searchSymbols(q);
  return { hits };
});
