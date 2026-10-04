import { MAX_LEVEL, STAT_POINTS_PER_LEVEL, xpToNext, ENERGY, EVOLUTION_REQ } from './config/progression.js';
import { RACES } from './config/races.js';
import { ATTR_KEYS, type Attributes, type Evolution, type RaceId } from './types.js';

export function totalStatPoints(level: number): number {
  return level * STAT_POINTS_PER_LEVEL;
}

export function spentPoints(attrs: Attributes): number {
  return ATTR_KEYS.reduce((s, k) => s + (attrs[k] ?? 0), 0);
}

export function freePoints(level: number, attrs: Attributes): number {
  return totalStatPoints(level) - spentPoints(attrs);
}

/** Apply XP gain. Returns the new level/xp and how many levels were gained. */
export function applyXp(level: number, xp: number, gained: number): { level: number; xp: number; levelsGained: number } {
  let L = level;
  let X = xp + Math.max(0, Math.floor(gained));
  const start = L;
  while (L < MAX_LEVEL && X >= xpToNext(L)) {
    X -= xpToNext(L);
    L += 1;
  }
  if (L >= MAX_LEVEL) X = 0;
  return { level: L, xp: X, levelsGained: L - start };
}

/** Validate a point allocation delta. Returns error or null. */
export function validateAllocation(level: number, current: Attributes, add: Partial<Attributes>): string | null {
  let total = 0;
  for (const [k, v] of Object.entries(add)) {
    if (!ATTR_KEYS.includes(k as never)) return `Unknown attribute: ${k}`;
    if (!Number.isInteger(v) || (v as number) < 0) return 'Points must be non-negative integers';
    total += v as number;
  }
  if (total === 0) return 'Nothing to allocate';
  if (total > freePoints(level, current)) return 'Not enough free points';
  return null;
}

/** Which skill slots are unlocked at an evolution stage. */
export function unlockedSkillSlots(evolution: Evolution): number {
  return evolution;
}

/** Validate a skill loadout: one choice per unlocked slot, from the race list. */
export function validateSkills(raceId: RaceId, evolution: Evolution, skills: string[]): string | null {
  const choices = RACES[raceId].skillChoices;
  if (skills.length !== unlockedSkillSlots(evolution)) return 'Wrong number of skills';
  for (let i = 0; i < skills.length; i++) {
    if (!choices[i].includes(skills[i])) return `Invalid skill for slot ${i + 1}`;
  }
  return null;
}

export function evolutionRequirement(current: Evolution) {
  if (current >= 3) return null;
  return EVOLUTION_REQ[(current + 1) as 2 | 3];
}

/** Current energy from stored value + elapsed time. Pure function of time. */
export function currentEnergy(stored: number, updatedAt: number, now: number): { energy: number; updatedAt: number } {
  if (stored >= ENERGY.max) return { energy: ENERGY.max, updatedAt: now };
  const gained = Math.floor((now - updatedAt) / ENERGY.regenMs);
  if (gained <= 0) return { energy: stored, updatedAt };
  const energy = Math.min(ENERGY.max, stored + gained);
  return { energy, updatedAt: energy >= ENERGY.max ? now : updatedAt + gained * ENERGY.regenMs };
}

export function eloChange(ratingA: number, ratingB: number, scoreA: number, k: number): number {
  const expected = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  return Math.round(k * (scoreA - expected));
}
