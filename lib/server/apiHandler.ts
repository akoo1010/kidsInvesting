// Wrap each route handler so:
//   - Uncaught errors return a stable, non-leaky JSON 500
//   - Origin/Referer is checked on state-changing methods (basic CSRF)
//   - JSON parsing is centralized with a body-size cap
//   - Throwing an ApiError mid-handler returns a clean JSON response
import { NextResponse } from "next/server";
import { ENV, SYNC } from "@/lib/constants";

export class ApiError extends Error {
  constructor(
    public status: number,
    public publicMessage: string,
    public extra?: Record<string, unknown>,
  ) {
    super(publicMessage);
  }
}

function trustedOrigins(): Set<string> {
  const raw = process.env[ENV.trustedOrigins];
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function checkOrigin(req: Request): void {
  // Only enforce on writes — GETs are safe.
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const origin = req.headers.get("origin");
  if (!origin) {
    // No Origin header on a same-origin form post (rare for fetch). Allow.
    return;
  }
  const allowed = trustedOrigins();
  if (allowed.size === 0) {
    // No explicit allowlist configured — accept same-origin only by comparing
    // to the request URL's origin.
    const requestOrigin = new URL(req.url).origin;
    if (origin !== requestOrigin) {
      throw new ApiError(403, "Origin not allowed.");
    }
    return;
  }
  if (!allowed.has(origin)) {
    throw new ApiError(403, "Origin not allowed.");
  }
}

export async function parseJsonBody<T = unknown>(
  req: Request,
  maxBytes = SYNC.maxStateBytes,
): Promise<T> {
  const len = req.headers.get("content-length");
  if (len && Number(len) > maxBytes) {
    throw new ApiError(413, "Request body too large.");
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    throw new ApiError(400, "Could not read request body.");
  }
  if (text.length > maxBytes) {
    throw new ApiError(413, "Request body too large.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(400, "Invalid JSON.");
  }
}

export function apiHandler<T>(
  fn: (req: Request) => Promise<T>,
): (req: Request) => Promise<NextResponse> {
  return async (req: Request) => {
    try {
      checkOrigin(req);
      const result = await fn(req);
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: err.publicMessage, ...(err.extra ?? {}) },
          { status: err.status },
        );
      }
      // Log internally so devs can debug, return a stable shape to clients.
      console.error("[api]", err);
      return NextResponse.json(
        { error: "Something went wrong on our end." },
        { status: 500 },
      );
    }
  };
}

export function parseSymbolsParam(req: Request): string[] {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols") || "";
  const symbol = searchParams.get("symbol");
  
  if (symbolsParam) {
    return symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return symbol ? [symbol.trim()] : [];
}
