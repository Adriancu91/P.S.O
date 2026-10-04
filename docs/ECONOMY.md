# Economy

All economic operations are server-side, inside transactions, and recorded in `ledger`
(asset, delta, balance after, reason, ref). Balances have DB `CHECK (>= 0)` constraints.

## Currencies & materials

- **Gold** — the only currency.
- **Ore** — upgrades. **Essences** (Forest Sap, Desert Glass, Frost Shard, Ember Core) — evolution.

No premium currency yet (monetization decision deferred; see DECISIONS.md).

## Sources (all capped)

| Source        | Cap mechanism                                               |
| ------------- | ----------------------------------------------------------- |
| PvP fights    | Energy: 10 max, +1 per 6 min (~240 fights/day max)          |
| Zones         | Accumulation stops at 8 h; min 1 min between collects; max 10 items per collect |
| Missions      | One-time discovery chain                                    |
| Starter       | 100 gold + 1 weapon                                         |

PvP rewards: win `25 + 3×level` gold, loss `8 + level`. Same opponent max 3 times / 24 h.

## Sinks

| Sink            | Cost                                                   |
| --------------- | ------------------------------------------------------ |
| Item upgrade    | gold `40 × (u+1)^1.6 × tier`, ore `2 × (u+1) × tier`    |
| Evolution       | 1 500 gold + essences (evo 2), 8 000 + essences (evo 3) |
| Stat respec     | `100 + 40 × level` gold                                 |
| Salvage         | destroys items (item sink), returns a little ore        |
| Inventory limit | 60 items; overflow is auto-salvaged                     |
| Marketplace fee | planned: 5% of sale (gold sink)                         |

## Planned (Phase 6)

Marketplace listings with escrow (item locked while listed), 5% fee, price history from completed
sales. Live trade: both sides lock offers → both Ready → both Confirm → single transaction swaps
ownership with ownership + version checks; any change resets Ready.
