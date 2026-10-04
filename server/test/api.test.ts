import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DISCOVERY_MISSIONS, ENERGY, PASSIVE, PVP } from '@pso/shared';
import { buildApp } from '../src/app.js';

let clock = 1_700_000_000_000;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  clock = 1_700_000_000_000;
  app = await buildApp({ now: () => clock, rateLimits: false });
});
afterEach(async () => {
  await app.close();
});

async function call(method: 'GET' | 'POST', url: string, token?: string, payload?: unknown, headers: Record<string, string> = {}) {
  const res = await app.inject({
    method,
    url,
    payload: payload as never,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
  });
  return { status: res.statusCode, body: res.json() as any, headers: res.headers };
}

let userN = 0;
async function newPlayer(race = 'tuskar') {
  const username = `player${++userN}`;
  const r = await call('POST', '/api/auth/register', undefined, { username, password: 'password123' });
  expect(r.status).toBe(200);
  const token = r.body.token as string;
  const p = await call('POST', '/api/pet', token, { name: `Pet${userN}`, race, gender: 'f' });
  expect(p.status).toBe(200);
  return { token, userId: r.body.userId as string, username };
}

const me = async (token: string) => (await call('GET', '/api/me', token)).body;

function grant(userId: string, gold: number, ore = 0) {
  const db = app.ctx.db;
  db.prepare('UPDATE players SET gold = gold + ? WHERE user_id = ?').run(gold, userId);
  db.prepare('INSERT INTO ledger (user_id, asset, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, 'gold', gold, 'test', clock);
  if (ore)
    db.prepare(
      'INSERT INTO materials (user_id, material, amount) VALUES (?, ?, ?) ON CONFLICT(user_id, material) DO UPDATE SET amount = amount + excluded.amount',
    ).run(userId, 'ore', ore);
}

describe('auth', () => {
  it('register, login, reject bad password, reject duplicate', async () => {
    const r = await call('POST', '/api/auth/register', undefined, { username: 'Alice_1', password: 'supersecret' });
    expect(r.status).toBe(200);
    expect((await call('POST', '/api/auth/register', undefined, { username: 'alice_1', password: 'supersecret' })).status).toBe(409);
    expect((await call('POST', '/api/auth/login', undefined, { username: 'Alice_1', password: 'wrongwrong' })).status).toBe(401);
    const ok = await call('POST', '/api/auth/login', undefined, { username: 'Alice_1', password: 'supersecret' });
    expect(ok.status).toBe(200);
    expect((await call('GET', '/api/me', ok.body.token)).status).toBe(200);
  });

  it('rejects weak input and unauthenticated access', async () => {
    expect((await call('POST', '/api/auth/register', undefined, { username: 'a', password: 'supersecret' })).status).toBe(400);
    expect((await call('POST', '/api/auth/register', undefined, { username: 'bob', password: 'short' })).status).toBe(400);
    expect((await call('GET', '/api/me')).status).toBe(401);
    expect((await call('GET', '/api/me', 'forged-token')).status).toBe(401);
  });

  it('logout invalidates the token', async () => {
    const { token } = await newPlayer();
    await call('POST', '/api/auth/logout', token);
    expect((await call('GET', '/api/me', token)).status).toBe(401);
  });

  it('passwords are not stored in plain text', async () => {
    await call('POST', '/api/auth/register', undefined, { username: 'carol', password: 'mypassword9' });
    const row = app.ctx.db.prepare('SELECT pass_hash FROM users WHERE username = ?').get('carol') as { pass_hash: string };
    expect(row.pass_hash).not.toContain('mypassword9');
    expect(row.pass_hash.startsWith('scrypt$')).toBe(true);
  });
});

describe('pet', () => {
  it('creates a pet with starter weapon equipped and 3 free points', async () => {
    const { token } = await newPlayer('hoolu');
    const s = await me(token);
    expect(s.pet.raceId).toBe('hoolu');
    expect(s.pet.level).toBe(1);
    expect(s.pet.freePoints).toBe(3);
    expect(s.items.filter((i: any) => i.equipped)).toHaveLength(1);
    expect(s.items[0].templateId).toBe('orb_t1');
    expect(s.gold).toBe(100);
  });

  it('only one pet, valid race/gender/name', async () => {
    const { token } = await newPlayer();
    expect((await call('POST', '/api/pet', token, { name: 'Again', race: 'vexa', gender: 'm' })).status).toBe(409);
    const r = await call('POST', '/api/auth/register', undefined, { username: 'xx_new', password: 'password123' });
    const t = r.body.token;
    expect((await call('POST', '/api/pet', t, { name: 'Ok', race: 'dragon', gender: 'm' })).status).toBe(400);
    expect((await call('POST', '/api/pet', t, { name: 'Ok', race: 'vexa', gender: 'x' })).status).toBe(400);
    expect((await call('POST', '/api/pet', t, { name: '<script>', race: 'vexa', gender: 'm' })).status).toBe(400);
  });

  it('stat allocation cannot exceed free points or use fake attributes', async () => {
    const { token } = await newPlayer();
    expect((await call('POST', '/api/pet/allocate', token, { add: { str: 4 } })).status).toBe(400);
    expect((await call('POST', '/api/pet/allocate', token, { add: { str: -5, vit: 8 } })).status).toBe(400);
    expect((await call('POST', '/api/pet/allocate', token, { add: { godmode: 1 } })).status).toBe(400);
    const ok = await call('POST', '/api/pet/allocate', token, { add: { str: 2, vit: 1 } });
    expect(ok.status).toBe(200);
    const s = await me(token);
    expect(s.pet.freePoints).toBe(0);
    expect(s.pet.attributes.str).toBe(2);
  });

  it('skills must be valid for race and evolution', async () => {
    const { token } = await newPlayer('tuskar');
    expect((await call('POST', '/api/pet/skills', token, { skills: ['mud_wall'] })).status).toBe(200);
    expect((await call('POST', '/api/pet/skills', token, { skills: ['moon_bolt'] })).status).toBe(400);
    expect((await call('POST', '/api/pet/skills', token, { skills: ['mud_wall', 'thick_hide'] })).status).toBe(400);
  });

  it('evolution needs level, gold and essence', async () => {
    const { token } = await newPlayer();
    const r = await call('POST', '/api/pet/evolve', token);
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('level_too_low');
  });
});

describe('battle', () => {
  it('fight is simulated server-side, stored, verifiable, and consumes energy', async () => {
    const { token } = await newPlayer();
    // Any client-supplied "result" is ignored.
    const r = await call('POST', '/api/battle/fight', token, { winner: 0, gold: 999999 });
    expect(r.status).toBe(200);
    const b = r.body.battle;
    expect(b.events.at(-1).type).toBe('end');
    expect(r.body.rewards.gold).toBeLessThan(1000);
    expect(r.body.energy.energy).toBe(ENERGY.max - 1);
    const v = await call('GET', `/api/battle/${b.id}/verify`, token);
    expect(v.body.verified).toBe(true);
    const again = await call('GET', `/api/battle/${b.id}`, token);
    expect(again.body.battle.events).toEqual(b.events);
  });

  it('tampering with a stored battle is detected by verification', async () => {
    const { token } = await newPlayer();
    const r = await call('POST', '/api/battle/fight', token);
    app.ctx.db.prepare('UPDATE battles SET winner = 1 - COALESCE(winner, 0) WHERE id = ?').run(r.body.battle.id);
    const v = await call('GET', `/api/battle/${r.body.battle.id}/verify`, token);
    expect(v.body.verified).toBe(false);
  });

  it('energy runs out and refills over time', async () => {
    const { token } = await newPlayer();
    for (let i = 0; i < ENERGY.max; i++) expect((await call('POST', '/api/battle/fight', token)).status).toBe(200);
    const no = await call('POST', '/api/battle/fight', token);
    expect(no.status).toBe(400);
    expect(no.body.error).toBe('no_energy');
    clock += ENERGY.regenMs;
    expect((await call('POST', '/api/battle/fight', token)).status).toBe(200);
  });

  it('other players cannot read my battles', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const r = await call('POST', '/api/battle/fight', a.token);
    const peek = await call('GET', `/api/battle/${r.body.battle.id}`, b.token);
    // b may have been the defender — only then can b see it.
    const row = app.ctx.db.prepare('SELECT defender_id FROM battles WHERE id = ?').get(r.body.battle.id) as { defender_id: string | null };
    expect(peek.status).toBe(row.defender_id === b.userId ? 200 : 404);
  });

  it('matches real players, updates both ratings, and stops farming the same opponent', async () => {
    const a = await newPlayer('vexa');
    const b = await newPlayer('tuskar');
    const ratingB0 = (await me(b.token)).rating;
    const opponents: (string | null)[] = [];
    for (let i = 0; i < PVP.sameOpponentLimit + 2; i++) {
      const r = await call('POST', '/api/battle/fight', a.token);
      const row = app.ctx.db.prepare('SELECT defender_id FROM battles WHERE id = ?').get(r.body.battle.id) as { defender_id: string | null };
      opponents.push(row.defender_id);
    }
    expect(opponents.filter((o) => o === b.userId).length).toBe(PVP.sameOpponentLimit);
    expect(opponents.slice(PVP.sameOpponentLimit).every((o) => o === null)).toBe(true); // bots afterwards
    expect((await me(b.token)).rating).not.toBe(ratingB0);
  });
});

describe('items & economy', () => {
  it('upgrade costs gold and ore, cannot go negative', async () => {
    const { token, userId } = await newPlayer();
    const weapon = (await me(token)).items[0];
    const noOre = await call('POST', `/api/items/${weapon.id}/upgrade`, token);
    expect(noOre.status).toBe(400);
    grant(userId, 0, 100);
    const ok = await call('POST', `/api/items/${weapon.id}/upgrade`, token);
    expect(ok.status).toBe(200);
    const s = await me(token);
    expect(s.items[0].upgrade).toBe(1);
    expect(s.gold).toBe(100 - ok.body.cost.gold);
    expect(s.materials.ore).toBe(100 - ok.body.cost.ore);
  });

  it('idempotency key: a replayed request does not charge twice', async () => {
    const { token, userId } = await newPlayer();
    grant(userId, 5000, 500);
    const weapon = (await me(token)).items[0];
    const h = { 'idempotency-key': 'abc-123' };
    const r1 = await call('POST', `/api/items/${weapon.id}/upgrade`, token, undefined, h);
    const r2 = await call('POST', `/api/items/${weapon.id}/upgrade`, token, undefined, h);
    expect(r1.body).toEqual(r2.body);
    expect(r2.headers['idempotent-replay']).toBe('true');
    expect((await me(token)).items[0].upgrade).toBe(1);
  });

  it('concurrent upgrades with gold for only one: exactly one succeeds', async () => {
    const { token, userId } = await newPlayer();
    const weapon = (await me(token)).items[0];
    grant(userId, -100 + weapon.upgradeCost.gold, weapon.upgradeCost.ore); // exactly enough for one
    const results = await Promise.all(Array.from({ length: 5 }, () => call('POST', `/api/items/${weapon.id}/upgrade`, token)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const s = await me(token);
    expect(s.gold).toBe(0);
    expect(s.items[0].upgrade).toBe(1);
  });

  it("cannot touch another player's items", async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const aItem = (await me(a.token)).items[0];
    expect((await call('POST', `/api/items/${aItem.id}/equip`, b.token)).status).toBe(404);
    expect((await call('POST', `/api/items/${aItem.id}/salvage`, b.token)).status).toBe(404);
    expect((await call('POST', `/api/items/${aItem.id}/upgrade`, b.token)).status).toBe(404);
  });

  it('salvage: not while equipped; gives ore and removes the item', async () => {
    const { token } = await newPlayer();
    const weapon = (await me(token)).items[0];
    expect((await call('POST', `/api/items/${weapon.id}/salvage`, token)).status).toBe(400);
    await call('POST', `/api/items/${weapon.id}/unequip`, token);
    const r = await call('POST', `/api/items/${weapon.id}/salvage`, token);
    expect(r.status).toBe(200);
    const s = await me(token);
    expect(s.items).toHaveLength(0);
    expect(s.materials.ore).toBe(r.body.ore);
    // Salvaging twice is impossible.
    expect((await call('POST', `/api/items/${weapon.id}/salvage`, token)).status).toBe(404);
  });

  it('gold ledger always sums to the balance', async () => {
    const { token, userId } = await newPlayer();
    for (let i = 0; i < 3; i++) await call('POST', '/api/battle/fight', token);
    const sum = (app.ctx.db.prepare("SELECT SUM(delta) AS s FROM ledger WHERE user_id = ? AND asset = 'gold'").get(userId) as { s: number }).s;
    expect(sum).toBe((await me(token)).gold);
  });
});

describe('zones / passive income', () => {
  it('start, too-early collect, then collect after time with a cap', async () => {
    const { token } = await newPlayer();
    expect((await call('POST', '/api/zone/start', token, { zoneId: 'volcano' })).status).toBe(400); // level gate
    expect((await call('POST', '/api/zone/start', token, { zoneId: 'forest' })).status).toBe(200);
    expect((await call('POST', '/api/zone/collect', token)).status).toBe(400);
    clock += 2 * 3_600_000;
    const two = await call('POST', '/api/zone/collect', token);
    expect(two.status).toBe(200);
    expect(two.body.gold).toBeGreaterThan(0);
    expect(two.body.capped).toBe(false);
    clock += 100 * 3_600_000;
    const capped = await call('POST', '/api/zone/collect', token);
    expect(capped.body.capped).toBe(true);
    expect(capped.body.elapsedMs).toBe(PASSIVE.capMs);
  });
});

describe('discovery missions', () => {
  it('one active mission, progresses by doing, rewards on claim', async () => {
    const { token } = await newPlayer();
    let s = await me(token);
    expect(s.mission.id).toBe(DISCOVERY_MISSIONS[0].id);
    expect((await call('POST', '/api/missions/claim', token)).status).toBe(400);
    await call('POST', '/api/missions/event', token, { event: 'open_pet' });
    const claim = await call('POST', '/api/missions/claim', token);
    expect(claim.status).toBe(200);
    s = await me(token);
    expect(s.gold).toBe(100 + (DISCOVERY_MISSIONS[0].reward.gold ?? 0));
    expect(s.mission.id).toBe(DISCOVERY_MISSIONS[1].id);
    // Can't claim the same mission twice
    expect((await call('POST', '/api/missions/claim', token)).status).toBe(400);
  });

  it('client cannot report economic events', async () => {
    const { token } = await newPlayer();
    expect((await call('POST', '/api/missions/event', token, { event: 'win' })).status).toBe(400);
  });
});
