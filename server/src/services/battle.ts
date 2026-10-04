import { randomBytes } from 'node:crypto';
import {
  ENGINE_VERSION,
  PVP,
  battleHighlights,
  createRng,
  currentEnergy,
  eloChange,
  generateBot,
  simulateBattle,
  toSnapshot,
  type BattleResult,
  type FighterSnapshot,
} from '@pso/shared';
import { ApiError, audit, newId, notFound, type Ctx } from '../ctx.js';
import { tx } from '../db.js';
import { changeGold } from './economy.js';
import { recordEvent } from './missions.js';
import { addXp, buildOf, requirePet, type PetRow } from './pets.js';

const DAY = 24 * 60 * 60 * 1000;

export function energyOf(ctx: Ctx, userId: string) {
  const p = ctx.db.prepare('SELECT energy, energy_at FROM players WHERE user_id = ?').get(userId) as {
    energy: number;
    energy_at: number;
  };
  return currentEnergy(p.energy, p.energy_at, ctx.now());
}

interface Opponent {
  userId: string | null;
  rating: number;
  snapshot: FighterSnapshot;
}

/**
 * Async PvP: fight another player's current build (server-simulated).
 * Matchmaking uses rating + level windows, never Combat Power alone.
 * Opponents already fought too often in 24h are skipped (anti-farming).
 */
function findOpponent(ctx: Ctx, userId: string, pet: PetRow, rating: number): Opponent {
  const since = ctx.now() - DAY;
  for (const w of PVP.windows) {
    const rows = ctx.db
      .prepare(
        `SELECT p.*, pl.rating AS rating FROM players pl
         JOIN pets p ON p.id = pl.active_pet_id
         WHERE pl.user_id != ?
           AND pl.rating BETWEEN ? AND ?
           AND p.level BETWEEN ? AND ?
           AND (SELECT COUNT(*) FROM battles b WHERE b.attacker_id = ? AND b.defender_id = pl.user_id AND b.created_at > ?) < ?
         ORDER BY ABS(pl.rating - ?) LIMIT 8`,
      )
      .all(userId, rating - w.rating, rating + w.rating, pet.level - w.level, pet.level + w.level, userId, since, PVP.sameOpponentLimit, rating) as unknown as (PetRow & { rating: number })[];
    if (rows.length) {
      const pick = rows[Math.floor(Math.random() * rows.length)];
      return { userId: pick.user_id, rating: pick.rating, snapshot: toSnapshot(pick.name, pick.gender, buildOf(ctx, pick)) };
    }
  }
  // No suitable player: a bot near the player's level.
  const rng = createRng(randomBytes(8).toString('hex'));
  const level = Math.max(1, pet.level + rng.int(-1, 1));
  const bot = generateBot(rng, level);
  return { userId: null, rating, snapshot: toSnapshot(bot.name, bot.gender, bot.build) };
}

export function fight(ctx: Ctx, userId: string) {
  return tx(ctx.db, () => {
    const pet = requirePet(ctx, userId);
    const now = ctx.now();
    const en = energyOf(ctx, userId);
    if (en.energy < 1) throw new ApiError(400, 'no_energy', 'Your pet needs a rest. Energy refills over time.');
    ctx.db.prepare('UPDATE players SET energy = ?, energy_at = ? WHERE user_id = ?').run(en.energy - 1, en.updatedAt, userId);

    const me = ctx.db.prepare('SELECT rating FROM players WHERE user_id = ?').get(userId) as { rating: number };
    const mySnap = toSnapshot(pet.name, pet.gender, buildOf(ctx, pet));
    const opp = findOpponent(ctx, userId, pet, me.rating);

    const seed = randomBytes(16).toString('hex');
    const result = simulateBattle(mySnap, opp.snapshot, seed);
    const won = result.winner === 0;
    const draw = result.winner === null;

    // Rating (draw = 0.5). Bot fights move rating at half speed.
    const k = opp.userId ? PVP.eloK : PVP.eloK / 2;
    const delta = eloChange(me.rating, opp.rating, won ? 1 : draw ? 0.5 : 0, k);
    ctx.db
      .prepare('UPDATE players SET rating = MAX(0, rating + ?), wins = wins + ?, losses = losses + ? WHERE user_id = ?')
      .run(delta, won ? 1 : 0, !won && !draw ? 1 : 0, userId);
    if (opp.userId) {
      const dDef = Math.round(-delta * PVP.defenderFactor);
      ctx.db
        .prepare('UPDATE players SET rating = MAX(0, rating + ?), wins = wins + ?, losses = losses + ? WHERE user_id = ?')
        .run(dDef, !won && !draw ? 1 : 0, won ? 1 : 0, opp.userId);
    }

    const battleId = newId();
    const gold = won ? PVP.winGold(pet.level) : PVP.lossGold(pet.level);
    const xp = won ? PVP.winXp(pet.level) : PVP.lossXp(pet.level);
    changeGold(ctx, userId, gold, 'pvp', `battle:${battleId}`);
    const levelUp = addXp(ctx, userId, xp);
    const rewards = { gold, xp, rating: delta };

    ctx.db
      .prepare(
        `INSERT INTO battles (id, attacker_id, defender_id, is_bot, seed, engine_version, snap_a, snap_b, winner, reason, duration_ms, summary_json, events_json, rewards_json, rating_delta, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        battleId,
        userId,
        opp.userId,
        opp.userId ? 0 : 1,
        seed,
        ENGINE_VERSION,
        JSON.stringify(mySnap),
        JSON.stringify(opp.snapshot),
        result.winner,
        result.reason,
        result.durationMs,
        JSON.stringify(result.summary),
        JSON.stringify(result.events),
        JSON.stringify(rewards),
        delta,
        now,
      );

    recordEvent(ctx, userId, 'fight');
    if (won) recordEvent(ctx, userId, 'win');
    audit(ctx, userId, 'fight', { battleId, opponent: opp.userId ?? 'bot', winner: result.winner });

    return {
      battle: battleView(battleId, mySnap, opp.snapshot, result, !opp.userId),
      you: 0 as const,
      rewards,
      levelUp,
      energy: energyOf(ctx, userId),
    };
  });
}

function battleView(id: string, a: FighterSnapshot, b: FighterSnapshot, r: BattleResult, isBot: boolean) {
  return {
    id,
    fighters: [a, b] as [FighterSnapshot, FighterSnapshot],
    isBot,
    seed: r.seed,
    engineVersion: r.engineVersion,
    winner: r.winner,
    reason: r.reason,
    durationMs: r.durationMs,
    summary: r.summary,
    events: r.events,
    highlights: battleHighlights(r, [a.name, b.name]),
  };
}

interface BattleRow {
  id: string;
  attacker_id: string;
  defender_id: string | null;
  is_bot: number;
  seed: string;
  engine_version: string;
  snap_a: string;
  snap_b: string;
  winner: number | null;
  reason: BattleResult['reason'];
  duration_ms: number;
  summary_json: string;
  events_json: string;
  rewards_json: string;
  rating_delta: number;
  created_at: number;
}

function loadBattle(ctx: Ctx, userId: string, id: string): BattleRow {
  const row = ctx.db.prepare('SELECT * FROM battles WHERE id = ?').get(id) as BattleRow | undefined;
  if (!row || (row.attacker_id !== userId && row.defender_id !== userId)) throw notFound('Battle not found');
  return row;
}

export function getBattle(ctx: Ctx, userId: string, id: string) {
  const row = loadBattle(ctx, userId, id);
  const a = JSON.parse(row.snap_a) as FighterSnapshot;
  const b = JSON.parse(row.snap_b) as FighterSnapshot;
  const r: BattleResult = {
    engineVersion: row.engine_version,
    seed: row.seed,
    winner: row.winner as BattleResult['winner'],
    reason: row.reason,
    durationMs: row.duration_ms,
    summary: JSON.parse(row.summary_json),
    events: JSON.parse(row.events_json),
  };
  return {
    battle: battleView(row.id, a, b, r, !!row.is_bot),
    you: row.attacker_id === userId ? 0 : 1,
    rewards: row.attacker_id === userId ? JSON.parse(row.rewards_json) : null,
  };
}

/** Re-simulate a stored battle and compare. Proves the result wasn't tampered with. */
export function verifyBattle(ctx: Ctx, userId: string, id: string) {
  const row = loadBattle(ctx, userId, id);
  if (row.engine_version !== ENGINE_VERSION) {
    return { verified: null, reason: `Battle used engine ${row.engine_version}, server runs ${ENGINE_VERSION}` };
  }
  const r = simulateBattle(JSON.parse(row.snap_a), JSON.parse(row.snap_b), row.seed);
  const same =
    r.winner === row.winner && r.durationMs === row.duration_ms && JSON.stringify(r.events) === row.events_json;
  return { verified: same };
}

export function recentBattles(ctx: Ctx, userId: string) {
  const rows = ctx.db
    .prepare(
      `SELECT id, attacker_id, winner, reason, snap_a, snap_b, rating_delta, created_at FROM battles
       WHERE attacker_id = ? OR defender_id = ? ORDER BY created_at DESC LIMIT 20`,
    )
    .all(userId, userId) as unknown as BattleRow[];
  return rows.map((r) => {
    const you = r.attacker_id === userId ? 0 : 1;
    const opp = JSON.parse(you === 0 ? r.snap_b : r.snap_a) as FighterSnapshot;
    return {
      id: r.id,
      won: r.winner === you,
      draw: r.winner === null,
      defended: you === 1,
      opponent: { name: opp.name, raceId: opp.raceId, level: opp.level, evolution: opp.evolution },
      ratingDelta: you === 0 ? r.rating_delta : Math.round(-r.rating_delta * PVP.defenderFactor),
      at: r.created_at,
    };
  });
}
