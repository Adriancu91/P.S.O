import {
  RACES,
  RACE_IDS,
  applyXp,
  canEquip,
  emptyAttributes,
  evolutionRequirement,
  getTemplate,
  respecCost,
  salvageValue,
  upgradeCost,
  validateAllocation,
  validateSkills,
  type Attributes,
  type Evolution,
  type Gender,
  type PetBuild,
  type RaceId,
} from '@pso/shared';
import { ApiError, audit, bad, newId, type Ctx } from '../ctx.js';
import { tx } from '../db.js';
import {
  changeGold,
  changeMaterial,
  destroyItem,
  getItemRow,
  grantItem,
  rowToItem,
  type ItemRow,
} from './economy.js';
import { recordEvent } from './missions.js';

export interface PetRow {
  id: string;
  user_id: string;
  name: string;
  race: RaceId;
  gender: Gender;
  level: number;
  xp: number;
  evolution: Evolution;
  attrs_json: string;
  skills_json: string;
  zone_id: string | null;
  zone_since: number | null;
  created_at: number;
}

const NAME_RE = /^[\p{L}\p{N} _'-]{2,16}$/u;

export function getActivePet(ctx: Ctx, userId: string): PetRow | null {
  return (
    (ctx.db
      .prepare('SELECT p.* FROM pets p JOIN players pl ON pl.active_pet_id = p.id WHERE pl.user_id = ?')
      .get(userId) as PetRow | undefined) ?? null
  );
}

export function requirePet(ctx: Ctx, userId: string): PetRow {
  const pet = getActivePet(ctx, userId);
  if (!pet) throw new ApiError(400, 'no_pet', 'Create your pet first');
  return pet;
}

export function equippedItems(ctx: Ctx, petId: string) {
  return (ctx.db.prepare('SELECT * FROM items WHERE equipped_pet_id = ?').all(petId) as unknown as ItemRow[]).map(rowToItem);
}

export function buildOf(ctx: Ctx, pet: PetRow): PetBuild {
  return {
    raceId: pet.race,
    level: pet.level,
    evolution: pet.evolution,
    attributes: JSON.parse(pet.attrs_json) as Attributes,
    skills: JSON.parse(pet.skills_json) as string[],
    equipped: equippedItems(ctx, pet.id),
  };
}

export function createPet(ctx: Ctx, userId: string, body: { name?: unknown; race?: unknown; gender?: unknown }) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!NAME_RE.test(name)) throw bad('bad_name', 'Name: 2-16 letters or numbers');
  if (!RACE_IDS.includes(body.race as RaceId)) throw bad('bad_race', 'Unknown race');
  if (body.gender !== 'm' && body.gender !== 'f') throw bad('bad_gender', 'Pick male or female');
  const race = body.race as RaceId;
  return tx(ctx.db, () => {
    if (getActivePet(ctx, userId)) throw new ApiError(409, 'pet_exists', 'You already have a pet');
    const id = newId();
    const skills = [RACES[race].skillChoices[0][0]];
    ctx.db
      .prepare(
        `INSERT INTO pets (id, user_id, name, race, gender, level, xp, evolution, attrs_json, skills_json, created_at)
         VALUES (?, ?, ?, ?, ?, 1, 0, 1, ?, ?, ?)`,
      )
      .run(id, userId, name, race, body.gender as string, JSON.stringify(emptyAttributes()), JSON.stringify(skills), ctx.now());
    ctx.db.prepare('UPDATE players SET active_pet_id = ? WHERE user_id = ?').run(id, userId);
    // Starter kit: a race-appropriate weapon, already equipped.
    const weapon = grantItem(ctx, userId, { tier: 1, rarity: 'common', baseId: race === 'hoolu' ? 'orb' : 'claw' }, 'starter');
    ctx.db.prepare('UPDATE items SET equipped_pet_id = ? WHERE id = ?').run(id, weapon.id);
    changeGold(ctx, userId, 100, 'starter');
    audit(ctx, userId, 'pet_create', { race, gender: body.gender });
    return { petId: id };
  });
}

/** Grant XP to the active pet; handles level ups. Must run inside a transaction. */
export function addXp(ctx: Ctx, userId: string, amount: number) {
  const pet = requirePet(ctx, userId);
  const r = applyXp(pet.level, pet.xp, amount);
  ctx.db.prepare('UPDATE pets SET level = ?, xp = ? WHERE id = ?').run(r.level, r.xp, pet.id);
  if (r.levelsGained > 0) {
    recordEvent(ctx, userId, 'level', r.level);
    audit(ctx, userId, 'level_up', { from: pet.level, to: r.level });
  }
  return r.levelsGained > 0 ? { from: pet.level, to: r.level, points: r.levelsGained * 3 } : null;
}

export function allocatePoints(ctx: Ctx, userId: string, add: unknown) {
  if (!add || typeof add !== 'object') throw bad('bad_request', 'Nothing to allocate');
  return tx(ctx.db, () => {
    const pet = requirePet(ctx, userId);
    const attrs = JSON.parse(pet.attrs_json) as Attributes;
    const err = validateAllocation(pet.level, attrs, add as Partial<Attributes>);
    if (err) throw bad('bad_allocation', err);
    for (const [k, v] of Object.entries(add as Record<string, number>)) attrs[k as keyof Attributes] += v;
    ctx.db.prepare('UPDATE pets SET attrs_json = ? WHERE id = ?').run(JSON.stringify(attrs), pet.id);
    recordEvent(ctx, userId, 'allocate_points');
    return { attributes: attrs };
  });
}

export function respec(ctx: Ctx, userId: string) {
  return tx(ctx.db, () => {
    const pet = requirePet(ctx, userId);
    changeGold(ctx, userId, -respecCost(pet.level), 'respec', pet.id);
    ctx.db.prepare('UPDATE pets SET attrs_json = ? WHERE id = ?').run(JSON.stringify(emptyAttributes()), pet.id);
    audit(ctx, userId, 'respec');
    return { ok: true };
  });
}

export function setSkills(ctx: Ctx, userId: string, skills: unknown) {
  if (!Array.isArray(skills) || !skills.every((s) => typeof s === 'string')) throw bad('bad_request', 'Invalid skills');
  return tx(ctx.db, () => {
    const pet = requirePet(ctx, userId);
    const err = validateSkills(pet.race, pet.evolution, skills);
    if (err) throw bad('bad_skills', err);
    ctx.db.prepare('UPDATE pets SET skills_json = ? WHERE id = ?').run(JSON.stringify(skills), pet.id);
    recordEvent(ctx, userId, 'choose_skill');
    return { skills };
  });
}

export function evolve(ctx: Ctx, userId: string) {
  return tx(ctx.db, () => {
    const pet = requirePet(ctx, userId);
    const req = evolutionRequirement(pet.evolution);
    if (!req) throw bad('max_evolution', 'Already at the final form');
    if (pet.level < req.level) throw bad('level_too_low', `Reach level ${req.level} first`);
    const ref = `evolve:${pet.id}:${pet.evolution + 1}`;
    changeGold(ctx, userId, -req.gold, 'evolve', ref);
    for (const [mat, n] of Object.entries(req.essence)) changeMaterial(ctx, userId, mat, -n, 'evolve', ref);
    const evolution = (pet.evolution + 1) as Evolution;
    const skills = JSON.parse(pet.skills_json) as string[];
    skills.push(RACES[pet.race].skillChoices[evolution - 1][0]);
    ctx.db.prepare('UPDATE pets SET evolution = ?, skills_json = ? WHERE id = ?').run(evolution, JSON.stringify(skills), pet.id);
    recordEvent(ctx, userId, 'evolve');
    audit(ctx, userId, 'evolve', { to: evolution });
    return { evolution, stageName: RACES[pet.race].stageNames[evolution - 1] };
  });
}

export function equip(ctx: Ctx, userId: string, itemId: string) {
  return tx(ctx.db, () => {
    const pet = requirePet(ctx, userId);
    const row = getItemRow(ctx, userId, itemId);
    if (row.equipped_pet_id === pet.id) return { ok: true };
    const item = rowToItem(row);
    const err = canEquip(pet.level, pet.evolution, item);
    if (err) throw bad('cannot_equip', err);
    ctx.db.prepare('UPDATE items SET equipped_pet_id = NULL WHERE equipped_pet_id = ? AND slot = ?').run(pet.id, row.slot);
    ctx.db.prepare('UPDATE items SET equipped_pet_id = ? WHERE id = ?').run(pet.id, itemId);
    recordEvent(ctx, userId, 'equip');
    if (item.bonuses.length > 0) recordEvent(ctx, userId, 'equip_bonus_item');
    return { ok: true };
  });
}

export function unequip(ctx: Ctx, userId: string, itemId: string) {
  return tx(ctx.db, () => {
    getItemRow(ctx, userId, itemId);
    ctx.db.prepare('UPDATE items SET equipped_pet_id = NULL WHERE id = ? AND user_id = ?').run(itemId, userId);
    return { ok: true };
  });
}

export function upgradeItem(ctx: Ctx, userId: string, itemId: string) {
  return tx(ctx.db, () => {
    const row = getItemRow(ctx, userId, itemId);
    const item = rowToItem(row);
    const cost = upgradeCost(item);
    if (!cost) throw bad('max_upgrade', 'Already at max upgrade');
    const ref = `upgrade:${itemId}:${item.upgrade + 1}`;
    changeGold(ctx, userId, -cost.gold, 'upgrade', ref);
    changeMaterial(ctx, userId, 'ore', -cost.ore, 'upgrade', ref);
    // Guarded update: only succeeds if nobody changed the level meanwhile.
    const res = ctx.db
      .prepare('UPDATE items SET upgrade = upgrade + 1 WHERE id = ? AND user_id = ? AND upgrade = ?')
      .run(itemId, userId, item.upgrade);
    if (res.changes !== 1) throw new ApiError(409, 'conflict', 'Item changed, try again');
    recordEvent(ctx, userId, 'upgrade');
    return { upgrade: item.upgrade + 1, cost };
  });
}

export function salvageItem(ctx: Ctx, userId: string, itemId: string) {
  return tx(ctx.db, () => {
    const row = getItemRow(ctx, userId, itemId);
    if (row.equipped_pet_id) throw bad('item_equipped', 'Unequip it first');
    const { ore } = salvageValue(rowToItem(row));
    destroyItem(ctx, userId, itemId, 'salvage');
    changeMaterial(ctx, userId, 'ore', ore, 'salvage', `salvage:${itemId}`);
    recordEvent(ctx, userId, 'salvage');
    return { ore, template: getTemplate(row.template_id).name };
  });
}
