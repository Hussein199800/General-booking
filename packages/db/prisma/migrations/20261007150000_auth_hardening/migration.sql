-- =============================================================================
-- Migration: auth_hardening
-- TOTP replay protection: a one-time code is valid for a 30-second step; the
-- last accepted step is recorded so the same code cannot be used twice.
-- =============================================================================

ALTER TABLE users ADD COLUMN mfa_last_step bigint CHECK (mfa_last_step >= 0);

-- Refresh-token rotation marks the old token (rotated_at + replaced_by_id) and
-- inserts its successor in one transaction. The one-live-token-per-session
-- index forces "mark old" first, so the forward reference must be checked at
-- commit time.
ALTER TABLE refresh_tokens
  ALTER CONSTRAINT refresh_tokens_replaced_by_id_fkey DEFERRABLE INITIALLY DEFERRED;
