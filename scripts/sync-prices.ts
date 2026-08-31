/**
 * Runs every configured price data provider and ingests what they return.
 *
 * Intended to be run on a schedule (cron / systemd timer). Live portal fetching
 * only happens when ENABLE_LIVE_PRICE_FETCH=true; otherwise the live providers
 * report themselves unavailable and only the demo provider contributes.
 *
 * Run with: npm run prices:sync
 */

import { getDb } from '@/lib/db/client';
import { listProviderStatus, runIngest } from '@/lib/services/catalog';
import { buildProviders } from '@/lib/providers/registry';

async function main(): Promise<void> {
  const db = getDb();
  const providers = buildProviders();
  process.stdout.write(`Configured providers: ${providers.length}\n`);

  const reports = await runIngest(db, providers);
  for (const report of reports) {
    process.stdout.write(
      `${report.providerId}: ${report.pricesWritten} prices, ${report.historyRowsWritten} history rows, ` +
        `${report.promotionsUpserted} promotions, ${report.warnings.length} warnings` +
        `${report.producesRealMarketPrices ? '' : ' (SYNTHETIC DEMO DATA)'}\n`,
    );
  }

  process.stdout.write('\nProvider status:\n');
  for (const status of listProviderStatus(db)) {
    process.stdout.write(
      `  ${status.providerId}: ${status.available ? 'available' : 'unavailable'}` +
        `${status.lastError ? ` — ${status.lastError}` : ''}\n`,
    );
  }
}

await main();
