# Architecture

```
client (React PWA)  ──HTTPS/JSON──▶  server (Fastify)  ──▶  SQLite (node:sqlite, WAL)
        │                                   │
        └──────── both import ──────────────┴──▶  shared/ (pure engine + config)
```

## Principles

1. **Server-authoritative.** The client sends intents ("fight", "upgrade item X"). The server
   validates, computes with the shared engine, persists, and returns results. The client never
   sends damage, loot, gold, levels or outcomes.
2. **One engine, two uses.** `shared/` is pure TypeScript with no I/O. The server uses it to
   decide; the client uses the same code only to *display* (labels, stat formatting, previews).
3. **Data-driven balance.** Every number lives in `shared/src/config/*`. Balance changes = edit data.
4. **Deterministic combat.** `simulateBattle(a, b, seed)` is a pure function. Battles are stored
   with seed + both snapshots + engine version and can be re-simulated to verify.
5. **Small and boring.** One process, one SQLite file. No microservices, no queues, no blockchain.

## shared/

| File                    | Role                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| `types.ts`              | Domain types (stats, items, skills, battle events)                   |
| `rng.ts`                | Seeded deterministic RNG (sfc32 + cyrb128)                           |
| `stats.ts`              | Stat pipeline: race base → evolution → attributes → gear → sets → external modifiers → caps |
| `items.ts`              | Item templates (base × tier), generation, random bonuses, upgrade/salvage |
| `combat.ts`             | Combat engine + battle highlights                                   |
| `progression.ts`        | XP/levels, point allocation validation, skills, energy, Elo          |
| `zones.ts`              | Passive income computation                                           |
| `bots.ts`               | Bot opponents with archetype builds                                  |
| `config/*`              | Races, skills, items, sets, progression, zones, missions             |

## server/

- `db.ts` — schema + versioned migrations + `tx()` (BEGIN IMMEDIATE: serialized writers, no races).
- `auth.ts` — scrypt passwords, random session tokens stored as SHA-256 hashes.
- `services/economy.ts` — the only place gold/materials/items change; every change is ledgered.
- `services/pets.ts`, `zones.ts`, `battle.ts`, `missions.ts`, `state.ts` — game logic.
- `app.ts` — routes, auth hook, rate limits, idempotency keys, error handling, static client.

### Data model (implemented)

`users`, `sessions`, `players` (gold, energy, rating, active pet), `pets` (many per user allowed by
schema), `items` (owned by user, `equipped_pet_id`, unique per pet+slot, `origin` for provenance),
`materials`, `ledger`, `battles`, `missions`, `audit`, `idempotency`.

Planned tables: `listings`, `trades`, `trade_items`, `friends`, `messages`, `achievements`,
`redemption_codes` / `account_bonuses` (physical figures — see below).

### Future: physical figures

`PetBuild.external: Modifier[]` already flows through the stat pipeline. A future
`account_bonuses` table (source = redemption code, figure edition, rarity) will feed that list.
No other system needs to change.

## client/

Single-page app, no router: 4 screens behind a bottom nav (Pet, Gear, Fight, Explore) + "Me" panel.
`game.tsx` holds state (refetches `/api/me` after every action). Every POST carries a fresh
`Idempotency-Key`. Pet art is hand-built SVG (`PetArt.tsx`) — tiny, scalable, animatable.

## Scaling path

SQLite handles a single server comfortably into thousands of concurrent players. When needed:
move to Postgres (same SQL, transactions map 1:1), move rate limits to Redis, add WebSockets for chat
and live trade.
