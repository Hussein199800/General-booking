-- =============================================================================
-- Constraint checks against the migrated schema. Every rejection below must
-- fail with the exact SQLSTATE given and every acceptance must succeed;
-- otherwise the script aborts. Everything runs in one transaction that is
-- rolled back, so the database is left exactly as it was.
--
-- Run as the schema owner (superuser in Docker/CI) on a migrated database
-- with no Grand Syndic grant yet (i.e. before demo seeding):
--   psql -v ON_ERROR_STOP=1 -f packages/db/tests/constraints.checks.sql
-- =============================================================================

\set QUIET on
SET client_min_messages = notice;
\o /dev/null

BEGIN;

CREATE FUNCTION pg_temp.expect_error(stmt text, expected_state text, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN
      RAISE NOTICE 'ok  rejects: %', label;
      RETURN;
    END IF;
    RAISE EXCEPTION 'FAIL %: expected SQLSTATE %, got % (%)', label, expected_state, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL %: statement succeeded but must be rejected', label;
END $$;

CREATE FUNCTION pg_temp.expect_ok(stmt text, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE NOTICE 'ok  accepts: %', label;
END $$;

-- Fixtures --------------------------------------------------------------------

INSERT INTO organizational_units (id, unit_type, code, name_ar, governorate) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'REGIONAL_BRANCH', 'BRANCH_DAMASCUS', 'x', 'DAMASCUS');

INSERT INTO users (id, full_name, email, password_hash, status) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'syndic',  'syndic@example.test',  '$argon2id$v=19$m=65536,t=3,p=4$x$y', 'ACTIVE'),
  ('00000000-0000-0000-0000-0000000000a2', 'officer', 'officer@example.test', '$argon2id$v=19$m=65536,t=3,p=4$x$y', 'ACTIVE'),
  ('00000000-0000-0000-0000-0000000000a3', 'lawyer',  'lawyer@example.test',  '$argon2id$v=19$m=65536,t=3,p=4$x$y', 'ACTIVE'),
  ('00000000-0000-0000-0000-0000000000a4', 'deputy',  'deputy@example.test',  '$argon2id$v=19$m=65536,t=3,p=4$x$y', 'ACTIVE');

INSERT INTO user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'GRAND_SYNDIC'),
  ('00000000-0000-0000-0000-0000000000a2', 'SECRETARIAT_OFFICER');

INSERT INTO rooms (id, code, name_ar, capacity) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'MAIN_HALL', 'x', 20);

INSERT INTO agenda_days (id, principal_user_id, agenda_date) VALUES
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-07'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a4', '2026-10-07');

INSERT INTO tickets (id, reference_code, kind, priority, submission_channel) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'REQ-1', 'AUDIENCE_REQUEST', 'CRITICAL', 'PUBLIC_PORTAL'),
  ('00000000-0000-0000-0000-0000000000e2', 'REQ-2', 'AUDIENCE_REQUEST', 'STANDARD', 'PUBLIC_PORTAL'),
  ('00000000-0000-0000-0000-0000000000e3', 'REQ-3', 'AUDIENCE_REQUEST', 'STANDARD', 'PUBLIC_PORTAL'),
  ('00000000-0000-0000-0000-0000000000e4', 'REQ-4', 'AUDIENCE_REQUEST', 'STANDARD', 'PUBLIC_PORTAL'),
  ('00000000-0000-0000-0000-0000000000e5', 'REQ-5', 'AUDIENCE_REQUEST', 'STANDARD', 'PUBLIC_PORTAL');
INSERT INTO tickets (id, reference_code, kind, priority, submission_channel, submitted_by_user_id) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'GRV-1', 'GRIEVANCE', 'INTERNAL', 'LAWYER_PORTAL',
   '00000000-0000-0000-0000-0000000000a3');

-- 1. Ticket lifecycle -----------------------------------------------------------

SELECT pg_temp.expect_error($$
  INSERT INTO tickets (reference_code, kind, status, priority, submission_channel)
  VALUES ('REQ-X', 'AUDIENCE_REQUEST', 'APPROVED', 'STANDARD', 'PUBLIC_PORTAL')
$$, '23514', 'ticket created already APPROVED (no auto-confirmation)');

SELECT pg_temp.expect_error($$
  INSERT INTO tickets (reference_code, kind, priority, submission_channel)
  VALUES ('GRV-X', 'GRIEVANCE', 'INTERNAL', 'LAWYER_PORTAL')
$$, '23514', 'lawyer-portal ticket without an identified submitter');

SELECT pg_temp.expect_error($$
  UPDATE tickets SET status = 'CLOSED' WHERE id = '00000000-0000-0000-0000-0000000000e1'
$$, '23514', 'illegal transition PENDING_REVIEW -> CLOSED');

SELECT pg_temp.expect_error($$
  UPDATE tickets SET status = 'APPROVED' WHERE id = '00000000-0000-0000-0000-0000000000f1'
$$, '23514', 'grievance cannot be APPROVED for the agenda');

SELECT pg_temp.expect_error($$
  UPDATE tickets SET kind = 'GRIEVANCE' WHERE id = '00000000-0000-0000-0000-0000000000e1'
$$, '23514', 'changing a ticket kind');

SELECT pg_temp.expect_ok($$
  UPDATE tickets SET status = 'APPROVED' WHERE id IN (
    '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2',
    '00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e4',
    '00000000-0000-0000-0000-0000000000e5')
$$, 'legal transition PENDING_REVIEW -> APPROVED');

SELECT pg_temp.expect_error($$
  INSERT INTO grievances (ticket_id, grievance_type, subject, description, court_name)
  VALUES ('00000000-0000-0000-0000-0000000000e1', 'JUDICIAL_MATTER', 's', 'd', 'c')
$$, '23503', 'grievance detail row attached to an audience-request ticket');

SELECT pg_temp.expect_error($$
  INSERT INTO grievances (ticket_id, grievance_type, subject, description)
  VALUES ('00000000-0000-0000-0000-0000000000f1', 'AGAINST_LAWYER', 's', 'd')
$$, '23514', 'peer grievance without a respondent');

-- 2. Double-booking prevention --------------------------------------------------

SELECT pg_temp.expect_ok($$
  INSERT INTO appointments (id, ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, room_id, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000e1',
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1',
    '2026-10-07 10:00+03', '2026-10-07 10:30+03', 'IN_PERSON',
    '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2')
$$, 'Syndic 10:00-10:30 in MAIN_HALL');

SELECT pg_temp.expect_error($$
  INSERT INTO appointments (ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, meeting_provider, meeting_url, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000a1', '2026-10-07 10:15+03', '2026-10-07 10:45+03',
    'REMOTE', 'jitsi', 'https://meet.example/x', '00000000-0000-0000-0000-0000000000a2')
$$, '23P01', 'Syndic double-booked 10:15-10:45 (even remotely)');

SELECT pg_temp.expect_error($$
  INSERT INTO appointments (ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, room_id, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000a4', '2026-10-07 10:20+03', '2026-10-07 10:40+03',
    'IN_PERSON', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2')
$$, '23P01', 'MAIN_HALL double-booked by another principal');

SELECT pg_temp.expect_ok($$
  INSERT INTO appointments (id, ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, meeting_provider, meeting_url, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-0000000000e2',
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1',
    '2026-10-07 10:30+03', '2026-10-07 11:00+03', 'REMOTE', 'jitsi',
    'https://meet.example/y', '00000000-0000-0000-0000-0000000000a2')
$$, 'back-to-back 10:30-11:00 (half-open ranges touch, do not overlap)');

SELECT pg_temp.expect_error($$
  INSERT INTO appointments (ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, meeting_provider, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000a1', '2026-10-07 12:00+03', '2026-10-07 12:30+03',
    'REMOTE', 'jitsi', '00000000-0000-0000-0000-0000000000a2')
$$, '23514', 'remote appointment without a meeting link');

SELECT pg_temp.expect_error($$
  INSERT INTO appointments (ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, room_id, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000a1', '2026-10-08 10:00+03', '2026-10-08 10:30+03',
    'IN_PERSON', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2')
$$, '23514', 'appointment outside its agenda day (Damascus local date)');

SELECT pg_temp.expect_error($$
  INSERT INTO appointments (ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, room_id, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000a4', '2026-10-07 13:00+03', '2026-10-07 13:30+03',
    'IN_PERSON', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2')
$$, '23514', 'principal differs from the agenda day owner');

SELECT pg_temp.expect_error($$
  INSERT INTO appointments (ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, room_id, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000a1', '2026-10-07 14:00+03', '2026-10-07 14:30+03',
    'IN_PERSON', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2')
$$, '23503', 'scheduling a grievance ticket on the agenda');

-- 3. Attendee-level conflicts (denormalised slot kept in sync by triggers) -----

SELECT pg_temp.expect_ok($$
  INSERT INTO appointment_attendees (appointment_id, user_id, attendee_role, full_name)
  VALUES ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-0000000000a3',
    'REQUESTER', 'lawyer')
$$, 'lawyer attends 10:30-11:00');

SELECT pg_temp.expect_ok($$
  INSERT INTO appointments (id, ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, meeting_provider, meeting_url, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-0000000000e3',
    '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a4',
    '2026-10-07 10:45+03', '2026-10-07 11:15+03', 'REMOTE', 'jitsi',
    'https://meet.example/z', '00000000-0000-0000-0000-0000000000a2')
$$, 'deputy meeting 10:45-11:15');

SELECT pg_temp.expect_error($$
  INSERT INTO appointment_attendees (appointment_id, user_id, attendee_role, full_name)
  VALUES ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-0000000000a3',
    'ATTENDEE', 'lawyer')
$$, '23P01', 'same lawyer booked into an overlapping meeting');

SELECT pg_temp.expect_error($$
  UPDATE appointment_attendees SET slot = 'empty', blocks_time = false
  WHERE user_id = '00000000-0000-0000-0000-0000000000a3'
    AND appointment_id = '00000000-0000-0000-0000-000000000102';
  INSERT INTO appointment_attendees (appointment_id, user_id, attendee_role, full_name)
  VALUES ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-0000000000a3',
    'ATTENDEE', 'lawyer')
$$, '23P01', 'application cannot spoof the denormalised slot to dodge the check');

-- 4. Appointment lifecycle & emergency postponement ----------------------------

SELECT pg_temp.expect_ok($$
  UPDATE appointments SET status = 'POSTPONED'
  WHERE id = '00000000-0000-0000-0000-000000000102'
$$, 'postpone 10:30-11:00');

SELECT pg_temp.expect_ok($$
  INSERT INTO appointment_attendees (appointment_id, user_id, attendee_role, full_name)
  VALUES ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-0000000000a3',
    'ATTENDEE', 'lawyer')
$$, 'postponement released the lawyer''s time');

SELECT pg_temp.expect_ok($$
  INSERT INTO appointments (id, ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, meeting_provider, meeting_url, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-0000000000e4',
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1',
    '2026-10-07 10:30+03', '2026-10-07 11:00+03', 'REMOTE', 'jitsi',
    'https://meet.example/w', '00000000-0000-0000-0000-0000000000a2')
$$, 'postponement released the Syndic''s slot');

SELECT pg_temp.expect_error($$
  UPDATE appointments SET status = 'SCHEDULED'
  WHERE id = '00000000-0000-0000-0000-000000000102'
$$, '23514', 'illegal transition POSTPONED -> SCHEDULED');

SELECT pg_temp.expect_ok($$
  UPDATE agenda_days SET is_suspended = true WHERE id = '00000000-0000-0000-0000-0000000000d1'
$$, 'emergency override suspends the day');

SELECT pg_temp.expect_error($$
  INSERT INTO appointments (ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, room_id, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000a1', '2026-10-07 15:00+03', '2026-10-07 15:30+03',
    'IN_PERSON', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2')
$$, '23514', 'new booking on a suspended day');

SELECT pg_temp.expect_ok($$
  UPDATE appointments SET status = 'CANCELLED'
  WHERE id = '00000000-0000-0000-0000-000000000101'
$$, 'cancelling the remaining appointment on a suspended day');

-- 4b. Principal-owned entries, transfers, live tracking (D18–D20) ------------

INSERT INTO agenda_days (id, principal_user_id, agenda_date) VALUES
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', '2026-10-08'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a4', '2026-10-08');

SELECT pg_temp.expect_ok($$
  INSERT INTO appointments (id, origin, title, is_private, agenda_day_id, principal_user_id,
    starts_at, ends_at, meeting_mode, location_note, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-000000000105', 'PRINCIPAL', 'x', true,
    '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1',
    '2026-10-08 16:00+03', '2026-10-08 17:00+03', 'IN_PERSON', 'x',
    '00000000-0000-0000-0000-0000000000a1')
$$, 'Grand Syndic enters his own private appointment (no request behind it)');

SELECT pg_temp.expect_error($$
  INSERT INTO appointments (ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, room_id, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000a1', '2026-10-08 16:30+03', '2026-10-08 17:00+03',
    'IN_PERSON', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2')
$$, '23P01', 'Secretariat booking over the Grand Syndic''s own entry');

SELECT pg_temp.expect_error($$
  INSERT INTO appointments (origin, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, location_note, scheduled_by_user_id)
  VALUES ('PRINCIPAL', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1',
    '2026-10-08 18:00+03', '2026-10-08 18:30+03', 'IN_PERSON', 'x', '00000000-0000-0000-0000-0000000000a1')
$$, '23514', 'principal entry without a title');

SELECT pg_temp.expect_error($$
  INSERT INTO appointments (agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, room_id, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1',
    '2026-10-08 18:00+03', '2026-10-08 18:30+03', 'IN_PERSON',
    '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2')
$$, '23514', 'Secretariat booking without an audience request');

SELECT pg_temp.expect_error($$
  INSERT INTO appointments (ticket_id, is_private, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, room_id, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-0000000000e5', true, '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-0000000000a1', '2026-10-08 10:00+03', '2026-10-08 10:30+03',
    'IN_PERSON', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2')
$$, '23514', 'a request-based booking marked private');

SELECT pg_temp.expect_ok($$
  INSERT INTO appointments (id, ticket_id, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, room_id, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-0000000000e5',
    '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1',
    '2026-10-08 10:00+03', '2026-10-08 10:30+03', 'IN_PERSON',
    '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2');
  UPDATE appointments SET status = 'TRANSFERRED' WHERE id = '00000000-0000-0000-0000-000000000106';
  INSERT INTO appointments (id, ticket_id, transferred_from_id, transfer_note, agenda_day_id,
    principal_user_id, starts_at, ends_at, meeting_mode, room_id, scheduled_by_user_id)
  VALUES ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-0000000000e5',
    '00000000-0000-0000-0000-000000000106', 'x', '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000a4', '2026-10-08 10:00+03', '2026-10-08 10:30+03',
    'IN_PERSON', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1')
$$, 'audience transferred to a council member, same room and time');

SELECT pg_temp.expect_ok($$
  INSERT INTO appointments (origin, title, agenda_day_id, principal_user_id, starts_at, ends_at,
    meeting_mode, location_note, scheduled_by_user_id)
  VALUES ('PRINCIPAL', 'x', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1',
    '2026-10-08 10:00+03', '2026-10-08 10:30+03', 'IN_PERSON', 'x', '00000000-0000-0000-0000-0000000000a1')
$$, 'transfer released the Grand Syndic''s slot');

SELECT pg_temp.expect_error($$
  UPDATE appointments SET ended_at = now() WHERE id = '00000000-0000-0000-0000-000000000107'
$$, '23514', 'live tracking: meeting ended before it started');

SELECT pg_temp.expect_error($$
  UPDATE appointments SET arrived_at = '2026-10-08 10:05+03', started_at = '2026-10-08 10:00+03'
  WHERE id = '00000000-0000-0000-0000-000000000107'
$$, '23514', 'live tracking: entered the office before arriving');

SELECT pg_temp.expect_ok($$
  UPDATE appointments SET arrived_at = '2026-10-08 09:55+03', started_at = '2026-10-08 10:02+03',
    ended_at = '2026-10-08 10:28+03'
  WHERE id = '00000000-0000-0000-0000-000000000107'
$$, 'live tracking: arrived, entered, left');


-- 5. Identity, tokens -----------------------------------------------------------

SELECT pg_temp.expect_error($$
  INSERT INTO user_roles (user_id, role)
  VALUES ('00000000-0000-0000-0000-0000000000a4', 'GRAND_SYNDIC')
$$, '23505', 'a second active Grand Syndic');

SELECT pg_temp.expect_error($$
  INSERT INTO users (full_name, email, password_hash)
  VALUES ('weak', 'weak@example.test', '$2b$10$bcrypt-not-allowed')
$$, '23514', 'password hash that is not Argon2id');

SELECT pg_temp.expect_error($$
  INSERT INTO sessions (id, user_id, absolute_expires_at)
  VALUES ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000a2', now() + interval '8 hours');
  INSERT INTO documents (id, ticket_id, storage_bucket, storage_key, kek_id, wrapped_dek,
    content_iv, content_auth_tag, metadata_enc, mime_type, plaintext_size_bytes,
    plaintext_sha256, ciphertext_sha256)
  VALUES ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-0000000000e1',
    'sba-documents', 'k1', 'kek-1', decode(repeat('00', 60), 'hex'),
    decode(repeat('00', 12), 'hex'), decode(repeat('00', 16), 'hex'), '\x01', 'application/pdf',
    10, sha256('\x01'), sha256('\x02'));
  INSERT INTO document_access_tokens (document_id, user_id, session_id, token_hash, expires_at)
  VALUES ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-000000000201', sha256('\x03'), now() + interval '1 hour')
$$, '23514', 'document view token valid for an hour');

SELECT pg_temp.expect_error($$
  INSERT INTO documents (ticket_id, storage_bucket, storage_key, kek_id, wrapped_dek,
    content_iv, content_auth_tag, metadata_enc, mime_type, plaintext_size_bytes,
    plaintext_sha256, ciphertext_sha256)
  VALUES ('00000000-0000-0000-0000-0000000000e1', 'sba-documents', 'k2', 'kek-1',
    decode(repeat('00', 60), 'hex'), decode(repeat('00', 12), 'hex'),
    decode(repeat('00', 16), 'hex'), '\x01', 'application/x-msdownload', 10,
    sha256('\x01'), sha256('\x02'))
$$, '23514', 'executable uploaded as a document');

INSERT INTO action_tokens (purpose, token_hash, ticket_id, appointment_id, expires_at)
VALUES ('RESCHEDULE_RESPONSE', sha256('\x04'), '00000000-0000-0000-0000-0000000000e2',
  '00000000-0000-0000-0000-000000000102', now() + interval '7 days');

DO $$
DECLARE
  first_use int;
  second_use int;
BEGIN
  WITH c AS (UPDATE action_tokens SET consumed_at = now()
             WHERE token_hash = sha256('\x04') AND consumed_at IS NULL AND expires_at > now()
             RETURNING 1) SELECT count(*) INTO first_use FROM c;
  WITH c AS (UPDATE action_tokens SET consumed_at = now()
             WHERE token_hash = sha256('\x04') AND consumed_at IS NULL AND expires_at > now()
             RETURNING 1) SELECT count(*) INTO second_use FROM c;
  IF first_use <> 1 OR second_use <> 0 THEN
    RAISE EXCEPTION 'FAIL reschedule token is not single-use (% then %)', first_use, second_use;
  END IF;
  RAISE NOTICE 'ok  accepts: reschedule token consumed exactly once';
END $$;

-- 6. Audit log: append-only, hash-chained, least privilege ---------------------

INSERT INTO audit_logs (actor_user_id, actor_roles, action, entity_type, entity_id, before_state, after_state)
VALUES
  ('00000000-0000-0000-0000-0000000000a2', '{SECRETARIAT_OFFICER}', 'ticket.approve', 'ticket',
   '00000000-0000-0000-0000-0000000000e1', '{"status":"PENDING_REVIEW"}', '{"status":"APPROVED"}'),
  ('00000000-0000-0000-0000-0000000000a1', '{GRAND_SYNDIC}', 'agenda.emergency_reschedule', 'agenda_day',
   '00000000-0000-0000-0000-0000000000d1', '{"is_suspended":false}', '{"is_suspended":true}');

DO $$
BEGIN
  IF audit_verify_chain() IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL audit chain does not verify';
  END IF;
  RAISE NOTICE 'ok  accepts: audit chain verifies';
END $$;

SELECT pg_temp.expect_error($$ UPDATE audit_logs SET action = 'ticket.decline' $$,
  '42501', 'UPDATE on audit_logs (even as owner)');
SELECT pg_temp.expect_error($$ DELETE FROM audit_logs $$,
  '42501', 'DELETE on audit_logs (even as owner)');
SELECT pg_temp.expect_error($$ TRUNCATE audit_logs $$,
  '42501', 'TRUNCATE on audit_logs (even as owner)');

SET ROLE sba_app;
SELECT pg_temp.expect_ok($$
  INSERT INTO audit_logs (action, entity_type, entity_id) VALUES ('ticket.view', 'ticket', 'e1')
$$, 'runtime role appends to the audit log');
SELECT pg_temp.expect_error($$ UPDATE audit_chain_head SET last_hash = '\x00' $$,
  '42501', 'runtime role moving the chain head');
SELECT pg_temp.expect_error($$ DELETE FROM tickets $$,
  '42501', 'runtime role hard-deleting legal records');
SELECT pg_temp.expect_error($$
  INSERT INTO ticket_status_transitions VALUES ('GRIEVANCE', 'PENDING_REVIEW', 'APPROVED')
$$, '42501', 'runtime role widening the state machine');
RESET ROLE;

-- Tampering by someone with superuser rights is not prevented, but it is detected.
ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update_delete;
UPDATE audit_logs SET after_state = '{"status":"DECLINED"}' WHERE action = 'ticket.approve';
ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_update_delete;

DO $$
DECLARE
  broken bigint := audit_verify_chain();
BEGIN
  IF broken IS NULL THEN
    RAISE EXCEPTION 'FAIL tampering went undetected';
  END IF;
  RAISE NOTICE 'ok  detects: tampered audit row id=%', broken;
END $$;

ROLLBACK;

\echo 'ALL SCHEMA CHECKS PASSED'
