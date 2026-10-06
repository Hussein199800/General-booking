-- =============================================================================
-- Migration: runtime_role
-- The API connects as sba_app (DML only). Migrations run as the schema owner.
-- In Docker, infra/postgres/init/02-roles.sh creates sba_app with a password
-- first; elsewhere it is created here without LOGIN and ops must enable it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Least-privilege runtime role
-- -----------------------------------------------------------------------------
-- Migrations run as the schema owner; the API connects as sba_app, which can
-- never rewrite history even if the application is compromised.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sba_app') THEN
    CREATE ROLE sba_app NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO sba_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sba_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO sba_app;

REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM sba_app;
REVOKE ALL ON audit_chain_head FROM sba_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON ticket_status_transitions, appointment_status_transitions FROM sba_app;
-- Legal records are never hard-deleted by the application.
REVOKE DELETE ON tickets, audience_requests, grievances, appointments, appointment_attendees,
  documents, routing_assignments, document_requests, notifications, users, lawyer_profiles,
  user_roles, emergency_overrides FROM sba_app;

-- Prisma's own bookkeeping is not the application's business.
REVOKE ALL ON _prisma_migrations FROM sba_app;

-- Tables created by later migrations get DML for sba_app automatically. Each such
-- migration must still REVOKE DELETE explicitly on tables holding legal records.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sba_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO sba_app;
