/**
 * Product matching: resolves a free-text basket line to a catalog product.
 *
 * The search is a two-stage funnel — a cheap SQL pre-filter to bound the
 * candidate set, then the deterministic scorer from the domain layer. When the
 * best candidate does not clear the acceptance threshold the line stays
 * unmatched and the UI asks the user, rather than guessing.
 */

import type { DatabaseSync } from 'node:sqlite';
import { all, optNum, optStr, str, type Row } from '@/lib/db/client';
import {
  findBestMatch,
  isPlausibleBarcode,
  MATCH_ACCEPT_THRESHOLD,
  normalizeProduct,
  tokenize,
  type MatchCandidate,
  type NormalizedProduct,
} from '@/lib/domain/normalize';
import type { BaseUnit } from '@/lib/domain/units';

export interface CatalogProduct {
  id: string;
  nameHe: string;
  canonicalName: string;
  barcode: string | null;
  brand: string | null;
  categoryKey: string | null;
  packageBaseQty: number | null;
  packageBaseUnit: BaseUnit | null;
  packageRawText: string | null;
}

function rowToProduct(row: Row): CatalogProduct {
  const unit = optStr(row.package_base_unit);
  return {
    id: str(row.id),
    nameHe: str(row.name_he),
    canonicalName: str(row.canonical_name),
    barcode: optStr(row.barcode),
    brand: optStr(row.brand_name),
    categoryKey: optStr(row.category_key),
    packageBaseQty: optNum(row.package_base_qty),
    packageBaseUnit: unit === 'g' || unit === 'ml' || unit === 'unit' ? unit : null,
    packageRawText: optStr(row.package_raw_text),
  };
}

const PRODUCT_SELECT = `
  SELECT p.id, p.name_he, p.canonical_name, p.barcode, p.package_base_qty, p.package_base_unit,
         p.package_raw_text, b.name AS brand_name, c.key AS category_key
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id`;

/** Bounded candidate set: exact barcode, then any product sharing a query token. */
export function findCandidates(db: DatabaseSync, query: string, limit = 200): CatalogProduct[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  if (isPlausibleBarcode(trimmed)) {
    const byBarcode = all<Row>(db, `${PRODUCT_SELECT} WHERE p.barcode = ?`, [trimmed.replace(/\D/g, '')]);
    if (byBarcode.length > 0) return byBarcode.map(rowToProduct);
  }

  const tokens = tokenize(trimmed).filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];

  const clauses = tokens.map(() => 'p.canonical_name LIKE ?').join(' OR ');
  const params = tokens.map((t) => `%${t}%`);
  const rows = all<Row>(db, `${PRODUCT_SELECT} WHERE ${clauses} LIMIT ?`, [...params, limit]);

  // Aliases catch spellings that never made it into the canonical name.
  const aliasRows = all<Row>(
    db,
    `${PRODUCT_SELECT}
      WHERE p.id IN (SELECT product_id FROM product_aliases WHERE ${tokens.map(() => 'alias LIKE ?').join(' OR ')})
      LIMIT ?`,
    [...params, limit],
  );

  const merged = new Map<string, CatalogProduct>();
  for (const row of [...rows, ...aliasRows]) {
    const product = rowToProduct(row);
    merged.set(product.id, product);
  }
  return [...merged.values()];
}

export function toNormalized(product: CatalogProduct): NormalizedProduct {
  return normalizeProduct({
    name: product.nameHe,
    barcode: product.barcode,
    brand: product.brand,
    category: product.categoryKey,
    size:
      product.packageBaseQty !== null && product.packageBaseUnit !== null
        ? {
            baseQuantity: product.packageBaseQty,
            baseUnit: product.packageBaseUnit,
            rawText: product.packageRawText ?? '',
            multipack: 1,
          }
        : null,
  });
}

export interface ProductMatch {
  product: CatalogProduct | null;
  confidence: number;
  accepted: boolean;
  alternatives: Array<{ product: CatalogProduct; score: number }>;
}

export function matchProduct(
  db: DatabaseSync,
  rawText: string,
  options: { preferredBrand?: string | null; threshold?: number } = {},
): ProductMatch {
  const candidates = findCandidates(db, rawText);
  if (candidates.length === 0) {
    return { product: null, confidence: 0, accepted: false, alternatives: [] };
  }

  const query = normalizeProduct({ name: rawText, brand: options.preferredBrand ?? null });
  const wrapped: MatchCandidate<CatalogProduct>[] = candidates.map((product) => ({
    item: product,
    normalized: toNormalized(product),
  }));
  const outcome = findBestMatch(query, wrapped, options.threshold ?? MATCH_ACCEPT_THRESHOLD);

  return {
    product: outcome.best?.item ?? null,
    confidence: outcome.score.score,
    accepted: outcome.accepted,
    alternatives: outcome.alternatives.map((alt) => ({ product: alt.item, score: alt.score })),
  };
}

/**
 * Products that could stand in for a matched product: same category, comparable
 * package size, different brand. Used only when the user permits substitution.
 */
export function findSubstitutes(
  db: DatabaseSync,
  product: CatalogProduct,
  limit = 8,
): Array<{ product: CatalogProduct; score: number }> {
  if (!product.categoryKey && !product.packageBaseUnit) return [];
  const rows = all<Row>(
    db,
    `${PRODUCT_SELECT}
      WHERE p.id != ?
        AND (c.key = ? OR ? IS NULL)
        AND (p.package_base_unit = ? OR p.package_base_unit IS NULL)
      LIMIT ?`,
    [product.id, product.categoryKey, product.categoryKey, product.packageBaseUnit, limit * 4],
  );

  const target = toNormalized(product);
  const scored = rows
    .map(rowToProduct)
    .map((candidate) => {
      const normalized = toNormalized(candidate);
      const sizeRatio =
        product.packageBaseQty && candidate.packageBaseQty
          ? Math.min(product.packageBaseQty, candidate.packageBaseQty) /
            Math.max(product.packageBaseQty, candidate.packageBaseQty)
          : 0;
      // Token similarity carries most of the weight; size proximity keeps a 1L
      // substitute from being offered for a 200ml original.
      let overlap = 0;
      const targetTokens = new Set(target.tokens);
      for (const token of normalized.tokens) if (targetTokens.has(token)) overlap += 1;
      const jaccard =
        targetTokens.size + normalized.tokens.length - overlap === 0
          ? 0
          : overlap / (targetTokens.size + normalized.tokens.length - overlap);
      return { product: candidate, score: Math.min(1, jaccard * 0.75 + sizeRatio * 0.25) };
    })
    .filter((entry) => entry.score > 0.3)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
