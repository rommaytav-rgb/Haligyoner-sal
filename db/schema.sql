-- Personal Shopping Optimizer — relational schema.
--
-- Conventions:
--   * All monetary values are INTEGER agorot (1 ILS = 100 agorot). No floats.
--   * All timestamps are ISO-8601 UTC strings.
--   * Every price row carries its source and observation time, so any number the
--     product shows can be traced back to where and when it came from.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  locale        TEXT NOT NULL DEFAULT 'he',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- One row per user. JSON columns hold list-shaped preferences that are always
-- read and written whole.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id                  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  optimization_mode        TEXT NOT NULL DEFAULT 'best_value',
  max_stores               INTEGER NOT NULL DEFAULT 2,
  max_distance_km          REAL,
  city                     TEXT,
  home_latitude            REAL,
  home_longitude           REAL,
  household_size           INTEGER,
  shopping_frequency_days  INTEGER,
  weekly_budget_agorot     INTEGER,
  wants_delivery           INTEGER NOT NULL DEFAULT 0,
  allow_substitutions      INTEGER NOT NULL DEFAULT 1,
  min_substitution_score   REAL NOT NULL DEFAULT 0.65,
  excluded_chain_ids       TEXT NOT NULL DEFAULT '[]',
  preferred_chain_ids      TEXT NOT NULL DEFAULT '[]',
  favorite_brands          TEXT NOT NULL DEFAULT '[]',
  disliked_brands          TEXT NOT NULL DEFAULT '[]',
  severity_thresholds      TEXT NOT NULL DEFAULT '{"minimal":2,"small":5,"moderate":10,"large":20}',
  convenience_model        TEXT NOT NULL DEFAULT '{"travelCostPerKmAgorot":180,"timeValuePerHourAgorot":4000,"extraStorePenaltyAgorot":1200}',
  updated_at               TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain_id   TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, chain_id)
);

CREATE TABLE IF NOT EXISTS supermarket_chains (
  id                 TEXT PRIMARY KEY,
  name_he            TEXT NOT NULL,
  name_en            TEXT NOT NULL,
  chain_group        TEXT,
  portal_id          TEXT,
  portal_username    TEXT,
  endpoint_verified  INTEGER NOT NULL DEFAULT 0,
  active             INTEGER NOT NULL DEFAULT 1,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS store_branches (
  id                       TEXT PRIMARY KEY,
  chain_id                 TEXT NOT NULL REFERENCES supermarket_chains(id) ON DELETE CASCADE,
  external_branch_id       TEXT,
  name                     TEXT NOT NULL,
  city                     TEXT,
  address                  TEXT,
  latitude                 REAL,
  longitude                REAL,
  supports_delivery        INTEGER NOT NULL DEFAULT 0,
  delivery_fee_agorot      INTEGER,
  delivery_minimum_agorot  INTEGER,
  updated_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_branches_chain ON store_branches(chain_id);
CREATE INDEX IF NOT EXISTS idx_branches_city ON store_branches(city);

CREATE TABLE IF NOT EXISTS brands (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  name_he    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- One row per distinct purchasable package.
CREATE TABLE IF NOT EXISTS products (
  id                  TEXT PRIMARY KEY,
  signature           TEXT NOT NULL UNIQUE,
  barcode             TEXT,
  name_he             TEXT NOT NULL,
  name_en             TEXT,
  canonical_name      TEXT NOT NULL,
  brand_id            TEXT REFERENCES brands(id) ON DELETE SET NULL,
  manufacturer        TEXT,
  category_id         TEXT REFERENCES categories(id) ON DELETE SET NULL,
  package_base_qty    REAL,
  package_base_unit   TEXT,
  package_raw_text    TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_canonical ON products(canonical_name);

-- Alternative names/spellings seen for a product, used to improve matching.
CREATE TABLE IF NOT EXISTS product_aliases (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alias       TEXT NOT NULL,
  source      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (product_id, alias)
);
CREATE INDEX IF NOT EXISTS idx_aliases_alias ON product_aliases(alias);

CREATE TABLE IF NOT EXISTS promotions (
  id                     TEXT PRIMARY KEY,
  external_id            TEXT,
  chain_id               TEXT NOT NULL REFERENCES supermarket_chains(id) ON DELETE CASCADE,
  branch_id              TEXT REFERENCES store_branches(id) ON DELETE CASCADE,
  product_id             TEXT REFERENCES products(id) ON DELETE CASCADE,
  kind                   TEXT NOT NULL,
  description            TEXT NOT NULL,
  buy_quantity           INTEGER,
  free_quantity          INTEGER,
  bundle_quantity        INTEGER,
  bundle_price_agorot    INTEGER,
  percent_off            REAL,
  discount_agorot        INTEGER,
  promo_unit_price_agorot INTEGER,
  min_quantity           INTEGER,
  requires_membership    INTEGER NOT NULL DEFAULT 0,
  starts_at              TEXT,
  ends_at                TEXT,
  source                 TEXT NOT NULL,
  observed_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_promotions_product ON promotions(product_id, chain_id);

-- Latest known price per (product, branch). A cache over price_history for reads.
CREATE TABLE IF NOT EXISTS prices (
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  chain_id        TEXT NOT NULL REFERENCES supermarket_chains(id) ON DELETE CASCADE,
  branch_id       TEXT NOT NULL REFERENCES store_branches(id) ON DELETE CASCADE,
  price_agorot    INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'ILS',
  is_member_price INTEGER NOT NULL DEFAULT 0,
  promotion_id    TEXT REFERENCES promotions(id) ON DELETE SET NULL,
  availability    TEXT NOT NULL DEFAULT 'unknown',
  confidence      REAL NOT NULL DEFAULT 1.0,
  source          TEXT NOT NULL,
  provider_id     TEXT NOT NULL,
  observed_at     TEXT NOT NULL,
  PRIMARY KEY (product_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_prices_product ON prices(product_id);
CREATE INDEX IF NOT EXISTS idx_prices_branch ON prices(branch_id);

-- Append-only. The backbone of every historical comparison in the product.
CREATE TABLE IF NOT EXISTS price_history (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  chain_id        TEXT NOT NULL REFERENCES supermarket_chains(id) ON DELETE CASCADE,
  branch_id       TEXT NOT NULL REFERENCES store_branches(id) ON DELETE CASCADE,
  price_agorot    INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'ILS',
  observed_at     TEXT NOT NULL,
  source          TEXT NOT NULL,
  provider_id     TEXT NOT NULL,
  promotion_id    TEXT REFERENCES promotions(id) ON DELETE SET NULL,
  is_member_price INTEGER NOT NULL DEFAULT 0,
  availability    TEXT NOT NULL DEFAULT 'unknown',
  confidence      REAL NOT NULL DEFAULT 1.0,
  UNIQUE (product_id, branch_id, observed_at, price_agorot)
);
CREATE INDEX IF NOT EXISTS idx_history_product_time ON price_history(product_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_history_branch_time ON price_history(branch_id, observed_at);

CREATE TABLE IF NOT EXISTS baskets (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  is_recurring INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_baskets_user ON baskets(user_id);

CREATE TABLE IF NOT EXISTS basket_items (
  id                  TEXT PRIMARY KEY,
  basket_id           TEXT NOT NULL REFERENCES baskets(id) ON DELETE CASCADE,
  product_id          TEXT REFERENCES products(id) ON DELETE SET NULL,
  -- The user's own words, kept verbatim even after matching, so an unmatched or
  -- mis-matched line can always be shown as the user wrote it.
  raw_text            TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  quantity            REAL NOT NULL DEFAULT 1,
  preferred_brand     TEXT,
  preferred_size_text TEXT,
  substitution_policy TEXT NOT NULL DEFAULT 'allow',
  is_locked           INTEGER NOT NULL DEFAULT 0,
  is_favorite         INTEGER NOT NULL DEFAULT 0,
  is_optional         INTEGER NOT NULL DEFAULT 0,
  match_confidence    REAL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_basket ON basket_items(basket_id);

-- A priced snapshot of a basket at a point in time. Feeds basket price history.
CREATE TABLE IF NOT EXISTS basket_snapshots (
  id                   TEXT PRIMARY KEY,
  basket_id            TEXT NOT NULL REFERENCES baskets(id) ON DELETE CASCADE,
  captured_at          TEXT NOT NULL,
  total_agorot         INTEGER NOT NULL,
  covered_line_count   INTEGER NOT NULL,
  requested_line_count INTEGER NOT NULL,
  unpriced_line_ids    TEXT NOT NULL DEFAULT '[]',
  plan_kind            TEXT NOT NULL,
  notes                TEXT
);
CREATE INDEX IF NOT EXISTS idx_snapshots_basket_time ON basket_snapshots(basket_id, captured_at);

CREATE TABLE IF NOT EXISTS basket_snapshot_lines (
  id                    TEXT PRIMARY KEY,
  snapshot_id           TEXT NOT NULL REFERENCES basket_snapshots(id) ON DELETE CASCADE,
  basket_item_id        TEXT NOT NULL,
  product_id            TEXT,
  display_name          TEXT NOT NULL,
  quantity              REAL NOT NULL,
  unit_price_agorot     INTEGER NOT NULL,
  effective_total_agorot INTEGER NOT NULL,
  promotion_id          TEXT,
  chain_id              TEXT,
  branch_id             TEXT,
  observed_at           TEXT NOT NULL,
  source                TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshot_lines ON basket_snapshot_lines(snapshot_id);

CREATE TABLE IF NOT EXISTS optimization_results (
  id                  TEXT PRIMARY KEY,
  basket_id           TEXT NOT NULL REFERENCES baskets(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode                TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  goods_total_agorot  INTEGER NOT NULL,
  payable_total_agorot INTEGER NOT NULL,
  store_count         INTEGER NOT NULL,
  covered_line_count  INTEGER NOT NULL,
  requested_line_count INTEGER NOT NULL,
  -- Full serialised plan, so a result the user saw can be reproduced verbatim.
  plan_json           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_optimizations_basket ON optimization_results(basket_id, created_at);

CREATE TABLE IF NOT EXISTS savings_events (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  basket_id             TEXT REFERENCES baskets(id) ON DELETE SET NULL,
  nature                TEXT NOT NULL,
  baseline_kind         TEXT NOT NULL,
  baseline_label        TEXT NOT NULL,
  baseline_total_agorot INTEGER NOT NULL,
  compared_total_agorot INTEGER NOT NULL,
  saving_agorot         INTEGER NOT NULL,
  comparable_coverage   INTEGER NOT NULL DEFAULT 1,
  occurred_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_savings_user_time ON savings_events(user_id, occurred_at);

CREATE TABLE IF NOT EXISTS price_alerts (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  product_id      TEXT REFERENCES products(id) ON DELETE CASCADE,
  basket_id       TEXT REFERENCES baskets(id) ON DELETE CASCADE,
  threshold_value REAL NOT NULL,
  label           TEXT NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON price_alerts(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  title_key    TEXT NOT NULL,
  facts_json   TEXT NOT NULL,
  read_at      TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);

CREATE TABLE IF NOT EXISTS receipts (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain_id          TEXT,
  branch_id         TEXT,
  purchased_at      TEXT,
  total_agorot      INTEGER,
  -- 'pending' | 'extracted' | 'partial' | 'failed'. Never reported as extracted
  -- unless extraction actually produced lines.
  status            TEXT NOT NULL DEFAULT 'pending',
  failure_reason    TEXT,
  original_filename TEXT,
  raw_text          TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_id, created_at);

CREATE TABLE IF NOT EXISTS receipt_lines (
  id            TEXT PRIMARY KEY,
  receipt_id    TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  raw_text      TEXT NOT NULL,
  product_id    TEXT REFERENCES products(id) ON DELETE SET NULL,
  quantity      REAL,
  price_agorot  INTEGER,
  discount_agorot INTEGER,
  match_confidence REAL
);
CREATE INDEX IF NOT EXISTS idx_receipt_lines ON receipt_lines(receipt_id);

-- Health of each configured price data provider.
CREATE TABLE IF NOT EXISTS provider_status (
  provider_id           TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  supported_chain_ids   TEXT NOT NULL DEFAULT '[]',
  available             INTEGER NOT NULL DEFAULT 0,
  data_kind             TEXT NOT NULL,
  freshness_seconds     INTEGER,
  rate_limit_per_minute INTEGER,
  last_success_at       TEXT,
  last_attempt_at       TEXT,
  last_error            TEXT,
  updated_at            TEXT NOT NULL
);
