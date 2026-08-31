/**
 * Seeds a local database with the synthetic demo dataset and a demo account.
 *
 * Run with: npm run db:seed
 */

import { createUser, setMembership, updatePreferences } from '@/lib/services/users';
import { addItems, createBasket } from '@/lib/services/baskets';
import { seedDemoData } from '@/lib/services/demo-seed';
import { getDb } from '@/lib/db/client';

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'demo@example.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-password-2026';

const WEEKLY_BASKET = [
  { rawText: 'חלב 3% 1 ליטר', quantity: 4 },
  { rawText: 'ביצים L 12 יחידות', quantity: 1 },
  { rawText: 'לחם אחיד פרוס 750 גרם', quantity: 2 },
  { rawText: 'קפה טורקי עלית 200 גרם', quantity: 1, isLocked: true },
  { rawText: 'אורז סוגת 1 ק"ג', quantity: 1 },
  { rawText: 'חזה עוף טרי 1 ק"ג', quantity: 2 },
  { rawText: 'עגבניות 1 ק"ג', quantity: 2 },
  { rawText: 'מלפפונים 1 ק"ג', quantity: 1 },
  { rawText: 'קורנפלקס תלמה 500 גרם', quantity: 1 },
  { rawText: 'שמפו הוואי 700 מ"ל', quantity: 1 },
  { rawText: 'נייר טואלט 32 גלילים', quantity: 1 },
  { rawText: 'גבינה צהובה עמק 400 גרם', quantity: 1 },
  { rawText: 'יוגורט דנונה 500 גרם', quantity: 2 },
  { rawText: 'שמן קנולה 1 ליטר', quantity: 1 },
  { rawText: 'פסטה ספגטי 500 גרם', quantity: 2 },
  { rawText: 'קוקה קולה 1.5 ליטר', quantity: 2 },
];

async function main(): Promise<void> {
  const db = getDb();
  const report = seedDemoData(db);
  process.stdout.write(
    `Seeded demo catalog: ${report.weeksReplayed} weekly snapshots, ${report.historyRowsWritten} price history rows\n`,
  );

  let userId: string;
  try {
    const user = await createUser(db, {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: 'Demo',
      locale: 'he',
    });
    userId = user.id;
    process.stdout.write(`Created demo user ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})\n`);
  } catch {
    process.stdout.write(`Demo user ${DEMO_EMAIL} already exists; leaving it as-is\n`);
    return;
  }

  updatePreferences(db, userId, {
    city: 'תל אביב',
    // Nominal home location in central Tel Aviv, so store distances are real numbers.
    homeLatitude: 32.0753,
    homeLongitude: 34.7818,
    householdSize: 4,
    maxStores: 2,
    maxDistanceKm: 15,
    weeklyBudgetAgorot: 60000,
  });
  setMembership(db, userId, 'shufersal', true);

  const basket = createBasket(db, userId, 'הסל השבועי שלי');
  const result = addItems(db, userId, basket.id, WEEKLY_BASKET);
  process.stdout.write(
    `Created basket "${basket.name}" with ${result.added.length} items (${result.unmatched.length} unmatched)\n`,
  );
}

await main();
