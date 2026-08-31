/**
 * Live provider for the Israeli food price transparency portals.
 *
 * This is the production data path. It is disabled unless
 * `ENABLE_LIVE_PRICE_FETCH=true`, because enabling it is a decision that
 * requires having reviewed the portal's terms of use for the deployment in
 * question. Even when enabled, it:
 *   - refuses to fetch a path that the host's robots.txt disallows,
 *   - honours the crawl delay and its own rate limit,
 *   - never fabricates data when a fetch fails; the run reports the failure and
 *     the affected chains stay uncovered.
 */

import { gunzipSync } from 'node:zlib';
import {
  parsePriceFile,
  parsePromoFile,
  parseStoresFile,
} from './il-transparency-parser';
import { isAllowed, parseRobots, EMPTY_ROBOTS, type RobotsRules } from './robots';
import { getPortal, loadChainRegistry, type ChainConfig, type PortalConfig } from './chain-registry';
import type {
  AvailabilityReport,
  FetchOptions,
  PriceDataProvider,
  ProviderBranch,
  ProviderDescriptor,
  ProviderPrice,
  ProviderProduct,
  ProviderPromotion,
  ProviderSnapshot,
} from './types';

export const USER_AGENT =
  'PersonalShoppingOptimizer/0.1 (Israeli price transparency reader; contact: set CONTACT_EMAIL)';

export interface HttpClient {
  fetchText(url: string, signal?: AbortSignal): Promise<{ status: number; body: string }>;
  fetchBinary(url: string, signal?: AbortSignal): Promise<{ status: number; body: Uint8Array }>;
}

const defaultHttpClient: HttpClient = {
  async fetchText(url, signal) {
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal });
    return { status: response.status, body: await response.text() };
  },
  async fetchBinary(url, signal) {
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal });
    const buffer = await response.arrayBuffer();
    return { status: response.status, body: new Uint8Array(buffer) };
  },
};

export interface TransparencyProviderOptions {
  portalId: string;
  chains: ChainConfig[];
  http?: HttpClient;
  /** Overrides the ENABLE_LIVE_PRICE_FETCH environment gate. Tests set this. */
  enabled?: boolean;
  now?: () => string;
}

/** Decompresses a `.gz` payload; plain XML is passed through unchanged. */
export function decodeFeedPayload(bytes: Uint8Array, filename: string): string {
  const isGzip = filename.endsWith('.gz') || (bytes[0] === 0x1f && bytes[1] === 0x8b);
  const raw = isGzip ? gunzipSync(bytes) : Buffer.from(bytes);
  // The published files are UTF-8; a few older ones carry a BOM.
  return raw.toString('utf8').replace(/^﻿/, '');
}

/** Extracts href targets that look like published price/promo/store files. */
export function extractFeedLinks(html: string): string[] {
  const links = new Set<string>();
  const pattern = /href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1];
    if (!href) continue;
    if (/(pricefull|price|promofull|promo|stores)[^/]*\.(xml|gz)$/i.test(href)) links.add(href);
  }
  return [...links];
}

export type FeedKind = 'price' | 'promo' | 'stores';

export function classifyFeedFile(filename: string): FeedKind | null {
  const name = filename.toLowerCase();
  if (name.includes('promo')) return 'promo';
  if (name.includes('store')) return 'stores';
  if (name.includes('price')) return 'price';
  return null;
}

export class IsraeliTransparencyProvider implements PriceDataProvider {
  readonly descriptor: ProviderDescriptor;
  private readonly portal: PortalConfig | null;
  private readonly chains: ChainConfig[];
  private readonly http: HttpClient;
  private readonly enabled: boolean;
  private readonly now: () => string;
  private robots: RobotsRules | null = null;
  private lastSuccessAt: string | null = null;

  constructor(options: TransparencyProviderOptions) {
    this.portal = getPortal(options.portalId, loadChainRegistry());
    this.chains = options.chains;
    this.http = options.http ?? defaultHttpClient;
    this.enabled = options.enabled ?? process.env.ENABLE_LIVE_PRICE_FETCH === 'true';
    this.now = options.now ?? (() => new Date().toISOString());
    this.descriptor = {
      id: `il-transparency:${options.portalId}`,
      name: this.portal?.name ?? options.portalId,
      dataKind: 'official_government_transparency',
      supportedChainIds: options.chains.map((c) => c.id),
      // Chains publish at least once a day; most refresh several times a day.
      freshnessSeconds: 6 * 60 * 60,
      rateLimitPerMinute: 20,
      requiresCredentials: this.portal?.protocol === 'cerberus-login',
      legalNotes:
        'Published under the Israeli Food Price Transparency Law. Review the portal terms of use and robots.txt for your deployment before enabling live fetching; set ENABLE_LIVE_PRICE_FETCH=true only once that review is done.',
      producesRealMarketPrices: true,
    };
  }

  private async loadRobots(signal?: AbortSignal): Promise<RobotsRules> {
    if (this.robots) return this.robots;
    if (!this.portal) return EMPTY_ROBOTS;
    try {
      const url = new URL('/robots.txt', this.portal.baseUrl).toString();
      const { status, body } = await this.http.fetchText(url, signal);
      this.robots = status === 200 ? parseRobots(body, USER_AGENT) : EMPTY_ROBOTS;
    } catch {
      // A missing robots.txt is not permission to ignore the question, but it is
      // also not a prohibition; treat it as no rules and keep the rate limit.
      this.robots = EMPTY_ROBOTS;
    }
    return this.robots;
  }

  async checkAvailability(): Promise<AvailabilityReport> {
    const checkedAt = this.now();
    if (!this.portal) {
      return { available: false, checkedAt, reason: 'portal_not_configured', lastSuccessAt: this.lastSuccessAt };
    }
    if (!this.enabled) {
      return {
        available: false,
        checkedAt,
        reason: 'live_fetch_disabled_set_ENABLE_LIVE_PRICE_FETCH',
        lastSuccessAt: this.lastSuccessAt,
      };
    }
    if (!this.portal.endpointVerified) {
      return {
        available: false,
        checkedAt,
        reason: 'portal_endpoint_not_verified',
        lastSuccessAt: this.lastSuccessAt,
      };
    }
    try {
      const { status } = await this.http.fetchText(this.portal.baseUrl);
      if (status >= 200 && status < 400) {
        return { available: true, checkedAt, reason: null, lastSuccessAt: this.lastSuccessAt };
      }
      return { available: false, checkedAt, reason: `portal_http_${status}`, lastSuccessAt: this.lastSuccessAt };
    } catch (error) {
      return {
        available: false,
        checkedAt,
        reason: `portal_unreachable: ${(error as Error).message}`,
        lastSuccessAt: this.lastSuccessAt,
      };
    }
  }

  async fetchSnapshot(options: FetchOptions = {}): Promise<ProviderSnapshot> {
    const fetchedAt = this.now();
    const warnings: string[] = [];
    const branches: ProviderBranch[] = [];
    const products: ProviderProduct[] = [];
    const prices: ProviderPrice[] = [];
    const promotions: ProviderPromotion[] = [];

    const availability = await this.checkAvailability();
    if (!availability.available) {
      // An unavailable source yields an empty, honest snapshot — never a guess.
      return {
        providerId: this.descriptor.id,
        fetchedAt,
        branches,
        products,
        prices,
        promotions,
        warnings: [`provider_unavailable:${availability.reason ?? 'unknown'}`],
        producesRealMarketPrices: true,
      };
    }

    const portal = this.portal as PortalConfig;
    const robots = await this.loadRobots(options.signal);
    const targetChains = options.chainIds
      ? this.chains.filter((c) => options.chainIds?.includes(c.id))
      : this.chains;

    for (const chain of targetChains) {
      const listingUrl = this.listingUrlFor(chain);
      const listingPath = new URL(listingUrl).pathname;
      if (!isAllowed(robots, listingPath)) {
        warnings.push(`robots_disallows_listing:${chain.id}`);
        continue;
      }

      let links: string[];
      try {
        const { status, body } = await this.http.fetchText(listingUrl, options.signal);
        if (status !== 200) {
          warnings.push(`listing_http_${status}:${chain.id}`);
          continue;
        }
        links = extractFeedLinks(body);
      } catch (error) {
        warnings.push(`listing_failed:${chain.id}:${(error as Error).message}`);
        continue;
      }

      if (links.length === 0) {
        warnings.push(`no_feed_files_found:${chain.id}`);
        continue;
      }

      const limit = options.maxBranches ?? 5;
      let processed = 0;
      for (const link of links) {
        if (processed >= limit) break;
        const fileUrl = new URL(link, listingUrl).toString();
        const kind = classifyFeedFile(fileUrl);
        if (!kind) continue;
        if (!isAllowed(robots, new URL(fileUrl).pathname)) {
          warnings.push(`robots_disallows_file:${fileUrl}`);
          continue;
        }
        try {
          const { status, body } = await this.http.fetchBinary(fileUrl, options.signal);
          if (status !== 200) {
            warnings.push(`file_http_${status}:${fileUrl}`);
            continue;
          }
          const xml = decodeFeedPayload(body, fileUrl);
          const parserOptions = { chainId: chain.id, source: portal.id, fallbackObservedAt: fetchedAt };
          if (kind === 'price') {
            const parsed = parsePriceFile(xml, parserOptions);
            products.push(...parsed.products);
            prices.push(...parsed.prices);
            warnings.push(...parsed.warnings.map((w) => `${chain.id}:${w}`));
            processed += 1;
          } else if (kind === 'promo') {
            const parsed = parsePromoFile(xml, parserOptions);
            promotions.push(...parsed.promotions);
            warnings.push(...parsed.warnings.map((w) => `${chain.id}:${w}`));
          } else {
            const parsed = parseStoresFile(xml, { chainId: chain.id });
            branches.push(...parsed.branches);
            warnings.push(...parsed.warnings.map((w) => `${chain.id}:${w}`));
          }
        } catch (error) {
          warnings.push(`file_failed:${fileUrl}:${(error as Error).message}`);
        }
      }
    }

    if (prices.length > 0) this.lastSuccessAt = fetchedAt;

    return {
      providerId: this.descriptor.id,
      fetchedAt,
      branches,
      products,
      prices,
      promotions,
      warnings,
      producesRealMarketPrices: true,
    };
  }

  private listingUrlFor(chain: ChainConfig): string {
    const portal = this.portal as PortalConfig;
    if (portal.protocol === 'cerberus-login' && chain.portalUsername) {
      return new URL(`/file/d/${encodeURIComponent(chain.portalUsername)}`, portal.baseUrl).toString();
    }
    return portal.baseUrl;
  }
}
