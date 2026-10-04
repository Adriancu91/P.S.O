# Combat Engine

`shared/src/combat.ts` — `simulateBattle(a, b, seed): BattleResult`. Pure and deterministic.
Engine version: `ENGINE_VERSION` (bump it whenever results could change).

## Timeline

- Fixed 50 ms ticks, max 60 s.
- Initiative chosen by seed; the acting order alternates each tick (no first-mover advantage).
- Each tick, per fighter: cooldown skills that are due → basic attack if the attack timer is full.
- Attack interval = `100000 / aspd` ms (aspd 100 = 1 hit/s; capped 30–300).
- Every 1000 ms: regeneration (logged as a `tick` event with both HP values).
- 25 s **Fatigue**: healing ×0.4. 40 s **Frenzy**: damage ×2. 60 s timeout: higher HP% wins, equal = draw.

## Damage

```
raw      = attack stat × skill multiplier
crit     = rng < critChance%  → raw × critDmg%
mitigate = raw × 120 / (120 + defense)       (pdef for physical, mdef for magic)
variance = ×(0.95 … 1.05)
amount   = max(1, round(...))  → shields absorb first, then HP
```

Basic attacks use the higher of Phys/Magic Attack. Skills choose their own type.

## Skills = triggers + effects (data)

Triggers: `always`, `battleStart`, `everyNthHit(n)`, `cooldown(ms, firstMs)`, `hpBelow(pct)` (once), `onCrit`.
Effects: `damage` (scale, mult, type, hits), `heal` (% max HP), `shield` (% max HP, cap 50%),
`buff` (self/enemy, stat or `healingTaken`/`damageDealt`, pct or flat, duration; re-applying refreshes, never stacks).
Rule: `onCrit` skills should only contain buffs (no recursion).

## Log & report

Events: `start, hit, skill, heal, shield, buff, tick, phase, death, end`. Full log is stored in
`battles.events_json`. The player sees a replay plus a short report (damage dealt/taken, crits,
healing, shields, skills used, HP left) and 2–5 highlights.

## Verification

`GET /api/battle/:id/verify` re-runs the stored snapshots + seed and compares winner, duration and the
full event log. Tests prove a tampered row fails verification.

## Balance snapshot (Lv 20, bots, 400 fights each — `npm run balance`)

Races 41–59%. Archetypes 38–64% (magic and physical strongest, hybrid weakest). Lower level (−3)
still wins ~35%. Tuning targets for Phase 7: archetypes within 45–55%, races within 47–53%.
