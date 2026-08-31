/**
 * Explanations.
 *
 * The numbers are computed by the deterministic engines and handed to this layer
 * as facts. The model may only rephrase them. Its output is checked against the
 * fact set and discarded if it contains a figure that was never computed, in
 * which case the deterministic template is shown instead.
 */

import { formatAgorot, formatAgorotDelta } from '@/lib/domain/money';
import type { BasketChangeSummary } from '@/lib/domain/basket-change';
import { createTranslator, formatPercent, type Locale } from '@/lib/i18n';
import { AI_MODEL, getAiClient } from './client';
import { allowedNumbersFrom, checkNumbers } from './number-guard';

export interface BasketChangeFacts {
  previousTotalAgorot: number;
  currentTotalAgorot: number;
  absoluteChangeAgorot: number;
  percentageChange: number | null;
  direction: 'increase' | 'decrease' | 'unchanged';
  increasedCount: number;
  decreasedCount: number;
  unchangedCount: number;
  promotionsAppeared: number;
  promotionsEnded: number;
  comparableCoverage: boolean;
  topIncreases: Array<{ name: string; previousTotalAgorot: number; currentTotalAgorot: number; percent: number | null }>;
  topDecreases: Array<{ name: string; previousTotalAgorot: number; currentTotalAgorot: number; percent: number | null }>;
}

export function factsFromSummary(summary: BasketChangeSummary, topN = 3): BasketChangeFacts {
  const map = (line: BasketChangeSummary['lines'][number]) => ({
    name: line.displayName,
    previousTotalAgorot: line.previousTotalAgorot ?? 0,
    currentTotalAgorot: line.currentTotalAgorot ?? 0,
    percent: line.unitPercentageChange,
  });
  return {
    previousTotalAgorot: summary.previousTotalAgorot,
    currentTotalAgorot: summary.currentTotalAgorot,
    absoluteChangeAgorot: summary.absoluteChangeAgorot,
    percentageChange: summary.percentageChange,
    direction: summary.direction,
    increasedCount: summary.counts.increased,
    decreasedCount: summary.counts.decreased,
    unchangedCount: summary.counts.unchanged,
    promotionsAppeared: summary.counts.promotionsAppeared,
    promotionsEnded: summary.counts.promotionsEnded,
    comparableCoverage: summary.comparableCoverage,
    topIncreases: summary.biggestIncreases.slice(0, topN).map(map),
    topDecreases: summary.biggestDecreases.slice(0, topN).map(map),
  };
}

/** The deterministic explanation. Always correct, always available. */
export function templateExplanation(facts: BasketChangeFacts, locale: Locale): string {
  const t = createTranslator(locale);
  const headline =
    facts.direction === 'decrease'
      ? t('explain.basketCheaper')
      : facts.direction === 'increase'
        ? t('explain.basketMoreExpensive')
        : t('explain.basketUnchanged');

  const totals = `${formatAgorot(facts.previousTotalAgorot, locale)} → ${formatAgorot(facts.currentTotalAgorot, locale)}`;
  const delta =
    facts.percentageChange === null
      ? formatAgorotDelta(facts.absoluteChangeAgorot, locale)
      : `${formatAgorotDelta(facts.absoluteChangeAgorot, locale)} (${formatPercent(facts.percentageChange)})`;

  const parts = [`${headline}: ${totals} ${delta}.`];

  const counts: string[] = [];
  if (facts.increasedCount > 0) counts.push(t('dashboard.increasedCount', { count: facts.increasedCount }));
  if (facts.decreasedCount > 0) counts.push(t('dashboard.decreasedCount', { count: facts.decreasedCount }));
  if (facts.promotionsAppeared > 0) counts.push(t('dashboard.promotionsFound', { count: facts.promotionsAppeared }));
  if (facts.promotionsEnded > 0) counts.push(t('dashboard.promotionsEnded', { count: facts.promotionsEnded }));
  if (counts.length > 0) parts.push(`${counts.join(', ')}.`);

  const biggestUp = facts.topIncreases[0];
  if (biggestUp) {
    const pct = biggestUp.percent === null ? '' : ` (${formatPercent(biggestUp.percent)})`;
    parts.push(
      `${t('report.biggestIncrease')}: ${biggestUp.name} ${formatAgorot(biggestUp.previousTotalAgorot, locale)} → ${formatAgorot(biggestUp.currentTotalAgorot, locale)}${pct}.`,
    );
  }
  const biggestDown = facts.topDecreases[0];
  if (biggestDown) {
    const pct = biggestDown.percent === null ? '' : ` (${formatPercent(biggestDown.percent)})`;
    parts.push(
      `${t('report.biggestDecrease')}: ${biggestDown.name} ${formatAgorot(biggestDown.previousTotalAgorot, locale)} → ${formatAgorot(biggestDown.currentTotalAgorot, locale)}${pct}.`,
    );
  }
  if (!facts.comparableCoverage) parts.push(t('explain.coverageWarning'));

  return parts.join(' ');
}

const EXPLAIN_SYSTEM = `You write one short paragraph explaining a change in a shopper's grocery basket.

Absolute rules:
- Use ONLY the numbers given to you in the facts JSON. Never compute, derive, round differently, estimate or invent any number.
- Never predict future prices or say a price "will" do anything.
- Do not claim anything about stores, stock or promotions that is not in the facts.
- Write in the requested language, in a plain, factual voice. Two to four sentences.
- Amounts are given in agorot; write them as shekels (₪) using the exact shekel value implied.`;

export interface ExplanationResult {
  text: string;
  /** Which path produced the text, so the UI can label it. */
  producedBy: 'ai' | 'template';
  /** Set when a model answer was rejected, naming the numbers that failed the check. */
  rejectedNumbers?: number[];
}

export async function explainBasketChange(
  facts: BasketChangeFacts,
  locale: Locale,
  options: { signal?: AbortSignal } = {},
): Promise<ExplanationResult> {
  const fallback = templateExplanation(facts, locale);
  const client = getAiClient();
  if (!client) return { text: fallback, producedBy: 'template' };

  try {
    const response = await client.messages.create(
      {
        model: AI_MODEL,
        max_tokens: 1200,
        system: EXPLAIN_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Language: ${locale === 'he' ? 'Hebrew' : 'English'}\nFacts JSON:\n${JSON.stringify(facts)}`,
          },
        ],
      },
      { signal: options.signal },
    );

    if (response.stop_reason === 'refusal') return { text: fallback, producedBy: 'template' };

    const text = response.content
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    if (text.length === 0) return { text: fallback, producedBy: 'template' };

    const check = checkNumbers(text, allowedNumbersFrom(facts as unknown as Record<string, unknown>));
    if (!check.ok) {
      return { text: fallback, producedBy: 'template', rejectedNumbers: check.offending };
    }
    return { text, producedBy: 'ai' };
  } catch {
    return { text: fallback, producedBy: 'template' };
  }
}
