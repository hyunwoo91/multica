-- name: ListMembers :many
SELECT * FROM member
WHERE workspace_id = $1
ORDER BY created_at ASC;

-- name: GetMember :one
SELECT * FROM member
WHERE id = $1;

-- name: GetMemberByUserAndWorkspace :one
SELECT * FROM member
WHERE user_id = $1 AND workspace_id = $2;

-- name: CreateMember :one
INSERT INTO member (workspace_id, user_id, role, profile_id)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateMemberRole :one
UPDATE member SET role = $2
WHERE id = $1
RETURNING *;

-- name: DeleteMember :exec
DELETE FROM member WHERE id = $1;

-- name: ListMembersWithUser :many
SELECT m.id, m.workspace_id, m.user_id, m.role, m.created_at,
       COALESCE(p.name, u.name) as user_name,
       u.email as user_email,
       COALESCE(p.avatar_url, u.avatar_url) as user_avatar_url,
       m.profile_id as profile_id
FROM member m
JOIN "user" u ON u.id = m.user_id
LEFT JOIN profile p ON p.id = m.profile_id
WHERE m.workspace_id = $1
ORDER BY m.created_at ASC;
