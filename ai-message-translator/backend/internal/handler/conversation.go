package handler

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/model"
)

// conversationWithAnalyses is the response shape for GET /api/conversations/{id}.
type conversationWithAnalyses struct {
	ID          uuid.UUID   `json:"id"`
	ContactName string      `json:"contactName"`
	CreatedAt   string      `json:"createdAt"`
	UpdatedAt   string      `json:"updatedAt"`
	Analyses    interface{} `json:"analyses"`
}

// HandleListConversations handles GET /api/conversations.
// It returns all conversations ordered by most recently updated.
func (h *Handler) HandleListConversations(w http.ResponseWriter, r *http.Request) {
	convs, err := h.repo.ListConversations(r.Context())
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "failed to list conversations")
		return
	}

	// Return an empty array instead of null when there are no conversations.
	if convs == nil {
		convs = []*model.Conversation{}
	}

	jsonResponse(w, http.StatusOK, convs)
}

// HandleGetConversation handles GET /api/conversations/{id}.
// It returns a single conversation along with all its analyses.
func (h *Handler) HandleGetConversation(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		errorResponse(w, http.StatusBadRequest, "invalid conversation ID")
		return
	}

	conv, err := h.repo.GetConversation(r.Context(), id)
	if err != nil {
		errorResponse(w, http.StatusNotFound, "conversation not found")
		return
	}

	analyses, err := h.repo.ListByConversation(r.Context(), id)
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "failed to list analyses")
		return
	}

	if analyses == nil {
		analyses = []*model.Analysis{}
	}

	resp := conversationWithAnalyses{
		ID:          conv.ID,
		ContactName: conv.ContactName,
		CreatedAt:   conv.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   conv.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Analyses:    analyses,
	}

	jsonResponse(w, http.StatusOK, resp)
}
