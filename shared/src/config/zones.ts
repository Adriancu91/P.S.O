import type { Rarity } from '../types.js';

export const MATERIALS: Record<string, { name: string; description: string }> = {
  ore: { name: 'Ore', description: 'Used to upgrade equipment.' },
  sap: { name: 'Forest Sap', description: 'Evolution essence from the Forest.' },
  glass: { name: 'Desert Glass', description: 'Evolution essence from the Desert.' },
  frost: { name: 'Frost Shard', description: 'Evolution essence from the Ice Lands.' },
  ember: { name: 'Ember Core', description: 'Evolution essence from the Volcano.' },
};

export interface ZoneDef {
  id: string;
  name: string;
  description: string;
  level: number;
  theme: { sky: string; ground: string; accent: string };
  /** Per-hour base rates (multiplied by pet level bonus). */
  goldPerHour: number;
  xpPerHour: number;
  orePerHour: number;
  essence: { id: string; perHour: number };
  itemsPerHour: number;
  /** Loot tiers that can drop here with weights. */
  tiers: Partial<Record<1 | 2 | 3 | 4, number>>;
  rarity: Record<Rarity, number>;
  /** Chance a dropped item belongs to this zone's set. */
  set: { id: string; chance: number };
  /** Risk/reward: payout multiplier rolls in [1 - variance, 1 + variance]. */
  variance: number;
}

export const ZONES: ZoneDef[] = [
  {
    id: 'forest',
    name: 'Mossy Forest',
    description: 'Safe and steady. Good for young pets.',
    level: 1,
    theme: { sky: '#bfe6c3', ground: '#3f7d4a', accent: '#8fd16a' },
    goldPerHour: 60,
    xpPerHour: 50,
    orePerHour: 3,
    essence: { id: 'sap', perHour: 1.2 },
    itemsPerHour: 1.0,
    tiers: { 1: 85, 2: 15 },
    rarity: { common: 60, uncommon: 28, rare: 10, epic: 2, legendary: 0 },
    set: { id: 'wildheart', chance: 0.12 },
    variance: 0.1,
  },
  {
    id: 'desert',
    name: 'Sunbaked Desert',
    description: 'Hot, dry, better loot. Results vary more.',
    level: 8,
    theme: { sky: '#ffe2a8', ground: '#c99a52', accent: '#ffcf5a' },
    goldPerHour: 110,
    xpPerHour: 90,
    orePerHour: 5,
    essence: { id: 'glass', perHour: 1.0 },
    itemsPerHour: 1.2,
    tiers: { 1: 30, 2: 65, 3: 5 },
    rarity: { common: 50, uncommon: 32, rare: 14, epic: 3.6, legendary: 0.4 },
    set: { id: 'wildheart', chance: 0.15 },
    variance: 0.25,
  },
  {
    id: 'ice',
    name: 'Ice Lands',
    description: 'Cold and quiet. Rare gear sleeps under the snow.',
    level: 16,
    theme: { sky: '#d8eeff', ground: '#8fb4d6', accent: '#e9f6ff' },
    goldPerHour: 180,
    xpPerHour: 140,
    orePerHour: 7,
    essence: { id: 'frost', perHour: 0.9 },
    itemsPerHour: 1.4,
    tiers: { 2: 45, 3: 50, 4: 5 },
    rarity: { common: 42, uncommon: 34, rare: 18, epic: 5.2, legendary: 0.8 },
    set: { id: 'stormclaw', chance: 0.15 },
    variance: 0.35,
  },
  {
    id: 'volcano',
    name: 'Ember Volcano',
    description: 'Dangerous and rewarding. Big swings, big loot.',
    level: 25,
    theme: { sky: '#ffb199', ground: '#5a2a24', accent: '#ff6a3d' },
    goldPerHour: 270,
    xpPerHour: 200,
    orePerHour: 10,
    essence: { id: 'ember', perHour: 0.8 },
    itemsPerHour: 1.6,
    tiers: { 3: 55, 4: 45 },
    rarity: { common: 35, uncommon: 34, rare: 22, epic: 7.5, legendary: 1.5 },
    set: { id: 'stormclaw', chance: 0.2 },
    variance: 0.5,
  },
];

export const ZONE_BY_ID: Record<string, ZoneDef> = Object.fromEntries(ZONES.map((z) => [z.id, z]));

export const PASSIVE = {
  /** Offline accumulation cap. Rewards stop growing after this. */
  capMs: 8 * 60 * 60 * 1000,
  /** Collecting earlier than this gives nothing (anti-spam). */
  minCollectMs: 60 * 1000,
  /** Pet level bonus: +2% production per level. */
  levelBonus: 0.02,
  /** Max items per collection regardless of time (inventory protection). */
  maxItemsPerCollect: 10,
};
