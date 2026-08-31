# Personal Shopping Optimizer

An intelligent personal grocery-shopping assistant for Israeli consumers.

> Know what I buy, watch prices for me, optimize my basket, and help me spend less.

This is not a price-comparison search box. The unit of the product is **your
recurring basket**: you keep the list you actually buy, and the app watches its
prices, explains what changed, and works out the smartest way to buy it today.

```
PERSONAL BASKET → REAL PRICES → PRICE INTELLIGENCE → OPTIMIZATION → SAVINGS → REPEAT
```

## Quick start

```bash
npm install
npm run db:seed     # creates data/app.db, loads the demo dataset and a demo account
npm run dev         # http://localhost:3000
```

The seed account is `demo@example.com` / `demo-password-2026` (override with
`DEMO_EMAIL` / `DEMO_PASSWORD`).

```bash
npm run verify      # typecheck + lint + tests + production build
```

Requires Node 22.5 or newer — the database runs on Node's built-in `node:sqlite`,
so there is no native module to compile and no external database to run.

## Read this before trusting a number

**The prices in a fresh checkout are synthetic.** No live price feed is connected
by default, so the app seeds `data/demo-dataset.json`, a generated dataset that
exists purely so the whole product can be run and tested. Every screen that shows
one of those figures carries a permanent banner saying so, and the data page
reports which chains are actually covered.

Every *calculation* is real. The demo data is fake; the arithmetic on top of it
is the same arithmetic that would run against a live feed.

To connect real data, see [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md). Live
fetching is off until you have reviewed a portal's terms of use and marked its
endpoint verified — the provider refuses to fetch otherwise.

## What it does

**Your basket.** Write your list the way you'd say it — `4 חלב 3% 1 ליטר`,
`2 chicken breast`, `coffee — do not replace`. Lines are structured, matched to
catalog products, and your own wording is kept forever alongside the match.

**Price intelligence.** For every product: current price, 7-day and 30-day
comparisons, a 90-day average, your own usual price, your recorded low and high,
a timeline, and an answer to "should I buy this now?" — all from stored
observations, with no prediction about where prices are going.

**Basket price history.** Week over week: what the basket cost, what it costs
now, which products moved, which promotions started and ended, and which lines
account for the difference. The line contributions are checked to reconcile
against the reported total.

**Optimization.** Cheapest, best value, most convenient, closest, and one-store
plans, each priced with delivery fees and an explicit travel-cost model, so a
basket that is cheaper but further away is visibly so rather than silently
preferred.

**Promotions and club prices.** 1+1, N-for-X, percentage, fixed and member
prices. A promotion is applied only when you actually qualify; every promotion
that was seen and *not* applied is shown with the reason.

**Alerts.** Price below an amount, a rise or fall beyond a percentage, a
promotion appearing or ending, a recorded low, or your basket moving beyond a
threshold.

**Receipts.** Paste receipt text to import what you bought and find the products
you buy repeatedly.

**Hebrew and English**, RTL and LTR, mobile-first. No hardcoded user-facing
strings.

## The rules this codebase holds itself to

- **A percentage is arithmetic, never generation.** `((current - previous) /
  previous) × 100` lives in exactly one function, and the AI layer is scanned to
  make sure it never restates a number that engine did not produce.
- **Money is integer agorot.** Floats never touch a total.
- **Incomparable is a valid answer.** No previous observation, a zero baseline, a
  changed package size, an unparseable timestamp — each produces an explicit
  "cannot compare", not a number.
- **A stale comparison says it is stale.** A 30-day-old previous price is never
  described as "changed today".
- **Coverage is reported, not hidden.** A plan that could not price three items
  says so; a cheaper total can never come from quietly dropping lines.
- **Savings always name their baseline**, and potential savings are never mixed
  with confirmed ones.
- **Membership prices need declared membership.**
- **Nothing is invented** — not a price, a promotion, stock, or a price history.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run verify` | typecheck, lint, tests, production build |
| `npm test` | Unit and integration tests |
| `npm run db:seed` | Seed the demo catalog and account |
| `npm run db:reset` | Delete the local database |
| `npm run prices:sync` | Run every configured provider and ingest what it returns |
| `npm run data:generate-demo` | Regenerate the synthetic demo dataset |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, the deterministic core,
  the AI boundary, the data model, security.
- [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) — where prices come from, how to
  verify and enable a chain, and what "covered" means.
- [.env.example](.env.example) — configuration.

## Status

This is an MVP. It completes the full loop — sign up, build a basket in natural
language, match products, price them across chains, compute single- and
multi-store plans, save the result, come back later and see what changed — and it
is honest about what it cannot yet do. See the Limitations section of the project
report for the specifics.
