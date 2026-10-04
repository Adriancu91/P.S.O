import { randomBytes } from 'node:crypto';
import { INVENTORY_LIMIT, PASSIVE, ZONE_BY_ID, computeZoneRewards, createRng, generateItem, salvageValue } from '@pso/shared';
import { ApiError, audit, bad, type Ctx } from '../ctx.js';
import { tx } from '../db.js';
import { changeGold, changeMaterial, grantItem, itemCount } from './economy.js';
import { recordEvent } from './missions.js';
import { addXp, requirePet } from './pets.js';

export function zoneStatus(ctx: Ctx, pet: { zone_id: string | null; zone_since: number | null }) {
  if (!pet.zone_id || pet.zone_since == null) return null;
  const elapsed = ctx.now() - pet.zone_since;
  return {
    zoneId: pet.zone_id,
    since: pet.zone_since,
    elapsedMs: Math.min(elapsed, PASSIVE.capMs),
    capMs: PASSIVE.capMs,
    full: elapsed >= PASSIVE.capMs,
    canCollect: elapsed >= PASSIVE.minCollectMs,
  };
}

/** Collect what the pet produced. Must be called inside a transaction. */
function collectInner(ctx: Ctx, userId: string) {
  const pet = requirePet(ctx, userId);
  if (!pet.zone_id || pet.zone_since == null) throw bad('no_zone', 'Your pet is not exploring');
  const zone = ZONE_BY_ID[pet.zone_id];
  const elapsed = ctx.now() - pet.zone_since;
  if (elapsed < PASSIVE.minCollectMs) throw bad('too_early', 'Nothing found yet. Come back in a minute.');

  const seed = randomBytes(16).toString('hex');
  const r = computeZoneRewards(createRng(seed), zone, pet.level, elapsed);
  const ref = `zone:${zone.id}:${pet.zone_since}`;

  changeGold(ctx, userId, r.gold, 'zone', ref);
  for (const [m, n] of Object.entries(r.materials)) changeMaterial(ctx, userId, m, n, 'zone', ref);
  const items = [];
  let overflowOre = 0;
  for (const opts of r.items) {
    if (itemCount(ctx, userId) < INVENTORY_LIMIT) {
      items.push(grantItem(ctx, userId, opts, 'zone', ref));
    } else {
      // Bag full: auto-salvage instead of silently losing the drop.
      overflowOre += salvageValue(generateItem(createRng(seed + items.length), 'tmp', opts)).ore;
    }
  }
  if (overflowOre) changeMaterial(ctx, userId, 'ore', overflowOre, 'zone_overflow', ref);
  ctx.db.prepare('UPDATE pets SET zone_since = ? WHERE id = ?').run(ctx.now(), pet.id);
  const levelUp = addXp(ctx, userId, r.xp);
  recordEvent(ctx, userId, 'zone_collect');
  audit(ctx, userId, 'zone_collect', { zone: zone.id, elapsedMs: r.elapsedMs, gold: r.gold, items: items.length });
  return { zoneId: zone.id, ...r, items, overflowOre, levelUp };
}

export function collect(ctx: Ctx, userId: string) {
  return tx(ctx.db, () => collectInner(ctx, userId));
}

export function startZone(ctx: Ctx, userId: string, zoneId: unknown) {
  if (typeof zoneId !== 'string' || !ZONE_BY_ID[zoneId]) throw bad('bad_zone', 'Unknown zone');
  return tx(ctx.db, () => {
    const pet = requirePet(ctx, userId);
    const zone = ZONE_BY_ID[zoneId];
    if (pet.level < zone.level) throw new ApiError(400, 'level_too_low', `Reach level ${zone.level} first`);
    let collected = null;
    if (pet.zone_id && pet.zone_since != null && ctx.now() - pet.zone_since >= PASSIVE.minCollectMs) {
      collected = collectInner(ctx, userId);
    }
    ctx.db.prepare('UPDATE pets SET zone_id = ?, zone_since = ? WHERE id = ?').run(zoneId, ctx.now(), pet.id);
    recordEvent(ctx, userId, 'zone_start');
    return { zoneId, collected };
  });
}
