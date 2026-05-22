# Deploying Wall Street Cubs to the cloud

This app runs locally with **zero** external services. Cross-device sync uses
a JSON file under `./data/` and an in-memory rate limiter — both fine for a
single Node process on a laptop. **Neither survives serverless deployment**,
so before you ship to Vercel (or anywhere with ephemeral filesystems / a fleet
of instances) you need to swap them out.

This document covers everything that has to change, ordered by whether it's
a hard blocker, a recommended hardening, or a nice-to-have.

---

## TL;DR

| Concern                  | Today                     | Required for cloud           | Effort |
|--------------------------|---------------------------|------------------------------|--------|
| Family / session storage | `JsonFileRepository`      | Postgres adapter (Neon)      | ~1 h   |
| Sync rate limit          | In-memory Map (per-instance) | Redis-backed (Upstash)    | ~30 m  |
| CORS allowlist           | Same-origin only          | Set `WSC_TRUSTED_ORIGINS`    | 1 m    |
| Yahoo Finance caching    | Per-route revalidate only | Add KV cache at scale        | ~1 h   |
| Bearer tokens in `localStorage` | Works, but XSS-risk | Consider httpOnly cookies   | ~3 h   |
| Logging                  | `console.error`           | Replace with structured logger | ~1 h |
| Database backups         | None                      | Configure Neon PITR          | 5 m    |

---

## 1. Required: replace the family repository

**Why it's required.** Serverless functions on Vercel (and most cloud
platforms) have ephemeral filesystems. The `data/families.json` file is
re-created on every cold start and disappears between deployments. You will
register a family, deploy a fix, and it will be gone.

**Interface.** `lib/server/repo.ts` exports `FamilyRepository` — 8 methods.
The default `JsonFileRepository` implementation is local-only. Replace it.

**Recommended backend: Neon Postgres** (Vercel Marketplace integration).

### Schema

```sql
CREATE TABLE families (
  id                TEXT PRIMARY KEY,           -- the handle, lowercase
  password_hash     TEXT NOT NULL,
  password_salt     TEXT NOT NULL,
  state             JSONB,                      -- the SyncedSnapshot
  state_updated_at  BIGINT NOT NULL DEFAULT 0,  -- ms since epoch
  created_at        BIGINT NOT NULL
);

CREATE TABLE sessions (
  token         TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_at    BIGINT NOT NULL,
  last_used_at  BIGINT NOT NULL
);

CREATE INDEX sessions_family_idx ON sessions(family_id);
CREATE INDEX sessions_last_used_idx ON sessions(last_used_at);
```

### Adapter template

Install `pg` (the lowest-dependency option — switch to Drizzle or Prisma
later if your team prefers an ORM):

```bash
npm install pg
npm install -D @types/pg
```

Then add to `lib/server/repo.ts` (alongside `JsonFileRepository`):

```ts
import { Pool } from "pg";
import type {
  FamilyRecord,
  FamilyRepository,
  SessionRecord,
} from "./repo";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requires SSL, but the connection string already includes ?sslmode=require
});

export class PostgresRepository implements FamilyRepository {
  async getFamilyById(id: string): Promise<FamilyRecord | null> {
    const { rows } = await pool.query(
      `SELECT id, password_hash, password_salt, state, state_updated_at, created_at
       FROM families WHERE id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    return {
      id: rows[0].id,
      passwordHash: rows[0].password_hash,
      passwordSalt: rows[0].password_salt,
      state: rows[0].state,
      stateUpdatedAt: Number(rows[0].state_updated_at),
      createdAt: Number(rows[0].created_at),
    };
  }

  async createFamily(rec: FamilyRecord): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO families(id, password_hash, password_salt, state, state_updated_at, created_at)
         VALUES($1, $2, $3, $4, $5, $6)`,
        [
          rec.id,
          rec.passwordHash,
          rec.passwordSalt,
          rec.state,
          rec.stateUpdatedAt,
          rec.createdAt,
        ],
      );
    } catch (err: unknown) {
      // 23505 = unique_violation
      if (err && typeof err === "object" && "code" in err && err.code === "23505") {
        throw new Error("family-exists");
      }
      throw err;
    }
  }

  async updateFamilyState(
    id: string,
    state: unknown,
    stateUpdatedAt: number,
  ): Promise<void> {
    const r = await pool.query(
      `UPDATE families SET state = $2, state_updated_at = $3 WHERE id = $1`,
      [id, state, stateUpdatedAt],
    );
    if (r.rowCount === 0) throw new Error("family-not-found");
  }

  async createSession(rec: SessionRecord): Promise<void> {
    await pool.query(
      `INSERT INTO sessions(token, family_id, created_at, last_used_at)
       VALUES($1, $2, $3, $4)`,
      [rec.token, rec.familyId, rec.createdAt, rec.lastUsedAt],
    );
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    const { rows } = await pool.query(
      `SELECT token, family_id, created_at, last_used_at FROM sessions WHERE token = $1`,
      [token],
    );
    if (!rows[0]) return null;
    return {
      token: rows[0].token,
      familyId: rows[0].family_id,
      createdAt: Number(rows[0].created_at),
      lastUsedAt: Number(rows[0].last_used_at),
    };
  }

  async deleteSession(token: string): Promise<void> {
    await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
  }

  async touchSession(token: string, now: number): Promise<void> {
    await pool.query(
      `UPDATE sessions SET last_used_at = $2 WHERE token = $1`,
      [token, now],
    );
  }
}
```

Then swap the default at the bottom of `repo.ts`:

```ts
// Before:
let repoInstance: FamilyRepository | null = null;
export function getRepository(): FamilyRepository {
  if (!repoInstance) repoInstance = new JsonFileRepository();
  return repoInstance;
}

// After:
let repoInstance: FamilyRepository | null = null;
export function getRepository(): FamilyRepository {
  if (!repoInstance) {
    repoInstance = process.env.DATABASE_URL
      ? new PostgresRepository()
      : new JsonFileRepository();
  }
  return repoInstance;
}
```

Local dev still uses the JSON file (`DATABASE_URL` unset); production picks
up Postgres automatically. No code changes elsewhere.

### Alternative backends

- **Supabase** (also Postgres) — drop-in equivalent.
- **Upstash Redis** — schemaless; store the whole family record as a JSON
  blob keyed by handle. Simpler to operate but loses SQL queryability.
- **Turso / libSQL** — SQLite at the edge. Use `@libsql/client`. Good fit if
  you prefer SQLite syntax and want low-latency reads.
- **Vercel Postgres** — deprecated; use Neon via marketplace.

The `FamilyRepository` interface is intentionally tiny so any of these is
a one-file implementation.

---

## 2. Required: replace the in-memory rate limiter

**Why it's required.** `lib/server/rateLimit.ts` keeps a `Map<string,
number[]>` in module memory. In serverless, every cold start gets its own
empty map; an attacker who hits a different instance avoids the counter
entirely. A multi-instance ECS / Cloud Run deployment has the same problem.

**Recommended backend: Upstash Redis** (Vercel Marketplace integration; HTTPS
REST API, so it works in every runtime).

```bash
npm install @upstash/ratelimit @upstash/redis
```

Replace `lib/server/rateLimit.ts`:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { RATE_LIMIT } from "@/lib/constants";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const limiters = new Map<string, Ratelimit>();
function limiterFor(scope: string, limit: number): Ratelimit | null {
  if (!redis) return null;
  let l = limiters.get(scope);
  if (!l) {
    l = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${RATE_LIMIT.windowMs} ms`),
      prefix: `wsc:rl:${scope}`,
    });
    limiters.set(scope, l);
  }
  return l;
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

export async function rateLimit(
  key: string,
  limit: number,
): Promise<RateLimitResult> {
  // No Redis configured -> fall back to in-memory (dev / local)
  const scope = key.split(":")[0] ?? "default";
  const l = limiterFor(scope, limit);
  if (!l) return inMemoryFallback(key, limit);
  const r = await l.limit(key);
  if (r.success) return { ok: true };
  return { ok: false, retryAfterMs: r.reset - Date.now() };
}

// ... keep the existing in-memory implementation below as `inMemoryFallback`
// for local dev convenience.

export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]?.trim() : "local";
  return `${scope}:${ip || "local"}`;
}
```

Then update callers — `rateLimit()` is now async:

```ts
// app/api/sync/login/route.ts
const limit = await rateLimit(...);  // add await
```

Two places to change: login and register routes.

---

## 3. Recommended: configure the origin allowlist

If you deploy the app at a single domain (e.g. `https://cubs.example.com`),
the default same-origin check is enough — `apiHandler` compares request
Origin to the request URL's origin and rejects mismatches with 403.

If you split frontend and API (or serve preview deployments under
`*.vercel.app`), set `WSC_TRUSTED_ORIGINS` as a CSV:

```
WSC_TRUSTED_ORIGINS=https://cubs.example.com,https://preview-1.cubs.example.com
```

The check in `lib/server/apiHandler.ts` already reads this env var; no code
change required.

---

## 4. Recommended: cache the Yahoo Finance proxy

`yahoo-finance2` hits Yahoo's unofficial API. It has no documented rate
limits but is known to throttle aggressive clients with 401s and CAPTCHAs.
At scale you want a shared cache so a quote fetched by one user serves
others.

The four data routes (`/api/quote`, `/api/search`, `/api/history`,
`/api/profile`) already set `revalidate` for the Next.js Data Cache, which
covers a lot. For multi-region deployments, also wrap each `getQuote` /
`getProfile` call in a Redis cache layer:

```ts
// pseudo-code
const cached = await redis.get(`quote:${symbol}`);
if (cached) return JSON.parse(cached);
const fresh = await yf.quote(symbol);
await redis.set(`quote:${symbol}`, JSON.stringify(fresh), { ex: 60 });
return fresh;
```

Vercel's [Runtime Cache API](https://vercel.com/docs/runtime-cache) is a
zero-config alternative.

If usage grows past Yahoo's tolerance, swap to a paid provider with a real
SLA — Polygon, Twelve Data, IEX Cloud, or Alpha Vantage.

---

## 5. Recommended: bearer tokens vs httpOnly cookies

Right now the sync session token is stored in `localStorage` under
`wsc.sync.v1` and sent as `Authorization: Bearer …`. If the app ever has
an XSS bug, the attacker can read the token and impersonate the family.

For a kid app the trade-off is acceptable. For a more serious deployment,
move to httpOnly secure cookies:

1. After `register` / `login` success, set a cookie:
   `Set-Cookie: wsc_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=5184000` (60 days).
2. Update `resolveSession()` to read from `req.cookies.get("wsc_session")`
   in addition to (or instead of) the `Authorization` header.
3. Add CSRF protection — `SameSite=Strict` covers the common cases but the
   `apiHandler` origin check is also already in place. With both, no token
   needs to live in JS.
4. Drop the `localStorage.setItem(SYNC_KEY, …)` in `lib/sync.tsx`; the
   browser handles persistence via the cookie.

This is non-trivial because the current Bearer flow lets the client easily
include/exclude the token; with cookies, every fetch automatically sends
it. Doable but rewrites the SyncProvider's auth state.

---

## 6. Recommended: structured logging

The codebase uses `console.error("[api]", err)` in one place. On Vercel
this lands in Vercel Logs with no extra context (no request ID, no family
ID, no route). For production debugging add a simple logger:

```ts
// lib/server/log.ts
export function logEvent(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ts: Date.now(), ...fields }));
}
```

Then in `apiHandler`:

```ts
const requestId = crypto.randomUUID();
try {
  // ...
} catch (err) {
  logEvent("api.error", { requestId, path: new URL(req.url).pathname, message: err instanceof Error ? err.message : "unknown" });
  return NextResponse.json({ error: "Something went wrong.", requestId }, { status: 500 });
}
```

Sending `requestId` back to the client and surfacing it in error messages
lets support / parents tell you exactly which request failed.

For richer observability, drop in Vercel's [Speed Insights](https://vercel.com/docs/speed-insights)
or Sentry — the SDKs are one `npm install` plus an `<Insights />` mount.

---

## 7. Optional: database backups

Neon has point-in-time recovery built in (last 7 days on the free tier,
30 days on paid). Enable it in the Neon console and confirm by simulating
a restore on a branch before you trust it.

Independently: the in-app **Backup & restore** flow in `/admin` produces a
JSON of all family state. Parents can keep their own backups too.

---

## 8. Optional: PWA / mobile install

Adds a manifest + service worker so the app installs to a kid's phone
home screen. Roughly:

```ts
// public/manifest.webmanifest
{
  "name": "Wall Street Cubs",
  "short_name": "Cubs",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f7f6f2",
  "theme_color": "#4f46e5",
  "icons": [{ "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }]
}
```

Plus a service worker (use `next-pwa` or hand-roll one) that caches the
shell + last-known quotes for offline reads. Adds ~50 lines of config and
two icon files.

---

## Environment variables

| Variable                    | Required        | Purpose                                                  |
|-----------------------------|-----------------|----------------------------------------------------------|
| `DATABASE_URL`              | Yes (Postgres)  | Postgres connection string (Neon auto-populates this)    |
| `UPSTASH_REDIS_REST_URL`    | Yes (Redis)     | Rate limiter backend                                      |
| `UPSTASH_REDIS_REST_TOKEN`  | Yes (Redis)     | Rate limiter auth                                         |
| `WSC_TRUSTED_ORIGINS`       | Recommended     | CSV of allowed `Origin` headers for CSRF                  |
| `WSC_DATA_DIR`              | No              | Only the JSON file adapter reads this; ignored in cloud  |

---

## Step-by-step Vercel deploy

1. **Push to GitHub**. Skip `data/` (already in `.gitignore` if you've run
   the JSON adapter locally — confirm before pushing).
2. **Import in Vercel** → New Project → from your repo.
3. **Storage tab → Add Neon Postgres**. Vercel populates `DATABASE_URL`.
   Run the schema from §1 (Neon console → SQL Editor).
4. **Storage tab → Add Upstash Redis**. Vercel populates
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
5. **Settings → Environment Variables → add `WSC_TRUSTED_ORIGINS`**
   with your production domain (`https://yourdomain.com`).
6. **Code changes**:
   - Add `PostgresRepository` to `lib/server/repo.ts` (template above).
   - Replace `lib/server/rateLimit.ts` with the Upstash version
     (template above).
   - Update the two callers in `app/api/sync/{login,register}/route.ts`
     to `await rateLimit(...)`.
7. **Commit & push**. Vercel auto-deploys.
8. **Smoke-test** by visiting `/admin` on prod → creating a family → signing
   in on a second device. The same flow that worked locally should work
   identically.
9. **Configure Neon PITR** (Settings → Backups) so you can recover from a
   bad deploy or accidental delete.

After all this the only path-dependent code is `lib/server/repo.ts` and
`lib/server/rateLimit.ts`. Everything else — client app, API routes, auth,
validation — runs the same on a laptop, on Vercel, or on any Node host.

---

## What you don't need to change

For reference, here's everything that already works in any cloud
environment without modification:

- All `/api/sync/*` routes — already use `apiHandler`, structured errors,
  origin checks, body-size caps.
- `lib/server/auth.ts` — pure functions (scrypt, random tokens).
- `lib/server/session.ts` — depends only on the repo interface.
- `lib/snapshot.ts` — pure validator, isomorphic.
- All client code (`lib/sync.tsx`, providers, components) — fetches its
  own absolute API paths, no environment assumptions.
- Yahoo Finance proxy routes (`/api/quote`, `/api/search`, etc.) — work
  as-is, just consider adding a shared cache at scale (§4).
- Next.js itself — App Router, RSC, image optimization, static rendering
  for kid-facing pages.

`runtime = "nodejs"` is already declared on every route that needs Node
APIs (`scrypt`, `fs`), so Vercel will deploy them as Node functions, not
Edge functions. Don't change this — Edge functions don't have `node:crypto`
scrypt.
