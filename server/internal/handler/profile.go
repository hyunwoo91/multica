package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type ProfileResponse struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Email     string  `json:"email"`
	AvatarURL *string `json:"avatar_url"`
	IsDefault bool    `json:"is_default"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

func profileToResponse(p db.Profile) ProfileResponse {
	return ProfileResponse{
		ID:        uuidToString(p.ID),
		Name:      p.Name,
		Email:     p.Email,
		AvatarURL: textToPtr(p.AvatarUrl),
		IsDefault: p.IsDefault,
		CreatedAt: timestampToString(p.CreatedAt),
		UpdatedAt: timestampToString(p.UpdatedAt),
	}
}

// ListProfiles returns all profiles for the authenticated user.
func (h *Handler) ListProfiles(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	profiles, err := h.Queries.ListProfilesByUser(r.Context(), parseUUID(userID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list profiles")
		return
	}

	resp := make([]ProfileResponse, len(profiles))
	for i, p := range profiles {
		resp[i] = profileToResponse(p)
	}
	writeJSON(w, http.StatusOK, resp)
}

type CreateProfileRequest struct {
	Name      string  `json:"name"`
	Email     string  `json:"email"`
	AvatarURL *string `json:"avatar_url"`
}

// CreateProfile creates a new non-default profile for the authenticated user.
func (h *Handler) CreateProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req CreateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	params := db.CreateProfileParams{
		UserID:    parseUUID(userID),
		Name:      name,
		Email:     email,
		IsDefault: false,
	}
	if req.AvatarURL != nil {
		params.AvatarUrl = pgtype.Text{String: strings.TrimSpace(*req.AvatarURL), Valid: true}
	}

	profile, err := h.Queries.CreateProfile(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create profile")
		return
	}

	writeJSON(w, http.StatusCreated, profileToResponse(profile))
}

type UpdateProfileRequest struct {
	Name      *string `json:"name"`
	Email     *string `json:"email"`
	AvatarURL *string `json:"avatar_url"`
}

// UpdateProfile updates an existing profile owned by the authenticated user.
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	profileID := chi.URLParam(r, "id")
	profile, err := h.Queries.GetProfile(r.Context(), parseUUID(profileID))
	if err != nil {
		writeError(w, http.StatusNotFound, "profile not found")
		return
	}

	if uuidToString(profile.UserID) != userID {
		writeError(w, http.StatusForbidden, "not your profile")
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	params := db.UpdateProfileParams{ID: profile.ID}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "name cannot be empty")
			return
		}
		params.Name = pgtype.Text{String: name, Valid: true}
	}
	if req.Email != nil {
		email := strings.ToLower(strings.TrimSpace(*req.Email))
		if email == "" {
			writeError(w, http.StatusBadRequest, "email cannot be empty")
			return
		}
		params.Email = pgtype.Text{String: email, Valid: true}
	}
	if req.AvatarURL != nil {
		params.AvatarUrl = pgtype.Text{String: strings.TrimSpace(*req.AvatarURL), Valid: true}
	}

	updated, err := h.Queries.UpdateProfile(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	writeJSON(w, http.StatusOK, profileToResponse(updated))
}

// DeleteProfile deletes a non-default profile. Members using it are reassigned to the default profile.
func (h *Handler) DeleteProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	profileID := chi.URLParam(r, "id")
	profile, err := h.Queries.GetProfile(r.Context(), parseUUID(profileID))
	if err != nil {
		writeError(w, http.StatusNotFound, "profile not found")
		return
	}

	if uuidToString(profile.UserID) != userID {
		writeError(w, http.StatusForbidden, "not your profile")
		return
	}

	if profile.IsDefault {
		writeError(w, http.StatusBadRequest, "cannot delete default profile")
		return
	}

	// Reassign members using this profile to the user's default profile.
	if err := h.Queries.ResetMembersToDefaultProfile(r.Context(), profile.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to reassign members")
		return
	}

	if err := h.Queries.DeleteProfile(r.Context(), profile.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete profile")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type SetWorkspaceProfileRequest struct {
	ProfileID string `json:"profile_id"`
}

// SetWorkspaceProfile sets the profile for the current user's membership in a workspace.
func (h *Handler) SetWorkspaceProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	workspaceID := workspaceIDFromURL(r, "id")
	member, err := h.getWorkspaceMember(r.Context(), userID, workspaceID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not a member of this workspace")
		return
	}

	var req SetWorkspaceProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Verify the profile belongs to the user.
	profile, err := h.Queries.GetProfile(r.Context(), parseUUID(req.ProfileID))
	if err != nil {
		writeError(w, http.StatusNotFound, "profile not found")
		return
	}
	if uuidToString(profile.UserID) != userID {
		writeError(w, http.StatusForbidden, "not your profile")
		return
	}

	_, err = h.Queries.SetMemberProfile(r.Context(), db.SetMemberProfileParams{
		ID:        member.ID,
		ProfileID: profile.ID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to set workspace profile")
		return
	}

	writeJSON(w, http.StatusOK, profileToResponse(profile))
}
