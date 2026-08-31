# Price data sources

The product rule is simple and absolute: **never invent a price.** Everything the
application displays is either a stored observation with a source and a
timestamp, or an explicit "we could not verify this".

## Source priority

1. **Official government price transparency.** Israel's food price transparency
   regulations require the large chains to publish full price and promotion files
   at a public endpoint. This is the primary source and the one the shipped
   provider implements (`src/lib/providers/il-transparency-provider.ts`).
2. **Official retailer APIs**, where a chain offers one under terms that permit
   this use.
3. **Licensed commercial price APIs.**
4. **Other authorized feeds.**

A fifth kind exists only for development: the **synthetic demo dataset**
(`data/demo-dataset.json`). It carries `realMarketData: false`, everything it
produces is tagged `source: demo-fixture`, and the UI shows a permanent banner
whenever any of it is on screen. It must never be presented as market pricing.

## What is and is not verified in this repository

`data/chains.json` is the chain registry. Every chain and every portal in it
currently carries `"endpointVerified": false`.

That flag is not decoration. It means: **the publishing endpoint recorded here
has not been confirmed against the live portal from this environment.** The URLs
and portal usernames are recorded from public knowledge of how the transparency
scheme is published, and they are a starting point for verification — not
evidence of coverage.

The provider refuses to fetch from an unverified portal
(`portal_endpoint_not_verified`), so no unverified endpoint can quietly become a
source of "real" prices.

### Verifying a chain before enabling it

1. Start from the Ministry of Economy index of publishing locations (the `govil`
   portal entry in the registry). It is authoritative for where each chain
   publishes.
2. Open the chain's portal and confirm the base URL, the listing path, and the
   login username where one is required.
3. Read the portal's terms of use. Confirm that automated retrieval, and the
   commercial use you intend, are permitted.
4. Fetch `/robots.txt` and confirm the paths you need are allowed. The provider
   enforces this at run time as well, but a portal that disallows the crawl is a
   decision to stop, not a check to bypass.
5. Note the publication cadence and set a sync schedule that respects it and the
   portal's rate limits.
6. Only then set `"endpointVerified": true` for that portal and chain, and set
   `ENABLE_LIVE_PRICE_FETCH=true` in the deployment.

Until those steps are done for a chain, the honest statement about coverage is
"none", and the app's data page says exactly that.

## What the provider does at run time

- Refuses to run at all unless `ENABLE_LIVE_PRICE_FETCH=true`.
- Refuses to fetch from a portal whose endpoint is not marked verified.
- Reads `robots.txt` for the portal host and skips any path it disallows,
  recording the skip as a warning rather than proceeding.
- Declares a rate limit and a user agent, and caps how many files one run pulls.
- Parses the regulated `PriceFull` / `PromoFull` / `Stores` XML formats,
  including gzip payloads.
- Skips rows it cannot parse — a missing item code, an unparseable price, a
  promotion whose terms it does not recognise — and reports each skip as a
  warning. It never fills a gap with a guess.
- Reads the feed's own timestamps (Israel local time, DST-aware) rather than
  stamping observations with the ingest time.
- On any failure, returns an empty snapshot and records the reason in
  `provider_status`, which the data page shows to the user.

## Freshness

The chains publish at least daily and typically several times a day. The provider
declares a freshness expectation of 6 hours. `MAX_PRICE_AGE_DAYS` (14 days) bounds
how old an observation may be and still be used in a live optimization; anything
older is excluded and the affected line is reported as unpriced rather than
priced from stale data.

## Promotions and club prices

Promotion terms come from the `PromoFull` files. A promotion is applied to a
user's basket only when the evidence supports it: the date window is open, the
quantity threshold is met, and — for a club price — the user has declared that
membership. Every promotion that was seen but not applied is shown to the user
with the reason it was not applied.
