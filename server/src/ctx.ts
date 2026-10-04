import { randomUUID } from 'node:crypto';
import type { DB } from './db.js';

export interface Ctx {
  db: DB;
  now: () => number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const bad = (code: string, message: string) => new ApiError(400, code, message);
export const notFound = (message = 'Not found') => new ApiError(404, 'not_found', message);

export const newId = () => randomUUID();

export function audit(ctx: Ctx, userId: string | null, action: string, detail?: unknown) {
  ctx.db
    .prepare('INSERT INTO audit (user_id, action, detail_json, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, action, detail === undefined ? null : JSON.stringify(detail), ctx.now());
}
