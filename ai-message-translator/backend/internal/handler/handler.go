// Package handler provides HTTP handlers for the AI message translator API.
package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/ai"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/model"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/ocr"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/repository"
)

// Repo defines the repository operations required by the handler.
type Repo interface {
	CreateConversation(ctx context.Context, contactName string) (*model.Conversation, error)
	CreateAnalysis(ctx context.Context, params repository.CreateAnalysisParams) (*model.Analysis, error)
	GetAnalysis(ctx context.Context, id uuid.UUID) (*model.Analysis, error)
	ListByConversation(ctx context.Context, conversationID uuid.UUID) ([]*model.Analysis, error)
	ListConversations(ctx context.Context) ([]*model.Conversation, error)
	GetConversation(ctx context.Context, id uuid.UUID) (*model.Conversation, error)
}

// OCRClient defines the OCR operations required by the handler.
type OCRClient interface {
	ExtractText(ctx context.Context, imageData []byte) (*ocr.Result, error)
}

// AIClient defines the AI analysis operations required by the handler.
type AIClient interface {
	Analyze(ctx context.Context, req ai.AnalysisRequest) (*ai.AnalysisResponse, error)
}

// Handler holds dependencies and provides HTTP handler methods.
type Handler struct {
	repo Repo
	ocr  OCRClient
	ai   AIClient
}

// New creates a new Handler with the given dependencies.
func New(repo Repo, ocrClient OCRClient, aiClient AIClient) *Handler {
	return &Handler{
		repo: repo,
		ocr:  ocrClient,
		ai:   aiClient,
	}
}

// RegisterRoutes registers all API routes on the given ServeMux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/analyze/screenshot", h.HandleAnalyzeScreenshot)
	mux.HandleFunc("POST /api/analyze/text", h.HandleAnalyzeText)
	mux.HandleFunc("GET /api/conversations", h.HandleListConversations)
	mux.HandleFunc("GET /api/conversations/{id}", h.HandleGetConversation)
}

// errorResponse writes a JSON error response with the given status code.
func errorResponse(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// jsonResponse writes a JSON response with the given status code.
func jsonResponse(w http.ResponseWriter, statusCode int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}
