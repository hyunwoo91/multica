-- name: GetProfile :one
SELECT * FROM profile
WHERE id = $1;

-- name: GetDefaultProfile :one
SELECT * FROM profile
WHERE user_id = $1 AND is_default = true;

-- name: ListProfilesByUser :many
SELECT * FROM profile
WHERE user_id = $1
ORDER BY is_default DESC, created_at ASC;

-- name: CreateProfile :one
INSERT INTO profile (user_id, name, avatar_url, is_default)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateProfile :one
UPDATE profile SET
    name = COALESCE(sqlc.narg('name'), name),
    avatar_url = COALESCE(sqlc.narg('avatar_url'), avatar_url),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteProfile :exec
DELETE FROM profile WHERE id = $1;

-- name: ResetMembersToDefaultProfile :exec
UPDATE member m
SET profile_id = (
    SELECT p.id FROM profile p
    WHERE p.user_id = m.user_id AND p.is_default = true
)
WHERE m.profile_id = $1;

-- name: SetMemberProfile :one
UPDATE member SET profile_id = $2
WHERE id = $1
RETURNING *;
