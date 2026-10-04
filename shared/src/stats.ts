import { SETS } from './config/items.js';
import { ATTRIBUTES, STAT_CAPS } from './config/progression.js';
import { EVOLUTION_STAT_MULT, RACES } from './config/races.js';
import { itemModifiers, getTemplate } from './items.js';
import {
  ATTR_KEYS,
  STAT_KEYS,
  type Attributes,
  type Evolution,
  type ItemInstance,
  type Modifier,
  type RaceId,
  type Stats,
} from './types.js';

export interface PetBuild {
  raceId: RaceId;
  level: number;
  evolution: Evolution;
  attributes: Attributes;
  equipped: ItemInstance[];
  /** Chosen race skills. */
  skills: string[];
  /**
   * Extra modifiers from outside the pet itself. Reserved for future systems
   * (e.g. physical figurine codes -> account bonus). Same format as gear.
   */
  external?: Modifier[];
}

export function emptyStats(): Stats {
  return Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Stats;
}

export function emptyAttributes(): Attributes {
  return Object.fromEntries(ATTR_KEYS.map((k) => [k, 0])) as Attributes;
}

export function baseStats(raceId: RaceId, level: number, evolution: Evolution): Stats {
  const race = RACES[raceId];
  const mult = EVOLUTION_STAT_MULT[evolution];
  const out = emptyStats();
  for (const k of STAT_KEYS) {
    const grown = race.base[k] + (race.growth[k] ?? 0) * (level - 1);
    // Percent-like stats (crit, aspd) don't get the evolution multiplier.
    const scales = k !== 'critChance' && k !== 'critDmg' && k !== 'aspd';
    out[k] = scales ? grown * mult : grown;
  }
  return out;
}

export function attributeModifiers(attributes: Attributes): Modifier[] {
  const mods: Modifier[] = [];
  for (const k of ATTR_KEYS) {
    const pts = attributes[k] ?? 0;
    if (!pts) continue;
    for (const g of ATTRIBUTES[k].gives) mods.push({ stat: g.stat, mode: g.mode, value: g.value * pts });
  }
  return mods;
}

export function activeSetBonuses(equipped: ItemInstance[]): { setId: string; count: number; mods: Modifier[]; skills: string[] }[] {
  const counts: Record<string, number> = {};
  for (const it of equipped) if (it.setId) counts[it.setId] = (counts[it.setId] ?? 0) + 1;
  return Object.entries(counts)
    .filter(([id]) => SETS[id])
    .map(([setId, count]) => {
      const mods: Modifier[] = [];
      const skills: string[] = [];
      for (const p of SETS[setId].pieces) {
        if (count >= p.count) {
          mods.push(...p.mods);
          if (p.skill) skills.push(p.skill);
        }
      }
      return { setId, count, mods, skills };
    });
}

export function applyModifiers(base: Stats, mods: Modifier[]): Stats {
  const flat = emptyStats();
  const pct = emptyStats();
  for (const m of mods) {
    if (m.mode === 'flat') flat[m.stat] += m.value;
    else pct[m.stat] += m.value;
  }
  const out = emptyStats();
  for (const k of STAT_KEYS) out[k] = (base[k] + flat[k]) * (1 + pct[k] / 100);
  out.critChance = Math.min(out.critChance, STAT_CAPS.critChance);
  out.aspd = Math.max(STAT_CAPS.aspdMin, Math.min(out.aspd, STAT_CAPS.aspd));
  for (const k of STAT_KEYS) out[k] = Math.round(out[k] * 10) / 10;
  return out;
}

/** Final pre-battle stats. Server uses this as the single source of truth. */
export function computeStats(build: PetBuild): Stats {
  const mods: Modifier[] = [...attributeModifiers(build.attributes)];
  for (const it of build.equipped) mods.push(...itemModifiers(it));
  for (const s of activeSetBonuses(build.equipped)) mods.push(...s.mods);
  if (build.external) mods.push(...build.external);
  return applyModifiers(baseStats(build.raceId, build.level, build.evolution), mods);
}

/** Skills that will be active in battle: chosen race skills + set skills. */
export function battleSkills(build: PetBuild): string[] {
  const set = activeSetBonuses(build.equipped).flatMap((s) => s.skills);
  return [...build.skills, ...set];
}

/** Single indicative number for UI. NOT used alone for matchmaking. */
export function combatPower(s: Stats): number {
  const critFactor = 1 + (Math.min(s.critChance, 75) / 100) * ((s.critDmg - 100) / 100);
  const dps = (s.patk + s.matk) * (s.aspd / 100) * critFactor;
  const ehp = s.hp * (1 + (s.pdef + s.mdef) / 200) + s.regen * 30;
  return Math.round(Math.sqrt(dps * ehp) * 2);
}

/** Can this pet equip this item? Returns an error message or null. */
export function canEquip(level: number, evolution: number, item: ItemInstance): string | null {
  const tpl = getTemplate(item.templateId);
  if (level < tpl.levelReq) return `Requires level ${tpl.levelReq}`;
  if (evolution < tpl.evolutionReq) return `Requires evolution ${tpl.evolutionReq}`;
  return null;
}

/** The frozen picture of a pet that goes into a battle (and is stored for replay/verification). */
export function toSnapshot(name: string, gender: 'm' | 'f', build: PetBuild): import('./types.js').FighterSnapshot {
  return {
    name,
    raceId: build.raceId,
    gender,
    level: build.level,
    evolution: build.evolution,
    stats: computeStats(build),
    skills: battleSkills(build),
  };
}
