-- =============================================================================
--  gt_010_booking_reminder.sql · track the one-time registration reminder
-- =============================================================================
--  So the scheduled reminder is sent at most once per booking. Null means "not
--  reminded yet"; set once the reminder goes out.
-- =============================================================================

alter table public.gt_bookings add column if not exists reminder_sent_at timestamptz;
