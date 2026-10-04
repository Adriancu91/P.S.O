import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ApiError, audit, bad, type Ctx } from './ctx.js';
import { openDb } from './db.js';
import { login, logout, register, userFromToken } from './auth.js';
import { RateLimiter } from './ratelimit.js';
import { fight, getBattle, recentBattles, verifyBattle } from './services/battle.js';
import { CLIENT_EVENTS, claimMission, recordEvent } from './services/missions.js';
import {
  allocatePoints,
  createPet,
  equip,
  evolve,
  respec,
  salvageItem,
  setSkills,
  unequip,
  upgradeItem,
} from './services/pets.js';
import { getState } from './services/state.js';
import { collect, startZone } from './services/zones.js';
import type { MissionEvent } from '@pso/shared';

export interface AppOptions {
  dbPath?: string;
  now?: () => number;
  logger?: boolean;
  staticDir?: string;
  /** Disable rate limits (tests). */
  rateLimits?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; username: string };
    token?: string;
  }
}

export async function buildApp(opts: AppOptions = {}) {
  const ctx: Ctx = { db: openDb(opts.dbPath ?? ':memory:'), now: opts.now ?? Date.now };
  const app = Fastify({
    logger: opts.logger ? { level: 'info', redact: ['req.headers.authorization'] } : false,
    bodyLimit: 16 * 1024,
    trustProxy: true,
  });
  const limits = opts.rateLimits !== false;
  const authLimiter = new RateLimiter(10, 60_000); // per IP
  const actionLimiter = new RateLimiter(120, 60_000); // per user
  const fightLimiter = new RateLimiter(1, 1500); // per user

  app.decorate('ctx', ctx);

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    if (err instanceof ApiError) return reply.status(err.status).send({ error: err.code, message: err.message });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: 'bad_request', message: err.message });
    req.log.error(err);
    return reply.status(500).send({ error: 'server_error', message: 'Something went wrong' });
  });

  const rateLimit = (limiter: RateLimiter, key: string, req: FastifyRequest) => {
    if (!limits) return;
    if (!limiter.take(key)) {
      audit(ctx, req.user?.id ?? null, 'rate_limited', { route: req.routeOptions.url });
      throw new ApiError(429, 'rate_limited', 'Slow down a little');
    }
  };

  const authed = async (req: FastifyRequest) => {
    const h = req.headers.authorization;
    const token = h?.startsWith('Bearer ') ? h.slice(7) : undefined;
    const user = userFromToken(ctx, token);
    if (!user) throw new ApiError(401, 'unauthorized', 'Please log in');
    req.user = user;
    req.token = token;
    rateLimit(actionLimiter, user.id, req);
  };

  /**
   * Anti-replay for mutations: if the client sends an Idempotency-Key that was
   * already processed, the original response is returned and nothing runs twice.
   */
  const mutation =
    (handler: (req: FastifyRequest) => unknown) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      const key = req.headers['idempotency-key'];
      const userId = req.user!.id;
      if (typeof key === 'string' && key.length > 0) {
        if (key.length > 100) throw bad('bad_idempotency_key', 'Idempotency key too long');
        const prev = ctx.db.prepare('SELECT response_json, status FROM idempotency WHERE user_id = ? AND key = ?').get(userId, key) as
          | { response_json: string; status: number }
          | undefined;
        if (prev) return reply.status(prev.status).header('idempotent-replay', 'true').send(JSON.parse(prev.response_json));
        const result = await handler(req);
        ctx.db
          .prepare('INSERT OR IGNORE INTO idempotency (user_id, key, response_json, status, created_at) VALUES (?, ?, ?, 200, ?)')
          .run(userId, key, JSON.stringify(result ?? null), ctx.now());
        return result;
      }
      return handler(req);
    };

  // ---------- health ----------
  app.get('/api/health', async () => ({ ok: true, time: ctx.now() }));

  // ---------- auth ----------
  app.post('/api/auth/register', async (req) => {
    rateLimit(authLimiter, `ip:${req.ip}`, req);
    return register(ctx, (req.body ?? {}) as Record<string, unknown>);
  });
  app.post('/api/auth/login', async (req) => {
    rateLimit(authLimiter, `ip:${req.ip}`, req);
    return login(ctx, (req.body ?? {}) as Record<string, unknown>);
  });
  app.post('/api/auth/logout', { preHandler: authed }, async (req) => {
    logout(ctx, req.token!);
    return { ok: true };
  });

  // ---------- state ----------
  app.get('/api/me', { preHandler: authed }, async (req) => getState(ctx, req.user!.id, req.user!.username));

  // ---------- pet ----------
  type Body = Record<string, unknown>;
  const body = (req: FastifyRequest) => (req.body ?? {}) as Body;
  const param = (req: FastifyRequest, k: string) => (req.params as Record<string, string>)[k];

  app.post('/api/pet', { preHandler: authed }, mutation((req) => createPet(ctx, req.user!.id, body(req))));
  app.post('/api/pet/allocate', { preHandler: authed }, mutation((req) => allocatePoints(ctx, req.user!.id, body(req).add)));
  app.post('/api/pet/respec', { preHandler: authed }, mutation((req) => respec(ctx, req.user!.id)));
  app.post('/api/pet/skills', { preHandler: authed }, mutation((req) => setSkills(ctx, req.user!.id, body(req).skills)));
  app.post('/api/pet/evolve', { preHandler: authed }, mutation((req) => evolve(ctx, req.user!.id)));

  // ---------- items ----------
  app.post('/api/items/:id/equip', { preHandler: authed }, mutation((req) => equip(ctx, req.user!.id, param(req, 'id'))));
  app.post('/api/items/:id/unequip', { preHandler: authed }, mutation((req) => unequip(ctx, req.user!.id, param(req, 'id'))));
  app.post('/api/items/:id/upgrade', { preHandler: authed }, mutation((req) => upgradeItem(ctx, req.user!.id, param(req, 'id'))));
  app.post('/api/items/:id/salvage', { preHandler: authed }, mutation((req) => salvageItem(ctx, req.user!.id, param(req, 'id'))));

  // ---------- zones ----------
  app.post('/api/zone/start', { preHandler: authed }, mutation((req) => startZone(ctx, req.user!.id, body(req).zoneId)));
  app.post('/api/zone/collect', { preHandler: authed }, mutation((req) => collect(ctx, req.user!.id)));

  // ---------- battle ----------
  app.post(
    '/api/battle/fight',
    { preHandler: authed },
    mutation((req) => {
      rateLimit(fightLimiter, req.user!.id, req);
      return fight(ctx, req.user!.id);
    }),
  );
  app.get('/api/battles', { preHandler: authed }, async (req) => ({ battles: recentBattles(ctx, req.user!.id) }));
  app.get('/api/battle/:id', { preHandler: authed }, async (req) => getBattle(ctx, req.user!.id, param(req, 'id')));
  app.get('/api/battle/:id/verify', { preHandler: authed }, async (req) => verifyBattle(ctx, req.user!.id, param(req, 'id')));

  // ---------- missions ----------
  app.post('/api/missions/claim', { preHandler: authed }, mutation((req) => claimMission(ctx, req.user!.id)));
  app.post('/api/missions/event', { preHandler: authed }, async (req) => {
    const ev = body(req).event as MissionEvent;
    if (!CLIENT_EVENTS.includes(ev)) throw bad('bad_event', 'Unknown event');
    recordEvent(ctx, req.user!.id, ev);
    return { ok: true };
  });

  // ---------- client (production) ----------
  const staticDir = opts.staticDir;
  if (staticDir && existsSync(join(staticDir, 'index.html'))) {
    const fastifyStatic = (await import('@fastify/static')).default;
    await app.register(fastifyStatic, { root: staticDir, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.status(404).send({ error: 'not_found', message: 'Not found' });
      return reply.sendFile('index.html');
    });
  }

  app.addHook('onClose', async () => ctx.db.close());
  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    ctx: Ctx;
  }
}
