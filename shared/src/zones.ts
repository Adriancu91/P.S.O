import { PASSIVE, type ZoneDef } from './config/zones.js';
import type { GenerateItemOptions } from './items.js';
import type { Rng } from './rng.js';
import type { Rarity } from './types.js';

export interface ZoneRewards {
  elapsedMs: number;
  capped: boolean;
  gold: number;
  xp: number;
  materials: Record<string, number>;
  items: GenerateItemOptions[];
}

function stochasticRound(rng: Rng, x: number): number {
  const base = Math.floor(x);
  return base + (rng.chance(x - base) ? 1 : 0);
}

/** Pure function: what the pet produced during elapsedMs in a zone. */
export function computeZoneRewards(rng: Rng, zone: ZoneDef, petLevel: number, elapsedMs: number): ZoneRewards {
  const capped = elapsedMs >= PASSIVE.capMs;
  const ms = Math.max(0, Math.min(elapsedMs, PASSIVE.capMs));
  const hours = ms / 3_600_000;
  const lvl = 1 + PASSIVE.levelBonus * (petLevel - 1);
  const roll = () => 1 - zone.variance + rng.next() * zone.variance * 2;

  const gold = Math.floor(zone.goldPerHour * hours * lvl * roll());
  const xp = Math.floor(zone.xpPerHour * hours * lvl * roll());
  const materials: Record<string, number> = {};
  const ore = stochasticRound(rng, zone.orePerHour * hours * roll());
  if (ore > 0) materials.ore = ore;
  const ess = stochasticRound(rng, zone.essence.perHour * hours * roll());
  if (ess > 0) materials[zone.essence.id] = ess;

  const count = Math.min(PASSIVE.maxItemsPerCollect, stochasticRound(rng, zone.itemsPerHour * hours));
  const items: GenerateItemOptions[] = [];
  const tierWeights = Object.fromEntries(Object.entries(zone.tiers).map(([k, v]) => [`t${k}`, v])) as Record<string, number>;
  for (let i = 0; i < count; i++) {
    const tier = Number(rng.weighted(tierWeights).slice(1)) as 1 | 2 | 3 | 4;
    const rarity = rng.weighted(zone.rarity) as Rarity;
    const setId = rng.chance(zone.set.chance) ? zone.set.id : null;
    items.push({ tier, rarity, setId });
  }
  return { elapsedMs: ms, capped, gold, xp, materials, items };
}
