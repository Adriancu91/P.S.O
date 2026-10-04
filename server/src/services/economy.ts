// All currency/material/item mutations go through here so every change is
// validated (never negative) and written to the ledger.

import { randomBytes } from 'node:crypto';
import {
  INVENTORY_LIMIT,
  createRng,
  generateItem,
  getTemplate,
  type GenerateItemOptions,
  type ItemInstance,
} from '@pso/shared';
import { ApiError, newId, type Ctx } from '../ctx.js';

export interface ItemRow {
  id: string;
  user_id: string;
  template_id: string;
  slot: string;
  rarity: string;
  upgrade: number;
  bonuses_json: string;
  set_id: string | null;
  equipped_pet_id: string | null;
  origin: string;
  origin_ref: string | null;
  created_at: number;
}

export function rowToItem(r: ItemRow): ItemInstance & { equipped: boolean; slot: string } {
  return {
    id: r.id,
    templateId: r.template_id,
    rarity: r.rarity as ItemInstance['rarity'],
    upgrade: r.upgrade,
    bonuses: JSON.parse(r.bonuses_json),
    setId: r.set_id,
    equipped: r.equipped_pet_id !== null,
    slot: r.slot,
  };
}

function ledger(ctx: Ctx, userId: string, asset: string, delta: number, balanceAfter: number | null, reason: string, ref?: string) {
  ctx.db
    .prepare('INSERT INTO ledger (user_id, asset, delta, balance_after, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, asset, delta, balanceAfter, reason, ref ?? null, ctx.now());
}

export function getGold(ctx: Ctx, userId: string): number {
  return (ctx.db.prepare('SELECT gold FROM players WHERE user_id = ?').get(userId) as { gold: number }).gold;
}

/** Add (or remove, with negative delta) gold. Throws if it would go negative. */
export function changeGold(ctx: Ctx, userId: string, delta: number, reason: string, ref?: string): number {
  delta = Math.trunc(delta);
  if (delta === 0) return getGold(ctx, userId);
  const cur = getGold(ctx, userId);
  if (cur + delta < 0) throw new ApiError(400, 'not_enough_gold', 'Not enough gold');
  ctx.db.prepare('UPDATE players SET gold = gold + ? WHERE user_id = ?').run(delta, userId);
  ledger(ctx, userId, 'gold', delta, cur + delta, reason, ref);
  return cur + delta;
}

export function getMaterials(ctx: Ctx, userId: string): Record<string, number> {
  const rows = ctx.db.prepare('SELECT material, amount FROM materials WHERE user_id = ?').all(userId) as {
    material: string;
    amount: number;
  }[];
  return Object.fromEntries(rows.map((r) => [r.material, r.amount]));
}

export function changeMaterial(ctx: Ctx, userId: string, material: string, delta: number, reason: string, ref?: string) {
  delta = Math.trunc(delta);
  if (delta === 0) return;
  const cur =
    (ctx.db.prepare('SELECT amount FROM materials WHERE user_id = ? AND material = ?').get(userId, material) as
      | { amount: number }
      | undefined)?.amount ?? 0;
  if (cur + delta < 0) throw new ApiError(400, 'not_enough_materials', `Not enough ${material}`);
  ctx.db
    .prepare(
      'INSERT INTO materials (user_id, material, amount) VALUES (?, ?, ?) ON CONFLICT(user_id, material) DO UPDATE SET amount = excluded.amount',
    )
    .run(userId, material, cur + delta);
  ledger(ctx, userId, `mat:${material}`, delta, cur + delta, reason, ref);
}

export function itemCount(ctx: Ctx, userId: string): number {
  return (ctx.db.prepare('SELECT COUNT(*) AS n FROM items WHERE user_id = ?').get(userId) as { n: number }).n;
}

/** Create a brand-new item for a user. Server-side RNG; origin recorded for provenance. */
export function grantItem(ctx: Ctx, userId: string, opts: GenerateItemOptions, origin: string, originRef?: string): ItemInstance {
  if (itemCount(ctx, userId) >= INVENTORY_LIMIT) throw new ApiError(400, 'inventory_full', 'Your bag is full');
  const id = newId();
  const item = generateItem(createRng(randomBytes(16).toString('hex')), id, opts);
  ctx.db
    .prepare(
      `INSERT INTO items (id, user_id, template_id, slot, rarity, upgrade, bonuses_json, set_id, equipped_pet_id, origin, origin_ref, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?, ?)`,
    )
    .run(id, userId, item.templateId, getTemplate(item.templateId).slot, item.rarity, JSON.stringify(item.bonuses), item.setId, origin, originRef ?? null, ctx.now());
  ledger(ctx, userId, `item:${id}`, 1, null, origin, originRef);
  return item;
}

export function getItemRow(ctx: Ctx, userId: string, itemId: string): ItemRow {
  const row = ctx.db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(itemId, userId) as ItemRow | undefined;
  if (!row) throw new ApiError(404, 'item_not_found', 'Item not found');
  return row;
}

export function destroyItem(ctx: Ctx, userId: string, itemId: string, reason: string) {
  const res = ctx.db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?').run(itemId, userId);
  if (res.changes !== 1) throw new ApiError(404, 'item_not_found', 'Item not found');
  ledger(ctx, userId, `item:${itemId}`, -1, null, reason);
}
