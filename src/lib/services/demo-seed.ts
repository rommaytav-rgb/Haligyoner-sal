/**
 * Seeds the database from the synthetic demo dataset.
 *
 * The dataset is replayed week by week through the normal ingest path, so
 * `price_history` is populated exactly as a live provider would populate it and
 * every price-intelligence feature has real (if synthetic) history to work from.
 */

import type { DatabaseSync } from 'node:sqlite';
import { DemoPriceProvider } from '@/lib/providers/demo-provider';
import { ingestSnapshot, recordProviderStatus, syncChainRegistry } from './catalog';

export interface DemoSeedReport {
  weeksReplayed: number;
  historyRowsWritten: number;
  productsUpserted: number;
  branchesUpserted: number;
}

export function seedDemoData(db: DatabaseSync, provider = new DemoPriceProvider()): DemoSeedReport {
  syncChainRegistry(db);

  const weeks = [...new Set(provider.fullHistory().map((p) => p.observedAt))].sort();
  let historyRowsWritten = 0;
  let productsUpserted = 0;
  let branchesUpserted = 0;

  for (const observedAt of weeks) {
    const snapshot = provider.snapshotAsOf(observedAt);
    const report = ingestSnapshot(db, snapshot);
    historyRowsWritten += report.historyRowsWritten;
    productsUpserted += report.productsUpserted;
    branchesUpserted += report.branchesUpserted;
  }

  recordProviderStatus(db, provider, {
    available: true,
    error: null,
    succeededAt: weeks[weeks.length - 1] ?? null,
  });

  return { weeksReplayed: weeks.length, historyRowsWritten, productsUpserted, branchesUpserted };
}
