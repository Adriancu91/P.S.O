import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = DatabaseSync;

const MIGRATIONS: string[] = [
  // 1 — foundation
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE players (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    active_pet_id TEXT,
    gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
    energy INTEGER NOT NULL,
    energy_at INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  -- user_id is not unique: the schema already allows a collection of pets.
  CREATE TABLE pets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    race TEXT NOT NULL,
    gender TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    evolution INTEGER NOT NULL DEFAULT 1,
    attrs_json TEXT NOT NULL,
    skills_json TEXT NOT NULL,
    zone_id TEXT,
    zone_since INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX pets_user ON pets(user_id);
  CREATE INDEX pets_level ON pets(level);

  CREATE TABLE items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    template_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    rarity TEXT NOT NULL,
    upgrade INTEGER NOT NULL DEFAULT 0,
    bonuses_json TEXT NOT NULL,
    set_id TEXT,
    equipped_pet_id TEXT REFERENCES pets(id),
    origin TEXT NOT NULL,
    origin_ref TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX items_user ON items(user_id);
  CREATE UNIQUE INDEX items_one_per_slot ON items(equipped_pet_id, slot) WHERE equipped_pet_id IS NOT NULL;

  CREATE TABLE materials (
    user_id TEXT NOT NULL REFERENCES users(id),
    material TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    PRIMARY KEY (user_id, material)
  );

  -- Every change of gold/materials/items is recorded: where it came from, where it went.
  CREATE TABLE ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    asset TEXT NOT NULL,
    delta INTEGER NOT NULL,
    balance_after INTEGER,
    reason TEXT NOT NULL,
    ref TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX ledger_user ON ledger(user_id, created_at);

  CREATE TABLE battles (
    id TEXT PRIMARY KEY,
    attacker_id TEXT NOT NULL,
    defender_id TEXT,
    is_bot INTEGER NOT NULL,
    seed TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    snap_a TEXT NOT NULL,
    snap_b TEXT NOT NULL,
    winner INTEGER,
    reason TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    summary_json TEXT NOT NULL,
    events_json TEXT NOT NULL,
    rewards_json TEXT NOT NULL,
    rating_delta INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX battles_attacker ON battles(attacker_id, created_at);
  CREATE INDEX battles_defender ON battles(defender_id, created_at);

  CREATE TABLE missions (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    idx INTEGER NOT NULL DEFAULT 0,
    progress INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    detail_json TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX audit_user ON audit(user_id, created_at);

  -- Anti-replay: a repeated Idempotency-Key returns the original response.
  CREATE TABLE idempotency (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    response_json TEXT NOT NULL,
    status INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  `,
];

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db: DB) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
  let version = row?.version ?? 0;
  if (!row) db.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
  while (version < MIGRATIONS.length) {
    tx(db, () => {
      db.exec(MIGRATIONS[version]);
      db.prepare('UPDATE schema_version SET version = ?').run(version + 1);
    });
    version += 1;
  }
}

let depth = 0;
/**
 * Run fn atomically. SQLite serializes writers, and BEGIN IMMEDIATE takes the
 * write lock up front, so check-then-update sequences can't race.
 */
export function tx<T>(db: DB, fn: () => T): T {
  if (depth > 0) return fn(); // nested: join the outer transaction
  db.exec('BEGIN IMMEDIATE');
  depth++;
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    depth--;
  }
}
