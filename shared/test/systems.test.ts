import { describe, expect, it } from 'vitest';
import {
  ENERGY,
  MAX_LEVEL,
  PASSIVE,
  RACES,
  RARITY,
  SETS,
  STAT_CAPS,
  ZONE_BY_ID,
  applyXp,
  battleSkills,
  canEquip,
  computeStats,
  computeZoneRewards,
  createRng,
  currentEnergy,
  eloChange,
  emptyAttributes,
  freePoints,
  generateItem,
  itemBaseStats,
  salvageValue,
  upgradeCost,
  validateAllocation,
  validateSkills,
  xpToNext,
  type ItemInstance,
  type PetBuild,
} from '../src/index.js';

const baseBuild = (over: Partial<PetBuild> = {}): PetBuild => ({
  raceId: 'vexa',
  level: 1,
  evolution: 1,
  attributes: emptyAttributes(),
  equipped: [],
  skills: ['twin_fang'],
  ...over,
});

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng('x');
    const b = createRng('x');
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    expect(createRng('y').next()).not.toBe(createRng('x').next());
  });
});

describe('stats', () => {
  it('level 1 evo 1 with no gear equals race base', () => {
    expect(computeStats(baseBuild())).toMatchObject(RACES.vexa.base);
  });

  it('attribute points add stats', () => {
    const s0 = computeStats(baseBuild());
    const s1 = computeStats(baseBuild({ attributes: { ...emptyAttributes(), str: 3 } }));
    expect(s1.patk - s0.patk).toBeCloseTo(9);
  });

  it('evolution multiplies base stats but not crit/aspd', () => {
    const e1 = computeStats(baseBuild({ level: 30, evolution: 1 }));
    const e3 = computeStats(baseBuild({ level: 30, evolution: 3 }));
    expect(e3.hp / e1.hp).toBeCloseTo(1.3, 2);
    expect(e3.aspd).toBe(e1.aspd);
    expect(e3.critChance).toBe(e1.critChance);
  });

  it('crit chance is capped', () => {
    const s = computeStats(baseBuild({ level: 40, attributes: { ...emptyAttributes(), for: 120 } }));
    expect(s.critChance).toBe(STAT_CAPS.critChance);
  });

  it('pct bonuses multiply, flat bonuses add', () => {
    const item: ItemInstance = {
      id: 'i',
      templateId: 'claw_t1',
      rarity: 'common',
      upgrade: 0,
      bonuses: [
        { stat: 'patk', mode: 'pct', value: 10 },
        { stat: 'critChance', mode: 'flat', value: 5 },
      ],
      setId: null,
    };
    const s = computeStats(baseBuild({ equipped: [item] }));
    expect(s.patk).toBeCloseTo((RACES.vexa.base.patk + 10) * 1.1, 1);
    expect(s.critChance).toBe(RACES.vexa.base.critChance + 5);
  });

  it('external modifiers (future figurine bonuses) plug into the same pipeline', () => {
    const s0 = computeStats(baseBuild());
    const s1 = computeStats(baseBuild({ external: [{ stat: 'hp', mode: 'pct', value: 10 }] }));
    expect(s1.hp).toBeCloseTo(s0.hp * 1.1, 0);
  });
});

describe('items', () => {
  it('generation is deterministic and respects rarity bonus count', () => {
    for (const rarity of Object.keys(RARITY) as (keyof typeof RARITY)[]) {
      const a = generateItem(createRng('seed'), 'id', { tier: 2, rarity });
      const b = generateItem(createRng('seed'), 'id', { tier: 2, rarity });
      expect(a).toEqual(b);
      expect(a.bonuses.length).toBe(RARITY[rarity].bonuses);
      expect(new Set(a.bonuses.map((x) => x.stat)).size).toBe(a.bonuses.length);
    }
  });

  it('upgrades raise base stats and cost more each level', () => {
    const it0 = generateItem(createRng('u'), 'id', { tier: 1, rarity: 'common', baseId: 'claw' });
    const it5 = { ...it0, upgrade: 5 };
    expect(itemBaseStats(it5)[0].value).toBeGreaterThan(itemBaseStats(it0)[0].value);
    expect(upgradeCost(it5)!.gold).toBeGreaterThan(upgradeCost(it0)!.gold);
    expect(upgradeCost({ ...it0, upgrade: 9 })).toBeNull();
  });

  it('higher tiers need level and evolution', () => {
    const t3 = generateItem(createRng('t'), 'id', { tier: 3, rarity: 'common' });
    expect(canEquip(25, 1, t3)).toMatch(/evolution/);
    expect(canEquip(19, 2, t3)).toMatch(/level/);
    expect(canEquip(20, 2, t3)).toBeNull();
  });

  it('salvage gives ore', () => {
    const it = generateItem(createRng('s'), 'id', { tier: 2, rarity: 'rare' });
    expect(salvageValue(it).ore).toBeGreaterThan(0);
  });

  it('set bonuses apply at thresholds and 6 pieces add the set skill', () => {
    const slots = ['weapon', 'armor', 'helmet', 'boots', 'ring', 'charm'] as const;
    const pieces = slots.map((slot, i) =>
      generateItem(createRng(`p${i}`), `p${i}`, { tier: 1, rarity: 'common', slot, setId: 'wildheart' }),
    );
    const s2 = computeStats(baseBuild({ equipped: pieces.slice(0, 2) }));
    const s2noset = computeStats(baseBuild({ equipped: pieces.slice(0, 2).map((p) => ({ ...p, setId: null })) }));
    expect(s2.hp).toBeGreaterThan(s2noset.hp);
    expect(battleSkills(baseBuild({ equipped: pieces.slice(0, 5) }))).not.toContain(SETS.wildheart.pieces[2].skill);
    expect(battleSkills(baseBuild({ equipped: pieces }))).toContain('set_wild_renewal');
  });
});

describe('progression', () => {
  it('3 stat points per level', () => {
    expect(freePoints(1, emptyAttributes())).toBe(3);
    expect(freePoints(10, emptyAttributes())).toBe(30);
  });

  it('allocation validation blocks overspending and bad input', () => {
    expect(validateAllocation(1, emptyAttributes(), { str: 3 })).toBeNull();
    expect(validateAllocation(1, emptyAttributes(), { str: 4 })).toMatch(/Not enough/);
    expect(validateAllocation(1, emptyAttributes(), { str: -1 })).toBeTruthy();
    expect(validateAllocation(1, emptyAttributes(), { str: 1.5 })).toBeTruthy();
    expect(validateAllocation(1, emptyAttributes(), { hacks: 1 } as never)).toMatch(/Unknown/);
  });

  it('xp levels up across multiple levels and stops at max', () => {
    const r = applyXp(1, 0, xpToNext(1) + xpToNext(2) + 5);
    expect(r).toEqual({ level: 3, xp: 5, levelsGained: 2 });
    expect(applyXp(MAX_LEVEL, 0, 1e9).level).toBe(MAX_LEVEL);
  });

  it('skill loadout must match evolution and race', () => {
    expect(validateSkills('vexa', 1, ['twin_fang'])).toBeNull();
    expect(validateSkills('vexa', 1, ['moon_bolt'])).toBeTruthy();
    expect(validateSkills('vexa', 1, ['twin_fang', 'momentum'])).toBeTruthy();
    expect(validateSkills('vexa', 2, ['fox_fire', 'momentum'])).toBeNull();
  });

  it('energy regenerates over time up to max', () => {
    const now = 1_000_000_000;
    expect(currentEnergy(0, now - ENERGY.regenMs * 3 - 10, now).energy).toBe(3);
    expect(currentEnergy(0, now - ENERGY.regenMs * 100, now).energy).toBe(ENERGY.max);
    expect(currentEnergy(5, now, now).energy).toBe(5);
  });

  it('elo is zero-sum-ish and favors upsets', () => {
    expect(eloChange(1000, 1000, 1, 32)).toBe(16);
    expect(eloChange(1000, 1400, 1, 32)).toBeGreaterThan(eloChange(1400, 1000, 1, 32));
  });
});

describe('zones / passive income', () => {
  it('rewards scale with time and are capped', () => {
    const z = ZONE_BY_ID.forest;
    const h1 = computeZoneRewards(createRng('z'), z, 1, 3_600_000);
    const h8 = computeZoneRewards(createRng('z'), z, 1, PASSIVE.capMs);
    const h100 = computeZoneRewards(createRng('z'), z, 1, 100 * 3_600_000);
    expect(h8.gold).toBeGreaterThan(h1.gold * 5);
    expect(h100.gold).toBe(h8.gold);
    expect(h100.capped).toBe(true);
    expect(h100.items.length).toBeLessThanOrEqual(PASSIVE.maxItemsPerCollect);
  });

  it('nothing for zero time', () => {
    const r = computeZoneRewards(createRng('z'), ZONE_BY_ID.desert, 10, 0);
    expect(r.gold).toBe(0);
    expect(r.items.length).toBe(0);
  });
});
