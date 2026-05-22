# Wall Street Cubs 🐻

A friendly investing playground for kids (~age 12). Practice with **virtual
money** at **real stock prices**. The app works fully on-device with
localStorage, and can optionally sync across devices via a small backend.

## What's inside

- **Real prices** via [`yahoo-finance2`](https://github.com/gadicc/yahoo-finance2)
  — quotes, search, historical charts, and `assetProfile` (sector/industry).
- **Multiple Cubs** — siblings can each have their own profile and portfolio.
- **Paper trading** — every new Cub starts with **$10,000**. Trades show a
  confirmation step with totals before going through.
- **Parent password** (device-local) — gates all Cub management (create /
  switch / rename / delete / reset). Hashed with SHA-256 + random salt in
  localStorage. Auto-locks after 5 minutes; 5 wrong attempts triggers a
  10-minute cooldown.
- **Cross-device sync** (optional, new) — a parent-created "family handle"
  lets every device pull the same Cubs. Scrypt-hashed password, bearer tokens,
  debounced push, last-write-wins.
- **Goal setting** — pick a target dollar value + optional deadline.
- **Portfolio value chart** with **S&P 500 overlay** — daily snapshots,
  normalized to the same start so kids can see whether they're beating the
  market.
- **Sector breakdown** pie chart — diversification at a glance, with
  praise/warning callouts.
- **Achievements** — first trade, bull run, diversified, long-term holder,
  active investor, goal crusher.
- **Trade notes** — every buy/sell can carry a 140-char "why?" so kids
  reflect.
- **Sentiment-based mood badge** — 🚀/😄/🙂/😐/😕/😣/🌧️ on each Cub's
  portfolio and the leaderboard row, based on today's weighted holdings
  change.
- **Leaderboard** — all Cubs ranked by total return %.
- **Stock fundamentals panel** — market cap, P/E, dividend yield, 52-week
  range with a marker for today's price.
- **Buy / sell markers on the price chart** — each Cub's own trades for a
  symbol show as green (buy) and red (sell) dots on the stock detail
  chart, with a tooltip that includes shares + fill price, plus a chip
  list of recent trades right under the chart.
- **Interactive lessons** — pizza-slice intro, compound-interest sliders,
  diversification quiz. **Per-Cub progress tracking** with a header bar on
  `/learn` — each lesson is marked done via an "I got it" button (the
  quiz auto-completes once every question is answered).
- **Backup & restore** — admin can download a JSON of every Cub, password
  hash included, and restore on this or another device.

## Routes

| Route                | Audience | Notes                                              |
|----------------------|----------|----------------------------------------------------|
| `/`                  | Kid      | Hero, market snapshot, watchlist                   |
| `/explore`           | Kid      | Curated stock categories + search                  |
| `/stock/:sym`        | Kid      | Chart with own-trade markers + buy/sell + fundamentals |
| `/portfolio`         | Kid      | Value chart, goal, sector pie, achievements        |
| `/leaderboard`       | Kid      | All Cubs ranked by return + mood badges            |
| `/learn`             | Kid      | Story cards + compound calculator + quiz + progress bar |
| `/admin`             | Parent   | Cub management, password change, sync, backup      |
| `/api/quote`         | —        | `?symbol=AAPL` or `?symbols=AAPL,MSFT`             |
| `/api/search`        | —        | `?q=disney`                                        |
| `/api/history`       | —        | `?symbol=AAPL&range=6mo` or `?symbol=…&from=&to=`  |
| `/api/profile`       | —        | `?symbol=AAPL` (sector / industry / summary)       |
| `/api/sync/register` | —        | `POST { handle, password }`                        |
| `/api/sync/login`    | —        | `POST { handle, password }`                        |
| `/api/sync/logout`   | —        | `POST` (Bearer)                                    |
| `/api/sync/state`    | —        | `GET` / `PUT` (Bearer)                             |

## Getting started

Requires Node 20+ (Node 25 was used for development). No external services
required for local dev — sync uses a JSON file under `./data`.

```bash
npm install
npm run dev          # http://localhost:3000
```

For production:

```bash
npm run build
PORT=3030 npm run start
```

## First run

1. The app prompts the parent to **set a local password** (min 4 characters).
2. The parent **creates the first Cub** (name + emoji avatar).
3. The kid starts trading. Switching, renaming, deleting, and resetting Cubs
   all require the parent password.

To add a second Cub later, open `/admin`, unlock, and use **Add a new Cub**.

## Cross-device sync

By default the app stores everything in `localStorage`. To follow a family
between devices:

1. Open `/admin` on the device that has the Cubs you want to keep.
2. Scroll to **☁️ Cross-device sync** → **Create family account**.
3. Pick a **family handle** (3–20 chars, lowercase letters / digits / `_` /
   `-`, e.g. `smith-family`) and a **sync password** (≥ 6 chars). This
   password is *separate* from the local parent password.
4. On the second device, open `/admin` → **Sign in to existing** → enter the
   same handle and sync password. The Cubs (and the local parent-password
   snapshot) pull onto that device.

Notes:

- Changes push **about 1.5 s after they happen** (debounced).
- If two devices edit at the same time, last-write-wins; the loser
  automatically applies the winner's state on its next push.
- Session tokens last 60 days, then re-prompt.
- Tap **Pull now** in admin to grab a sibling's latest changes immediately.

### Production sync deployment

The default sync backend is a **JSON file** (`./data/families.json`) plus an
**in-memory rate limiter** — both fine for `npm run dev` on a laptop, neither
works on Vercel-style serverless. For production, set environment variables to
automatically switch to durable backends — no code changes needed.

#### PostgreSQL (recommended for multi-node / serverless)

Set `DATABASE_URL` to a Postgres connection string (e.g. from
[Neon](https://neon.tech)) and the app switches to `PostgresRepository`
automatically:

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

The families and sessions tables are created on first boot if they don't exist.

#### Upstash Redis rate-limiting

Set both variables below and the app switches from the in-memory limiter to
[Upstash Redis](https://upstash.com) automatically:

```
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

In the absence of either variable the app falls back to the in-memory limiter
(suitable for single-node deploys, not serverless).

Every other module — client code, API routes, auth, validation — runs
unchanged regardless of which backend is selected.

Override the data directory (for the JSON adapter in self-hosted / single-node
deploys) with:

```bash
WSC_DATA_DIR=/var/lib/wsc-data npm run start
```

## Data & storage

Client-side (localStorage):

| Key                          | Contents                                              |
|------------------------------|-------------------------------------------------------|
| `wsc.profiles.v2`            | profiles, currentProfileId, per-Cub portfolio state   |
| `wsc.parentLock.v1`          | `{ salt, hash, setAt }` for the local parent password |
| `wsc.parentLockAttempts.v1`  | failed unlock attempts + cooldown timestamp           |
| `wsc.sync.v1`                | `{ token, handle }` when signed into cross-device sync|

Server-side — JSON file (`./data/families.json`) by default, or PostgreSQL
when `DATABASE_URL` is set:

| Table / key  | Contents                                                               |
|--------------|------------------------------------------------------------------------|
| `families`   | `{ id, passwordHash, passwordSalt, state, stateUpdatedAt, createdAt }` |
| `sessions`   | `{ token, familyId, createdAt, lastUsedAt }`                           |

**Forgot the local parent password?** Clear the site's storage in your
browser (DevTools → Application → Storage → Clear site data) and run setup
again. This wipes every local Cub's portfolio — so if you have sync
enabled, sign back in on a fresh setup to recover them.

**Forgot the sync password?** No recovery — pick a fresh family handle and
re-seed it from a backup (admin → Backup & restore → Download backup ahead
of time).

## Tech stack

- [Next.js 16](https://nextjs.org/) App Router (Turbopack)
- React 19 + TypeScript
- Tailwind CSS v4
- [`yahoo-finance2`](https://github.com/gadicc/yahoo-finance2)
- [Recharts](https://recharts.org/) for charts
- Web Crypto API (`SubtleCrypto`) for client-side password hashing
- Node `crypto.scrypt` for server-side password hashing

## Lighthouse targets

Mobile preset, standard kid-facing pages:

| Page         | Perf | A11y | Best Practices | SEO |
|--------------|------|------|----------------|-----|
| Home         | 88+  | 100  | 100            | 100 |
| Stock detail | 89+  | 100  | 100            | 100 |
| Portfolio    | 88+  | 100  | 100            | 100 |
| Leaderboard  | 98   | 100  | 100            | 100 |
| Admin        | 85+  | 100  | 100            | 100 |
| Learn        | 89+  | 100  | 100            | 100 |

## Security model — read this

- The whole app is client-side except sync. The local parent password is a
  **soft gate** to deter curious kids, not a security boundary against
  determined attackers (anyone with DevTools can clear storage).
- The cross-device sync password is hashed with **scrypt** server-side
  before storage. Bearer tokens are 32-byte random hex, transported over
  HTTPS in production.
- Backup files contain a salted password hash. If an attacker steals one
  they can brute-force the password offline — treat backups like a
  sensitive document.
- Prices may be delayed up to 15 minutes (Yahoo Finance limitation).
