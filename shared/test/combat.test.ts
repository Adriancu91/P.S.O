import { describe, expect, it } from 'vitest';
import {
  COMBAT,
  ENGINE_VERSION,
  createRng,
  emptyAttributes,
  generateBot,
  generateItem,
  simulateBattle,
  toSnapshot,
  type FighterSnapshot,
  type PetBuild,
  type Stats,
} from '../src/index.js';

function fighter(stats: Partial<Stats>, skills: string[] = [], name = 'F'): FighterSnapshot {
  return {
    name,
    raceId: 'tuskar',
    gender: 'm',
    level: 1,
    evolution: 1,
    stats: {
      hp: 1000,
      patk: 50,
      matk: 0,
      pdef: 0,
      mdef: 0,
      aspd: 100,
      critChance: 0,
      critDmg: 150,
      regen: 0,
      ...stats,
    },
    skills,
  };
}

describe('combat engine — determinism', () => {
  it('same fighters + same seed => identical result', () => {
    const a = generateBot(createRng('a'), 20);
    const b = generateBot(createRng('b'), 20);
    const sa = toSnapshot('A', 'm', a.build);
    const sb = toSnapshot('B', 'f', b.build);
    const r1 = simulateBattle(sa, sb, 'seed-123');
    const r2 = simulateBattle(sa, sb, 'seed-123');
    expect(JSON.stringify(r1)).toEqual(JSON.stringify(r2));
    expect(r1.engineVersion).toBe(ENGINE_VERSION);
  });

  it('different seeds can produce different logs', () => {
    const sa = fighter({ critChance: 30 });
    const sb = fighter({ critChance: 30 });
    const logs = new Set(
      Array.from({ length: 10 }, (_, i) => JSON.stringify(simulateBattle(sa, sb, `s${i}`).events)),
    );
    expect(logs.size).toBeGreaterThan(1);
  });

  it('does not mutate the input snapshots', () => {
    const sa = fighter({});
    const before = JSON.stringify(sa);
    simulateBattle(sa, fighter({}, ['tusk_charge']), 'x');
    expect(JSON.stringify(sa)).toBe(before);
  });
});

describe('combat engine — mechanics', () => {
  it('a much stronger fighter wins by KO and a death event is logged', () => {
    const r = simulateBattle(fighter({ patk: 500 }), fighter({ patk: 5 }), 'ko');
    expect(r.winner).toBe(0);
    expect(r.reason).toBe('ko');
    expect(r.events.some((e) => e.type === 'death' && e.who === 1)).toBe(true);
    expect(r.summary[1].hpLeft).toBe(0);
  });

  it('defense mitigates damage', () => {
    const noDef = simulateBattle(fighter({}), fighter({ pdef: 0, hp: 1e6 }), 'd');
    const def = simulateBattle(fighter({}), fighter({ pdef: 120, hp: 1e6 }), 'd');
    const avg = (r: typeof noDef) => r.summary[0].damageDealt / r.summary[0].hits;
    // K/(K+def) with def = K => half damage
    expect(avg(def) / avg(noDef)).toBeCloseTo(0.5, 1);
  });

  it('magic attackers are mitigated by magic defense, not physical', () => {
    const mage = fighter({ patk: 0, matk: 50 });
    const r1 = simulateBattle(mage, fighter({ pdef: 500, mdef: 0, hp: 1e6 }), 'm');
    const r2 = simulateBattle(mage, fighter({ pdef: 0, mdef: 500, hp: 1e6 }), 'm');
    expect(r1.summary[0].damageDealt).toBeGreaterThan(r2.summary[0].damageDealt * 3);
  });

  it('crit chance 0 => no crits; crit chance cap => many crits with crit damage', () => {
    const r0 = simulateBattle(fighter({ critChance: 0 }), fighter({ hp: 1e6 }), 'c');
    expect(r0.summary[0].crits).toBe(0);
    const r1 = simulateBattle(fighter({ critChance: 75, critDmg: 200 }), fighter({ hp: 1e6 }), 'c');
    expect(r1.summary[0].crits / r1.summary[0].hits).toBeGreaterThan(0.6);
    expect(r1.summary[0].damageDealt).toBeGreaterThan(r0.summary[0].damageDealt * 1.5);
  });

  it('attack speed scales number of hits', () => {
    const slow = simulateBattle(fighter({ aspd: 50 }), fighter({ hp: 1e6, patk: 0 }), 'a');
    const fast = simulateBattle(fighter({ aspd: 200 }), fighter({ hp: 1e6, patk: 0 }), 'a');
    expect(fast.summary[0].hits / slow.summary[0].hits).toBeCloseTo(4, 0);
  });

  it('regeneration heals over time and is reduced by fatigue', () => {
    const r = simulateBattle(fighter({ patk: 200 }), fighter({ hp: 1e5, regen: 50, patk: 1 }), 'r');
    expect(r.summary[1].healing).toBeGreaterThan(0);
    const ticks = r.events.filter((e) => e.type === 'tick') as { t: number; regen: [number, number] }[];
    const early = ticks.find((e) => e.t === 10_000)!;
    const late = ticks.find((e) => e.t === 30_000)!;
    expect(late.regen[1]).toBeLessThanOrEqual(early.regen[1] * COMBAT.fatigueHealMult + 0.5);
  });

  it('timeout with equal HP is a draw', () => {
    // Both deal 1 damage and regen it back every second: both end full HP.
    const r = simulateBattle(fighter({ patk: 0, regen: 1000 }), fighter({ patk: 0, regen: 1000 }), 'draw');
    expect(r.reason).toBe('draw');
    expect(r.winner).toBeNull();
    expect(r.durationMs).toBe(COMBAT.maxMs);
  });

  it('frenzy guarantees long fights end', () => {
    const tanky = fighter({ hp: 5000, pdef: 400, regen: 20, patk: 40 });
    const r = simulateBattle(tanky, tanky, 'long');
    expect(r.durationMs).toBeLessThanOrEqual(COMBAT.maxMs);
    expect(r.events.at(-1)!.type).toBe('end');
  });
});

describe('combat engine — skills', () => {
  it('everyNthHit fires on the right hits (Tusk Charge every 4th)', () => {
    const r = simulateBattle(fighter({}, ['tusk_charge']), fighter({ hp: 1e6, patk: 0 }), 'n');
    const basic = r.summary[0].hits - (r.summary[0].skillsUsed['tusk_charge'] ?? 0);
    expect(r.summary[0].skillsUsed['tusk_charge']).toBe(Math.floor(basic / 4));
  });

  it('cooldown skills fire on schedule (Moon Bolt every 4s, first at 2s)', () => {
    const r = simulateBattle(fighter({ matk: 50 }, ['moon_bolt']), fighter({ hp: 1e6, patk: 0 }), 'cd');
    const times = r.events.filter((e) => e.type === 'skill').map((e) => e.t);
    expect(times.slice(0, 3)).toEqual([2000, 6000, 10000]);
  });

  it('hpBelow triggers exactly once (Boar Heart)', () => {
    const r = simulateBattle(fighter({ hp: 2000, patk: 1 }, ['boar_heart']), fighter({ patk: 60 }), 'hp');
    expect(r.summary[0].skillsUsed['boar_heart']).toBe(1);
  });

  it('shields absorb damage (Mud Wall)', () => {
    const r = simulateBattle(fighter({ patk: 1 }, ['mud_wall']), fighter({ patk: 60 }), 'sh');
    expect(r.summary[0].shieldAbsorbed).toBeGreaterThan(0);
  });

  it('Eclipse reduces enemy healing', () => {
    const healer = fighter({ hp: 1e5, regen: 100, patk: 1 });
    const without = simulateBattle(fighter({ matk: 300 }), healer, 'e');
    const withEclipse = simulateBattle(fighter({ matk: 300 }, ['eclipse']), healer, 'e');
    expect(withEclipse.summary[1].healing).toBeLessThan(without.summary[1].healing * 0.6);
  });

  it('enemy debuffs apply (Night Hush lowers defense)', () => {
    const target = fighter({ hp: 1e6, pdef: 200, patk: 0 });
    const plain = simulateBattle(fighter({}), target, 'nh');
    const hush = simulateBattle(fighter({}, ['night_hush']), target, 'nh');
    expect(hush.summary[0].damageDealt).toBeGreaterThan(plain.summary[0].damageDealt);
  });

  it('unknown skills are ignored instead of crashing', () => {
    expect(() => simulateBattle(fighter({}, ['does_not_exist']), fighter({}), 'u')).not.toThrow();
  });
});

describe('competitive principle: level is not a guaranteed win', () => {
  it('a level-20 magic build beats a level-24 physical-defense stacker most of the time', () => {
    const rng = createRng('counter');
    const mage: PetBuild = {
      raceId: 'hoolu',
      level: 20,
      evolution: 2,
      attributes: { ...emptyAttributes(), int: 40, vit: 20 },
      skills: ['moon_bolt', 'wise_eyes'],
      equipped: [
        generateItem(rng, 'm1', { tier: 2, rarity: 'uncommon', baseId: 'orb' }),
        generateItem(rng, 'm2', { tier: 2, rarity: 'uncommon', baseId: 'robe' }),
      ],
    };
    const wall: PetBuild = {
      raceId: 'tuskar',
      level: 24,
      evolution: 2,
      attributes: { ...emptyAttributes(), grd: 36, vit: 36 },
      skills: ['tusk_charge', 'thick_hide'],
      equipped: [
        generateItem(rng, 'w1', { tier: 2, rarity: 'uncommon', baseId: 'claw' }),
        generateItem(rng, 'w2', { tier: 2, rarity: 'uncommon', baseId: 'plate' }),
        generateItem(rng, 'w3', { tier: 2, rarity: 'uncommon', baseId: 'helm' }),
      ],
    };
    let wins = 0;
    const N = 60;
    for (let i = 0; i < N; i++) {
      const r = simulateBattle(toSnapshot('Mage', 'f', mage), toSnapshot('Wall', 'm', wall), `c${i}`);
      if (r.winner === 0) wins++;
    }
    expect(wins / N).toBeGreaterThan(0.5);
  });
});
