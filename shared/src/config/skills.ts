import type { SkillDef } from '../types.js';

// All skills are data. The combat engine only knows triggers + effects.
// Tuning a skill = editing numbers here, no engine changes.

const list: SkillDef[] = [
  // ---------------- TUSKAR (boar) ----------------
  {
    id: 'tusk_charge',
    name: 'Tusk Charge',
    kind: 'active',
    description: 'Every 4th hit: a charge for 180% physical attack.',
    trigger: { type: 'everyNthHit', n: 4 },
    effects: [{ type: 'damage', scale: 'patk', mult: 1.8, dmgType: 'phys' }],
  },
  {
    id: 'mud_wall',
    name: 'Mud Wall',
    kind: 'active',
    description: 'Every 8s: raise a shield worth 12% of max HP.',
    trigger: { type: 'cooldown', ms: 8000, firstMs: 3000 },
    effects: [{ type: 'shield', pctMaxHp: 12 }],
  },
  {
    id: 'thick_hide',
    name: 'Thick Hide',
    kind: 'passive',
    description: 'Permanent +15% physical defense and +12% magic defense.',
    trigger: { type: 'always' },
    effects: [
      { type: 'buff', target: 'self', stat: 'pdef', value: 15, durationMs: 0 },
      { type: 'buff', target: 'self', stat: 'mdef', value: 12, durationMs: 0 },
    ],
  },
  {
    id: 'last_stand',
    name: 'Last Stand',
    kind: 'passive',
    description: 'Below 35% HP: +35% physical attack and +15% attack speed until the end.',
    trigger: { type: 'hpBelow', pct: 35 },
    effects: [
      { type: 'buff', target: 'self', stat: 'patk', value: 35, durationMs: 0 },
      { type: 'buff', target: 'self', stat: 'aspd', value: 15, durationMs: 0 },
    ],
  },
  {
    id: 'earthquake_stomp',
    name: 'Earthquake Stomp',
    kind: 'ultimate',
    description: 'Every 12s: 250% physical damage and enemy attack speed -25% for 4s.',
    trigger: { type: 'cooldown', ms: 12000, firstMs: 6000 },
    effects: [
      { type: 'damage', scale: 'patk', mult: 2.5, dmgType: 'phys' },
      { type: 'buff', target: 'enemy', stat: 'aspd', value: -25, durationMs: 4000 },
    ],
  },
  {
    id: 'boar_heart',
    name: 'Boar Heart',
    kind: 'ultimate',
    description: 'Once, below 40% HP: heal 30% of max HP and gain +20% defenses.',
    trigger: { type: 'hpBelow', pct: 40 },
    effects: [
      { type: 'heal', pctMaxHp: 30 },
      { type: 'buff', target: 'self', stat: 'pdef', value: 20, durationMs: 0 },
      { type: 'buff', target: 'self', stat: 'mdef', value: 20, durationMs: 0 },
    ],
  },

  // ---------------- VEXA (fox) ----------------
  {
    id: 'twin_fang',
    name: 'Twin Fang',
    kind: 'active',
    description: 'Every 3rd hit: a second strike for 100% physical attack.',
    trigger: { type: 'everyNthHit', n: 3 },
    effects: [{ type: 'damage', scale: 'patk', mult: 1.0, dmgType: 'phys' }],
  },
  {
    id: 'fox_fire',
    name: 'Fox Fire',
    kind: 'active',
    description: 'Every 5s: a spirit flame for 150% magic damage.',
    trigger: { type: 'cooldown', ms: 5000, firstMs: 2500 },
    effects: [{ type: 'damage', scale: 'matk', mult: 1.5, dmgType: 'magic' }],
  },
  {
    id: 'hunters_focus',
    name: "Hunter's Focus",
    kind: 'passive',
    description: 'Permanent +8 crit chance and +20 crit damage.',
    trigger: { type: 'always' },
    effects: [
      { type: 'buff', target: 'self', stat: 'critChance', mode: 'flat', value: 8, durationMs: 0 },
      { type: 'buff', target: 'self', stat: 'critDmg', mode: 'flat', value: 20, durationMs: 0 },
    ],
  },
  {
    id: 'momentum',
    name: 'Momentum',
    kind: 'passive',
    description: 'After a critical hit: +20% attack speed for 3s.',
    trigger: { type: 'onCrit' },
    effects: [{ type: 'buff', target: 'self', stat: 'aspd', value: 20, durationMs: 3000 }],
  },
  {
    id: 'thousand_tails',
    name: 'Thousand Tails',
    kind: 'ultimate',
    description: 'Every 10s: 5 rapid strikes, each 45% physical attack.',
    trigger: { type: 'cooldown', ms: 10000, firstMs: 5000 },
    effects: [{ type: 'damage', scale: 'patk', mult: 0.45, dmgType: 'phys', hits: 5 }],
  },
  {
    id: 'mirage',
    name: 'Mirage',
    kind: 'ultimate',
    description: 'Once, below 50% HP: shield for 25% max HP and +40 crit damage for 6s.',
    trigger: { type: 'hpBelow', pct: 50 },
    effects: [
      { type: 'shield', pctMaxHp: 25 },
      { type: 'buff', target: 'self', stat: 'critDmg', mode: 'flat', value: 40, durationMs: 6000 },
    ],
  },

  // ---------------- HOOLU (owl) ----------------
  {
    id: 'moon_bolt',
    name: 'Moon Bolt',
    kind: 'active',
    description: 'Every 4s: a bolt of moonlight for 160% magic damage.',
    trigger: { type: 'cooldown', ms: 4000, firstMs: 2000 },
    effects: [{ type: 'damage', scale: 'matk', mult: 1.6, dmgType: 'magic' }],
  },
  {
    id: 'night_hush',
    name: 'Night Hush',
    kind: 'active',
    description: 'Every 5th hit: enemy defenses -20% for 5s.',
    trigger: { type: 'everyNthHit', n: 5 },
    effects: [
      { type: 'buff', target: 'enemy', stat: 'pdef', value: -20, durationMs: 5000 },
      { type: 'buff', target: 'enemy', stat: 'mdef', value: -20, durationMs: 5000 },
    ],
  },
  {
    id: 'feather_mend',
    name: 'Feather Mend',
    kind: 'passive',
    description: 'Every 3s: heal 2.5% of max HP.',
    trigger: { type: 'cooldown', ms: 3000, firstMs: 3000 },
    effects: [{ type: 'heal', pctMaxHp: 2.5 }],
  },
  {
    id: 'wise_eyes',
    name: 'Wise Eyes',
    kind: 'passive',
    description: 'Permanent +12% magic attack and +12% magic defense.',
    trigger: { type: 'always' },
    effects: [
      { type: 'buff', target: 'self', stat: 'matk', value: 12, durationMs: 0 },
      { type: 'buff', target: 'self', stat: 'mdef', value: 12, durationMs: 0 },
    ],
  },
  {
    id: 'starfall',
    name: 'Starfall',
    kind: 'ultimate',
    description: 'Every 12s: a falling star for 300% magic damage.',
    trigger: { type: 'cooldown', ms: 12000, firstMs: 6000 },
    effects: [{ type: 'damage', scale: 'matk', mult: 3.0, dmgType: 'magic' }],
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    kind: 'ultimate',
    description: 'Battle start: enemy healing -50% for the whole fight, and +10% magic attack.',
    trigger: { type: 'battleStart' },
    effects: [
      { type: 'buff', target: 'enemy', stat: 'healingTaken', value: -50, durationMs: 0 },
      { type: 'buff', target: 'self', stat: 'matk', value: 10, durationMs: 0 },
    ],
  },

  // ---------------- SET SKILLS (6-piece bonuses) ----------------
  {
    id: 'set_wild_renewal',
    name: 'Wild Renewal',
    kind: 'set',
    description: 'Wildheart 6-set: every 4s heal 3% of max HP.',
    trigger: { type: 'cooldown', ms: 4000, firstMs: 4000 },
    effects: [{ type: 'heal', pctMaxHp: 3 }],
  },
  {
    id: 'set_storm_strike',
    name: 'Storm Strike',
    kind: 'set',
    description: 'Stormclaw 6-set: every 6th hit unleashes lightning for 100% physical + 80% magic.',
    trigger: { type: 'everyNthHit', n: 6 },
    effects: [
      { type: 'damage', scale: 'patk', mult: 1.0, dmgType: 'phys' },
      { type: 'damage', scale: 'matk', mult: 0.8, dmgType: 'magic' },
    ],
  },
];

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(list.map((s) => [s.id, s]));
