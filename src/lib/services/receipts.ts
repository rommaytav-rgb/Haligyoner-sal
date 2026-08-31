/**
 * Receipt import.
 *
 * Accepts pasted receipt text (from a store's emailed receipt, a scanning app,
 * or the user typing it out). Extraction is deterministic line parsing; a
 * receipt is only marked `extracted` when lines were genuinely recovered, and a
 * failure is recorded as a failure with its reason.
 *
 * Image OCR is not implemented. Uploading a photo therefore reports honestly
 * that no text could be extracted rather than pretending to have read it.
 */

import type { DatabaseSync } from 'node:sqlite';
import { all, get, newId, nowIso, num, optNum, optStr, run, str, transaction, type Row } from '@/lib/db/client';
import { shekelsToAgorot, type Agorot } from '@/lib/domain/money';
import { matchProduct } from './matching';

export type ReceiptStatus = 'pending' | 'extracted' | 'partial' | 'failed';

export interface ReceiptLineDraft {
  rawText: string;
  quantity: number | null;
  priceAgorot: Agorot | null;
  discountAgorot: Agorot | null;
}

export interface ReceiptExtraction {
  lines: ReceiptLineDraft[];
  totalAgorot: Agorot | null;
  purchasedAt: string | null;
  warnings: string[];
}

const PRICE_AT_END = /(-?\d{1,6}(?:[.,]\d{1,2})?)\s*(?:₪|ש"ח|nis)?\s*$/i;
const QUANTITY_PREFIX = /^(\d+(?:[.,]\d{1,3})?)\s*[xX×*]\s*/;
const TOTAL_LINE = /(סה"כ|סה״כ|לתשלום|total|sum)\s*:?\s*(-?\d{1,6}(?:[.,]\d{1,2})?)/i;
const DATE_LINE = /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/;
const DISCOUNT_LINE = /(הנחה|מבצע|discount)/i;

function toAgorot(raw: string): Agorot | null {
  const value = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(value) ? shekelsToAgorot(value) : null;
}

/** Parses receipt text into candidate lines. Nothing is inferred beyond what is written. */
export function extractReceipt(text: string): ReceiptExtraction {
  const warnings: string[] = [];
  const lines: ReceiptLineDraft[] = [];
  let totalAgorot: Agorot | null = null;
  let purchasedAt: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const totalMatch = TOTAL_LINE.exec(line);
    if (totalMatch?.[2]) {
      totalAgorot = toAgorot(totalMatch[2]);
      continue;
    }

    const dateMatch = DATE_LINE.exec(line);
    if (dateMatch) {
      const day = Number(dateMatch[1]);
      const month = Number(dateMatch[2]);
      const yearRaw = Number(dateMatch[3]);
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
      if (purchasedAt === null && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        purchasedAt = new Date(Date.UTC(year, month - 1, day)).toISOString();
      }
    }

    const priceMatch = PRICE_AT_END.exec(line);
    if (!priceMatch?.[1]) continue;

    // A trailing year is part of a date, not a price: "תאריך 24/08/2026" must
    // not become a ₪2,026 line item.
    if (dateMatch?.index !== undefined) {
      const dateEnd = dateMatch.index + dateMatch[0].length;
      if ((priceMatch.index ?? 0) < dateEnd) continue;
    }
    const priceAgorot = toAgorot(priceMatch[1]);
    if (priceAgorot === null) continue;

    let description = line.slice(0, priceMatch.index).trim();
    let quantity: number | null = null;
    const quantityMatch = QUANTITY_PREFIX.exec(description);
    if (quantityMatch?.[1]) {
      const parsed = Number.parseFloat(quantityMatch[1].replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0) {
        quantity = parsed;
        description = description.slice(quantityMatch[0].length).trim();
      }
    }
    if (description.length === 0) continue;

    const isDiscount = DISCOUNT_LINE.test(description) || priceAgorot < 0;
    if (isDiscount) {
      const previous = lines[lines.length - 1];
      if (previous) {
        previous.discountAgorot = (previous.discountAgorot ?? 0) + Math.abs(priceAgorot);
        continue;
      }
      warnings.push('discount_line_without_preceding_item');
      continue;
    }

    lines.push({ rawText: description, quantity, priceAgorot, discountAgorot: null });
  }

  if (lines.length === 0) warnings.push('no_lines_extracted');
  return { lines, totalAgorot, purchasedAt, warnings };
}

export interface StoredReceipt {
  id: string;
  status: ReceiptStatus;
  chainId: string | null;
  purchasedAt: string | null;
  totalAgorot: number | null;
  failureReason: string | null;
  createdAt: string;
  lineCount: number;
  matchedLineCount: number;
}

export function importReceiptText(
  db: DatabaseSync,
  userId: string,
  input: { text: string; chainId?: string | null; originalFilename?: string | null },
): StoredReceipt {
  const extraction = extractReceipt(input.text);
  const id = newId('rcp');
  const createdAt = nowIso();
  const status: ReceiptStatus =
    extraction.lines.length === 0 ? 'failed' : extraction.totalAgorot === null ? 'partial' : 'extracted';
  let matchedLineCount = 0;

  transaction(db, () => {
    run(
      db,
      `INSERT INTO receipts (id, user_id, chain_id, branch_id, purchased_at, total_agorot, status, failure_reason, original_filename, raw_text, created_at)
       VALUES (?,?,?,NULL,?,?,?,?,?,?,?)`,
      [
        id,
        userId,
        input.chainId ?? null,
        extraction.purchasedAt,
        extraction.totalAgorot,
        status,
        status === 'failed' ? extraction.warnings.join(',') : null,
        input.originalFilename ?? null,
        input.text.slice(0, 20000),
        createdAt,
      ],
    );

    for (const line of extraction.lines) {
      const match = matchProduct(db, line.rawText);
      if (match.accepted) matchedLineCount += 1;
      run(
        db,
        `INSERT INTO receipt_lines (id, receipt_id, raw_text, product_id, quantity, price_agorot, discount_agorot, match_confidence)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          newId('rcl'),
          id,
          line.rawText,
          match.accepted ? (match.product?.id ?? null) : null,
          line.quantity,
          line.priceAgorot,
          line.discountAgorot,
          match.confidence,
        ],
      );
    }
  });

  return {
    id,
    status,
    chainId: input.chainId ?? null,
    purchasedAt: extraction.purchasedAt,
    totalAgorot: extraction.totalAgorot,
    failureReason: status === 'failed' ? extraction.warnings.join(',') : null,
    createdAt,
    lineCount: extraction.lines.length,
    matchedLineCount,
  };
}

export function listReceipts(db: DatabaseSync, userId: string, limit = 20): StoredReceipt[] {
  return all<Row>(
    db,
    `SELECT r.*, (SELECT COUNT(*) FROM receipt_lines l WHERE l.receipt_id = r.id) AS line_count,
            (SELECT COUNT(*) FROM receipt_lines l WHERE l.receipt_id = r.id AND l.product_id IS NOT NULL) AS matched_count
       FROM receipts r WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT ?`,
    [userId, limit],
  ).map((row) => ({
    id: str(row.id),
    status: str(row.status) as ReceiptStatus,
    chainId: optStr(row.chain_id),
    purchasedAt: optStr(row.purchased_at),
    totalAgorot: optNum(row.total_agorot),
    failureReason: optStr(row.failure_reason),
    createdAt: str(row.created_at),
    lineCount: num(row.line_count),
    matchedLineCount: num(row.matched_count),
  }));
}

export function deleteReceipt(db: DatabaseSync, userId: string, receiptId: string): boolean {
  const existing = get<Row>(db, 'SELECT id FROM receipts WHERE id = ? AND user_id = ?', [receiptId, userId]);
  if (!existing) return false;
  run(db, 'DELETE FROM receipts WHERE id = ?', [receiptId]);
  return true;
}

export interface RecurringSuggestion {
  productId: string;
  displayName: string;
  receiptCount: number;
}

/**
 * Products the user bought on at least `minReceipts` separate receipts, so the
 * app can offer to add them to the recurring basket. Only matched lines count.
 */
export function suggestRecurringItems(
  db: DatabaseSync,
  userId: string,
  minReceipts = 3,
): RecurringSuggestion[] {
  return all<Row>(
    db,
    `SELECT l.product_id, p.name_he AS name, COUNT(DISTINCT l.receipt_id) AS receipt_count
       FROM receipt_lines l
       JOIN receipts r ON r.id = l.receipt_id
       JOIN products p ON p.id = l.product_id
      WHERE r.user_id = ? AND l.product_id IS NOT NULL
      GROUP BY l.product_id
     HAVING receipt_count >= ?
      ORDER BY receipt_count DESC`,
    [userId, minReceipts],
  ).map((row) => ({
    productId: str(row.product_id),
    displayName: str(row.name),
    receiptCount: num(row.receipt_count),
  }));
}
