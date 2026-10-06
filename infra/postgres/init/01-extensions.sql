-- Runs once, when the Postgres data volume is first created.
-- btree_gist: lets EXCLUDE constraints combine equality (=) on scalar columns
--             with range overlap (&&) — the basis of double-booking prevention.
-- citext:     case-insensitive e-mail addresses without lower() everywhere.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS citext;
