/**
 * Provider registry.
 *
 * The application talks to providers only through this registry, so no part of
 * the optimizer is tied to a specific source of prices. Providers are assembled
 * from configuration; adding a portal to `data/chains.json` adds a provider.
 */

import { loadChainRegistry, type ChainConfig } from './chain-registry';
import { DemoPriceProvider } from './demo-provider';
import { IsraeliTransparencyProvider } from './il-transparency-provider';
import type { PriceDataProvider } from './types';

export interface RegistryOptions {
  /** Include the synthetic demo provider. Defaults to the DEMO_DATA env flag. */
  includeDemo?: boolean;
  /** Enable live portal fetching. Defaults to the ENABLE_LIVE_PRICE_FETCH flag. */
  enableLive?: boolean;
}

export function demoDataEnabled(): boolean {
  // Demo data is on by default so a fresh checkout is runnable, and can be
  // turned off for a deployment that must only ever show verified prices.
  return process.env.DEMO_DATA !== 'false';
}

export function liveFetchEnabled(): boolean {
  return process.env.ENABLE_LIVE_PRICE_FETCH === 'true';
}

export function buildProviders(options: RegistryOptions = {}): PriceDataProvider[] {
  const includeDemo = options.includeDemo ?? demoDataEnabled();
  const enableLive = options.enableLive ?? liveFetchEnabled();
  const registry = loadChainRegistry();
  const providers: PriceDataProvider[] = [];

  const byPortal = new Map<string, ChainConfig[]>();
  for (const chain of registry.chains) {
    const list = byPortal.get(chain.portalId);
    if (list) list.push(chain);
    else byPortal.set(chain.portalId, [chain]);
  }

  for (const [portalId, chains] of byPortal) {
    providers.push(new IsraeliTransparencyProvider({ portalId, chains, enabled: enableLive }));
  }

  if (includeDemo) providers.push(new DemoPriceProvider());
  return providers;
}

/** True when at least one provider in the set can produce real market prices. */
export function hasRealDataProvider(providers: readonly PriceDataProvider[]): boolean {
  return providers.some((p) => p.descriptor.producesRealMarketPrices);
}
