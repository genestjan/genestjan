# ADR 0009: One `records` table with a visibility column, relational tables for identity

**Status:** accepted (changes section 7 of the technical blueprint)

**Context.** The blueprint listed about 35 tables, each with its own policies. That is a lot of SQL to write and to test by hand, and the app stores many record types (events, replies, messages, reviews, goals, logs, fund items...) that share the same four access patterns.

**Decision.** Identity and relationships stay relational (`memberships`, `teams`, `team_staff`, `players`, `player_private`, `player_guardians`, `consents`, `invites`). Everything else is a row in `records` with `kind`, `team_id`, `player_id`, `visibility` (`coach`, `family`, `team`, `club`) and a JSON `data` payload. Row Level Security keys off `visibility`; parents can insert or update only an allow-list of kinds (`availability`, `message`, `charge_ref`, `seen`) for their own child. A published review is stored twice: the full coach copy (`coach`) and a family copy without the private note (`family`).

**Consequences.** One set of policies covers all record types and is exercised by `supabase/tests/rls.sql` (45 checks). New record types need no migration. Costs: JSON payloads are not type-checked by the database (the app validates them), and per-kind queries rely on the `kind` filter and indexes on team and player. If a record type outgrows this (large volume or reporting), give it its own table then.
