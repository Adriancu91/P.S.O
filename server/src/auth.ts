import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ENERGY, PVP } from '@pso/shared';
import { ApiError, audit, bad, newId, type Ctx } from './ctx.js';
import { tx } from './db.js';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split('$');
  if (algo !== 'scrypt') return false;
  const key = await scrypt(pw, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function createSession(ctx: Ctx, userId: string): string {
  const token = randomBytes(32).toString('base64url');
  ctx.db
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), userId, ctx.now(), ctx.now() + SESSION_TTL_MS);
  return token;
}

function validateCredentials(username: unknown, password: unknown): { username: string; password: string } {
  if (typeof username !== 'string' || !USERNAME_RE.test(username))
    throw bad('bad_username', 'Username: 3-16 letters, numbers or _');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    throw bad('bad_password', 'Password: at least 8 characters');
  return { username, password };
}

export async function register(ctx: Ctx, body: { username?: unknown; password?: unknown }) {
  const { username, password } = validateCredentials(body.username, body.password);
  const passHash = await hashPassword(password);
  return tx(ctx.db, () => {
    const exists = ctx.db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
    if (exists) throw new ApiError(409, 'username_taken', 'That name is taken');
    const id = newId();
    const now = ctx.now();
    ctx.db.prepare('INSERT INTO users (id, username, pass_hash, created_at) VALUES (?, ?, ?, ?)').run(id, username, passHash, now);
    ctx.db
      .prepare('INSERT INTO players (user_id, gold, energy, energy_at, rating, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, 0, ENERGY.max, now, PVP.startRating, now);
    ctx.db.prepare('INSERT INTO missions (user_id, idx, progress) VALUES (?, 0, 0)').run(id);
    audit(ctx, id, 'register');
    return { token: createSession(ctx, id), userId: id, username };
  });
}

export async function login(ctx: Ctx, body: { username?: unknown; password?: unknown }) {
  if (typeof body.username !== 'string' || typeof body.password !== 'string') throw bad('bad_request', 'Missing credentials');
  const row = ctx.db.prepare('SELECT id, username, pass_hash FROM users WHERE username = ?').get(body.username) as
    | { id: string; username: string; pass_hash: string }
    | undefined;
  // Always run scrypt so response time doesn't reveal whether the user exists.
  const ok = row ? await verifyPassword(body.password, row.pass_hash) : (await hashPassword(body.password), false);
  if (!row || !ok) {
    audit(ctx, row?.id ?? null, 'login_failed');
    throw new ApiError(401, 'bad_credentials', 'Wrong username or password');
  }
  audit(ctx, row.id, 'login');
  return { token: createSession(ctx, row.id), userId: row.id, username: row.username };
}

export function logout(ctx: Ctx, token: string) {
  ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function userFromToken(ctx: Ctx, token: string | undefined): { id: string; username: string } | null {
  if (!token) return null;
  const row = ctx.db
    .prepare(
      'SELECT u.id, u.username, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?',
    )
    .get(hashToken(token)) as { id: string; username: string; expires_at: number } | undefined;
  if (!row || row.expires_at < ctx.now()) return null;
  return { id: row.id, username: row.username };
}
