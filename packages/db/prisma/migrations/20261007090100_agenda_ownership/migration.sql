-- =============================================================================
-- Migration: agenda_ownership
-- D18  Appointments are independent of audience requests. The Grand Syndic can
--      enter his own appointments; they occupy his time like any other, so the
--      EXCLUDE constraint stops the Secretariat from booking over them. Private
--      entries show to the Secretariat only as "reserved".
-- D19  The Grand Syndic can transfer a scheduled audience to a council member.
--      The original row becomes TRANSFERRED (freeing his time) and a new row on
--      the member's agenda points back to it via transferred_from_id.
-- D20  Live tracking: the Secretariat records arrival, entry and exit times.
--      Status stays SCHEDULED until the meeting is COMPLETED, so the
--      double-booking constraint is unaffected.
-- =============================================================================

ALTER TABLE appointments
  ALTER COLUMN ticket_id DROP NOT NULL,
  ADD COLUMN origin appointment_origin NOT NULL DEFAULT 'SECRETARIAT',
  ADD COLUMN title text,
  ADD COLUMN is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN location_note text,
  ADD COLUMN transferred_from_id uuid REFERENCES appointments (id),
  ADD COLUMN transfer_note text,
  ADD COLUMN arrived_at timestamptz,
  ADD COLUMN started_at timestamptz,
  ADD COLUMN ended_at timestamptz;

-- A Secretariat booking always comes from a request; a principal's own entry never does.
ALTER TABLE appointments ADD CONSTRAINT appointments_origin_shape CHECK (
  (origin = 'SECRETARIAT' AND ticket_id IS NOT NULL)
  OR (origin = 'PRINCIPAL' AND ticket_id IS NULL AND title IS NOT NULL)
);

ALTER TABLE appointments ADD CONSTRAINT appointments_private_is_principal
  CHECK (NOT is_private OR origin = 'PRINCIPAL');

-- Secretariat bookings still need a room or a meeting link; the principal's own
-- entries may instead give a free-text place (e.g. an official visit elsewhere).
ALTER TABLE appointments DROP CONSTRAINT appointments_mode_location;
ALTER TABLE appointments ADD CONSTRAINT appointments_mode_location CHECK (
  (meeting_mode = 'IN_PERSON' AND meeting_url IS NULL
     AND (room_id IS NOT NULL OR (origin = 'PRINCIPAL' AND location_note IS NOT NULL)))
  OR (meeting_mode = 'REMOTE' AND room_id IS NULL
     AND ((meeting_provider IS NOT NULL AND meeting_url IS NOT NULL) OR origin = 'PRINCIPAL'))
);

ALTER TABLE appointments ADD CONSTRAINT appointments_not_transferred_from_self
  CHECK (transferred_from_id IS NULL OR transferred_from_id <> id);

ALTER TABLE appointments ADD CONSTRAINT appointments_tracking_order CHECK (
  (ended_at IS NULL OR started_at IS NOT NULL)
  AND (ended_at IS NULL OR ended_at >= started_at)
  AND (started_at IS NULL OR arrived_at IS NULL OR started_at >= arrived_at)
);

CREATE INDEX appointments_transferred_from_idx ON appointments (transferred_from_id)
  WHERE transferred_from_id IS NOT NULL;

INSERT INTO appointment_status_transitions (from_status, to_status) VALUES
  ('SCHEDULED', 'TRANSFERRED');
