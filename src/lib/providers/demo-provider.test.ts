import { describe, expect, it } from 'vitest';
import { DemoPriceProvider, loadDemoDataset } from './demo-provider';

describe('DemoPriceProvider', () => {
  const provider = new DemoPriceProvider();

  it('declares itself as synthetic, not market data', () => {
    expect(provider.descriptor.producesRealMarketPrices).toBe(false);
    expect(provider.descriptor.dataKind).toBe('demo_fixture');
  });

  it('refuses to load a dataset that claims to be real', () => {
    const bad = { ...loadDemoDataset(), realMarketData: true } as unknown as never;
    expect(() => new DemoPriceProvider(bad)).toThrow();
  });

  it('returns only the newest observation per product and branch', async () => {
    const snapshot = await provider.fetchSnapshot();
    const keys = snapshot.prices.map((p) => `${p.externalProductId}|${p.externalBranchId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(snapshot.prices.length).toBe(snapshot.products.length * snapshot.branches.length);
  });

  it('labels every observation with the demo source and warns on the snapshot', async () => {
    const snapshot = await provider.fetchSnapshot();
    expect(snapshot.producesRealMarketPrices).toBe(false);
    expect(snapshot.warnings).toContain('synthetic_demo_data_not_real_prices');
    expect(snapshot.prices.every((p) => p.source === 'demo-fixture')).toBe(true);
  });

  it('filters to the requested chains', async () => {
    const snapshot = await provider.fetchSnapshot({ chainIds: ['rami-levy'] });
    expect(new Set(snapshot.prices.map((p) => p.chainId))).toEqual(new Set(['rami-levy']));
  });

  it('exposes enough history to support 90-day comparisons', () => {
    const history = provider.fullHistory();
    const timestamps = history.map((p) => Date.parse(p.observedAt));
    const span = (Math.max(...timestamps) - Math.min(...timestamps)) / 86_400_000;
    expect(span).toBeGreaterThanOrEqual(90);
  });
});
