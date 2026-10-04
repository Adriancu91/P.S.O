# Decision Log

### D1 — TypeScript monorepo with a shared pure engine
- **Reason:** one language; the exact same combat/stat code on server (authority) and client (display).
- **Alternatives:** Unity/Godot client + separate backend; Python backend.
- **Why:** fastest path to a web/mobile PWA; engine testable without UI.
- **Impact:** a native app later can wrap the PWA (Capacitor) or port the client only.

### D2 — SQLite via built-in `node:sqlite`
- **Reason:** zero ops, zero native builds, real transactions.
- **Alternatives:** Postgres, MongoDB.
- **Why:** MVP scale; schema is plain SQL so Postgres migration is mechanical.
- **Impact:** single server instance until migrated.

### D3 — Async PvP (fight other players' current builds, server-simulated)
- **Reason:** fully automatic combat needs no live connection; works at any player count; bots fill gaps.
- **Alternatives:** real-time matched fights over WebSockets.
- **Why:** simpler, instant, no waiting. Defender rating moves at 50%.
- **Impact:** live "Challenge" from profiles can reuse the same engine.

### D4 — Fixed-tick (50 ms) deterministic simulation
- **Reason:** simple to reason about, reproducible, cheap (~1 ms per battle).
- **Impact:** any change to formulas requires bumping `ENGINE_VERSION`.

### D5 — No upgrade failure chance in MVP
- **Reason:** brief asks to avoid frustrating systems unless proven necessary. Cost curve is the sink.

### D6 — Energy for PvP
- **Reason:** caps gold generation (anti-inflation) and bot farming; creates a "come back later" hook.

### D7 — Single soft currency, no premium currency yet
- **Reason:** monetization is a commercial decision for the owner; cosmetics-only is the intended direction.

### D8 — Hand-made SVG art for pets
- **Reason:** 18 variants with no art pipeline, tiny download, crisp at any size, easy to animate,
  and the bold simple shapes translate to physical figures. Can be replaced by illustrated sprites later.

### D9 — Basic attacks use the dominant attack type
- **Reason:** makes physical vs magic a real decision with a clear counter (matching defense).
- **Impact:** hybrid builds rely on skills/sets of the other type; balance watch item.
