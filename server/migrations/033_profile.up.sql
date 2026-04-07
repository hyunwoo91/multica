-- Profile table: users can have multiple named profiles (name + avatar).
CREATE TABLE profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each user can have exactly one default profile.
CREATE UNIQUE INDEX idx_profile_user_default ON profile(user_id) WHERE is_default = true;
CREATE INDEX idx_profile_user ON profile(user_id);

-- Link workspace membership to a chosen profile.
ALTER TABLE member ADD COLUMN profile_id UUID REFERENCES profile(id) ON DELETE SET NULL;

-- Backfill: create a default profile for every existing user from their current name/avatar.
INSERT INTO profile (user_id, name, avatar_url, is_default)
SELECT id, name, avatar_url, true FROM "user";

-- Point existing members at their user's default profile.
UPDATE member m
SET profile_id = p.id
FROM profile p
WHERE p.user_id = m.user_id AND p.is_default = true;
