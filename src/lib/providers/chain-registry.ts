/**
 * Supermarket chain registry.
 *
 * Chains and publishing portals are configuration (`data/chains.json`), not
 * code: a new chain becomes available to the pipeline by adding a row, with no
 * application change. Nothing here asserts that a chain's data is actually
 * reachable — that is the provider's job to establish and report.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

export type PortalProtocol = 'cerberus-login' | 'directory-listing' | 'index-page';

export interface PortalConfig {
  id: string;
  name: string;
  baseUrl: string;
  protocol: PortalProtocol;
  notes?: string;
  /** True only once the endpoint has been confirmed against the live portal. */
  endpointVerified: boolean;
}

export interface ChainConfig {
  id: string;
  nameHe: string;
  nameEn: string;
  portalId: string;
  portalUsername?: string;
  group?: string;
  categoriesCovered?: string[];
  endpointVerified: boolean;
}

export interface ChainRegistry {
  version: number;
  portals: PortalConfig[];
  chains: ChainConfig[];
}

let cached: ChainRegistry | null = null;

export const CHAIN_REGISTRY_PATH = path.join(process.cwd(), 'data', 'chains.json');

export function loadChainRegistry(): ChainRegistry {
  if (cached) return cached;
  const parsed = JSON.parse(readFileSync(CHAIN_REGISTRY_PATH, 'utf8')) as ChainRegistry;
  cached = {
    version: parsed.version,
    portals: parsed.portals ?? [],
    chains: parsed.chains ?? [],
  };
  return cached;
}

export function getChain(id: string, registry = loadChainRegistry()): ChainConfig | null {
  return registry.chains.find((c) => c.id === id) ?? null;
}

export function getPortal(id: string, registry = loadChainRegistry()): PortalConfig | null {
  return registry.portals.find((p) => p.id === id) ?? null;
}

/** Chains whose publishing endpoint has been confirmed — the only ones safe to advertise as covered. */
export function verifiedChains(registry = loadChainRegistry()): ChainConfig[] {
  return registry.chains.filter((chain) => {
    const portal = getPortal(chain.portalId, registry);
    return chain.endpointVerified && portal?.endpointVerified === true;
  });
}

export function resetChainRegistryCache(): void {
  cached = null;
}
