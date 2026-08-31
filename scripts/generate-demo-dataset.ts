/**
 * Generates `data/demo-dataset.json`.
 *
 * IMPORTANT: this dataset is SYNTHETIC. It exists so the application can be run,
 * demonstrated and tested end-to-end in environments with no access to a live
 * price feed. It is not, and must never be presented as, real Israeli market
 * pricing. Everything it produces is tagged `realMarketData: false` and surfaces
 * in the UI behind a permanent "demo data" banner.
 *
 * Run with: node --experimental-strip-types scripts/generate-demo-dataset.ts
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';

/** Deterministic PRNG (mulberry32) so regenerating the file is reproducible. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoProduct {
  id: string;
  barcode: string;
  nameHe: string;
  nameEn: string;
  brand: string;
  category: string;
  basePriceAgorot: number;
  /** Weekly volatility as a fraction of the base price. */
  volatility: number;
}

const PRODUCTS: DemoProduct[] = [
  { id: 'milk-3-1l', barcode: '7290000100011', nameHe: 'חלב תנובה 3% 1 ליטר', nameEn: 'Tnuva Milk 3% 1L', brand: 'תנובה', category: 'dairy', basePriceAgorot: 660, volatility: 0.04 },
  { id: 'eggs-l-12', barcode: '7290000100028', nameHe: 'ביצים L 12 יחידות', nameEn: 'Eggs L 12 units', brand: 'משק', category: 'eggs', basePriceAgorot: 1590, volatility: 0.06 },
  { id: 'bread-sliced-750g', barcode: '7290000100035', nameHe: 'לחם אחיד פרוס 750 גרם', nameEn: 'Sliced bread 750g', brand: 'ברמן', category: 'bakery', basePriceAgorot: 780, volatility: 0.03 },
  { id: 'coffee-turkish-200g', barcode: '7290000100042', nameHe: 'קפה טורקי עלית 200 גרם', nameEn: 'Elite Turkish coffee 200g', brand: 'עלית', category: 'coffee', basePriceAgorot: 2450, volatility: 0.05 },
  { id: 'rice-1kg', barcode: '7290000100059', nameHe: 'אורז סוגת 1 ק"ג', nameEn: 'Sugat rice 1kg', brand: 'סוגת', category: 'dry-goods', basePriceAgorot: 1390, volatility: 0.06 },
  { id: 'chicken-breast-1kg', barcode: '7290000100066', nameHe: 'חזה עוף טרי 1 ק"ג', nameEn: 'Fresh chicken breast 1kg', brand: 'עוף טוב', category: 'meat', basePriceAgorot: 3190, volatility: 0.08 },
  { id: 'tomato-1kg', barcode: '7290000100073', nameHe: 'עגבניות 1 ק"ג', nameEn: 'Tomatoes 1kg', brand: 'ירקות', category: 'produce', basePriceAgorot: 690, volatility: 0.15 },
  { id: 'cucumber-1kg', barcode: '7290000100080', nameHe: 'מלפפונים 1 ק"ג', nameEn: 'Cucumbers 1kg', brand: 'ירקות', category: 'produce', basePriceAgorot: 590, volatility: 0.15 },
  { id: 'cereal-500g', barcode: '7290000100097', nameHe: 'קורנפלקס תלמה 500 גרם', nameEn: 'Telma cornflakes 500g', brand: 'תלמה', category: 'cereal', basePriceAgorot: 2190, volatility: 0.05 },
  { id: 'shampoo-700ml', barcode: '7290000100103', nameHe: 'שמפו הוואי 700 מ"ל', nameEn: 'Hawaii shampoo 700ml', brand: 'הוואי', category: 'toiletries', basePriceAgorot: 2290, volatility: 0.07 },
  { id: 'toilet-paper-32', barcode: '7290000100110', nameHe: 'נייר טואלט 32 גלילים', nameEn: 'Toilet paper 32 rolls', brand: 'ליל', category: 'household', basePriceAgorot: 4590, volatility: 0.06 },
  { id: 'cheese-yellow-400g', barcode: '7290000100127', nameHe: 'גבינה צהובה עמק 400 גרם', nameEn: 'Emek yellow cheese 400g', brand: 'תנובה', category: 'dairy', basePriceAgorot: 3290, volatility: 0.05 },
  { id: 'yogurt-500g', barcode: '7290000100134', nameHe: 'יוגורט דנונה 500 גרם', nameEn: 'Danone yogurt 500g', brand: 'שטראוס', category: 'dairy', basePriceAgorot: 890, volatility: 0.05 },
  { id: 'butter-200g', barcode: '7290000100141', nameHe: 'חמאה תנובה 200 גרם', nameEn: 'Tnuva butter 200g', brand: 'תנובה', category: 'dairy', basePriceAgorot: 1290, volatility: 0.06 },
  { id: 'canola-oil-1l', barcode: '7290000100158', nameHe: 'שמן קנולה 1 ליטר', nameEn: 'Canola oil 1L', brand: 'עין הבשור', category: 'pantry', basePriceAgorot: 1490, volatility: 0.07 },
  { id: 'sugar-1kg', barcode: '7290000100165', nameHe: 'סוכר לבן 1 ק"ג', nameEn: 'White sugar 1kg', brand: 'סוגת', category: 'pantry', basePriceAgorot: 690, volatility: 0.04 },
  { id: 'flour-1kg', barcode: '7290000100172', nameHe: 'קמח לבן 1 ק"ג', nameEn: 'White flour 1kg', brand: 'סוגת', category: 'pantry', basePriceAgorot: 620, volatility: 0.04 },
  { id: 'pasta-500g', barcode: '7290000100189', nameHe: 'פסטה ספגטי 500 גרם', nameEn: 'Spaghetti 500g', brand: 'אסם', category: 'pantry', basePriceAgorot: 690, volatility: 0.05 },
  { id: 'cola-1500ml', barcode: '7290000100196', nameHe: 'קוקה קולה 1.5 ליטר', nameEn: 'Coca-Cola 1.5L', brand: 'קוקה קולה', category: 'beverages', basePriceAgorot: 890, volatility: 0.06 },
  { id: 'water-6x1500ml', barcode: '7290000100202', nameHe: 'מים מינרלים 6 x 1.5 ליטר', nameEn: 'Mineral water 6 x 1.5L', brand: 'נביעות', category: 'beverages', basePriceAgorot: 1690, volatility: 0.05 },
  { id: 'tuna-160g', barcode: '7290000100219', nameHe: 'טונה סטארקיסט 160 גרם', nameEn: 'StarKist tuna 160g', brand: 'סטארקיסט', category: 'pantry', basePriceAgorot: 890, volatility: 0.06 },
  { id: 'hummus-400g', barcode: '7290000100226', nameHe: 'חומוס אחלה 400 גרם', nameEn: 'Achla hummus 400g', brand: 'אחלה', category: 'chilled', basePriceAgorot: 1190, volatility: 0.05 },
  { id: 'tehina-500g', barcode: '7290000100233', nameHe: 'טחינה גולדן 500 גרם', nameEn: 'Golden tehina 500g', brand: 'הר ברכה', category: 'pantry', basePriceAgorot: 1690, volatility: 0.05 },
  { id: 'white-cheese-250g', barcode: '7290000100240', nameHe: 'גבינה לבנה 5% 250 גרם', nameEn: 'White cheese 5% 250g', brand: 'תנובה', category: 'dairy', basePriceAgorot: 720, volatility: 0.05 },
];

interface DemoBranch {
  id: string;
  chainId: string;
  name: string;
  city: string;
  /** Real Tel Aviv-area coordinates, so distance is computed rather than asserted. */
  latitude: number;
  longitude: number;
  supportsDelivery: boolean;
  deliveryFeeAgorot: number | null;
  deliveryMinimumAgorot: number | null;
  /** Multiplier applied to the base price for this chain's positioning. */
  priceIndex: number;
}

const BRANCHES: DemoBranch[] = [
  { id: 'demo-rl-01', chainId: 'rami-levy', name: 'סניף הדגמה — תל אביב', city: 'תל אביב', latitude: 32.0684, longitude: 34.7940, supportsDelivery: true, deliveryFeeAgorot: 2900, deliveryMinimumAgorot: 20000, priceIndex: 0.93 },
  { id: 'demo-rl-02', chainId: 'rami-levy', name: 'סניף הדגמה — רמת גן', city: 'רמת גן', latitude: 32.0823, longitude: 34.8140, supportsDelivery: true, deliveryFeeAgorot: 2900, deliveryMinimumAgorot: 20000, priceIndex: 0.94 },
  { id: 'demo-sh-01', chainId: 'shufersal', name: 'סניף הדגמה — תל אביב מרכז', city: 'תל אביב', latitude: 32.0790, longitude: 34.7805, supportsDelivery: true, deliveryFeeAgorot: 3900, deliveryMinimumAgorot: 15000, priceIndex: 1.07 },
  { id: 'demo-sh-02', chainId: 'shufersal', name: 'סניף הדגמה — גבעתיים', city: 'גבעתיים', latitude: 32.0722, longitude: 34.8106, supportsDelivery: true, deliveryFeeAgorot: 3900, deliveryMinimumAgorot: 15000, priceIndex: 1.05 },
  { id: 'demo-vc-01', chainId: 'victory', name: 'סניף הדגמה — בני ברק', city: 'בני ברק', latitude: 32.0836, longitude: 34.8330, supportsDelivery: false, deliveryFeeAgorot: null, deliveryMinimumAgorot: null, priceIndex: 0.97 },
  { id: 'demo-yo-01', chainId: 'yohananof', name: 'סניף הדגמה — פתח תקווה', city: 'פתח תקווה', latitude: 32.0868, longitude: 34.8870, supportsDelivery: true, deliveryFeeAgorot: 3500, deliveryMinimumAgorot: 25000, priceIndex: 1.01 },
];

/**
 * Scripted moves for the most recent week, so the demo exercises every branch of
 * the price-intelligence UI: a large rise, a moderate rise, and two clear falls.
 */
const RECENT_MOVES: Record<string, number> = {
  'coffee-turkish-200g': 1.29,
  'chicken-breast-1kg': 1.094,
  'milk-3-1l': 0.833,
  'rice-1kg': 0.786,
  'tomato-1kg': 1.18,
  'cheese-yellow-400g': 0.94,
};

const WEEKS = 14; // ~98 days of weekly observations
const REFERENCE_NOW = '2026-08-31T06:00:00.000Z';

interface DemoPricePoint {
  productId: string;
  branchId: string;
  chainId: string;
  priceAgorot: number;
  observedAt: string;
  promotionId: string | null;
  isMemberPrice: boolean;
}

interface DemoPromotion {
  id: string;
  chainId: string;
  branchId: string;
  productId: string;
  kind: string;
  description: string;
  buyQuantity: number | null;
  freeQuantity: number | null;
  bundleQuantity: number | null;
  bundlePriceAgorot: number | null;
  percentOff: number | null;
  promoUnitPriceAgorot: number | null;
  minQuantity: number | null;
  requiresMembership: boolean;
  startsAt: string;
  endsAt: string;
}

function main(): void {
  const random = makeRandom(20260831);
  const nowMs = Date.parse(REFERENCE_NOW);
  const prices: DemoPricePoint[] = [];
  const promotions: DemoPromotion[] = [];

  for (const branch of BRANCHES) {
    for (const product of PRODUCTS) {
      // A per-(product, branch) drift keeps chains from moving in lockstep.
      const branchBias = 0.97 + random() * 0.06;
      let level = product.basePriceAgorot * branch.priceIndex * branchBias;

      for (let week = WEEKS - 1; week >= 0; week -= 1) {
        const observedAt = new Date(nowMs - week * 7 * 86_400_000).toISOString();
        const drift = 1 + (random() - 0.5) * 2 * product.volatility;
        level *= drift;

        if (week === 0) {
          const move = RECENT_MOVES[product.id];
          if (move !== undefined) level = level * move;
        }

        let priceAgorot = Math.round(level);
        let promotionId: string | null = null;

        // Roughly one week in eight carries a promotion for a given line.
        const promoRoll = random();
        if (promoRoll < 0.09) {
          const percentOff = 10 + Math.floor(random() * 21);
          const id = `demo-promo-${product.id}-${branch.id}-${week}`;
          promotionId = id;
          promotions.push({
            id,
            chainId: branch.chainId,
            branchId: branch.id,
            productId: product.id,
            kind: 'percent_off',
            description: `${percentOff}% הנחה`,
            buyQuantity: null,
            freeQuantity: null,
            bundleQuantity: null,
            bundlePriceAgorot: null,
            percentOff,
            promoUnitPriceAgorot: null,
            minQuantity: null,
            requiresMembership: random() < 0.3,
            startsAt: new Date(Date.parse(observedAt) - 2 * 86_400_000).toISOString(),
            endsAt: new Date(Date.parse(observedAt) + 5 * 86_400_000).toISOString(),
          });
        } else if (promoRoll < 0.12) {
          const id = `demo-promo-${product.id}-${branch.id}-${week}-bogo`;
          promotionId = id;
          promotions.push({
            id,
            chainId: branch.chainId,
            branchId: branch.id,
            productId: product.id,
            kind: 'n_plus_m',
            description: '1+1',
            buyQuantity: 1,
            freeQuantity: 1,
            bundleQuantity: null,
            bundlePriceAgorot: null,
            percentOff: null,
            promoUnitPriceAgorot: null,
            minQuantity: 2,
            requiresMembership: false,
            startsAt: new Date(Date.parse(observedAt) - 2 * 86_400_000).toISOString(),
            endsAt: new Date(Date.parse(observedAt) + 5 * 86_400_000).toISOString(),
          });
        }

        priceAgorot = Math.max(100, priceAgorot);
        prices.push({
          productId: product.id,
          branchId: branch.id,
          chainId: branch.chainId,
          priceAgorot,
          observedAt,
          promotionId,
          isMemberPrice: false,
        });
      }
    }
  }

  const dataset = {
    $disclaimer:
      'SYNTHETIC DEMONSTRATION DATA. These are not real Israeli retail prices. They are generated by scripts/generate-demo-dataset.ts so the application can be run and tested without a live price feed. Never present these figures as market prices.',
    realMarketData: false,
    // Fixed rather than wall-clock, so regenerating produces an identical file.
    generatedAt: REFERENCE_NOW,
    referenceNow: REFERENCE_NOW,
    weeksOfHistory: WEEKS,
    products: PRODUCTS,
    branches: BRANCHES,
    promotions,
    prices,
  };

  const target = path.join(process.cwd(), 'data', 'demo-dataset.json');
  writeFileSync(target, `${JSON.stringify(dataset, null, 1)}\n`, 'utf8');
  process.stdout.write(
    `Wrote ${target}: ${PRODUCTS.length} products, ${BRANCHES.length} branches, ${prices.length} price points, ${promotions.length} promotions\n`,
  );
}

main();
