import {
  ENERGY,
  RACES,
  combatPower,
  computeStats,
  evolutionRequirement,
  freePoints,
  respecCost,
  upgradeCost,
  xpToNext,
  activeSetBonuses,
  battleSkills,
} from '@pso/shared';
import type { Ctx } from '../ctx.js';
import { getMaterials, rowToItem, type ItemRow } from './economy.js';
import { energyOf } from './battle.js';
import { missionView } from './missions.js';
import { buildOf, getActivePet } from './pets.js';
import { zoneStatus } from './zones.js';

/** Everything the client needs to render the game. Derived values are computed here, server-side. */
export function getState(ctx: Ctx, userId: string, username: string) {
  const player = ctx.db
    .prepare('SELECT gold, rating, wins, losses FROM players WHERE user_id = ?')
    .get(userId) as { gold: number; rating: number; wins: number; losses: number };
  const pet = getActivePet(ctx, userId);
  const items = (ctx.db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC').all(userId) as unknown as ItemRow[]).map(
    (r) => {
      const it = rowToItem(r);
      return { ...it, upgradeCost: upgradeCost(it) };
    },
  );
  const energy = energyOf(ctx, userId);
  const base = {
    user: { id: userId, username },
    gold: player.gold,
    rating: player.rating,
    wins: player.wins,
    losses: player.losses,
    energy: { current: energy.energy, max: ENERGY.max, nextAt: energy.energy >= ENERGY.max ? null : energy.updatedAt + ENERGY.regenMs },
    materials: getMaterials(ctx, userId),
    items,
    mission: missionView(ctx, userId),
    serverTime: ctx.now(),
  };
  if (!pet) return { ...base, pet: null };
  const build = buildOf(ctx, pet);
  const stats = computeStats(build);
  return {
    ...base,
    pet: {
      id: pet.id,
      name: pet.name,
      raceId: pet.race,
      gender: pet.gender,
      level: pet.level,
      xp: pet.xp,
      xpToNext: xpToNext(pet.level),
      evolution: pet.evolution,
      stageName: RACES[pet.race].stageNames[pet.evolution - 1],
      attributes: build.attributes,
      freePoints: freePoints(pet.level, build.attributes),
      skills: build.skills,
      battleSkills: battleSkills(build),
      sets: activeSetBonuses(build.equipped).map((s) => ({ setId: s.setId, count: s.count })),
      stats,
      combatPower: combatPower(stats),
      respecCost: respecCost(pet.level),
      nextEvolution: evolutionRequirement(pet.evolution),
      zone: zoneStatus(ctx, pet),
    },
  };
}
