/**
 * Parser for the file formats published under Israel's food price transparency
 * regulations (PriceFull / Price / PromoFull / Promo / Stores).
 *
 * The regulated schema is stable in shape but inconsistent in casing and in a
 * few element names between chains, so every lookup is case-insensitive and
 * accepts the known aliases. Rows that cannot be parsed are skipped and counted
 * as warnings rather than guessed at.
 */

import { shekelsToAgorot, type Agorot } from '@/lib/domain/money';
import type { ProviderBranch, ProviderPrice, ProviderProduct, ProviderPromotion } from './types';
import { childrenNamed, findFirst, parseXml, textOf, type XmlNode } from './xml';
import type { PromotionKind } from '@/lib/domain/promotions';

export interface ParsedPriceFile {
  chainId: string;
  externalBranchId: string;
  products: ProviderProduct[];
  prices: ProviderPrice[];
  warnings: string[];
}

export interface ParsedPromoFile {
  chainId: string;
  externalBranchId: string;
  promotions: ProviderPromotion[];
  warnings: string[];
}

export interface ParsedStoresFile {
  chainId: string;
  branches: ProviderBranch[];
  warnings: string[];
}

/** Reads the first present element from a list of aliases. */
function pick(node: XmlNode, ...names: string[]): string | null {
  for (const name of names) {
    const value = textOf(node, name);
    if (value !== null) return value;
  }
  return null;
}

function parsePrice(raw: string | null): Agorot | null {
  if (raw === null) return null;
  const value = Number.parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) return null;
  return shekelsToAgorot(value);
}

function parseNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/**
 * Feeds publish timestamps as "YYYY-MM-DD HH:mm" (local Israel time) or as
 * ISO-8601. Anything else is rejected so a bad timestamp cannot silently become
 * "now" and corrupt price history.
 */
export function parseFeedTimestamp(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const isoLike = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/.test(trimmed);
  if (!isoLike) return null;
  // Feeds without an explicit offset are Israel local time (UTC+03:00 in the
  // summer, UTC+02:00 in the winter). Treating them as UTC would shift every
  // observation by hours, so the offset is applied explicitly.
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const normalized = trimmed.replace(' ', 'T');
  const candidate = hasZone ? normalized : `${normalized}${israelOffsetFor(normalized)}`;
  const ms = Date.parse(candidate);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/**
 * Israel observes DST from the Friday before the last Sunday of March until the
 * last Sunday of October. Computed rather than hard-coded per year.
 */
function israelOffsetFor(localIso: string): '+02:00' | '+03:00' {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(localIso);
  if (!match) return '+02:00';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const lastSundayOf = (m: number): number => {
    const last = new Date(Date.UTC(year, m, 0)); // day 0 of next month = last day of m
    return last.getUTCDate() - last.getUTCDay();
  };
  const dstStart = lastSundayOf(3) - 2; // the Friday before the last Sunday of March
  const dstEnd = lastSundayOf(10);
  if (month < 3 || month > 10) return '+02:00';
  if (month > 3 && month < 10) return '+03:00';
  if (month === 3) return day >= dstStart ? '+03:00' : '+02:00';
  return day < dstEnd ? '+03:00' : '+02:00';
}

export function parsePriceFile(
  xml: string,
  options: { chainId: string; source: string; fallbackObservedAt: string },
): ParsedPriceFile {
  const root = parseXml(xml);
  const warnings: string[] = [];
  const chainId = options.chainId;
  const externalBranchId = pick(root, 'StoreId', 'StoreID', 'StoreNumber') ?? 'unknown';
  const fileObservedAt = parseFeedTimestamp(pick(root, 'PriceUpdateDate', 'LastUpdateDate'));

  const itemsNode = findFirst(root, 'Items') ?? findFirst(root, 'Products');
  const itemNodes = itemsNode
    ? [...childrenNamed(itemsNode, 'Item'), ...childrenNamed(itemsNode, 'Product')]
    : [];

  if (itemNodes.length === 0) warnings.push('price_file_contains_no_items');

  const products: ProviderProduct[] = [];
  const prices: ProviderPrice[] = [];
  const seenProducts = new Set<string>();

  for (const item of itemNodes) {
    const code = pick(item, 'ItemCode', 'ProductCode', 'Barcode');
    const name = pick(item, 'ItemName', 'ItemNm', 'ProductName');
    const priceAgorot = parsePrice(pick(item, 'ItemPrice', 'Price', 'UnitPrice'));

    if (!code || !name) {
      warnings.push('skipped_item_missing_identity');
      continue;
    }
    if (priceAgorot === null) {
      warnings.push(`skipped_item_unparseable_price:${code}`);
      continue;
    }

    const observedAt =
      parseFeedTimestamp(pick(item, 'PriceUpdateDate', 'LastUpdateDate')) ??
      fileObservedAt ??
      options.fallbackObservedAt;

    if (!seenProducts.has(code)) {
      seenProducts.add(code);
      products.push({
        externalProductId: code,
        barcode: /^\d{8,13}$/.test(code) ? code : null,
        name,
        manufacturer: pick(item, 'ManufacturerName', 'ManufactureName', 'ManufacturerItemDescription'),
        brand: pick(item, 'ManufacturerName', 'ManufactureName'),
        category: null,
        packageText: pick(item, 'UnitQty', 'UnitOfMeasure', 'UnitMeasure'),
        quantity: parseNumber(pick(item, 'Quantity', 'QtyInPackage')),
        unitOfMeasure: pick(item, 'UnitOfMeasure', 'UnitMeasure', 'UnitQty'),
      });
    }

    prices.push({
      externalProductId: code,
      externalBranchId,
      chainId,
      priceAgorot,
      currency: 'ILS',
      observedAt,
      // The regulated price files publish the shelf price; club prices arrive
      // through the promotions file, so nothing here is a member price.
      isMemberPrice: false,
      availability: 'unknown',
      confidence: 1,
      source: options.source,
    });
  }

  return { chainId, externalBranchId, products, prices, warnings };
}

/**
 * Maps the regulated `DiscountType`/`RewardType` fields onto the promotion kinds
 * the pricing engine understands. Anything unrecognised becomes a
 * `unit_price_override` when a discounted price is present, and is otherwise
 * skipped — an unknown promotion is never invented into a discount.
 */
function classifyPromotion(node: XmlNode): { kind: PromotionKind; requiresMembership: boolean } | null {
  const clubId = pick(node, 'ClubId', 'ClubID');
  const requiresMembership = clubId !== null && clubId !== '0' && clubId !== '';
  const rewardType = pick(node, 'RewardType');
  const discountType = pick(node, 'DiscountType');
  const minQty = parseNumber(pick(node, 'MinQty', 'MinQuantity'));
  const discountedPrice = parsePrice(pick(node, 'DiscountedPrice', 'DiscountedPricePerMida'));
  const discountRate = parseNumber(pick(node, 'DiscountRate'));

  // RewardType 1 = discount off the item, 2 = discount on the total,
  // 3 = "get another item", 10 = quantity bundle. Values vary slightly between
  // chains, so the shape of the data decides as well as the code.
  if (rewardType === '3' && minQty !== null && minQty >= 2) {
    return { kind: 'n_plus_m', requiresMembership };
  }
  if (discountedPrice !== null && minQty !== null && minQty >= 2 && discountType === '1') {
    return { kind: 'n_for_total', requiresMembership };
  }
  if (discountRate !== null && discountRate > 0 && discountedPrice === null) {
    return { kind: 'percent_off', requiresMembership };
  }
  if (discountedPrice !== null) {
    return { kind: requiresMembership ? 'member_price' : 'unit_price_override', requiresMembership };
  }
  return null;
}

export function parsePromoFile(
  xml: string,
  options: { chainId: string; source: string; fallbackObservedAt: string },
): ParsedPromoFile {
  const root = parseXml(xml);
  const warnings: string[] = [];
  const externalBranchId = pick(root, 'StoreId', 'StoreID', 'StoreNumber') ?? 'unknown';
  const promosNode = findFirst(root, 'Promotions') ?? findFirst(root, 'Sales');
  const promoNodes = promosNode
    ? [...childrenNamed(promosNode, 'Promotion'), ...childrenNamed(promosNode, 'Sale')]
    : [];

  const promotions: ProviderPromotion[] = [];

  for (const node of promoNodes) {
    const id = pick(node, 'PromotionId', 'PromotionID');
    const description = pick(node, 'PromotionDescription', 'PromotionDesc') ?? '';
    if (!id) {
      warnings.push('skipped_promotion_missing_id');
      continue;
    }

    const itemsNode = findFirst(node, 'PromotionItems');
    const productIds = itemsNode
      ? childrenNamed(itemsNode, 'Item')
          .map((item) => pick(item, 'ItemCode'))
          .filter((code): code is string => code !== null)
      : [];
    if (productIds.length === 0) {
      warnings.push(`skipped_promotion_without_items:${id}`);
      continue;
    }

    const classification = classifyPromotion(node);
    if (!classification) {
      warnings.push(`skipped_promotion_unrecognised_terms:${id}`);
      continue;
    }

    const minQty = parseNumber(pick(node, 'MinQty', 'MinQuantity'));
    const discountedPrice = parsePrice(pick(node, 'DiscountedPrice', 'DiscountedPricePerMida'));
    const discountRate = parseNumber(pick(node, 'DiscountRate'));
    const observedAt =
      parseFeedTimestamp(pick(node, 'PromotionUpdateDate', 'PriceUpdateDate')) ?? options.fallbackObservedAt;

    promotions.push({
      externalPromotionId: id,
      chainId: options.chainId,
      externalBranchId,
      externalProductIds: productIds,
      kind: classification.kind,
      description,
      buyQuantity: classification.kind === 'n_plus_m' && minQty !== null ? minQty - 1 : null,
      freeQuantity: classification.kind === 'n_plus_m' ? 1 : null,
      bundleQuantity: classification.kind === 'n_for_total' ? minQty : null,
      bundlePriceAgorot: classification.kind === 'n_for_total' ? discountedPrice : null,
      percentOff: classification.kind === 'percent_off' ? discountRate : null,
      discountAgorot: null,
      promoUnitPriceAgorot:
        classification.kind === 'unit_price_override' || classification.kind === 'member_price'
          ? discountedPrice
          : null,
      minQuantity: minQty,
      requiresMembership: classification.requiresMembership,
      startsAt: parseFeedTimestamp(pick(node, 'PromotionStartDate')),
      endsAt: parseFeedTimestamp(pick(node, 'PromotionEndDate')),
      observedAt,
      source: options.source,
    });
  }

  return { chainId: options.chainId, externalBranchId, promotions, warnings };
}

export function parseStoresFile(xml: string, options: { chainId: string }): ParsedStoresFile {
  const root = parseXml(xml);
  const warnings: string[] = [];
  const storesNode = findFirst(root, 'Stores') ?? findFirst(root, 'Branches');
  const storeNodes = storesNode
    ? [...childrenNamed(storesNode, 'Store'), ...childrenNamed(storesNode, 'Branch')]
    : [];

  const branches: ProviderBranch[] = [];
  for (const node of storeNodes) {
    const id = pick(node, 'StoreId', 'StoreID', 'StoreNumber');
    const name = pick(node, 'StoreName', 'StoreNm');
    if (!id || !name) {
      warnings.push('skipped_store_missing_identity');
      continue;
    }
    branches.push({
      externalBranchId: id,
      chainId: options.chainId,
      name,
      city: pick(node, 'City', 'CityName'),
      address: pick(node, 'Address'),
      latitude: parseNumber(pick(node, 'Latitude')),
      longitude: parseNumber(pick(node, 'Longitude')),
    });
  }
  if (branches.length === 0) warnings.push('stores_file_contains_no_branches');
  return { chainId: options.chainId, branches, warnings };
}
