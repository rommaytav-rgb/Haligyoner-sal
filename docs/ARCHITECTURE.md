# Architecture

## Layers

```
UI (React Server Components + a thin client layer)
  src/app/**, src/components/**
API (route handlers: validation, auth, rate limiting)
  src/app/api/**
Application services (orchestration, persistence, read models)
  src/lib/services/**
Domain (pure, deterministic, no I/O)
  src/lib/domain/**
Provider layer (price data sources behind one interface)
  src/lib/providers/**
AI layer (language only, never numbers)
  src/lib/ai/**
Persistence (SQLite via node:sqlite)
  src/lib/db/**, db/schema.sql
```

Business logic never lives in a component. Every page is a projection of a
service read model.

## The deterministic core

`src/lib/domain` contains no imports outside itself. It is where every number the
product shows is produced:

| Module | Responsibility |
|---|---|
| `money.ts` | Integer agorot arithmetic. No floats touch money. |
| `price-change.ts` | The single percentage-change formula, severity bands, and the rules for when two observations are *not* comparable. |
| `basket-change.ts` | Week-over-week basket comparison and contribution breakdown. |
| `units.ts` | Package size parsing and unit-price normalisation. |
| `normalize.ts` | Product identity, aliases and match scoring. |
| `promotions.ts` | Effective line cost under 1+1, N-for-X, percentage, fixed, member and quantity-gated promotions. |
| `optimizer.ts` | Single-store, multi-store and mode-specific plans, with travel and delivery priced explicitly. |
| `baseline.ts` | Personal price baseline and the "should I buy now?" judgement. |
| `savings.ts` | Savings with an explicit baseline and potential/confirmed separation. |
| `alerts.ts` | Alert rule evaluation. |
| `budget.ts` | Budget proposals, each requiring user approval. |
| `geo.ts` | Distance and travel-time estimation. |

Each module has a test file next to it. Together they are the reason the product
can promise that a percentage is arithmetic rather than a generated guess.

## The AI boundary

The model is allowed to do exactly two things:

1. **Structure free text into basket lines** (`ai/basket-parser.ts`). Its output
   is validated against a schema; anything that fails validation falls back to
   the deterministic parser in `ai/rule-parser.ts`.
2. **Phrase an explanation of numbers it was given** (`ai/explain.ts`). The facts
   are computed first; the generated text is then scanned by
   `ai/number-guard.ts`, and if it contains any figure that was not in the facts,
   it is discarded and the deterministic template is shown instead.

User text is wrapped in a delimited block and the system prompt states it is
data. The application never asks the model for a price, a total, a percentage, a
store recommendation or a prediction.

With no credentials configured, both paths fall back and every feature still
works.

## Provider abstraction

`PriceDataProvider` (`providers/types.ts`) is the only way prices enter the
system. A provider declares what it covers, how fresh it is, its rate limit,
whether it needs credentials, its licensing notes, and — critically — whether it
`producesRealMarketPrices`. That last flag propagates through ingest into the UI
banner and the coverage reporting.

Adding a chain is a change to `data/chains.json`, not to code.

## Data model notes

- `price_history` is append-only and is the backbone of every historical claim.
- `prices` is a cache of the newest observation per (product, branch) and refuses
  to move backwards in time when an out-of-order file arrives.
- `basket_snapshots` + `basket_snapshot_lines` record what a basket cost at a
  point in time, which is what week-over-week comparison reads.
- Every price row carries `source`, `provider_id` and `observed_at`.

## Security

- Sessions are opaque random tokens in an httpOnly, SameSite=Lax cookie, resolved
  server-side against a `sessions` row; revoking a session is a delete.
- Passwords are scrypt-hashed with per-user salts and verified in constant time.
  A sign-in attempt for an unknown email still performs a hash so account
  existence cannot be probed by timing.
- Every service query is scoped by `user_id`; there is no code path that takes a
  user id from the client.
- All request bodies are validated with Zod schemas before reaching a service.
- Sign-in, sign-up, item import and receipt import are rate limited.
- Provider credentials and the Anthropic key are read server-side only.
