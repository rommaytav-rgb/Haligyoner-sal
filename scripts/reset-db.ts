/**
 * Deletes the local database file so the next run starts from a clean schema.
 *
 * Run with: npm run db:reset
 */

import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const target = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'app.db');
for (const suffix of ['', '-wal', '-shm', '-journal']) {
  const file = `${target}${suffix}`;
  if (existsSync(file)) {
    rmSync(file);
    process.stdout.write(`Removed ${file}\n`);
  }
}
process.stdout.write('Database reset. Run `npm run db:seed` to reseed demo data.\n');
