import type { Rarity, Slot, StatKey } from '../types.js';

/** Gear tiers. Higher tiers need level + evolution — evolution literally unlocks new gear. */
export const TIERS = [
  { tier: 1, prefix: 'Scrappy', level: 1, evolution: 1, mult: 1.0 },
  { tier: 2, prefix: 'Iron', level: 10, evolution: 1, mult: 2.1 },
  { tier: 3, prefix: 'Runed', level: 20, evolution: 2, mult: 3.4 },
  { tier: 4, prefix: 'Mythic', level: 30, evolution: 3, mult: 5.0 },
] as const;

export interface ItemBaseDef {
  id: string;
  slot: Slot;
  name: string;
  /** Tier-1 base stats (scaled by tier multiplier, rarity, upgrade). */
  stats: Partial<Record<StatKey, number>>;
}

/** Two bases per slot, giving a physical/magical or offense/defense choice in every slot. */
export const ITEM_BASES: ItemBaseDef[] = [
  { id: 'claw', slot: 'weapon', name: 'Claws', stats: { patk: 10 } },
  { id: 'orb', slot: 'weapon', name: 'Orb', stats: { matk: 10 } },
  { id: 'plate', slot: 'armor', name: 'Plate', stats: { hp: 100, pdef: 8 } },
  { id: 'robe', slot: 'armor', name: 'Robe', stats: { hp: 100, mdef: 8 } },
  { id: 'helm', slot: 'helmet', name: 'Helm', stats: { hp: 75, pdef: 4, mdef: 2 } },
  { id: 'hood', slot: 'helmet', name: 'Hood', stats: { hp: 50, matk: 3, mdef: 3 } },
  { id: 'treads', slot: 'boots', name: 'Treads', stats: { aspd: 4, pdef: 3 } },
  { id: 'sandals', slot: 'boots', name: 'Sandals', stats: { aspd: 6, hp: 25 } },
  { id: 'fang_ring', slot: 'ring', name: 'Fang Ring', stats: { critChance: 3, patk: 3 } },
  { id: 'sage_ring', slot: 'ring', name: 'Sage Ring', stats: { matk: 5, mdef: 2 } },
  { id: 'leaf_charm', slot: 'charm', name: 'Leaf Charm', stats: { regen: 2.5, hp: 60 } },
  { id: 'tooth_charm', slot: 'charm', name: 'Tooth Charm', stats: { critDmg: 8, patk: 2 } },
];

/** Percent-type stats don't scale with tier (a +3 crit ring is +3 crit at any tier). */
export const NON_SCALING_STATS: StatKey[] = ['critChance', 'critDmg', 'aspd'];

export const RARITY: Record<
  Rarity,
  { mult: number; bonuses: number; rollMin: number; color: string; salvageOre: number }
> = {
  common: { mult: 1.0, bonuses: 0, rollMin: 0, color: '#9aa3ad', salvageOre: 1 },
  uncommon: { mult: 1.08, bonuses: 1, rollMin: 0, color: '#4cc26e', salvageOre: 2 },
  rare: { mult: 1.16, bonuses: 2, rollMin: 0.15, color: '#3d8bff', salvageOre: 4 },
  epic: { mult: 1.25, bonuses: 3, rollMin: 0.3, color: '#a65cff', salvageOre: 8 },
  legendary: { mult: 1.35, bonuses: 3, rollMin: 0.6, color: '#ffa928', salvageOre: 16 },
};

/** Random bonus pool. flat values for absolute stats scale with tier; percent-like values do not. */
export const BONUS_POOL: { stat: StatKey; mode: 'flat' | 'pct'; min: number; max: number; scales: boolean }[] = [
  { stat: 'critChance', mode: 'flat', min: 2, max: 8, scales: false },
  { stat: 'critDmg', mode: 'flat', min: 6, max: 20, scales: false },
  { stat: 'aspd', mode: 'flat', min: 3, max: 10, scales: false },
  { stat: 'hp', mode: 'pct', min: 3, max: 10, scales: false },
  { stat: 'patk', mode: 'pct', min: 3, max: 10, scales: false },
  { stat: 'matk', mode: 'pct', min: 3, max: 10, scales: false },
  { stat: 'pdef', mode: 'pct', min: 4, max: 12, scales: false },
  { stat: 'mdef', mode: 'pct', min: 4, max: 12, scales: false },
  { stat: 'regen', mode: 'flat', min: 2, max: 8, scales: true },
];

export const UPGRADE = {
  max: 9,
  /** Each upgrade level adds this fraction of the item's base stats. */
  perLevel: 0.08,
  cost: (currentUpgrade: number, tier: number) => ({
    gold: Math.round(40 * Math.pow(currentUpgrade + 1, 1.6) * tier),
    ore: 2 * (currentUpgrade + 1) * tier,
  }),
};

export const INVENTORY_LIMIT = 60;

export interface SetDef {
  id: string;
  name: string;
  description: string;
  pieces: { count: 2 | 4 | 6; mods: { stat: StatKey; mode: 'flat' | 'pct'; value: number }[]; skill?: string }[];
}

export const SETS: Record<string, SetDef> = {
  wildheart: {
    id: 'wildheart',
    name: 'Wildheart',
    description: 'Endurance set from the Forest and Desert. Outlasts burst.',
    pieces: [
      { count: 2, mods: [{ stat: 'hp', mode: 'pct', value: 6 }] },
      {
        count: 4,
        mods: [
          { stat: 'regen', mode: 'flat', value: 3 },
          { stat: 'hp', mode: 'pct', value: 6 },
        ],
      },
      { count: 6, mods: [], skill: 'set_wild_renewal' },
    ],
  },
  stormclaw: {
    id: 'stormclaw',
    name: 'Stormclaw',
    description: 'Aggressive set from the Ice Lands and Volcano. Speed into lightning.',
    pieces: [
      { count: 2, mods: [{ stat: 'aspd', mode: 'flat', value: 6 }] },
      { count: 4, mods: [{ stat: 'critDmg', mode: 'flat', value: 20 }] },
      { count: 6, mods: [], skill: 'set_storm_strike' },
    ],
  },
};
