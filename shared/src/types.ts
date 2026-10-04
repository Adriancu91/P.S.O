// Core domain types shared by server (authoritative) and client (display only).

/**
 * Stat units:
 *  hp, patk, matk, pdef, mdef  -> absolute values
 *  aspd        -> 100 = 1 basic attack per second
 *  critChance  -> percent points (10 = 10%)
 *  critDmg     -> percent multiplier on crit (150 = x1.5)
 *  regen       -> HP per second
 */
export const STAT_KEYS = [
  'hp',
  'patk',
  'matk',
  'pdef',
  'mdef',
  'aspd',
  'critChance',
  'critDmg',
  'regen',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

/** Attributes the player distributes stat points into (3 per level). */
export const ATTR_KEYS = ['vit', 'str', 'int', 'grd', 'agi', 'for'] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];
export type Attributes = Record<AttrKey, number>;

export type RaceId = 'tuskar' | 'vexa' | 'hoolu';
export type Gender = 'm' | 'f';
export type Evolution = 1 | 2 | 3;

export const SLOTS = ['weapon', 'armor', 'helmet', 'boots', 'ring', 'charm'] as const;
export type Slot = (typeof SLOTS)[number];

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

/** A stat modifier. flat = added; pct = multiplies the stat by (1 + sum(pct)/100). */
export interface Modifier {
  stat: StatKey;
  mode: 'flat' | 'pct';
  value: number;
}

export interface ItemInstance {
  id: string;
  templateId: string;
  rarity: Rarity;
  upgrade: number;
  bonuses: Modifier[];
  setId: string | null;
}

/** Everything the combat engine needs to know about one fighter. */
export interface FighterSnapshot {
  name: string;
  raceId: RaceId;
  gender: Gender;
  level: number;
  evolution: Evolution;
  stats: Stats;
  skills: string[];
}

// ----- Skills -----

export type SkillTrigger =
  | { type: 'always' }
  | { type: 'battleStart' }
  | { type: 'everyNthHit'; n: number }
  | { type: 'cooldown'; ms: number; firstMs?: number }
  | { type: 'hpBelow'; pct: number }
  | { type: 'onCrit' };

/** Buffable values: real stats plus combat-only multipliers. */
export type BuffStat = StatKey | 'healingTaken' | 'damageDealt';

export type SkillEffect =
  | {
      type: 'damage';
      scale: 'patk' | 'matk';
      mult: number;
      dmgType: 'phys' | 'magic';
      hits?: number;
    }
  | { type: 'heal'; pctMaxHp: number }
  | { type: 'shield'; pctMaxHp: number }
  | {
      type: 'buff';
      target: 'self' | 'enemy';
      stat: BuffStat;
      /** 'pct' (default) multiplies the stat by (1 + value/100); 'flat' adds value. */
      mode?: 'pct' | 'flat';
      value: number;
      /** 0 = lasts the whole battle */
      durationMs: number;
    };

export interface SkillDef {
  id: string;
  name: string;
  kind: 'active' | 'passive' | 'ultimate' | 'set';
  description: string;
  trigger: SkillTrigger;
  effects: SkillEffect[];
}

// ----- Combat output -----

export type BattleEvent =
  | { t: number; type: 'start'; hp: [number, number] }
  | {
      t: number;
      type: 'hit';
      src: 0 | 1;
      amount: number;
      crit: boolean;
      absorbed: number;
      skill?: string;
      hp: [number, number];
    }
  | { t: number; type: 'skill'; src: 0 | 1; skill: string }
  | { t: number; type: 'heal'; src: 0 | 1; amount: number; skill?: string; hp: [number, number] }
  | { t: number; type: 'shield'; src: 0 | 1; amount: number; skill: string }
  | {
      t: number;
      type: 'buff';
      src: 0 | 1;
      target: 0 | 1;
      stat: BuffStat;
      mode: 'pct' | 'flat';
      value: number;
      skill: string;
    }
  | { t: number; type: 'tick'; hp: [number, number]; regen: [number, number] }
  | { t: number; type: 'phase'; phase: 'fatigue' | 'frenzy' }
  | { t: number; type: 'death'; who: 0 | 1 }
  | { t: number; type: 'end'; winner: 0 | 1 | null; reason: 'ko' | 'timeout' | 'draw' };

export interface FighterSummary {
  damageDealt: number;
  damageTaken: number;
  hits: number;
  crits: number;
  healing: number;
  shieldAbsorbed: number;
  skillsUsed: Record<string, number>;
  hpLeft: number;
  maxHp: number;
}

export interface BattleResult {
  engineVersion: string;
  seed: string;
  winner: 0 | 1 | null;
  reason: 'ko' | 'timeout' | 'draw';
  durationMs: number;
  events: BattleEvent[];
  summary: [FighterSummary, FighterSummary];
}
