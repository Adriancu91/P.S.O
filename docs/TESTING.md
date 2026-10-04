# Testing

`npm test` — Vitest, 62 tests, ~3 s.

| Suite | Covers |
| ----- | ------ |
| `shared/test/combat.test.ts` (19) | determinism, no input mutation, KO/death, defense mitigation, magic vs mdef, crit, attack speed, regen + fatigue, draw, frenzy ending, every skill trigger type, shields, heal reduction, debuffs, unknown skills, **lower-level counter build beats higher level** |
| `shared/test/systems.test.ts` (20) | RNG, stat pipeline, caps, evolution multiplier, pct vs flat, external modifiers (figurines), item generation, upgrades, tier gating, salvage, set thresholds + set skills, points, allocation validation, XP/levels, skill loadouts, energy, Elo, zone rewards + cap |
| `server/test/api.test.ts` (23) | auth (register/login/logout, weak input, hashing), pet creation, allocation exploits, skills, evolution gating, server-side battle + verification + tamper detection, energy, battle privacy, real-player matchmaking + anti-farming, upgrade costs, idempotent replay, **concurrent double-spend**, cross-account item access, salvage, ledger consistency, zones + cap, missions + client event allowlist |

Also: `npm run balance` (simulation report) and a Playwright mobile walkthrough used during
development (register → hatch → missions → fight → verify → equip → explore).

## Still to cover

Trade (simultaneous confirm, disconnect, timeout, cancel, duplicates, ownership) and marketplace
(listing, purchase, cancel, concurrent purchase) — when Phase 6 lands.
