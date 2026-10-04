# Game Design

**Simple to play, hard to master.** Complexity lives in the engine and the build space, not in menus.

## Races

Names are working names — easy to change in `shared/src/config/races.ts`.

| Race   | Animal | Feel                         | Strengths                         | Weaknesses                     | Stages                                     |
| ------ | ------ | ---------------------------- | --------------------------------- | ------------------------------ | ------------------------------------------ |
| Tuskar | Boar   | Stubborn, loud, loyal        | Huge HP, physical defense         | Slow, weak magic, few crits    | Piglet → Tusk Brawler → Ironhide Warlord   |
| Vexa   | Fox    | Sly, elegant, vain           | Speed, crits, burst               | Low HP and defense             | Kit → Shadow Tail → Ninefold Phantom       |
| Hoolu  | Owl    | Calm, mysterious, smug       | Magic, magic defense, regen       | Weak physical attack/defense   | Fluffling → Moon Warden → Starseer Sage    |

Silhouette test: boar = wide with tusks, fox = slim with giant tail and tall ears, owl = round egg with
huge eyes and ear tufts. Each recognizable in 2 seconds.

**Gender** is purely visual (palette, lashes, flower/ribbon/gem). Never affects power.

**Evolution** (Lv 15 → 2, Lv 30 → 3, plus gold + zone essences): base stats ×1.15 / ×1.30, unlocks a new
skill slot, unlocks higher gear tiers, and visibly transforms the pet (armor, weapons, aura).

## Builds

Every level: **3 stat points** into 6 attributes:

| Attr | Gives                        |
| ---- | ---------------------------- |
| VIT  | HP + regeneration            |
| STR  | Physical attack              |
| INT  | Magic attack                 |
| GRD  | Physical + magic defense     |
| AGI  | Attack speed                 |
| FOR  | Crit chance + crit damage    |

Respec costs gold (economy sink). Archetypes (tank, crit, speed, physical, magic, regen, hybrid)
emerge from choices; none are classes.

**Counter-play is built in:** basic attacks use your dominant attack type, mitigated by the matching
defense. Stack physical defense → mages beat you. Stack regen → Eclipse (−50% healing) beats you.
Long fights → Fatigue (−60% healing at 25s) and Frenzy (×2 damage at 40s) stop stalemates.

## Skills (3 slots, pick 1 of 2 per slot)

| Slot     | Tuskar                        | Vexa                        | Hoolu                     |
| -------- | ----------------------------- | --------------------------- | ------------------------- |
| Active   | Tusk Charge / Mud Wall        | Twin Fang / Fox Fire        | Moon Bolt / Night Hush    |
| Passive  | Thick Hide / Last Stand       | Hunter's Focus / Momentum   | Feather Mend / Wise Eyes  |
| Ultimate | Earthquake Stomp / Boar Heart | Thousand Tails / Mirage     | Starfall / Eclipse        |

Synergy examples: Vexa AGI + Twin Fang (every 3rd hit) + Momentum (crit → speed). Tuskar VIT + Last
Stand + Boar Heart (comeback tank). Hoolu INT + Night Hush (defense shred) for hybrid teams.

## Equipment

6 slots (weapon, armor, helmet, boots, ring, charm), 2 bases per slot (offense/defense or phys/magic
choice), 4 tiers (Scrappy, Iron, Runed, Mythic), 5 rarities (common → legendary, 0–3 random bonuses),
upgrade +0…+9 (+8% base each, gold + ore, no failure chance in MVP), 2 sets (Wildheart: endurance,
Stormclaw: aggression) with 2/4/6-piece bonuses; the 6-piece grants a set skill.

## Loops

- **2 min:** collect zone loot, claim mission, spend points, 1–2 fights.
- **10 min:** use all energy, upgrade gear, try a new skill/build.
- **30 min:** optimize build vs. opponents that beat you, push zones and evolution.
- **Tomorrow:** zone filled up (8h cap), energy full, next evolution closer.

## Discovery missions

One active mission at a time, 13 in the chain. DO → SEE → DISCOVER: titles hint, never explain.
"Your pet is waiting." → "Choose your strength." → "Someone is waiting for you." → … → "A new form."

## Not in MVP (on purpose)

Guilds, crafting, multiple currencies, blockchain, pay-to-win. See ROADMAP.md.
