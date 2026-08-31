/**
 * Catalog ingest: persists a provider snapshot into the database.
 *
 * Two guarantees:
 *   1. Every price written carries its provider, source and observation time, so
 *      any figure the UI shows can be traced back.
 *   2. `price_history` is append-only. The `prices` table is only a cache of the
 *      newest observation per (product, branch), and is never allowed to move
 *      backwards in time.
 */

import type { DatabaseSync } from 'node:sqlite';
import { all, fromBool, get, newId, nowIso, num, optStr, run, str, transaction, type Row } from '@/lib/db/client';
import { normalizeProduct } from '@/lib/domain/normalize';
import { parsePackageSize } from '@/lib/domain/units';
import { loadChainRegistry } from '@/lib/providers/chain-registry';
import type { PriceDataProvider, ProviderSnapshot } from '@/lib/providers/types';

export interface IngestReport {
  providerId: string;
  producesRealMarketPrices: boolean;
  branchesUpserted: number;
  productsUpserted: number;
  pricesWritten: number;
  historyRowsWritten: number;
  promotionsUpserted: number;
  staleObservationsSkipped: number;
  warnings: string[];
  startedAt: string;
  finishedAt: string;
}

/** Mirrors `data/chains.json` into the database so joins have chain metadata. */
export function syncChainRegistry(db: DatabaseSync): number {
  const registry = loadChainRegistry();
  const now = nowIso();
  return transaction(db, () => {
    for (const chain of registry.chains) {
      run(
        db,
        `INSERT INTO supermarket_chains (id, name_he, name_en, chain_group, portal_id, portal_username, endpoint_verified, active, updated_at)
         VALUES (?,?,?,?,?,?,?,1,?)
         ON CONFLICT(id) DO UPDATE SET
           name_he = excluded.name_he, name_en = excluded.name_en, chain_group = excluded.chain_group,
           portal_id = excluded.portal_id, portal_username = excluded.portal_username,
           endpoint_verified = excluded.endpoint_verified, updated_at = excluded.updated_at`,
        [
          chain.id,
          chain.nameHe,
          chain.nameEn,
          chain.group ?? null,
          chain.portalId,
          chain.portalUsername ?? null,
          fromBool(chain.endpointVerified),
          now,
        ],
      );
    }
    return registry.chains.length;
  });
}

/** Stable internal id for a branch, namespaced by chain so ids cannot collide. */
export function branchIdFor(chainId: string, externalBranchId: string): string {
  return `${chainId}:${externalBranchId}`;
}

function upsertBrand(db: DatabaseSync, name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  const existing = get<Row>(db, 'SELECT id FROM brands WHERE name = ?', [trimmed]);
  if (existing) return str(existing.id);
  const id = newId('brand');
  run(db, 'INSERT INTO brands (id, name, created_at) VALUES (?, ?, ?)', [id, trimmed, nowIso()]);
  return id;
}

function upsertCategory(db: DatabaseSync, key: string | null): string | null {
  if (!key) return null;
  const existing = get<Row>(db, 'SELECT id FROM categories WHERE key = ?', [key]);
  if (existing) return str(existing.id);
  const id = newId('cat');
  run(db, 'INSERT INTO categories (id, key, name_he, name_en, created_at) VALUES (?,?,?,?,?)', [
    id,
    key,
    key,
    key,
    nowIso(),
  ]);
  return id;
}

/**
 * Resolves a provider product to an internal product id, creating it on first
 * sight. Identity comes from the normalisation signature (barcode when present),
 * so the same package from two chains converges on one product row.
 */
export function upsertProduct(
  db: DatabaseSync,
  input: {
    name: string;
    barcode: string | null;
    manufacturer: string | null;
    brand: string | null;
    category: string | null;
    packageText: string | null;
    quantity: number | null;
    unitOfMeasure: string | null;
  },
): string {
  // Size may be stated structurally by the feed or embedded in the name.
  const structuredSizeText =
    input.quantity !== null && input.unitOfMeasure ? `${input.quantity} ${input.unitOfMeasure}` : null;
  const size = parsePackageSize(input.name) ?? (structuredSizeText ? parsePackageSize(structuredSizeText) : null);
  const normalized = normalizeProduct({
    name: input.name,
    barcode: input.barcode,
    brand: input.brand,
    manufacturer: input.manufacturer,
    category: input.category,
    size,
  });

  const existing = get<Row>(db, 'SELECT id FROM products WHERE signature = ?', [normalized.signature]);
  const now = nowIso();
  if (existing) {
    const id = str(existing.id);
    run(db, 'UPDATE products SET updated_at = ? WHERE id = ?', [now, id]);
    // Record the spelling we just saw, so future matching can use it.
    run(db, 'INSERT OR IGNORE INTO product_aliases (id, product_id, alias, source, created_at) VALUES (?,?,?,?,?)', [
      newId('alias'),
      id,
      input.name,
      'ingest',
      now,
    ]);
    return id;
  }

  const id = newId('prod');
  run(
    db,
    `INSERT INTO products (
       id, signature, barcode, name_he, name_en, canonical_name, brand_id, manufacturer,
       category_id, package_base_qty, package_base_unit, package_raw_text, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      normalized.signature,
      normalized.barcode,
      input.name,
      null,
      normalized.canonicalName,
      upsertBrand(db, input.brand ?? input.manufacturer),
      input.manufacturer,
      upsertCategory(db, input.category),
      size?.baseQuantity ?? null,
      size?.baseUnit ?? null,
      size?.rawText ?? input.packageText ?? null,
      now,
      now,
    ],
  );
  run(db, 'INSERT OR IGNORE INTO product_aliases (id, product_id, alias, source, created_at) VALUES (?,?,?,?,?)', [
    newId('alias'),
    id,
    input.name,
    'ingest',
    now,
  ]);
  return id;
}

export function ingestSnapshot(db: DatabaseSync, snapshot: ProviderSnapshot): IngestReport {
  const startedAt = nowIso();
  const warnings = [...snapshot.warnings];
  let branchesUpserted = 0;
  let productsUpserted = 0;
  let pricesWritten = 0;
  let historyRowsWritten = 0;
  let promotionsUpserted = 0;
  let staleObservationsSkipped = 0;

  transaction(db, () => {
    for (const branch of snapshot.branches) {
      const id = branchIdFor(branch.chainId, branch.externalBranchId);
      run(
        db,
        `INSERT INTO store_branches (id, chain_id, external_branch_id, name, city, address, latitude, longitude, supports_delivery, delivery_fee_agorot, delivery_minimum_agorot, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, city = excluded.city, address = excluded.address,
           latitude = excluded.latitude, longitude = excluded.longitude,
           supports_delivery = excluded.supports_delivery,
           delivery_fee_agorot = excluded.delivery_fee_agorot,
           delivery_minimum_agorot = excluded.delivery_minimum_agorot,
           updated_at = excluded.updated_at`,
        [
          id,
          branch.chainId,
          branch.externalBranchId,
          branch.name,
          branch.city,
          branch.address,
          branch.latitude,
          branch.longitude,
          fromBool(branch.supportsDelivery ?? false),
          branch.deliveryFeeAgorot ?? null,
          branch.deliveryMinimumAgorot ?? null,
          startedAt,
        ],
      );
      branchesUpserted += 1;
    }

    // Provider product ids are namespaced per provider; map them to internal ids once.
    const productIdByExternal = new Map<string, string>();
    for (const product of snapshot.products) {
      const internalId = upsertProduct(db, {
        name: product.name,
        barcode: product.barcode,
        manufacturer: product.manufacturer,
        brand: product.brand,
        category: product.category,
        packageText: product.packageText,
        quantity: product.quantity,
        unitOfMeasure: product.unitOfMeasure,
      });
      productIdByExternal.set(product.externalProductId, internalId);
      productsUpserted += 1;
    }

    const promotionIdByExternal = new Map<string, string>();
    for (const promotion of snapshot.promotions) {
      const branchId = promotion.externalBranchId
        ? branchIdFor(promotion.chainId, promotion.externalBranchId)
        : null;
      for (const externalProductId of promotion.externalProductIds) {
        const productId = productIdByExternal.get(externalProductId);
        if (!productId) continue;
        const id = `promo:${snapshot.providerId}:${promotion.externalPromotionId}:${productId}`;
        run(
          db,
          `INSERT INTO promotions (
             id, external_id, chain_id, branch_id, product_id, kind, description, buy_quantity, free_quantity,
             bundle_quantity, bundle_price_agorot, percent_off, discount_agorot, promo_unit_price_agorot,
             min_quantity, requires_membership, starts_at, ends_at, source, observed_at
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             description = excluded.description, buy_quantity = excluded.buy_quantity,
             free_quantity = excluded.free_quantity, bundle_quantity = excluded.bundle_quantity,
             bundle_price_agorot = excluded.bundle_price_agorot, percent_off = excluded.percent_off,
             discount_agorot = excluded.discount_agorot, promo_unit_price_agorot = excluded.promo_unit_price_agorot,
             min_quantity = excluded.min_quantity, requires_membership = excluded.requires_membership,
             starts_at = excluded.starts_at, ends_at = excluded.ends_at, observed_at = excluded.observed_at`,
          [
            id,
            promotion.externalPromotionId,
            promotion.chainId,
            branchId,
            productId,
            promotion.kind,
            promotion.description,
            promotion.buyQuantity,
            promotion.freeQuantity,
            promotion.bundleQuantity,
            promotion.bundlePriceAgorot,
            promotion.percentOff,
            promotion.discountAgorot,
            promotion.promoUnitPriceAgorot,
            promotion.minQuantity,
            fromBool(promotion.requiresMembership),
            promotion.startsAt,
            promotion.endsAt,
            promotion.source,
            promotion.observedAt,
          ],
        );
        promotionIdByExternal.set(`${promotion.externalPromotionId}|${externalProductId}`, id);
        promotionsUpserted += 1;
      }
    }

    for (const price of snapshot.prices) {
      const productId = productIdByExternal.get(price.externalProductId);
      if (!productId) {
        warnings.push(`price_without_product:${price.externalProductId}`);
        continue;
      }
      const branchId = branchIdFor(price.chainId, price.externalBranchId);
      const branchExists = get<Row>(db, 'SELECT id FROM store_branches WHERE id = ?', [branchId]);
      if (!branchExists) {
        warnings.push(`price_without_branch:${branchId}`);
        continue;
      }

      const promotionId =
        snapshot.promotions
          .filter(
            (p) =>
              p.externalProductIds.includes(price.externalProductId) &&
              (p.externalBranchId === null || p.externalBranchId === price.externalBranchId),
          )
          .map((p) => promotionIdByExternal.get(`${p.externalPromotionId}|${price.externalProductId}`))
          .find((id): id is string => id !== undefined) ?? null;

      run(
        db,
        `INSERT OR IGNORE INTO price_history (
           id, product_id, chain_id, branch_id, price_agorot, currency, observed_at, source,
           provider_id, promotion_id, is_member_price, availability, confidence
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          newId('ph'),
          productId,
          price.chainId,
          branchId,
          price.priceAgorot,
          price.currency,
          price.observedAt,
          price.source,
          snapshot.providerId,
          promotionId,
          fromBool(price.isMemberPrice),
          price.availability,
          price.confidence,
        ],
      );
      historyRowsWritten += 1;

      const existing = get<Row>(db, 'SELECT observed_at FROM prices WHERE product_id = ? AND branch_id = ?', [
        productId,
        branchId,
      ]);
      // An out-of-order file must not overwrite a newer observation.
      if (existing && str(existing.observed_at) > price.observedAt) {
        staleObservationsSkipped += 1;
        continue;
      }

      run(
        db,
        `INSERT INTO prices (
           product_id, chain_id, branch_id, price_agorot, currency, is_member_price, promotion_id,
           availability, confidence, source, provider_id, observed_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(product_id, branch_id) DO UPDATE SET
           price_agorot = excluded.price_agorot, currency = excluded.currency,
           is_member_price = excluded.is_member_price, promotion_id = excluded.promotion_id,
           availability = excluded.availability, confidence = excluded.confidence,
           source = excluded.source, provider_id = excluded.provider_id, observed_at = excluded.observed_at`,
        [
          productId,
          price.chainId,
          branchId,
          price.priceAgorot,
          price.currency,
          fromBool(price.isMemberPrice),
          promotionId,
          price.availability,
          price.confidence,
          price.source,
          snapshot.providerId,
          price.observedAt,
        ],
      );
      pricesWritten += 1;
    }
  });

  return {
    providerId: snapshot.providerId,
    producesRealMarketPrices: snapshot.producesRealMarketPrices,
    branchesUpserted,
    productsUpserted,
    pricesWritten,
    historyRowsWritten,
    promotionsUpserted,
    staleObservationsSkipped,
    warnings,
    startedAt,
    finishedAt: nowIso(),
  };
}

/** Records provider health so the UI can explain why data is missing. */
export function recordProviderStatus(
  db: DatabaseSync,
  provider: PriceDataProvider,
  result: { available: boolean; error: string | null; succeededAt: string | null },
): void {
  const now = nowIso();
  const previous = get<Row>(db, 'SELECT last_success_at FROM provider_status WHERE provider_id = ?', [
    provider.descriptor.id,
  ]);
  run(
    db,
    `INSERT INTO provider_status (
       provider_id, name, supported_chain_ids, available, data_kind, freshness_seconds,
       rate_limit_per_minute, last_success_at, last_attempt_at, last_error, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(provider_id) DO UPDATE SET
       name = excluded.name, supported_chain_ids = excluded.supported_chain_ids,
       available = excluded.available, data_kind = excluded.data_kind,
       freshness_seconds = excluded.freshness_seconds, rate_limit_per_minute = excluded.rate_limit_per_minute,
       last_success_at = excluded.last_success_at, last_attempt_at = excluded.last_attempt_at,
       last_error = excluded.last_error, updated_at = excluded.updated_at`,
    [
      provider.descriptor.id,
      provider.descriptor.name,
      JSON.stringify(provider.descriptor.supportedChainIds),
      fromBool(result.available),
      provider.descriptor.dataKind,
      provider.descriptor.freshnessSeconds,
      provider.descriptor.rateLimitPerMinute,
      result.succeededAt ?? optStr(previous?.last_success_at ?? null),
      now,
      result.error,
      now,
    ],
  );
}

export interface ProviderStatusView {
  providerId: string;
  name: string;
  dataKind: string;
  available: boolean;
  supportedChainIds: string[];
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  freshnessSeconds: number | null;
}

export function listProviderStatus(db: DatabaseSync): ProviderStatusView[] {
  return all<Row>(db, 'SELECT * FROM provider_status ORDER BY provider_id').map((row) => ({
    providerId: str(row.provider_id),
    name: str(row.name),
    dataKind: str(row.data_kind),
    available: num(row.available) === 1,
    supportedChainIds: JSON.parse(str(row.supported_chain_ids, '[]')) as string[],
    lastSuccessAt: optStr(row.last_success_at),
    lastAttemptAt: optStr(row.last_attempt_at),
    lastError: optStr(row.last_error),
    freshnessSeconds: row.freshness_seconds === null ? null : num(row.freshness_seconds),
  }));
}

/** Runs every configured provider and ingests whatever they could actually return. */
export async function runIngest(
  db: DatabaseSync,
  providers: readonly PriceDataProvider[],
): Promise<IngestReport[]> {
  syncChainRegistry(db);
  const reports: IngestReport[] = [];
  for (const provider of providers) {
    try {
      const availability = await provider.checkAvailability();
      if (!availability.available) {
        recordProviderStatus(db, provider, {
          available: false,
          error: availability.reason,
          succeededAt: null,
        });
        continue;
      }
      const snapshot = await provider.fetchSnapshot();
      const report = ingestSnapshot(db, snapshot);
      recordProviderStatus(db, provider, {
        available: true,
        error: null,
        succeededAt: report.pricesWritten > 0 ? report.finishedAt : null,
      });
      reports.push(report);
    } catch (error) {
      recordProviderStatus(db, provider, {
        available: false,
        error: (error as Error).message,
        succeededAt: null,
      });
    }
  }
  return reports;
}
