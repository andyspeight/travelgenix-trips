-- =============================================================================
--  gt_020_abandoned_recovery.sql · track the one-time abandoned-booking nudge
-- =============================================================================
--  An abandoned booking is a hold that was reserved but never completed: still
--  `pending`, its hold has expired, no deposit taken. A daily job emails the
--  traveller once to invite them back. Null means "not recovered yet"; set once
--  the recovery email goes out, so it is sent at most once. Sibling of
--  reminder_sent_at (gt_010), a different trigger and a different message.
-- =============================================================================

alter table public.gt_bookings add column if not exists recovery_sent_at timestamptz;
