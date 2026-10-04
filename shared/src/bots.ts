// Bot opponents: used when no real player fits the matchmaking window.
// Bots get sensible builds so new players meet varied, beatable strategies.

import { TIERS } from './config/items.js';
import { RACES, RACE_IDS } from './config/races.js';
import { generateItem } from './items.js';
import { totalStatPoints } from './progression.js';
import type { Rng } from './rng.js';
import { emptyAttributes, type PetBuild } from './stats.js';
import { SLOTS, type AttrKey, type Evolution, type Gender, type RaceId, type Rarity, type Slot } from './types.js';

/** Archetype = how a bot spends points. Weights per attribute. */
export const ARCHETYPES: Record<string, { label: string; weights: Partial<Record<AttrKey, number>>; gear: Partial<Record<Slot, string>> }> = {
  tank: { label: 'Tank', weights: { vit: 4, grd: 4, str: 2 }, gear: { weapon: 'claw', armor: 'plate', helmet: 'helm' } },
  crit: { label: 'Critical', weights: { for: 5, str: 3, agi: 2 }, gear: { weapon: 'claw', ring: 'fang_ring', charm: 'tooth_charm' } },
  speed: { label: 'Speed', weights: { agi: 5, str: 3, for: 1, vit: 1 }, gear: { weapon: 'claw', boots: 'sandals' } },
  physical: { label: 'Physical', weights: { str: 6, vit: 2, for: 1 }, gear: { weapon: 'claw', ring: 'fang_ring' } },
  magic: { label: 'Magic', weights: { int: 6, vit: 2, agi: 1 }, gear: { weapon: 'orb', ring: 'sage_ring', helmet: 'hood' } },
  regen: { label: 'Regeneration', weights: { vit: 5, grd: 2, int: 2 }, gear: { charm: 'leaf_charm', armor: 'robe' } },
  hybrid: { label: 'Hybrid', weights: { str: 3, int: 3, vit: 2, agi: 1 }, gear: {} },
};

const RACE_ARCHETYPES: Record<RaceId, string[]> = {
  tuskar: ['tank', 'physical', 'regen', 'crit'],
  vexa: ['crit', 'speed', 'physical', 'hybrid'],
  hoolu: ['magic', 'regen', 'tank', 'hybrid'],
};

const BOT_NAMES = [
  'Bristle', 'Mochi', 'Snaggle', 'Pip', 'Grumble', 'Velvet', 'Ash', 'Nib', 'Rumble', 'Saffron',
  'Hush', 'Clover', 'Tofu', 'Jinx', 'Pebble', 'Ruckus', 'Echo', 'Biscuit', 'Fang', 'Wisp',
];

/** Spend points proportionally to weights (deterministic for the rng state). */
export function distributePoints(rng: Rng, points: number, weights: Partial<Record<AttrKey, number>>) {
  const attrs = emptyAttributes();
  const keys = Object.keys(weights) as AttrKey[];
  for (let i = 0; i < points; i++) {
    const k = rng.weighted(Object.fromEntries(keys.map((x) => [x, weights[x]!])) as Record<AttrKey, number>);
    attrs[k] += 1;
  }
  return attrs;
}

export function evolutionForLevel(level: number): Evolution {
  return level >= 30 ? 3 : level >= 15 ? 2 : 1;
}

export interface BotDef {
  name: string;
  gender: Gender;
  archetype: string;
  build: PetBuild;
}

export function generateBot(rng: Rng, level: number, opts: { raceId?: RaceId; archetype?: string; rarity?: Rarity } = {}): BotDef {
  const raceId = opts.raceId ?? rng.pick(RACE_IDS);
  const archetype = opts.archetype ?? rng.pick(RACE_ARCHETYPES[raceId]);
  const arch = ARCHETYPES[archetype];
  const evolution = evolutionForLevel(level);
  const attributes = distributePoints(rng, totalStatPoints(level), arch.weights);
  const skills = RACES[raceId].skillChoices.slice(0, evolution).map((c) => rng.pick(c));

  const tier = [...TIERS].reverse().find((t) => level >= t.level && evolution >= t.evolution)!.tier;
  const equipped = SLOTS.filter(() => rng.chance(0.85)).map((slot, i) =>
    generateItem(rng, `bot-${i}`, {
      tier,
      rarity: opts.rarity ?? (rng.weighted({ common: 55, uncommon: 35, rare: 10 }) as Rarity),
      slot,
      baseId: arch.gear[slot],
    }),
  );
  return {
    name: rng.pick(BOT_NAMES),
    gender: rng.pick(['m', 'f'] as const),
    archetype,
    build: { raceId, level, evolution, attributes, equipped, skills },
  };
}
