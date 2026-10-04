# Security

## Trust model

The client is untrusted. It can only request actions; the server decides damage, crits, outcomes,
drops, rewards, gold, items, levels, evolution. Request bodies carrying "results" are ignored
(tested).

## Implemented

- **Auth:** scrypt (64-byte key, random salt), constant-time compare, dummy hash on unknown user
  (no timing oracle). Session tokens: 32 random bytes, stored only as SHA-256, 30-day expiry.
- **Validation:** every input checked server-side (names, attributes, skills, item ownership, level/
  evolution requirements, zone level).
- **Atomicity:** all mutations in `BEGIN IMMEDIATE` transactions; guarded updates
  (`WHERE upgrade = ?`); unique index prevents two items in one slot.
- **Anti-duplication / double spend:** balances can't go negative (code + DB CHECK); items deleted
  with `changes === 1` check; concurrent spend test proves exactly one success.
- **Anti-replay:** `Idempotency-Key` header — a repeated key returns the stored response without
  re-running.
- **Rate limits:** auth 10/min/IP, actions 120/min/user, fights 1 per 1.5 s/user, plus energy.
- **Audit:** `audit` table (logins, failed logins, rate-limit hits, fights, evolutions, missions);
  `ledger` for every asset change; `items.origin` for provenance; `battles` for every fight.
- **Privacy:** no email or personal data stored; logs redact the Authorization header.
- **Body limit** 16 KB. Battles are only visible to their two participants.

## To do before public launch

- HTTPS termination (reverse proxy) and HSTS.
- Suspicious-activity jobs over `audit`/`ledger` (gold velocity, win-trading between two accounts).
- Account recovery (requires email → privacy review).
- Rate limiter in Redis when running more than one server.
- Idempotency key expiry job.
