/**
 * Provenance of the prices currently in the database.
 *
 * Drives the "this is demo data" banner and the data-sources page. A chain only
 * counts as covered when a provider that produces real market prices has
 * actually written prices for it.
 */

import type { DatabaseSync } from 'node:sqlite';
import { all, num, optStr, str, toBool, type Row } from '@/lib/db/client';
import { loadChainRegistry } from '@/lib/providers/chain-registry';

export interface CoveredChain {
  chainId: string;
  nameHe: string;
  nameEn: string;
  branchCount: number;
  priceCount: number;
  newestObservationAt: string | null;
  /** False when the only prices for this chain came from a non-market source. */
  realMarketData: boolean;
}

export interface DataStatus {
  /** True when any price on screen could have come from the synthetic dataset. */
  usingDemoData: boolean;
  /** True when at least one real-market-data provider has written prices. */
  hasRealData: boolean;
  coveredChains: CoveredChain[];
  registeredChainCount: number;
  totalProducts: number;
  totalPriceObservations: number;
  newestObservationAt: string | null;
}

const DEMO_PROVIDER_IDS = new Set(['demo-fixture']);

export function getDataStatus(db: DatabaseSync): DataStatus {
  const chains = all<Row>(
    db,
    `SELECT p.chain_id AS chain_id,
            c.name_he AS name_he,
            c.name_en AS name_en,
            COUNT(DISTINCT p.branch_id) AS branch_count,
            COUNT(*) AS price_count,
            MAX(p.observed_at) AS newest,
            SUM(CASE WHEN p.provider_id = 'demo-fixture' THEN 1 ELSE 0 END) AS demo_count
       FROM prices p JOIN supermarket_chains c ON c.id = p.chain_id
      GROUP BY p.chain_id
      ORDER BY price_count DESC`,
  ).map((row) => {
    const priceCount = num(row.price_count);
    const demoCount = num(row.demo_count);
    return {
      chainId: str(row.chain_id),
      nameHe: str(row.name_he),
      nameEn: str(row.name_en),
      branchCount: num(row.branch_count),
      priceCount,
      newestObservationAt: optStr(row.newest),
      realMarketData: demoCount < priceCount,
    };
  });

  const totals = all<Row>(
    db,
    `SELECT (SELECT COUNT(*) FROM products) AS products,
            (SELECT COUNT(*) FROM price_history) AS observations,
            (SELECT MAX(observed_at) FROM price_history) AS newest`,
  )[0];

  const providerRows = all<Row>(db, 'SELECT provider_id, data_kind, available FROM provider_status');
  const hasRealData = chains.some((c) => c.realMarketData);
  const demoPriceCount = num(
    all<Row>(db, "SELECT COUNT(*) AS n FROM prices WHERE provider_id = 'demo-fixture'")[0]?.n,
  );

  return {
    usingDemoData: demoPriceCount > 0,
    hasRealData:
      hasRealData ||
      providerRows.some((row) => !DEMO_PROVIDER_IDS.has(str(row.provider_id)) && toBool(row.available)),
    coveredChains: chains,
    registeredChainCount: loadChainRegistry().chains.length,
    totalProducts: num(totals?.products),
    totalPriceObservations: num(totals?.observations),
    newestObservationAt: optStr(totals?.newest ?? null),
  };
}
