/**
 * Basket management.
 *
 * The user's own words are kept in `raw_text` forever. Matching adds a product
 * id and a confidence; it never overwrites what the user typed, so a wrong match
 * is always visible and correctable.
 */

import type { DatabaseSync } from 'node:sqlite';
import { all, fromBool, get, newId, nowIso, num, optNum, optStr, run, str, toBool, transaction, type Row } from '@/lib/db/client';
import { matchProduct } from './matching';

export type SubstitutionPolicy = 'allow' | 'same_brand_only' | 'never';

export interface BasketItem {
  id: string;
  basketId: string;
  productId: string | null;
  rawText: string;
  displayName: string;
  quantity: number;
  preferredBrand: string | null;
  preferredSizeText: string | null;
  substitutionPolicy: SubstitutionPolicy;
  isLocked: boolean;
  isFavorite: boolean;
  isOptional: boolean;
  matchConfidence: number | null;
  sortOrder: number;
}

export interface Basket {
  id: string;
  userId: string;
  name: string;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
  items: BasketItem[];
}

export class BasketNotFoundError extends Error {}

function rowToItem(row: Row): BasketItem {
  const policy = str(row.substitution_policy, 'allow');
  return {
    id: str(row.id),
    basketId: str(row.basket_id),
    productId: optStr(row.product_id),
    rawText: str(row.raw_text),
    displayName: str(row.display_name),
    quantity: num(row.quantity, 1),
    preferredBrand: optStr(row.preferred_brand),
    preferredSizeText: optStr(row.preferred_size_text),
    substitutionPolicy:
      policy === 'never' || policy === 'same_brand_only' ? (policy as SubstitutionPolicy) : 'allow',
    isLocked: toBool(row.is_locked),
    isFavorite: toBool(row.is_favorite),
    isOptional: toBool(row.is_optional),
    matchConfidence: optNum(row.match_confidence),
    sortOrder: num(row.sort_order),
  };
}

export function createBasket(db: DatabaseSync, userId: string, name: string): Basket {
  const id = newId('bsk');
  const now = nowIso();
  run(db, 'INSERT INTO baskets (id, user_id, name, is_recurring, created_at, updated_at) VALUES (?,?,?,1,?,?)', [
    id,
    userId,
    name,
    now,
    now,
  ]);
  return { id, userId, name, isRecurring: true, createdAt: now, updatedAt: now, items: [] };
}

export function listBaskets(db: DatabaseSync, userId: string): Array<Omit<Basket, 'items'> & { itemCount: number }> {
  return all<Row>(
    db,
    `SELECT b.*, (SELECT COUNT(*) FROM basket_items i WHERE i.basket_id = b.id) AS item_count
       FROM baskets b WHERE b.user_id = ? ORDER BY b.updated_at DESC`,
    [userId],
  ).map((row) => ({
    id: str(row.id),
    userId: str(row.user_id),
    name: str(row.name),
    isRecurring: toBool(row.is_recurring),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    itemCount: num(row.item_count),
  }));
}

/** Loads a basket, enforcing that it belongs to the requesting user. */
export function getBasket(db: DatabaseSync, userId: string, basketId: string): Basket | null {
  const row = get<Row>(db, 'SELECT * FROM baskets WHERE id = ? AND user_id = ?', [basketId, userId]);
  if (!row) return null;
  const items = all<Row>(db, 'SELECT * FROM basket_items WHERE basket_id = ? ORDER BY sort_order, created_at', [
    basketId,
  ]).map(rowToItem);
  return {
    id: str(row.id),
    userId: str(row.user_id),
    name: str(row.name),
    isRecurring: toBool(row.is_recurring),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    items,
  };
}

export function getDefaultBasket(db: DatabaseSync, userId: string): Basket | null {
  const row = get<Row>(db, 'SELECT id FROM baskets WHERE user_id = ? ORDER BY created_at LIMIT 1', [userId]);
  return row ? getBasket(db, userId, str(row.id)) : null;
}

export interface NewBasketItem {
  rawText: string;
  displayName?: string;
  quantity?: number;
  preferredBrand?: string | null;
  preferredSizeText?: string | null;
  substitutionPolicy?: SubstitutionPolicy;
  isLocked?: boolean;
  isOptional?: boolean;
}

export interface AddItemsResult {
  added: BasketItem[];
  /** Items stored but not confidently matched to a catalog product. */
  unmatched: BasketItem[];
}

export function addItems(
  db: DatabaseSync,
  userId: string,
  basketId: string,
  inputs: readonly NewBasketItem[],
): AddItemsResult {
  const basket = getBasket(db, userId, basketId);
  if (!basket) throw new BasketNotFoundError(basketId);

  const now = nowIso();
  let sortOrder = basket.items.length;
  const added: BasketItem[] = [];

  transaction(db, () => {
    for (const input of inputs) {
      const rawText = input.rawText.trim();
      if (rawText.length === 0) continue;
      const match = matchProduct(db, rawText, { preferredBrand: input.preferredBrand ?? null });
      const id = newId('itm');
      const item: BasketItem = {
        id,
        basketId,
        productId: match.accepted ? (match.product?.id ?? null) : null,
        rawText,
        displayName: input.displayName?.trim() || match.product?.nameHe || rawText,
        quantity: input.quantity ?? 1,
        preferredBrand: input.preferredBrand ?? null,
        preferredSizeText: input.preferredSizeText ?? null,
        substitutionPolicy: input.substitutionPolicy ?? 'allow',
        isLocked: input.isLocked ?? false,
        isFavorite: false,
        isOptional: input.isOptional ?? false,
        matchConfidence: match.confidence > 0 ? match.confidence : null,
        sortOrder: sortOrder++,
      };
      run(
        db,
        `INSERT INTO basket_items (
           id, basket_id, product_id, raw_text, display_name, quantity, preferred_brand, preferred_size_text,
           substitution_policy, is_locked, is_favorite, is_optional, match_confidence, sort_order, created_at, updated_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          item.id,
          item.basketId,
          item.productId,
          item.rawText,
          item.displayName,
          item.quantity,
          item.preferredBrand,
          item.preferredSizeText,
          item.substitutionPolicy,
          fromBool(item.isLocked),
          fromBool(item.isFavorite),
          fromBool(item.isOptional),
          item.matchConfidence,
          item.sortOrder,
          now,
          now,
        ],
      );
      added.push(item);
    }
    run(db, 'UPDATE baskets SET updated_at = ? WHERE id = ?', [now, basketId]);
  });

  return { added, unmatched: added.filter((item) => item.productId === null) };
}

export type ItemPatch = Partial<
  Pick<
    BasketItem,
    | 'displayName'
    | 'quantity'
    | 'preferredBrand'
    | 'preferredSizeText'
    | 'substitutionPolicy'
    | 'isLocked'
    | 'isFavorite'
    | 'isOptional'
    | 'productId'
  >
>;

export function updateItem(
  db: DatabaseSync,
  userId: string,
  basketId: string,
  itemId: string,
  patch: ItemPatch,
): BasketItem | null {
  const basket = getBasket(db, userId, basketId);
  if (!basket) throw new BasketNotFoundError(basketId);
  const existing = basket.items.find((i) => i.id === itemId);
  if (!existing) return null;

  const next: BasketItem = { ...existing, ...patch };
  run(
    db,
    `UPDATE basket_items SET
       display_name = ?, quantity = ?, preferred_brand = ?, preferred_size_text = ?,
       substitution_policy = ?, is_locked = ?, is_favorite = ?, is_optional = ?, product_id = ?, updated_at = ?
     WHERE id = ? AND basket_id = ?`,
    [
      next.displayName,
      next.quantity,
      next.preferredBrand,
      next.preferredSizeText,
      next.substitutionPolicy,
      fromBool(next.isLocked),
      fromBool(next.isFavorite),
      fromBool(next.isOptional),
      next.productId,
      nowIso(),
      itemId,
      basketId,
    ],
  );
  return next;
}

export function removeItem(db: DatabaseSync, userId: string, basketId: string, itemId: string): boolean {
  const basket = getBasket(db, userId, basketId);
  if (!basket) throw new BasketNotFoundError(basketId);
  const exists = basket.items.some((i) => i.id === itemId);
  if (!exists) return false;
  run(db, 'DELETE FROM basket_items WHERE id = ? AND basket_id = ?', [itemId, basketId]);
  return true;
}

export function deleteBasket(db: DatabaseSync, userId: string, basketId: string): boolean {
  const basket = get<Row>(db, 'SELECT id FROM baskets WHERE id = ? AND user_id = ?', [basketId, userId]);
  if (!basket) return false;
  run(db, 'DELETE FROM baskets WHERE id = ?', [basketId]);
  return true;
}

/** Re-runs matching for every unmatched line, e.g. after new catalog data lands. */
export function rematchUnmatchedItems(db: DatabaseSync, userId: string, basketId: string): number {
  const basket = getBasket(db, userId, basketId);
  if (!basket) throw new BasketNotFoundError(basketId);
  let matched = 0;
  for (const item of basket.items) {
    if (item.productId !== null) continue;
    const match = matchProduct(db, item.rawText, { preferredBrand: item.preferredBrand });
    if (match.accepted && match.product) {
      run(db, 'UPDATE basket_items SET product_id = ?, match_confidence = ?, updated_at = ? WHERE id = ?', [
        match.product.id,
        match.confidence,
        nowIso(),
        item.id,
      ]);
      matched += 1;
    }
  }
  return matched;
}
