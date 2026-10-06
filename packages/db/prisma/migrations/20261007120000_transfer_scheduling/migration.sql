-- =============================================================================
-- Migration: transfer_scheduling  (decision D21, approved 2026-10-07)
-- When the Grand Syndic transfers an audience to a council member he chooses:
--   * keep the same time  -> the member's appointment is created at once, or
--   * a new time          -> the original row is TRANSFERRED with its target
--                            recorded, and the member or the Secretariat
--                            schedules the continuation later.
-- The target is therefore stored on the original row, and the database checks
-- that any continuation lands on that member's agenda, once.
-- =============================================================================

ALTER TABLE appointments ADD COLUMN transferred_to_user_id uuid REFERENCES users (id);

ALTER TABLE appointments ADD CONSTRAINT appointments_transfer_target
  CHECK ((status = 'TRANSFERRED') = (transferred_to_user_id IS NOT NULL));

-- One continuation per transfer (later moves use rescheduled_from_id).
DROP INDEX appointments_transferred_from_idx;
CREATE UNIQUE INDEX appointments_one_continuation_per_transfer
  ON appointments (transferred_from_id) WHERE transferred_from_id IS NOT NULL;

-- Transfers still waiting for a time, per member.
CREATE INDEX appointments_transfer_target_idx
  ON appointments (transferred_to_user_id) WHERE status = 'TRANSFERRED';

CREATE FUNCTION appointments_check_transfer() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parent appointments%ROWTYPE;
BEGIN
  IF NEW.transferred_from_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO parent FROM appointments WHERE id = NEW.transferred_from_id;
  IF parent.status IS DISTINCT FROM 'TRANSFERRED' THEN
    RAISE EXCEPTION 'continuation of an appointment that was not transferred'
      USING ERRCODE = 'check_violation';
  END IF;
  IF parent.transferred_to_user_id IS DISTINCT FROM NEW.principal_user_id THEN
    RAISE EXCEPTION 'transferred appointment must continue on the chosen member''s agenda'
      USING ERRCODE = 'check_violation';
  END IF;
  IF parent.ticket_id IS DISTINCT FROM NEW.ticket_id THEN
    RAISE EXCEPTION 'transferred appointment must keep its audience request'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER appointments_transfer_continuity
  BEFORE INSERT OR UPDATE OF transferred_from_id, principal_user_id, ticket_id ON appointments
  FOR EACH ROW EXECUTE FUNCTION appointments_check_transfer();
