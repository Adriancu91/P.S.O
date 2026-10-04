import { DISCOVERY_MISSIONS, type MissionDef, type MissionEvent } from '@pso/shared';
import { ApiError, audit, type Ctx } from '../ctx.js';
import { tx } from '../db.js';
import { changeGold, changeMaterial, grantItem } from './economy.js';
import { addXp, getActivePet } from './pets.js';

interface MissionRow {
  idx: number;
  progress: number;
}

function row(ctx: Ctx, userId: string): MissionRow {
  return ctx.db.prepare('SELECT idx, progress FROM missions WHERE user_id = ?').get(userId) as unknown as MissionRow;
}

export interface MissionView {
  id: string;
  title: string;
  hint: string;
  screen: MissionDef['screen'];
  progress: number;
  count: number;
  done: boolean;
  reward: MissionDef['reward'];
  number: number;
  total: number;
}

export function missionView(ctx: Ctx, userId: string): MissionView | null {
  const r = row(ctx, userId);
  const def = DISCOVERY_MISSIONS[r.idx];
  if (!def) return null;
  return {
    id: def.id,
    title: def.title,
    hint: def.hint,
    screen: def.screen,
    progress: Math.min(r.progress, def.count),
    count: def.count,
    done: r.progress >= def.count,
    reward: def.reward,
    number: r.idx + 1,
    total: DISCOVERY_MISSIONS.length,
  };
}

/** Called by game services when something happens. Only the active mission listens. */
export function recordEvent(ctx: Ctx, userId: string, event: MissionEvent, value = 1) {
  const r = row(ctx, userId);
  const def = DISCOVERY_MISSIONS[r.idx];
  if (!def || def.event !== event || r.progress >= def.count) return;
  const progress = event === 'level' ? Math.max(r.progress, value) : r.progress + value;
  ctx.db.prepare('UPDATE missions SET progress = ? WHERE user_id = ?').run(progress, userId);
}

/** Events the client may report (purely UI events with no economic value). */
export const CLIENT_EVENTS: MissionEvent[] = ['open_pet'];

export function claimMission(ctx: Ctx, userId: string) {
  return tx(ctx.db, () => {
    const r = row(ctx, userId);
    const def = DISCOVERY_MISSIONS[r.idx];
    if (!def) throw new ApiError(400, 'no_mission', 'No active mission');
    if (r.progress < def.count) throw new ApiError(400, 'mission_not_done', 'Not done yet');
    const ref = `mission:${def.id}`;
    const rw = def.reward;
    if (rw.gold) changeGold(ctx, userId, rw.gold, 'mission', ref);
    if (rw.ore) changeMaterial(ctx, userId, 'ore', rw.ore, 'mission', ref);
    let item = null;
    if (rw.item) item = grantItem(ctx, userId, { tier: rw.item.tier, rarity: rw.item.rarity }, 'mission', ref);
    let levelUp = null;
    if (rw.xp) levelUp = addXp(ctx, userId, rw.xp);

    // Advance. A 'level' mission starts with the current level as progress.
    const nextIdx = r.idx + 1;
    const next = DISCOVERY_MISSIONS[nextIdx];
    const pet = getActivePet(ctx, userId);
    const startProgress = next?.event === 'level' && pet ? pet.level : 0;
    ctx.db.prepare('UPDATE missions SET idx = ?, progress = ? WHERE user_id = ?').run(nextIdx, startProgress, userId);
    audit(ctx, userId, 'mission_claim', { mission: def.id });
    return { claimed: def.id, reward: rw, item, levelUp };
  });
}
