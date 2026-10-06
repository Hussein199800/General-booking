-- =============================================================================
-- Migration: init_schema
-- Full Phase 1 schema. Prisma cannot express most of what follows (EXCLUDE,
-- CHECK and partial-unique constraints, generated columns, triggers), so this
-- file is hand-written; prisma/schema.prisma mirrors it for the client and CI
-- verifies the two do not drift (`prisma migrate diff --exit-code`).
-- Design rationale: docs/DATABASE.md (decisions D1-D17).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------------------------------------------------------
-- 1. Enumerations
-- -----------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM (
  'SYSTEM_ADMIN',          -- technical administration; no access to case content
  'AUDITOR',               -- read-only access to audit logs
  'GRAND_SYNDIC',
  'SECRETARIAT_HEAD',
  'SECRETARIAT_OFFICER',
  'BRANCH_OFFICER',        -- scoped to one regional branch
  'COMMITTEE_MEMBER',      -- scoped to one committee
  'LAWYER'
);

CREATE TYPE user_status AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- Decision Q4 (approved 2026-10-06): see docs/ar/DECISIONS.md.
CREATE TYPE lawyer_practice_status AS ENUM ('PRACTISING', 'TRAINEE', 'SUSPENDED', 'NON_PRACTISING');

CREATE TYPE governorate AS ENUM (
  'DAMASCUS', 'RIF_DIMASHQ', 'ALEPPO', 'HOMS', 'HAMA', 'LATAKIA', 'TARTUS',
  'IDLIB', 'RAQQA', 'DEIR_EZ_ZOR', 'HASAKAH', 'DARAA', 'SUWAYDA', 'QUNEITRA'
);

CREATE TYPE org_unit_type AS ENUM (
  'GRAND_SYNDIC_OFFICE', 'CENTRAL_SECRETARIAT', 'REGIONAL_BRANCH',
  'DISCIPLINARY_COMMITTEE', 'COMMITTEE'
);

CREATE TYPE external_entity_type AS ENUM (
  'MINISTRY_OF_JUSTICE', 'SUPREME_JUDICIAL_COUNCIL', 'COURT',
  'STATE_INSTITUTION', 'MEDIA_OUTLET', 'OTHER'
);

CREATE TYPE ticket_kind AS ENUM ('AUDIENCE_REQUEST', 'GRIEVANCE');

-- Decision Q1 (approved 2026-10-06): the Secretariat may decline; no reason is sent.
CREATE TYPE request_status AS ENUM (
  'PENDING_REVIEW', 'AWAITING_DOCUMENTS', 'DELEGATED', 'APPROVED',
  'DECLINED', 'WITHDRAWN', 'CLOSED'
);

CREATE TYPE appointment_status AS ENUM (
  'SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED', 'RESCHEDULED', 'NO_SHOW'
);

CREATE TYPE priority_tier AS ENUM ('CRITICAL', 'INTERNAL', 'STANDARD');

CREATE TYPE requester_type AS ENUM (
  'CITIZEN', 'LAWYER', 'STATE_INSTITUTION', 'JUDICIAL_AUTHORITY', 'MEDIA', 'DELEGATION'
);

CREATE TYPE submission_channel AS ENUM ('PUBLIC_PORTAL', 'LAWYER_PORTAL', 'STAFF_ENTRY');

CREATE TYPE meeting_mode AS ENUM ('IN_PERSON', 'REMOTE');

CREATE TYPE attendee_role AS ENUM ('REQUESTER', 'ATTENDEE', 'STAFF');

CREATE TYPE grievance_type AS ENUM ('AGAINST_LAWYER', 'JUDICIAL_MATTER');

CREATE TYPE routing_target_type AS ENUM ('ORGANIZATIONAL_UNIT', 'EXTERNAL_ENTITY');

CREATE TYPE routing_status AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RETURNED', 'COMPLETED');

CREATE TYPE document_request_status AS ENUM ('OPEN', 'FULFILLED', 'EXPIRED', 'CANCELLED');

-- Decision Q6 (approved 2026-10-06): three levels.
CREATE TYPE document_classification AS ENUM ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

CREATE TYPE scan_status AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

CREATE TYPE notification_channel AS ENUM ('SMS', 'EMAIL', 'IN_APP');

CREATE TYPE notification_status AS ENUM (
  'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED'
);

CREATE TYPE action_token_purpose AS ENUM ('RESCHEDULE_RESPONSE', 'DOCUMENT_UPLOAD');

CREATE TYPE emergency_action AS ENUM ('CANCEL', 'POSTPONE');

CREATE TYPE job_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- -----------------------------------------------------------------------------
-- 2. Shared trigger functions
-- -----------------------------------------------------------------------------

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Organisation & reference data
-- -----------------------------------------------------------------------------

CREATE TABLE organizational_units (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_type    org_unit_type NOT NULL,
  code         text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  name_ar      text NOT NULL,
  governorate  governorate,
  parent_id    uuid REFERENCES organizational_units (id),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_units_branch_has_governorate
    CHECK (unit_type <> 'REGIONAL_BRANCH' OR governorate IS NOT NULL)
);
-- Exactly one branch council per governorate.
CREATE UNIQUE INDEX org_units_one_branch_per_governorate
  ON organizational_units (governorate) WHERE unit_type = 'REGIONAL_BRANCH';
CREATE INDEX org_units_parent_idx ON organizational_units (parent_id);

CREATE TABLE external_entities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       external_entity_type NOT NULL,
  code              text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  name_ar           text NOT NULL,
  parent_id         uuid REFERENCES external_entities (id),
  default_priority  priority_tier NOT NULL DEFAULT 'CRITICAL',
  contact_email     citext,
  contact_phone     text CHECK (contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  name_ar      text NOT NULL,
  location_ar  text,
  org_unit_id  uuid REFERENCES organizational_units (id),
  capacity     smallint NOT NULL CHECK (capacity > 0),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. Identity, roles, sessions
-- -----------------------------------------------------------------------------

CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             text NOT NULL,
  email                 citext UNIQUE,
  phone_e164            text UNIQUE CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  password_hash         text NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  status                user_status NOT NULL DEFAULT 'PENDING_ACTIVATION',
  -- TOTP secret, AES-256-GCM under a master key: nonce(12) || ciphertext || tag(16).
  mfa_totp_secret_enc   bytea,
  mfa_key_id            text,
  mfa_enabled_at        timestamptz,
  failed_login_count    integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until          timestamptz,
  last_login_at         timestamptz,
  password_changed_at   timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_mfa_secret_has_key CHECK ((mfa_totp_secret_enc IS NULL) = (mfa_key_id IS NULL)),
  CONSTRAINT users_mfa_enabled_has_secret CHECK (mfa_enabled_at IS NULL OR mfa_totp_secret_enc IS NOT NULL)
);

-- Roles are grants, not a column: a user may hold several, some scoped to a unit,
-- and every grant/revocation is kept for the record.
CREATE TABLE user_roles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users (id),
  role                user_role NOT NULL,
  org_unit_id         uuid REFERENCES organizational_units (id),
  granted_by_user_id  uuid REFERENCES users (id),
  granted_at          timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz,
  CONSTRAINT user_roles_scoped_roles_have_unit
    CHECK (role NOT IN ('BRANCH_OFFICER', 'COMMITTEE_MEMBER') OR org_unit_id IS NOT NULL),
  CONSTRAINT user_roles_revoked_after_granted
    CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE UNIQUE INDEX user_roles_active_unique
  ON user_roles (user_id, role, org_unit_id) NULLS NOT DISTINCT WHERE revoked_at IS NULL;
-- There is one Grand Syndic of the Republic at any time.
CREATE UNIQUE INDEX user_roles_single_grand_syndic
  ON user_roles (role) WHERE role = 'GRAND_SYNDIC' AND revoked_at IS NULL;

CREATE TABLE lawyer_profiles (
  user_id               uuid PRIMARY KEY REFERENCES users (id),
  registration_number   text NOT NULL UNIQUE,            -- رقم القيد النقابي
  -- HMAC-SHA256(pepper, normalised national ID): equality lookup without storing the ID.
  national_id_hmac      bytea NOT NULL UNIQUE CHECK (octet_length(national_id_hmac) = 32),
  -- AES-256-GCM ciphertext for authorised display only.
  national_id_enc       bytea NOT NULL,
  national_id_key_id    text NOT NULL,
  branch_id             uuid NOT NULL REFERENCES organizational_units (id),
  practice_status       lawyer_practice_status NOT NULL,
  registered_on         date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lawyer_profiles_branch_idx ON lawyer_profiles (branch_id);

CREATE TABLE sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users (id),
  ip                   inet,
  user_agent           text,
  mfa_verified_at      timestamptz,
  last_seen_at         timestamptz NOT NULL DEFAULT now(),
  absolute_expires_at  timestamptz NOT NULL,
  revoked_at           timestamptz,
  revoked_reason       text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_active_idx ON sessions (user_id) WHERE revoked_at IS NULL;

-- One row per issued refresh token. Presenting a token whose rotated_at is set
-- is a replay: the whole session is revoked.
CREATE TABLE refresh_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions (id),
  token_hash      bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  issued_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  rotated_at      timestamptz,
  replaced_by_id  uuid REFERENCES refresh_tokens (id),
  CONSTRAINT refresh_tokens_rotation_consistent
    CHECK ((rotated_at IS NULL) = (replaced_by_id IS NULL))
);
CREATE UNIQUE INDEX refresh_tokens_one_live_per_session
  ON refresh_tokens (session_id) WHERE rotated_at IS NULL;

-- -----------------------------------------------------------------------------
-- 5. Tickets (supertype) — audience requests and grievances
-- -----------------------------------------------------------------------------

CREATE TABLE tickets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code        text NOT NULL UNIQUE,          -- shown to the requester
  kind                  ticket_kind NOT NULL,
  status                request_status NOT NULL DEFAULT 'PENDING_REVIEW',
  priority              priority_tier NOT NULL,
  submission_channel    submission_channel NOT NULL,
  submitted_by_user_id  uuid REFERENCES users (id),    -- NULL for anonymous public intake
  assigned_officer_id   uuid REFERENCES users (id),
  submitted_at          timestamptz NOT NULL DEFAULT now(),
  status_changed_at     timestamptz NOT NULL DEFAULT now(),
  closed_at             timestamptz,
  version               integer NOT NULL DEFAULT 1,    -- optimistic locking
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- Target of the (id, kind) foreign keys that pin each subtype row to its kind.
  CONSTRAINT tickets_id_kind_unique UNIQUE (id, kind),
  CONSTRAINT tickets_portal_submissions_identified
    CHECK (submission_channel = 'PUBLIC_PORTAL' OR submitted_by_user_id IS NOT NULL)
);
-- The Secretariat board: open work, by colour tier, oldest first.
CREATE INDEX tickets_queue_idx ON tickets (priority, submitted_at)
  WHERE status IN ('PENDING_REVIEW', 'AWAITING_DOCUMENTS');
CREATE INDEX tickets_submitter_idx ON tickets (submitted_by_user_id, submitted_at DESC);
CREATE INDEX tickets_officer_idx ON tickets (assigned_officer_id) WHERE closed_at IS NULL;

-- Allowed status transitions, per ticket kind. The service layer owns the state
-- machine; this table + trigger is a second, independent line of defence.
CREATE TABLE ticket_status_transitions (
  kind         ticket_kind NOT NULL,
  from_status  request_status NOT NULL,
  to_status    request_status NOT NULL,
  PRIMARY KEY (kind, from_status, to_status),
  CHECK (from_status <> to_status)
);

INSERT INTO ticket_status_transitions (kind, from_status, to_status) VALUES
  -- Audience requests
  ('AUDIENCE_REQUEST', 'PENDING_REVIEW',     'APPROVED'),
  ('AUDIENCE_REQUEST', 'PENDING_REVIEW',     'DELEGATED'),
  ('AUDIENCE_REQUEST', 'PENDING_REVIEW',     'AWAITING_DOCUMENTS'),
  ('AUDIENCE_REQUEST', 'PENDING_REVIEW',     'DECLINED'),
  ('AUDIENCE_REQUEST', 'PENDING_REVIEW',     'WITHDRAWN'),
  ('AUDIENCE_REQUEST', 'AWAITING_DOCUMENTS', 'PENDING_REVIEW'),
  ('AUDIENCE_REQUEST', 'AWAITING_DOCUMENTS', 'WITHDRAWN'),
  ('AUDIENCE_REQUEST', 'DELEGATED',          'PENDING_REVIEW'),  -- returned by the unit
  ('AUDIENCE_REQUEST', 'DELEGATED',          'CLOSED'),
  ('AUDIENCE_REQUEST', 'APPROVED',           'PENDING_REVIEW'),  -- appointment postponed
  ('AUDIENCE_REQUEST', 'APPROVED',           'CLOSED'),
  -- Grievances (routed, never scheduled with the Grand Syndic directly)
  ('GRIEVANCE',        'PENDING_REVIEW',     'DELEGATED'),
  ('GRIEVANCE',        'PENDING_REVIEW',     'AWAITING_DOCUMENTS'),
  ('GRIEVANCE',        'PENDING_REVIEW',     'DECLINED'),
  ('GRIEVANCE',        'PENDING_REVIEW',     'WITHDRAWN'),
  ('GRIEVANCE',        'AWAITING_DOCUMENTS', 'PENDING_REVIEW'),
  ('GRIEVANCE',        'AWAITING_DOCUMENTS', 'WITHDRAWN'),
  ('GRIEVANCE',        'DELEGATED',          'PENDING_REVIEW'),
  ('GRIEVANCE',        'DELEGATED',          'CLOSED');

CREATE FUNCTION tickets_enforce_lifecycle() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- No auto-confirmation, ever: every ticket starts under review.
    IF NEW.status <> 'PENDING_REVIEW' THEN
      RAISE EXCEPTION 'tickets must be created in PENDING_REVIEW (got %)', NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.kind <> OLD.kind THEN
    RAISE EXCEPTION 'ticket kind is immutable' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status <> OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM ticket_status_transitions
      WHERE kind = NEW.kind AND from_status = OLD.status AND to_status = NEW.status
    ) THEN
      RAISE EXCEPTION 'illegal % transition % -> %', NEW.kind, OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.status_changed_at := now();
    NEW.closed_at := CASE WHEN NEW.status IN ('DECLINED', 'WITHDRAWN', 'CLOSED') THEN now() END;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tickets_lifecycle
  BEFORE INSERT OR UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION tickets_enforce_lifecycle();

CREATE TABLE audience_requests (
  ticket_id               uuid PRIMARY KEY,
  ticket_kind             ticket_kind NOT NULL DEFAULT 'AUDIENCE_REQUEST'
                            CHECK (ticket_kind = 'AUDIENCE_REQUEST'),
  requester_type          requester_type NOT NULL,
  requester_full_name     text NOT NULL,
  official_capacity       text NOT NULL,                 -- الصفة الرسمية
  organization_name       text,
  external_entity_id      uuid REFERENCES external_entities (id),
  contact_phone_e164      text NOT NULL CHECK (contact_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  contact_email           citext,
  purpose                 text NOT NULL,
  preferred_meeting_mode  meeting_mode,
  expected_attendees      smallint NOT NULL DEFAULT 1 CHECK (expected_attendees BETWEEN 1 AND 50),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (ticket_id, ticket_kind) REFERENCES tickets (id, kind),
  -- Redundant with the primary key, but lets Prisma model the 1:1 subtype relation.
  CONSTRAINT audience_requests_ticket_kind_unique UNIQUE (ticket_id, ticket_kind)
);
CREATE INDEX audience_requests_entity_idx ON audience_requests (external_entity_id);

CREATE TABLE grievances (
  ticket_id                        uuid PRIMARY KEY,
  ticket_kind                      ticket_kind NOT NULL DEFAULT 'GRIEVANCE'
                                     CHECK (ticket_kind = 'GRIEVANCE'),
  grievance_type                   grievance_type NOT NULL,
  subject                          text NOT NULL,
  description                      text NOT NULL,
  respondent_lawyer_id             uuid REFERENCES lawyer_profiles (user_id),
  respondent_registration_number   text,
  court_name                       text,
  case_number                      text,
  incident_date                    date,
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (ticket_id, ticket_kind) REFERENCES tickets (id, kind),
  -- Redundant with the primary key, but lets Prisma model the 1:1 subtype relation.
  CONSTRAINT grievances_ticket_kind_unique UNIQUE (ticket_id, ticket_kind),
  CONSTRAINT grievances_peer_has_respondent CHECK (
    grievance_type <> 'AGAINST_LAWYER'
    OR respondent_lawyer_id IS NOT NULL OR respondent_registration_number IS NOT NULL),
  CONSTRAINT grievances_judicial_has_court CHECK (
    grievance_type <> 'JUDICIAL_MATTER' OR court_name IS NOT NULL)
);
CREATE INDEX grievances_respondent_idx ON grievances (respondent_lawyer_id);

-- -----------------------------------------------------------------------------
-- 6. Routing & document requests
-- -----------------------------------------------------------------------------

CREATE TABLE routing_assignments (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id                  uuid NOT NULL REFERENCES tickets (id),
  target_type                routing_target_type NOT NULL,
  target_org_unit_id         uuid REFERENCES organizational_units (id),
  target_external_entity_id  uuid REFERENCES external_entities (id),
  status                     routing_status NOT NULL DEFAULT 'ACTIVE',
  instructions               text,
  assigned_by_user_id        uuid NOT NULL REFERENCES users (id),
  assigned_at                timestamptz NOT NULL DEFAULT now(),
  acknowledged_at            timestamptz,
  resolved_at                timestamptz,
  resolution_note            text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  -- A real FK per target type instead of a polymorphic id column.
  CONSTRAINT routing_target_matches_type CHECK (
    (target_type = 'ORGANIZATIONAL_UNIT'
       AND target_org_unit_id IS NOT NULL AND target_external_entity_id IS NULL)
    OR (target_type = 'EXTERNAL_ENTITY'
       AND target_external_entity_id IS NOT NULL AND target_org_unit_id IS NULL))
);
CREATE UNIQUE INDEX routing_one_open_per_ticket
  ON routing_assignments (ticket_id) WHERE status IN ('ACTIVE', 'ACKNOWLEDGED');
CREATE INDEX routing_ticket_idx ON routing_assignments (ticket_id, assigned_at);
CREATE INDEX routing_unit_inbox_idx ON routing_assignments (target_org_unit_id, status);
CREATE INDEX routing_entity_inbox_idx ON routing_assignments (target_external_entity_id, status);

CREATE TABLE document_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id             uuid NOT NULL REFERENCES tickets (id),
  requested_by_user_id  uuid NOT NULL REFERENCES users (id),
  message               text NOT NULL,                 -- shown to the requester
  status                document_request_status NOT NULL DEFAULT 'OPEN',
  due_at                timestamptz NOT NULL,
  reminders_sent        smallint NOT NULL DEFAULT 0 CHECK (reminders_sent >= 0),
  fulfilled_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_requests_fulfilled_timestamp
    CHECK ((status = 'FULFILLED') = (fulfilled_at IS NOT NULL))
);
CREATE UNIQUE INDEX document_requests_one_open_per_ticket
  ON document_requests (ticket_id) WHERE status = 'OPEN';
CREATE INDEX document_requests_due_idx ON document_requests (due_at) WHERE status = 'OPEN';

-- -----------------------------------------------------------------------------
-- 7. Agenda, appointments, emergency overrides
-- -----------------------------------------------------------------------------

CREATE TABLE agenda_days (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_user_id  uuid NOT NULL REFERENCES users (id),  -- whose agenda (the Grand Syndic)
  agenda_date        date NOT NULL,                        -- local date in Asia/Damascus
  is_suspended       boolean NOT NULL DEFAULT false,       -- set by an emergency override
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_days_one_per_principal_date UNIQUE (principal_user_id, agenda_date)
);

CREATE TABLE emergency_overrides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_day_id         uuid NOT NULL REFERENCES agenda_days (id),
  action                emergency_action NOT NULL,
  effective_from        timestamptz NOT NULL,       -- appointments starting at/after this
  internal_reason       text,                       -- never sent to attendees
  initiated_by_user_id  uuid NOT NULL REFERENCES users (id),
  idempotency_key       text NOT NULL UNIQUE,
  job_id                text,
  job_status            job_status NOT NULL DEFAULT 'PENDING',
  affected_count        integer CHECK (affected_count >= 0),
  last_error            text,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX emergency_overrides_day_idx ON emergency_overrides (agenda_day_id);

CREATE TABLE appointments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id              uuid NOT NULL,
  ticket_kind            ticket_kind NOT NULL DEFAULT 'AUDIENCE_REQUEST'
                           CHECK (ticket_kind = 'AUDIENCE_REQUEST'),
  agenda_day_id          uuid NOT NULL REFERENCES agenda_days (id),
  principal_user_id      uuid NOT NULL REFERENCES users (id),
  status                 appointment_status NOT NULL DEFAULT 'SCHEDULED',
  starts_at              timestamptz NOT NULL,
  ends_at                timestamptz NOT NULL,
  -- Derived, so the application only ever writes starts_at / ends_at.
  slot                   tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
  meeting_mode           meeting_mode NOT NULL,
  room_id                uuid REFERENCES rooms (id),
  meeting_provider       text,
  meeting_url            text,
  meeting_external_id    text,
  scheduled_by_user_id   uuid NOT NULL REFERENCES users (id),
  rescheduled_from_id    uuid REFERENCES appointments (id),
  emergency_override_id  uuid REFERENCES emergency_overrides (id),
  cancellation_reason    text,
  version                integer NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (ticket_id, ticket_kind) REFERENCES tickets (id, kind),
  CONSTRAINT appointments_positive_duration CHECK (ends_at > starts_at),
  CONSTRAINT appointments_max_duration CHECK (ends_at - starts_at <= interval '8 hours'),
  CONSTRAINT appointments_mode_location CHECK (
    (meeting_mode = 'IN_PERSON' AND room_id IS NOT NULL AND meeting_url IS NULL)
    OR (meeting_mode = 'REMOTE' AND room_id IS NULL
        AND meeting_provider IS NOT NULL AND meeting_url IS NOT NULL)),
  -- Double-booking prevention, enforced by the database itself.
  CONSTRAINT appointments_no_principal_overlap
    EXCLUDE USING gist (principal_user_id WITH =, slot WITH &&) WHERE (status = 'SCHEDULED'),
  CONSTRAINT appointments_no_room_overlap
    EXCLUDE USING gist (room_id WITH =, slot WITH &&)
    WHERE (status = 'SCHEDULED' AND room_id IS NOT NULL)
);
CREATE UNIQUE INDEX appointments_one_live_per_ticket
  ON appointments (ticket_id) WHERE status = 'SCHEDULED';
CREATE INDEX appointments_agenda_idx ON appointments (agenda_day_id, starts_at);
CREATE INDEX appointments_ticket_idx ON appointments (ticket_id);

CREATE TABLE appointment_status_transitions (
  from_status  appointment_status NOT NULL,
  to_status    appointment_status NOT NULL,
  PRIMARY KEY (from_status, to_status),
  CHECK (from_status <> to_status)
);

INSERT INTO appointment_status_transitions (from_status, to_status) VALUES
  ('SCHEDULED', 'COMPLETED'),
  ('SCHEDULED', 'CANCELLED'),
  ('SCHEDULED', 'POSTPONED'),
  ('SCHEDULED', 'RESCHEDULED'),
  ('SCHEDULED', 'NO_SHOW'),
  ('POSTPONED', 'RESCHEDULED'),
  ('POSTPONED', 'CANCELLED');

CREATE FUNCTION appointments_enforce_lifecycle() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  day agenda_days%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'appointments must be created SCHEDULED (got %)', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status AND NOT EXISTS (
    SELECT 1 FROM appointment_status_transitions
    WHERE from_status = OLD.status AND to_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'illegal appointment transition % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'SCHEDULED' THEN
    SELECT * INTO day FROM agenda_days WHERE id = NEW.agenda_day_id;
    IF day.principal_user_id <> NEW.principal_user_id THEN
      RAISE EXCEPTION 'appointment principal does not match its agenda day'
        USING ERRCODE = 'check_violation';
    END IF;
    IF (NEW.starts_at AT TIME ZONE 'Asia/Damascus')::date <> day.agenda_date
       OR ((NEW.ends_at - interval '1 microsecond') AT TIME ZONE 'Asia/Damascus')::date
          <> day.agenda_date THEN
      RAISE EXCEPTION 'appointment must fall within its agenda day (Asia/Damascus)'
        USING ERRCODE = 'check_violation';
    END IF;
    IF day.is_suspended THEN
      RAISE EXCEPTION 'agenda day % is suspended by an emergency override', day.agenda_date
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER appointments_lifecycle
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION appointments_enforce_lifecycle();

CREATE TABLE appointment_attendees (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id     uuid NOT NULL REFERENCES appointments (id),
  user_id            uuid REFERENCES users (id),     -- NULL for external guests
  attendee_role      attendee_role NOT NULL,
  full_name          text NOT NULL,
  official_capacity  text,
  phone_e164         text CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email              citext,
  -- Copied from the parent appointment by trigger (never written by the app) so
  -- that an EXCLUDE constraint can stop a registered user being double-booked.
  slot               tstzrange NOT NULL DEFAULT 'empty',
  blocks_time        boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_attendees_unique_user UNIQUE (appointment_id, user_id),
  CONSTRAINT appointment_attendees_no_overlap
    EXCLUDE USING gist (user_id WITH =, slot WITH &&) WHERE (blocks_time AND user_id IS NOT NULL)
);

CREATE FUNCTION appointment_attendees_sync_slot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT a.slot, a.status = 'SCHEDULED'
    INTO NEW.slot, NEW.blocks_time
    FROM appointments a WHERE a.id = NEW.appointment_id;
  RETURN NEW;
END $$;

CREATE TRIGGER appointment_attendees_slot
  BEFORE INSERT OR UPDATE ON appointment_attendees
  FOR EACH ROW EXECUTE FUNCTION appointment_attendees_sync_slot();

CREATE FUNCTION appointments_propagate_slot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Touching the children re-runs appointment_attendees_sync_slot for each.
  UPDATE appointment_attendees SET slot = NEW.slot WHERE appointment_id = NEW.id;
  RETURN NULL;
END $$;

CREATE TRIGGER appointments_propagate_slot
  AFTER UPDATE OF starts_at, ends_at, status ON appointments
  FOR EACH ROW EXECUTE FUNCTION appointments_propagate_slot();

-- -----------------------------------------------------------------------------
-- 8. Encrypted documents & access tokens
-- -----------------------------------------------------------------------------

CREATE TABLE documents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id             uuid NOT NULL REFERENCES tickets (id),
  document_request_id   uuid REFERENCES document_requests (id),
  classification        document_classification NOT NULL DEFAULT 'CONFIDENTIAL',
  uploaded_by_user_id   uuid REFERENCES users (id),   -- NULL for public intake uploads
  -- Location of the ciphertext. The key is random and meaningless by design.
  storage_bucket        text NOT NULL,
  storage_key           text NOT NULL,
  -- Envelope encryption: a fresh 256-bit data key (DEK) per file, wrapped by a
  -- key-encryption key (KEK) that lives outside the database.
  kek_id                text NOT NULL,                -- which master key wrapped the DEK
  wrapped_dek           bytea NOT NULL CHECK (octet_length(wrapped_dek) = 60),  -- nonce||ct||tag
  content_iv            bytea NOT NULL CHECK (octet_length(content_iv) = 12),
  content_auth_tag      bytea NOT NULL CHECK (octet_length(content_auth_tag) = 16),
  -- Original file name etc., encrypted under the same DEK with its own nonce.
  metadata_enc          bytea NOT NULL,
  mime_type             text NOT NULL
                          CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  plaintext_size_bytes  bigint NOT NULL CHECK (plaintext_size_bytes > 0),
  plaintext_sha256      bytea NOT NULL CHECK (octet_length(plaintext_sha256) = 32),
  ciphertext_sha256     bytea NOT NULL CHECK (octet_length(ciphertext_sha256) = 32),
  scan_status           scan_status NOT NULL DEFAULT 'PENDING',
  scanned_at            timestamptz,
  deleted_at            timestamptz,
  deleted_by_user_id    uuid REFERENCES users (id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_storage_unique UNIQUE (storage_bucket, storage_key),
  CONSTRAINT documents_deletion_attributed
    CHECK ((deleted_at IS NULL) = (deleted_by_user_id IS NULL))
);
CREATE INDEX documents_ticket_idx ON documents (ticket_id) WHERE deleted_at IS NULL;
CREATE INDEX documents_kek_idx ON documents (kek_id);   -- key rotation sweeps
CREATE INDEX documents_scan_pending_idx ON documents (created_at) WHERE scan_status = 'PENDING';

-- Short-lived, session-bound view grants. Only the SHA-256 of the token is stored.
CREATE TABLE document_access_tokens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       uuid NOT NULL REFERENCES documents (id),
  user_id           uuid NOT NULL REFERENCES users (id),
  session_id        uuid NOT NULL REFERENCES sessions (id),
  token_hash        bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  issued_ip         inet,
  issued_at         timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  access_count      integer NOT NULL DEFAULT 0 CHECK (access_count >= 0),
  last_accessed_at  timestamptz,
  revoked_at        timestamptz,
  CONSTRAINT document_access_tokens_short_lived
    CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '15 minutes')
);
CREATE INDEX document_access_tokens_expiry_idx ON document_access_tokens (expires_at);
CREATE INDEX document_access_tokens_document_idx ON document_access_tokens (document_id);

-- Single-use links sent to people without accounts (reschedule responses,
-- document uploads). Consumed atomically with
--   UPDATE ... SET consumed_at = now()
--   WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now() RETURNING *;
CREATE TABLE action_tokens (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose              action_token_purpose NOT NULL,
  token_hash           bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  ticket_id            uuid NOT NULL REFERENCES tickets (id),
  appointment_id       uuid REFERENCES appointments (id),
  document_request_id  uuid REFERENCES document_requests (id),
  expires_at           timestamptz NOT NULL,
  consumed_at          timestamptz,
  consumed_ip          inet,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_tokens_reschedule_target
    CHECK (purpose <> 'RESCHEDULE_RESPONSE' OR appointment_id IS NOT NULL),
  CONSTRAINT action_tokens_upload_target
    CHECK (purpose <> 'DOCUMENT_UPLOAD' OR document_request_id IS NOT NULL)
);
CREATE INDEX action_tokens_ticket_idx ON action_tokens (ticket_id);

-- -----------------------------------------------------------------------------
-- 9. Notifications (transactional outbox)
-- -----------------------------------------------------------------------------

-- Templates are versioned and never edited in place once used, so every sent
-- message can be traced to the exact wording that went out.
CREATE TABLE notification_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  channel             notification_channel NOT NULL,
  locale              text NOT NULL DEFAULT 'ar' CHECK (locale = 'ar'),
  version             integer NOT NULL CHECK (version > 0),
  subject             text,
  body                text NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  created_by_user_id  uuid REFERENCES users (id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_templates_version_unique UNIQUE (code, channel, locale, version),
  CONSTRAINT notification_templates_email_subject CHECK (channel <> 'EMAIL' OR subject IS NOT NULL)
);
CREATE UNIQUE INDEX notification_templates_one_active
  ON notification_templates (code, channel, locale) WHERE is_active;

CREATE TABLE notifications (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel                notification_channel NOT NULL,
  template_id            uuid NOT NULL REFERENCES notification_templates (id),
  recipient_user_id      uuid REFERENCES users (id),
  recipient_address      text NOT NULL,            -- phone / e-mail as used at send time
  payload                jsonb NOT NULL DEFAULT '{}',
  rendered_subject       text,
  rendered_body          text,                     -- exactly what was sent
  status                 notification_status NOT NULL DEFAULT 'QUEUED',
  attempts               smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts           smallint NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_attempt_at        timestamptz NOT NULL DEFAULT now(),
  last_error             text,
  provider               text,
  provider_message_id    text,
  ticket_id              uuid REFERENCES tickets (id),
  appointment_id         uuid REFERENCES appointments (id),
  emergency_override_id  uuid REFERENCES emergency_overrides (id),
  dedupe_key             text UNIQUE,
  sent_at                timestamptz,
  delivered_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_dispatch_idx ON notifications (next_attempt_at)
  WHERE status IN ('QUEUED', 'FAILED');
CREATE INDEX notifications_ticket_idx ON notifications (ticket_id);
CREATE INDEX notifications_override_idx ON notifications (emergency_override_id)
  WHERE emergency_override_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 10. Idempotency keys for mutating endpoints
-- -----------------------------------------------------------------------------

CREATE TABLE idempotency_keys (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope            text NOT NULL,          -- e.g. 'POST /secretariat/requests/:id/approve'
  user_id          uuid REFERENCES users (id),
  key              text NOT NULL CHECK (length(key) BETWEEN 16 AND 128),
  request_hash     bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  response_status  smallint,
  response_body    jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  CONSTRAINT idempotency_keys_unique UNIQUE NULLS NOT DISTINCT (scope, user_id, key)
);
CREATE INDEX idempotency_keys_expiry_idx ON idempotency_keys (expires_at);

-- -----------------------------------------------------------------------------
-- 11. Immutable, hash-chained audit log
-- -----------------------------------------------------------------------------

CREATE TABLE audit_chain_head (
  singleton  boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  last_id    bigint,
  last_hash  bytea NOT NULL
);
INSERT INTO audit_chain_head (singleton, last_id, last_hash)
VALUES (true, NULL, '\x0000000000000000000000000000000000000000000000000000000000000000');

CREATE TABLE audit_logs (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_user_id     uuid REFERENCES users (id),
  actor_roles       user_role[] NOT NULL DEFAULT '{}',
  actor_ip          inet,
  actor_user_agent  text,
  session_id        uuid,                         -- no FK: audit must outlive sessions
  request_id        text,
  action            text NOT NULL CHECK (action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  entity_type       text NOT NULL,
  entity_id         text NOT NULL,
  before_state      jsonb,
  after_state       jsonb,
  metadata          jsonb NOT NULL DEFAULT '{}',
  prev_hash         bytea NOT NULL DEFAULT '\x',  -- set by trigger
  row_hash          bytea NOT NULL DEFAULT '\x'   -- set by trigger
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, id);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_user_id, occurred_at);

-- Canonical form hashed into the chain. jsonb's text output is deterministic.
CREATE FUNCTION audit_row_digest(prev bytea, r audit_logs) RETURNS bytea
LANGUAGE sql IMMUTABLE AS $$
  SELECT sha256(prev || convert_to(jsonb_build_array(
    r.id, r.occurred_at, r.actor_user_id, r.actor_roles, r.actor_ip, r.actor_user_agent,
    r.session_id, r.request_id, r.action, r.entity_type, r.entity_id,
    r.before_state, r.after_state, r.metadata
  )::text, 'UTF8'))
$$;

-- SECURITY DEFINER: runs as the schema owner, so the runtime role needs no
-- privilege on audit_chain_head and cannot move the chain head itself.
CREATE FUNCTION audit_logs_chain() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  prev bytea;
BEGIN
  -- The row lock serialises writers; under REPEATABLE READ a concurrent writer
  -- fails with a retryable serialization error instead of forking the chain.
  SELECT last_hash INTO prev FROM audit_chain_head WHERE singleton FOR UPDATE;
  NEW.occurred_at := clock_timestamp();
  NEW.prev_hash := prev;
  NEW.row_hash := audit_row_digest(prev, NEW);
  UPDATE audit_chain_head SET last_id = NEW.id, last_hash = NEW.row_hash WHERE singleton;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_logs_chain
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_chain();

CREATE FUNCTION audit_logs_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% rejected)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_mutation();
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_reject_mutation();

-- Returns the id of the first row whose hash does not verify, or NULL if intact.
CREATE FUNCTION audit_verify_chain() RETURNS bigint
LANGUAGE plpgsql STABLE AS $$
DECLARE
  r audit_logs%ROWTYPE;
  expected_prev bytea := '\x0000000000000000000000000000000000000000000000000000000000000000';
BEGIN
  FOR r IN SELECT * FROM audit_logs ORDER BY id LOOP
    IF r.prev_hash <> expected_prev OR r.row_hash <> audit_row_digest(r.prev_hash, r) THEN
      RETURN r.id;
    END IF;
    expected_prev := r.row_hash;
  END LOOP;
  RETURN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 12. updated_at maintenance
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_name = c.table_name AND tb.table_schema = c.table_schema
    WHERE c.table_schema = current_schema() AND c.column_name = 'updated_at'
      AND tb.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t || '_updated_at', t);
  END LOOP;
END $$;
