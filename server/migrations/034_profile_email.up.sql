-- Add email column to profile table (profiles are name + email pairs).
ALTER TABLE profile ADD COLUMN email TEXT NOT NULL DEFAULT '';

-- Backfill email from the user table.
UPDATE profile p SET email = u.email FROM "user" u WHERE u.id = p.user_id;
