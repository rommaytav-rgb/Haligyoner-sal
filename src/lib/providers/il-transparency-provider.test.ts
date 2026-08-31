import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  classifyFeedFile,
  decodeFeedPayload,
  extractFeedLinks,
  IsraeliTransparencyProvider,
  type HttpClient,
} from './il-transparency-provider';
import { loadChainRegistry } from './chain-registry';

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), 'src/lib/providers/__fixtures__', name), 'utf8');

const chains = loadChainRegistry().chains.filter((c) => c.id === 'rami-levy');

function makeClient(overrides: Partial<HttpClient> = {}): HttpClient {
  return {
    async fetchText(url: string) {
      if (url.endsWith('/robots.txt')) return { status: 200, body: 'User-agent: *\nDisallow: /private' };
      return {
        status: 200,
        body: '<a href="PriceFull7290-042-202608310615.gz">price</a><a href="PromoFull7290-042.gz">promo</a><a href="Stores7290.xml">stores</a>',
      };
    },
    async fetchBinary(url: string) {
      const name = url.includes('Promo')
        ? 'promofull-sample.xml'
        : url.includes('Stores')
          ? 'stores-sample.xml'
          : 'pricefull-sample.xml';
      return { status: 200, body: new Uint8Array(gzipSync(Buffer.from(fixture(name), 'utf8'))) };
    },
    ...overrides,
  };
}

describe('decodeFeedPayload', () => {
  it('gunzips a .gz payload', () => {
    const bytes = new Uint8Array(gzipSync(Buffer.from('<a>1</a>', 'utf8')));
    expect(decodeFeedPayload(bytes, 'x.gz')).toBe('<a>1</a>');
  });

  it('passes plain XML through and strips a BOM', () => {
    const bytes = new Uint8Array(Buffer.from('﻿<a>1</a>', 'utf8'));
    expect(decodeFeedPayload(bytes, 'x.xml')).toBe('<a>1</a>');
  });
});

describe('extractFeedLinks / classifyFeedFile', () => {
  it('finds published feed files in a directory listing', () => {
    const links = extractFeedLinks(
      '<a href="PriceFull123.gz">a</a><a href="index.html">b</a><a href="PromoFull123.xml">c</a>',
    );
    expect(links).toEqual(['PriceFull123.gz', 'PromoFull123.xml']);
  });

  it('classifies file kinds', () => {
    expect(classifyFeedFile('PriceFull7290-042.gz')).toBe('price');
    expect(classifyFeedFile('PromoFull7290-042.gz')).toBe('promo')
    expect(classifyFeedFile('Stores7290.xml')).toBe('stores');
    expect(classifyFeedFile('readme.txt')).toBeNull();
  });
});

describe('IsraeliTransparencyProvider', () => {
  it('is unavailable until live fetching is explicitly enabled', async () => {
    const provider = new IsraeliTransparencyProvider({ portalId: 'cerberus', chains, enabled: false });
    const report = await provider.checkAvailability();
    expect(report.available).toBe(false);
    expect(report.reason).toBe('live_fetch_disabled_set_ENABLE_LIVE_PRICE_FETCH');
  });

  it('refuses to fetch from an unverified portal endpoint', async () => {
    const provider = new IsraeliTransparencyProvider({
      portalId: 'cerberus',
      chains,
      enabled: true,
      http: makeClient(),
    });
    const report = await provider.checkAvailability();
    expect(report.available).toBe(false);
    expect(report.reason).toBe('portal_endpoint_not_verified');
  });

  it('returns an empty, honest snapshot when the source is unavailable', async () => {
    const provider = new IsraeliTransparencyProvider({ portalId: 'cerberus', chains, enabled: false });
    const snapshot = await provider.fetchSnapshot();
    expect(snapshot.prices).toEqual([]);
    expect(snapshot.warnings[0]).toContain('provider_unavailable');
  });

  it('ingests a verified portal end to end', async () => {
    const registry = loadChainRegistry();
    const portal = registry.portals.find((p) => p.id === 'cerberus');
    const chain = registry.chains.find((c) => c.id === 'rami-levy');
    // Simulate the state after an operator has verified this endpoint.
    const restore = { portal: portal?.endpointVerified, chain: chain?.endpointVerified };
    if (portal) portal.endpointVerified = true;
    if (chain) chain.endpointVerified = true;
    try {
      const provider = new IsraeliTransparencyProvider({
        portalId: 'cerberus',
        chains: chain ? [chain] : [],
        enabled: true,
        http: makeClient(),
      });
      const snapshot = await provider.fetchSnapshot({ maxBranches: 5 });
      expect(snapshot.producesRealMarketPrices).toBe(true);
      expect(snapshot.prices).toHaveLength(2);
      expect(snapshot.promotions.length).toBeGreaterThan(0);
      expect(snapshot.branches).toHaveLength(2);
    } finally {
      if (portal) portal.endpointVerified = restore.portal ?? false;
      if (chain) chain.endpointVerified = restore.chain ?? false;
    }
  });

  it('does not fetch a path robots.txt disallows', async () => {
    const registry = loadChainRegistry();
    const portal = registry.portals.find((p) => p.id === 'cerberus');
    const chain = registry.chains.find((c) => c.id === 'rami-levy');
    const restore = { portal: portal?.endpointVerified, chain: chain?.endpointVerified };
    if (portal) portal.endpointVerified = true;
    if (chain) chain.endpointVerified = true;
    try {
      const provider = new IsraeliTransparencyProvider({
        portalId: 'cerberus',
        chains: chain ? [chain] : [],
        enabled: true,
        http: makeClient({
          async fetchText(url: string) {
            if (url.endsWith('/robots.txt')) return { status: 200, body: 'User-agent: *\nDisallow: /' };
            return { status: 200, body: '<a href="PriceFull1.gz">x</a>' };
          },
        }),
      });
      const snapshot = await provider.fetchSnapshot();
      expect(snapshot.prices).toEqual([]);
      expect(snapshot.warnings).toContain('robots_disallows_listing:rami-levy');
    } finally {
      if (portal) portal.endpointVerified = restore.portal ?? false;
      if (chain) chain.endpointVerified = restore.chain ?? false;
    }
  });
});
