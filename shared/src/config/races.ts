import type { RaceId, Stats } from '../types.js';

export interface RaceDef {
  id: RaceId;
  name: string;
  animal: string;
  tagline: string;
  personality: string;
  strengths: string[];
  weaknesses: string[];
  /** Level 1, Evolution 1 base stats. */
  base: Stats;
  /** Added to base per level above 1. */
  growth: Partial<Stats>;
  /** Display names per evolution stage [evo1, evo2, evo3]. */
  stageNames: [string, string, string];
  /** Skill choices per evolution stage: index 0 = evo1 active, 1 = evo2 passive, 2 = evo3 ultimate. */
  skillChoices: [string[], string[], string[]];
}

export const RACES: Record<RaceId, RaceDef> = {
  tuskar: {
    id: 'tuskar',
    name: 'Tuskar',
    animal: 'Boar',
    tagline: 'Big tusks. Bigger heart.',
    personality: 'Stubborn, loyal, loud. Charges first, thinks later — and still wins.',
    strengths: ['Huge HP', 'High physical defense', 'Hard to burst down'],
    weaknesses: ['Slow attacks', 'Weak magic', 'Few crits'],
    base: {
      hp: 650,
      patk: 22,
      matk: 8,
      pdef: 16,
      mdef: 12,
      aspd: 85,
      critChance: 5,
      critDmg: 150,
      regen: 3,
    },
    growth: { hp: 35, patk: 1.6, matk: 0.4, pdef: 1.2, mdef: 0.8, regen: 0.1 },
    stageNames: ['Piglet', 'Tusk Brawler', 'Ironhide Warlord'],
    skillChoices: [
      ['tusk_charge', 'mud_wall'],
      ['thick_hide', 'last_stand'],
      ['earthquake_stomp', 'boar_heart'],
    ],
  },
  vexa: {
    id: 'vexa',
    name: 'Vexa',
    animal: 'Fox',
    tagline: 'Blink and you lost.',
    personality: 'Sly, elegant, a little vain. Fights like a dance with knives.',
    strengths: ['Fast attacks', 'High crit', 'Explosive damage'],
    weaknesses: ['Low HP', 'Low defense', 'Punished by tanky builds'],
    base: {
      hp: 470,
      patk: 20,
      matk: 14,
      pdef: 9,
      mdef: 11,
      aspd: 115,
      critChance: 10,
      critDmg: 160,
      regen: 2,
    },
    growth: { hp: 22, patk: 1.5, matk: 0.9, pdef: 0.7, mdef: 0.7, regen: 0.06 },
    stageNames: ['Kit', 'Shadow Tail', 'Ninefold Phantom'],
    skillChoices: [
      ['twin_fang', 'fox_fire'],
      ['hunters_focus', 'momentum'],
      ['thousand_tails', 'mirage'],
    ],
  },
  hoolu: {
    id: 'hoolu',
    name: 'Hoolu',
    animal: 'Owl',
    tagline: 'Sees everything. Forgives nothing.',
    personality: 'Calm, mysterious, a bit smug. Wins the long game.',
    strengths: ['Strong magic', 'High magic defense', 'Best natural regeneration'],
    weaknesses: ['Weak physical attacks', 'Low physical defense', 'Slow start'],
    base: {
      hp: 560,
      patk: 9,
      matk: 26,
      pdef: 12,
      mdef: 15,
      aspd: 95,
      critChance: 5,
      critDmg: 150,
      regen: 4.5,
    },
    growth: { hp: 27, patk: 0.5, matk: 2.0, pdef: 0.9, mdef: 1.2, regen: 0.14 },
    stageNames: ['Fluffling', 'Moon Warden', 'Starseer Sage'],
    skillChoices: [
      ['moon_bolt', 'night_hush'],
      ['feather_mend', 'wise_eyes'],
      ['starfall', 'eclipse'],
    ],
  },
};

export const RACE_IDS = Object.keys(RACES) as RaceId[];

/** Base stats multiplier per evolution stage. Evolution also unlocks a skill slot and gear tiers. */
export const EVOLUTION_STAT_MULT: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.15, 3: 1.3 };
