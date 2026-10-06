-- =============================================================================
-- Migration: agenda_enums
-- New enum values must be committed before they can be used, so they live in
-- their own migration ahead of agenda_ownership.
-- =============================================================================

-- Members of the Bar Council: they can hold their own agenda and receive
-- audiences transferred to them by the Grand Syndic (decision D19).
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'COUNCIL_MEMBER' AFTER 'SECRETARIAT_OFFICER';

-- An audience the Grand Syndic hands over to a council member (decision D19).
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'TRANSFERRED';

-- Who put an entry on the agenda (decision D18).
CREATE TYPE appointment_origin AS ENUM (
  'SECRETARIAT',  -- scheduled by the Secretariat from an approved audience request
  'PRINCIPAL'     -- entered by the agenda owner himself; no request behind it
);
