// P.S.O. combat engine — pure, deterministic, server-authoritative.
// Same (fighters, seed, ENGINE_VERSION) => exactly the same BattleResult.
// The client only replays the event log; it never computes outcomes.

import { STAT_CAPS } from './config/progression.js';
import { SKILLS } from './config/skills.js';
import { createRng, type Rng } from './rng.js';
import type {
  BattleEvent,
  BattleResult,
  BuffStat,
  FighterSnapshot,
  FighterSummary,
  SkillDef,
  SkillEffect,
  Stats,
} from './types.js';

export const ENGINE_VERSION = '1.0.0';

export const COMBAT = {
  tickMs: 50,
  maxMs: 60_000,
  /** After this, all healing (regen, heals) is reduced — prevents regen stalemates. */
  fatigueAtMs: 25_000,
  fatigueHealMult: 0.4,
  /** After this, all damage is increased — fights always finish. */
  frenzyAtMs: 40_000,
  frenzyDamageMult: 2,
  /** Defense mitigation constant: damage * K / (K + def). */
  defK: 120,
  /** Damage variance +-5%. */
  variance: 0.05,
  /** Shields can't stack above this fraction of max HP. */
  maxShieldPct: 50,
};

interface Buff {
  key: string;
  stat: BuffStat;
  mode: 'pct' | 'flat';
  value: number;
  expiresAt: number;
}

interface SkillState {
  def: SkillDef;
  nextAt: number;
  used: boolean;
}

interface Fighter {
  idx: 0 | 1;
  snap: FighterSnapshot;
  base: Stats;
  maxHp: number;
  hp: number;
  shield: number;
  buffs: Buff[];
  attackTimer: number;
  hitCount: number;
  skills: SkillState[];
  sum: FighterSummary;
}

function makeSummary(maxHp: number): FighterSummary {
  return {
    damageDealt: 0,
    damageTaken: 0,
    hits: 0,
    crits: 0,
    healing: 0,
    shieldAbsorbed: 0,
    skillsUsed: {},
    hpLeft: maxHp,
    maxHp,
  };
}

export function simulateBattle(a: FighterSnapshot, b: FighterSnapshot, seed: string): BattleResult {
  const rng: Rng = createRng(`${ENGINE_VERSION}|${seed}`);
  const events: BattleEvent[] = [];
  let t = 0;
  let ended = false;
  let winner: 0 | 1 | null = null;
  let reason: BattleResult['reason'] = 'ko';

  const mk = (snap: FighterSnapshot, idx: 0 | 1): Fighter => {
    const maxHp = Math.max(1, Math.round(snap.stats.hp));
    const skills: SkillState[] = [];
    for (const id of snap.skills) {
      const def = SKILLS[id];
      if (!def) continue; // unknown skills are ignored, never crash a battle
      const nextAt = def.trigger.type === 'cooldown' ? (def.trigger.firstMs ?? def.trigger.ms) : 0;
      skills.push({ def, nextAt, used: false });
    }
    return {
      idx,
      snap,
      base: { ...snap.stats },
      maxHp,
      hp: maxHp,
      shield: 0,
      buffs: [],
      attackTimer: rng.int(0, 200),
      hitCount: 0,
      skills,
      sum: makeSummary(maxHp),
    };
  };

  const F: [Fighter, Fighter] = [mk(a, 0), mk(b, 1)];
  const hpPair = (): [number, number] => [F[0].hp, F[1].hp];

  const stat = (f: Fighter, k: BuffStat): number => {
    const base = k === 'healingTaken' || k === 'damageDealt' ? 1 : f.base[k];
    let flat = 0;
    let pct = 0;
    for (const bf of f.buffs) {
      if (bf.stat !== k || bf.expiresAt <= t) continue;
      if (bf.mode === 'flat') flat += bf.value;
      else pct += bf.value;
    }
    let v = (base + flat) * (1 + pct / 100);
    if (k === 'critChance') v = Math.min(v, STAT_CAPS.critChance);
    if (k === 'aspd') v = Math.max(STAT_CAPS.aspdMin, Math.min(v, STAT_CAPS.aspd));
    return Math.max(0, v);
  };

  const healMult = (f: Fighter) => stat(f, 'healingTaken') * (t >= COMBAT.fatigueAtMs ? COMBAT.fatigueHealMult : 1);

  const end = (w: 0 | 1 | null, r: BattleResult['reason']) => {
    ended = true;
    winner = w;
    reason = r;
  };

  const heal = (f: Fighter, raw: number, skill?: string) => {
    if (f.hp <= 0) return;
    const amount = Math.min(f.maxHp - f.hp, raw * healMult(f));
    if (amount <= 0) return;
    f.hp += amount;
    f.sum.healing += amount;
    if (skill) events.push({ t, type: 'heal', src: f.idx, amount: Math.round(amount), skill, hp: hpPair() });
  };

  const addBuff = (src: Fighter, target: Fighter, eff: Extract<SkillEffect, { type: 'buff' }>, skillId: string) => {
    const key = `${src.idx}:${skillId}:${eff.stat}`;
    target.buffs = target.buffs.filter((bf) => bf.key !== key); // refresh, never stack the same buff
    target.buffs.push({
      key,
      stat: eff.stat,
      mode: eff.mode ?? 'pct',
      value: eff.value,
      expiresAt: eff.durationMs > 0 ? t + eff.durationMs : Number.POSITIVE_INFINITY,
    });
    events.push({
      t,
      type: 'buff',
      src: src.idx,
      target: target.idx,
      stat: eff.stat,
      mode: eff.mode ?? 'pct',
      value: eff.value,
      skill: skillId,
    });
  };

  const checkHpTriggers = (f: Fighter) => {
    if (f.hp <= 0) return;
    for (const s of f.skills) {
      if (s.used || s.def.trigger.type !== 'hpBelow') continue;
      if ((f.hp / f.maxHp) * 100 < s.def.trigger.pct) {
        s.used = true;
        fireSkill(f, s.def);
      }
    }
  };

  const dealDamage = (
    src: Fighter,
    dst: Fighter,
    raw: number,
    dmgType: 'phys' | 'magic',
    skillId?: string,
  ) => {
    if (ended || dst.hp <= 0) return;
    let dmg = raw;
    const crit = rng.chance(stat(src, 'critChance') / 100);
    if (crit) dmg *= stat(src, 'critDmg') / 100;
    dmg *= stat(src, 'damageDealt');
    if (t >= COMBAT.frenzyAtMs) dmg *= COMBAT.frenzyDamageMult;
    const def = stat(dst, dmgType === 'phys' ? 'pdef' : 'mdef');
    dmg *= COMBAT.defK / (COMBAT.defK + def);
    dmg *= 1 - COMBAT.variance + rng.next() * COMBAT.variance * 2;
    const amount = Math.max(1, Math.round(dmg));

    const absorbed = Math.min(dst.shield, amount);
    dst.shield -= absorbed;
    const hpLoss = Math.min(dst.hp, amount - absorbed);
    dst.hp -= hpLoss;

    src.sum.damageDealt += amount;
    src.sum.hits += 1;
    if (crit) src.sum.crits += 1;
    dst.sum.damageTaken += hpLoss;
    dst.sum.shieldAbsorbed += absorbed;
    events.push({ t, type: 'hit', src: src.idx, amount, crit, absorbed, skill: skillId, hp: hpPair() });

    if (dst.hp <= 0) {
      dst.hp = 0;
      events.push({ t, type: 'death', who: dst.idx });
      end(src.idx, 'ko');
      return;
    }
    if (crit) {
      for (const s of src.skills) if (s.def.trigger.type === 'onCrit') fireSkill(src, s.def);
    }
    checkHpTriggers(dst);
  };

  function fireSkill(f: Fighter, def: SkillDef) {
    if (ended) return;
    const enemy = F[1 - f.idx];
    if (def.trigger.type !== 'always') {
      events.push({ t, type: 'skill', src: f.idx, skill: def.id });
      f.sum.skillsUsed[def.id] = (f.sum.skillsUsed[def.id] ?? 0) + 1;
    }
    for (const eff of def.effects) {
      if (ended) return;
      switch (eff.type) {
        case 'damage': {
          const hits = eff.hits ?? 1;
          for (let i = 0; i < hits && !ended; i++) {
            dealDamage(f, enemy, stat(f, eff.scale) * eff.mult, eff.dmgType, def.id);
          }
          break;
        }
        case 'heal':
          heal(f, (f.maxHp * eff.pctMaxHp) / 100, def.id);
          break;
        case 'shield': {
          const cap = (f.maxHp * COMBAT.maxShieldPct) / 100;
          const amount = Math.max(0, Math.min(cap - f.shield, (f.maxHp * eff.pctMaxHp) / 100));
          f.shield += amount;
          events.push({ t, type: 'shield', src: f.idx, amount: Math.round(amount), skill: def.id });
          break;
        }
        case 'buff':
          addBuff(f, eff.target === 'self' ? f : enemy, eff, def.id);
          break;
      }
    }
  }

  const basicAttack = (f: Fighter) => {
    const enemy = F[1 - f.idx];
    const patk = stat(f, 'patk');
    const matk = stat(f, 'matk');
    // Basic attacks use the pet's dominant attack type. Counter: stack the matching defense.
    if (matk > patk) dealDamage(f, enemy, matk, 'magic');
    else dealDamage(f, enemy, patk, 'phys');
    if (ended) return;
    f.hitCount += 1;
    for (const s of f.skills) {
      if (ended) return;
      if (s.def.trigger.type === 'everyNthHit' && f.hitCount % s.def.trigger.n === 0) fireSkill(f, s.def);
    }
  };

  const act = (f: Fighter) => {
    if (ended) return;
    for (const s of f.skills) {
      if (ended) return;
      if (s.def.trigger.type === 'cooldown' && t >= s.nextAt) {
        s.nextAt += s.def.trigger.ms;
        fireSkill(f, s.def);
      }
    }
    if (ended) return;
    f.attackTimer += COMBAT.tickMs;
    const interval = 100_000 / stat(f, 'aspd');
    if (f.attackTimer >= interval) {
      f.attackTimer -= interval;
      basicAttack(f);
    }
  };

  // ---- battle start ----
  events.push({ t: 0, type: 'start', hp: hpPair() });
  const first = rng.chance(0.5) ? 0 : 1;
  for (const f of first === 0 ? F : [F[1], F[0]]) {
    for (const s of f.skills) {
      if (s.def.trigger.type === 'always' || s.def.trigger.type === 'battleStart') fireSkill(f, s.def);
    }
  }

  // ---- main loop ----
  let tick = 0;
  let fatigueAnnounced = false;
  let frenzyAnnounced = false;
  while (!ended) {
    tick += 1;
    t = tick * COMBAT.tickMs;
    if (t > COMBAT.maxMs) break;
    if (!fatigueAnnounced && t >= COMBAT.fatigueAtMs) {
      fatigueAnnounced = true;
      events.push({ t, type: 'phase', phase: 'fatigue' });
    }
    if (!frenzyAnnounced && t >= COMBAT.frenzyAtMs) {
      frenzyAnnounced = true;
      events.push({ t, type: 'phase', phase: 'frenzy' });
    }

    const order: Fighter[] = (tick + first) % 2 === 0 ? [F[0], F[1]] : [F[1], F[0]];
    for (const f of order) act(f);
    if (ended) break;

    if (t % 1000 === 0) {
      const regen: [number, number] = [0, 0];
      for (const f of F) {
        const before = f.hp;
        heal(f, stat(f, 'regen'));
        regen[f.idx] = Math.round((f.hp - before) * 10) / 10;
      }
      events.push({ t, type: 'tick', hp: hpPair(), regen });
    }
  }

  if (!ended) {
    t = COMBAT.maxMs;
    const pa = F[0].hp / F[0].maxHp;
    const pb = F[1].hp / F[1].maxHp;
    if (Math.abs(pa - pb) < 1e-9) end(null, 'draw');
    else end(pa > pb ? 0 : 1, 'timeout');
  }
  events.push({ t, type: 'end', winner, reason });

  for (const f of F) {
    f.sum.hpLeft = Math.round(f.hp);
    f.sum.damageDealt = Math.round(f.sum.damageDealt);
    f.sum.damageTaken = Math.round(f.sum.damageTaken);
    f.sum.healing = Math.round(f.sum.healing);
    f.sum.shieldAbsorbed = Math.round(f.sum.shieldAbsorbed);
  }
  // Round hp values in events for compact storage.
  for (const e of events) if ('hp' in e) e.hp = [Math.round(e.hp[0]), Math.round(e.hp[1])];

  return {
    engineVersion: ENGINE_VERSION,
    seed,
    winner,
    reason,
    durationMs: t,
    events,
    summary: [F[0].sum, F[1].sum],
  };
}

/** Short human report: what mattered, not 200 lines. */
export function battleHighlights(r: BattleResult, names: [string, string]): string[] {
  const out: string[] = [];
  const [sa, sb] = r.summary;
  if (r.reason === 'draw') out.push('Perfectly even. Nobody fell.');
  else if (r.reason === 'timeout') out.push(`Time ran out — ${names[r.winner!]} had more HP left.`);
  else out.push(`${names[r.winner!]} knocked out ${names[1 - r.winner!]} in ${(r.durationMs / 1000).toFixed(1)}s.`);
  const biggest = r.events
    .filter((e): e is Extract<BattleEvent, { type: 'hit' }> => e.type === 'hit')
    .reduce<Extract<BattleEvent, { type: 'hit' }> | null>((m, e) => (!m || e.amount > m.amount ? e : m), null);
  if (biggest) out.push(`Biggest hit: ${biggest.amount}${biggest.crit ? ' (crit)' : ''} by ${names[biggest.src]}.`);
  for (const [i, s] of [sa, sb].entries()) {
    if (s.healing > s.maxHp * 0.25) out.push(`${names[i]} healed ${s.healing} HP.`);
    if (s.shieldAbsorbed > s.maxHp * 0.15) out.push(`${names[i]}'s shields blocked ${s.shieldAbsorbed} damage.`);
  }
  if (r.events.some((e) => e.type === 'phase' && e.phase === 'frenzy')) out.push('The fight went long enough for Frenzy.');
  return out;
}
