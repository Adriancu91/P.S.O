import type { AttrKey, Modifier } from '../types.js';

export const MAX_LEVEL = 40;
export const STAT_POINTS_PER_LEVEL = 3;

/** What one point in each attribute gives. Flat modifiers. */
export const ATTRIBUTES: Record<AttrKey, { name: string; short: string; description: string; gives: Modifier[] }> = {
  vit: {
    name: 'Vitality',
    short: 'VIT',
    description: 'More HP and a little regeneration.',
    gives: [
      { stat: 'hp', mode: 'flat', value: 45 },
      { stat: 'regen', mode: 'flat', value: 0.5 },
    ],
  },
  str: {
    name: 'Strength',
    short: 'STR',
    description: 'Physical attack.',
    gives: [{ stat: 'patk', mode: 'flat', value: 3 }],
  },
  int: {
    name: 'Intellect',
    short: 'INT',
    description: 'Magic attack.',
    gives: [
      { stat: 'matk', mode: 'flat', value: 3 },
    ],
  },
  grd: {
    name: 'Guard',
    short: 'GRD',
    description: 'Physical and magic defense.',
    gives: [
      { stat: 'pdef', mode: 'flat', value: 2 },
      { stat: 'mdef', mode: 'flat', value: 2 },
    ],
  },
  agi: {
    name: 'Agility',
    short: 'AGI',
    description: 'Attack speed.',
    gives: [{ stat: 'aspd', mode: 'flat', value: 2.5 }],
  },
  for: {
    name: 'Fortune',
    short: 'FOR',
    description: 'Critical chance and critical damage.',
    gives: [
      { stat: 'critChance', mode: 'flat', value: 1 },
      { stat: 'critDmg', mode: 'flat', value: 2.5 },
    ],
  },
};

/** Hard caps applied after all modifiers. */
export const STAT_CAPS = {
  critChance: 75,
  aspd: 300,
  aspdMin: 30,
};

export function xpToNext(level: number): number {
  return Math.round(60 + 30 * Math.pow(level, 1.55));
}

/** Evolution requirements. Index = target evolution. */
export const EVOLUTION_REQ: Record<2 | 3, { level: number; gold: number; essence: Record<string, number> }> = {
  2: { level: 15, gold: 1500, essence: { sap: 10, glass: 5 } },
  3: { level: 30, gold: 8000, essence: { frost: 12, ember: 8 } },
};

/** Stat respec cost (gold) — a deliberate economy sink. */
export function respecCost(level: number): number {
  return 100 + level * 40;
}

/** PvP fight energy: limits fight-based currency generation. */
export const ENERGY = {
  max: 10,
  regenMs: 6 * 60 * 1000,
};

export const PVP = {
  startRating: 1000,
  eloK: 32,
  /** Defender (async opponent) rating moves by this fraction. */
  defenderFactor: 0.5,
  /** Fights against the same opponent in 24h before rewards drop to 0. */
  sameOpponentLimit: 3,
  winGold: (level: number) => 25 + level * 3,
  lossGold: (level: number) => 8 + level,
  winXp: (level: number) => 40 + level * 6,
  lossXp: (level: number) => 15 + level * 2,
  /** Matchmaking windows tried in order. */
  windows: [
    { rating: 150, level: 3 },
    { rating: 300, level: 6 },
    { rating: 600, level: 10 },
  ],
};
