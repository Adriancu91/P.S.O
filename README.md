# P.S.O. — Pet Strike Online

Mobile-first auto-battle pet game. **Simple to play. Hard to master.**

Collect and evolve an animal-humanoid pet, build it with stat points, skills and gear,
and let it fight automatically. Your build is your strategy — level is never a guaranteed win.

## Run it

Requires Node.js 22.5+ (uses the built-in `node:sqlite`, no native builds).

```bash
npm install
npm run dev          # server on :8787 + client on :5173 (open on your phone via your LAN IP)
npm test             # 62 unit, integration and exploit tests
npm run balance      # bot-vs-bot win-rate simulation (npm run balance -- 25 for level 25)
```

Production (one process serves API + client):

```bash
npm run build && npm start   # http://localhost:8787
```

Env vars: `PORT` (8787), `HOST` (0.0.0.0), `PSO_DB` (path to SQLite file, default `data/pso.db`).

## Layout

| Folder    | What                                                                                       |
| --------- | ------------------------------------------------------------------------------------------ |
| `shared/` | Pure game engine + all balance data: races, skills, items, combat, zones, missions. No I/O. |
| `server/` | Fastify + SQLite. Authoritative for every outcome: battles, loot, gold, levels.            |
| `client/` | React + Vite PWA. Renders state and replays battle logs. Decides nothing.                  |
| `scripts/`| Balance simulator.                                                                         |
| `docs/`   | Design and technical documentation.                                                        |

## Docs

[Architecture](docs/ARCHITECTURE.md) · [Game design](docs/GAME_DESIGN.md) · [Combat](docs/COMBAT.md) ·
[Economy](docs/ECONOMY.md) · [Security](docs/SECURITY.md) · [Roadmap](docs/ROADMAP.md) ·
[Testing](docs/TESTING.md) · [Decisions](docs/DECISIONS.md) · [Changelog](CHANGELOG.md)
