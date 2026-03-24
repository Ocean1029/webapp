package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/ai"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/repository"
)

// maxUploadSize limits uploaded screenshot size to 10 MB.
const maxUploadSize = 10 << 20

// analyzeTextRequest is the expected JSON body for POST /api/analyze/text.
type analyzeTextRequest struct {
	Text        string `json:"text"`
	ToneMode    string `json:"toneMode"`
	ContactName string `json:"contactName"`
}

// HandleAnalyzeScreenshot handles POST /api/analyze/screenshot.
// It accepts multipart form data with fields: screenshot (file), toneMode, contactName.
func (h *Handler) HandleAnalyzeScreenshot(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		errorResponse(w, http.StatusBadRequest, "failed to parse multipart form")
		return
	}

	file, _, err := r.FormFile("screenshot")
	if err != nil {
		errorResponse(w, http.StatusBadRequest, "screenshot file is required")
		return
	}
	defer file.Close()

	toneMode := r.FormValue("toneMode")
	contactName := r.FormValue("contactName")

	if err := validateAnalyzeInput(toneMode, contactName); err != nil {
		errorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	imageData, err := io.ReadAll(file)
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "failed to read uploaded file")
		return
	}

	// Extract text from the screenshot via OCR.
	ocrResult, err := h.ocr.ExtractText(r.Context(), imageData)
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "OCR text extraction failed")
		return
	}

	if ocrResult.FullText == "" {
		errorResponse(w, http.StatusUnprocessableEntity, "no text detected in the screenshot")
		return
	}

	// Analyze the extracted text with AI.
	analysisResp, err := h.ai.Analyze(r.Context(), ai.AnalysisRequest{
		ConversationText: ocrResult.FullText,
		ToneMode:         toneMode,
	})
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "AI analysis failed")
		return
	}

	// Create conversation and save analysis to the database.
	conv, err := h.repo.CreateConversation(r.Context(), contactName)
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "failed to create conversation")
		return
	}

	analysis, err := h.repo.CreateAnalysis(r.Context(), repository.CreateAnalysisParams{
		ConversationID:     conv.ID,
		InputType:          "screenshot",
		RawText:            ocrResult.FullText,
		ToneMode:           toneMode,
		InterestScore:      analysisResp.InterestScore,
		SubtextTranslation: analysisResp.SubtextTranslation,
		ReplySuggestions:   analysisResp.ReplySuggestions,
		Summary:            analysisResp.Summary,
	})
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "failed to save analysis")
		return
	}

	jsonResponse(w, http.StatusOK, analysis)
}

// HandleAnalyzeText handles POST /api/analyze/text.
// It accepts a JSON body with fields: text, toneMode, contactName.
func (h *Handler) HandleAnalyzeText(w http.ResponseWriter, r *http.Request) {
	var req analyzeTextRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errorResponse(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.Text == "" {
		errorResponse(w, http.StatusBadRequest, "text is required")
		return
	}

	if err := validateAnalyzeInput(req.ToneMode, req.ContactName); err != nil {
		errorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	// Analyze the text with AI.
	analysisResp, err := h.ai.Analyze(r.Context(), ai.AnalysisRequest{
		ConversationText: req.Text,
		ToneMode:         req.ToneMode,
	})
	if err != nil {
		log.Printf("AI analysis error: %v", err)
		errorResponse(w, http.StatusInternalServerError, "AI analysis failed")
		return
	}

	// Create conversation and save analysis to the database.
	conv, err := h.repo.CreateConversation(r.Context(), req.ContactName)
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "failed to create conversation")
		return
	}

	analysis, err := h.repo.CreateAnalysis(r.Context(), repository.CreateAnalysisParams{
		ConversationID:     conv.ID,
		InputType:          "text",
		RawText:            req.Text,
		ToneMode:           req.ToneMode,
		InterestScore:      analysisResp.InterestScore,
		SubtextTranslation: analysisResp.SubtextTranslation,
		ReplySuggestions:   analysisResp.ReplySuggestions,
		Summary:            analysisResp.Summary,
	})
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, "failed to save analysis")
		return
	}

	jsonResponse(w, http.StatusOK, analysis)
}

// validateAnalyzeInput checks that toneMode and contactName are valid.
func validateAnalyzeInput(toneMode, contactName string) error {
	if toneMode != "counselor" && toneMode != "bestfriend" {
		return &validationError{field: "toneMode", message: "must be 'counselor' or 'bestfriend'"}
	}
	if contactName == "" {
		return &validationError{field: "contactName", message: "is required"}
	}
	return nil
}

// validationError represents a field validation error.
type validationError struct {
	field   string
	message string
}

func (e *validationError) Error() string {
	return e.field + " " + e.message
}
