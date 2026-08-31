/**
 * Price data provider abstraction.
 *
 * The optimizer must never depend on one specific source of prices, so every
 * ingest path implements this interface and is registered by configuration.
 * A provider declares what it covers and how fresh it is; the application
 * records its health and refuses to present data it could not actually obtain.
 */

import type { Agorot } from '@/lib/domain/money';
import type { PromotionKind } from '@/lib/domain/promotions';

/**
 * How a provider gets its data, in the priority order the product mandates.
 * `demo_fixture` exists so the app can be demonstrated without a live feed —
 * data from it is never presented as a real market price.
 */
export type ProviderDataKind =
  | 'official_government_transparency'
  | 'retailer_api'
  | 'licensed_commercial_api'
  | 'authorized_feed'
  | 'demo_fixture';

export interface ProviderDescriptor {
  id: string;
  name: string;
  dataKind: ProviderDataKind;
  /** Chain ids this provider can serve. Empty means "whatever the portal lists". */
  supportedChainIds: string[];
  /** How often the upstream source publishes, in seconds. */
  freshnessSeconds: number | null;
  rateLimitPerMinute: number | null;
  requiresCredentials: boolean;
  /** Terms-of-use and licensing notes a reviewer needs before enabling this. */
  legalNotes: string;
  /**
   * False for every source that is not a real market feed. The UI keys its
   * "this is not real price data" banner off this flag.
   */
  producesRealMarketPrices: boolean;
}

export interface AvailabilityReport {
  available: boolean;
  checkedAt: string;
  /** Populated whenever `available` is false — shown to the user verbatim-ish. */
  reason: string | null;
  lastSuccessAt: string | null;
}

export interface ProviderBranch {
  externalBranchId: string;
  chainId: string;
  name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Delivery terms, when the source publishes them. */
  supportsDelivery?: boolean;
  deliveryFeeAgorot?: Agorot | null;
  deliveryMinimumAgorot?: Agorot | null;
}

export interface ProviderProduct {
  externalProductId: string;
  barcode: string | null;
  name: string;
  manufacturer: string | null;
  brand: string | null;
  category: string | null;
  /** Raw size text from the feed, e.g. "1 ליטר". */
  packageText: string | null;
  quantity: number | null;
  unitOfMeasure: string | null;
}

export interface ProviderPrice {
  externalProductId: string;
  externalBranchId: string;
  chainId: string;
  priceAgorot: Agorot;
  currency: 'ILS';
  observedAt: string;
  isMemberPrice: boolean;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  /** 0..1 quality of this observation as judged by the ingest path. */
  confidence: number;
  source: string;
}

export interface ProviderPromotion {
  externalPromotionId: string;
  chainId: string;
  externalBranchId: string | null;
  externalProductIds: string[];
  kind: PromotionKind;
  description: string;
  buyQuantity: number | null;
  freeQuantity: number | null;
  bundleQuantity: number | null;
  bundlePriceAgorot: Agorot | null;
  percentOff: number | null;
  discountAgorot: Agorot | null;
  promoUnitPriceAgorot: Agorot | null;
  minQuantity: number | null;
  requiresMembership: boolean;
  startsAt: string | null;
  endsAt: string | null;
  observedAt: string;
  source: string;
}

export interface ProviderSnapshot {
  providerId: string;
  fetchedAt: string;
  branches: ProviderBranch[];
  products: ProviderProduct[];
  prices: ProviderPrice[];
  promotions: ProviderPromotion[];
  /** Non-fatal problems: skipped rows, unparseable prices, partial coverage. */
  warnings: string[];
  /** Mirrors the descriptor, carried on the payload so it survives persistence. */
  producesRealMarketPrices: boolean;
}

export interface FetchOptions {
  chainIds?: string[];
  /** Cap on files/branches pulled in one run, to respect the source's limits. */
  maxBranches?: number;
  signal?: AbortSignal;
}

export interface PriceDataProvider {
  readonly descriptor: ProviderDescriptor;
  checkAvailability(): Promise<AvailabilityReport>;
  fetchSnapshot(options?: FetchOptions): Promise<ProviderSnapshot>;
}

export class ProviderUnavailableError extends Error {
  constructor(
    public readonly providerId: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}
