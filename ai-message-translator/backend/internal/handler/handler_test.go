package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/ai"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/handler"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/model"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/ocr"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/repository"
)

// --- Mock dependencies ---

// mockRepo implements handler.Repo for testing.
type mockRepo struct {
	conversations []*model.Conversation
	analyses      []*model.Analysis

	createConversationFn func(ctx context.Context, contactName string) (*model.Conversation, error)
	createAnalysisFn     func(ctx context.Context, params repository.CreateAnalysisParams) (*model.Analysis, error)
	getAnalysisFn        func(ctx context.Context, id uuid.UUID) (*model.Analysis, error)
	listByConversationFn func(ctx context.Context, conversationID uuid.UUID) ([]*model.Analysis, error)
	listConversationsFn  func(ctx context.Context) ([]*model.Conversation, error)
	getConversationFn    func(ctx context.Context, id uuid.UUID) (*model.Conversation, error)
}

func (m *mockRepo) CreateConversation(ctx context.Context, contactName string) (*model.Conversation, error) {
	if m.createConversationFn != nil {
		return m.createConversationFn(ctx, contactName)
	}
	conv := &model.Conversation{ID: uuid.New(), ContactName: contactName}
	m.conversations = append(m.conversations, conv)
	return conv, nil
}

func (m *mockRepo) CreateAnalysis(ctx context.Context, params repository.CreateAnalysisParams) (*model.Analysis, error) {
	if m.createAnalysisFn != nil {
		return m.createAnalysisFn(ctx, params)
	}
	a := &model.Analysis{
		ID:                 uuid.New(),
		ConversationID:     params.ConversationID,
		InputType:          params.InputType,
		RawText:            params.RawText,
		ToneMode:           params.ToneMode,
		InterestScore:      params.InterestScore,
		SubtextTranslation: params.SubtextTranslation,
		ReplySuggestions:   params.ReplySuggestions,
		Summary:            params.Summary,
	}
	m.analyses = append(m.analyses, a)
	return a, nil
}

func (m *mockRepo) GetAnalysis(ctx context.Context, id uuid.UUID) (*model.Analysis, error) {
	if m.getAnalysisFn != nil {
		return m.getAnalysisFn(ctx, id)
	}
	return nil, nil
}

func (m *mockRepo) ListByConversation(ctx context.Context, conversationID uuid.UUID) ([]*model.Analysis, error) {
	if m.listByConversationFn != nil {
		return m.listByConversationFn(ctx, conversationID)
	}
	return m.analyses, nil
}

func (m *mockRepo) ListConversations(ctx context.Context) ([]*model.Conversation, error) {
	if m.listConversationsFn != nil {
		return m.listConversationsFn(ctx)
	}
	return m.conversations, nil
}

func (m *mockRepo) GetConversation(ctx context.Context, id uuid.UUID) (*model.Conversation, error) {
	if m.getConversationFn != nil {
		return m.getConversationFn(ctx, id)
	}
	for _, c := range m.conversations {
		if c.ID == id {
			return c, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

// mockOCR implements handler.OCRClient for testing.
type mockOCR struct {
	extractTextFn func(ctx context.Context, imageData []byte) (*ocr.Result, error)
}

func (m *mockOCR) ExtractText(ctx context.Context, imageData []byte) (*ocr.Result, error) {
	if m.extractTextFn != nil {
		return m.extractTextFn(ctx, imageData)
	}
	return &ocr.Result{FullText: "Hello", Lines: []string{"Hello"}}, nil
}

// mockAI implements handler.AIClient for testing.
type mockAI struct {
	analyzeFn func(ctx context.Context, req ai.AnalysisRequest) (*ai.AnalysisResponse, error)
}

func (m *mockAI) Analyze(ctx context.Context, req ai.AnalysisRequest) (*ai.AnalysisResponse, error) {
	if m.analyzeFn != nil {
		return m.analyzeFn(ctx, req)
	}
	return &ai.AnalysisResponse{
		SubtextTranslation: []model.SubtextEntry{
			{Original: "hi", Subtext: "wants to talk"},
		},
		InterestScore: 7,
		ReplySuggestions: []model.ReplySuggestion{
			{Text: "hey!", ExpectedEffect: "opens conversation"},
		},
		Summary: "positive vibes",
	}, nil
}

// --- Helper functions ---

func setupHandler() (*handler.Handler, *mockRepo, *mockOCR, *mockAI) {
	repo := &mockRepo{}
	ocrClient := &mockOCR{}
	aiClient := &mockAI{}
	h := handler.New(repo, ocrClient, aiClient)
	return h, repo, ocrClient, aiClient
}

func setupMux(h *handler.Handler) *http.ServeMux {
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	return mux
}

// --- Tests ---

func TestAnalyzeTextHandler(t *testing.T) {
	h, _, _, _ := setupHandler()
	mux := setupMux(h)

	body := `{"text":"嗨～你在幹嘛","toneMode":"bestfriend","contactName":"小明"}`
	req := httptest.NewRequest(http.MethodPost, "/api/analyze/text", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	var result model.Analysis
	err := json.NewDecoder(rec.Body).Decode(&result)
	require.NoError(t, err)
	assert.Equal(t, 7, result.InterestScore)
	assert.Equal(t, "text", result.InputType)
	assert.Equal(t, "bestfriend", result.ToneMode)
	assert.NotEmpty(t, result.SubtextTranslation)
	assert.NotEmpty(t, result.ReplySuggestions)
}

func TestAnalyzeTextHandler_MissingText(t *testing.T) {
	h, _, _, _ := setupHandler()
	mux := setupMux(h)

	body := `{"text":"","toneMode":"counselor","contactName":"小明"}`
	req := httptest.NewRequest(http.MethodPost, "/api/analyze/text", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAnalyzeTextHandler_InvalidToneMode(t *testing.T) {
	h, _, _, _ := setupHandler()
	mux := setupMux(h)

	body := `{"text":"hello","toneMode":"invalid","contactName":"小明"}`
	req := httptest.NewRequest(http.MethodPost, "/api/analyze/text", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAnalyzeTextHandler_MissingContactName(t *testing.T) {
	h, _, _, _ := setupHandler()
	mux := setupMux(h)

	body := `{"text":"hello","toneMode":"counselor","contactName":""}`
	req := httptest.NewRequest(http.MethodPost, "/api/analyze/text", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAnalyzeScreenshotHandler(t *testing.T) {
	h, _, _, _ := setupHandler()
	mux := setupMux(h)

	// Build multipart form with a fake screenshot file.
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("screenshot", "test.png")
	require.NoError(t, err)
	_, err = io.WriteString(part, "fake-image-data")
	require.NoError(t, err)
	require.NoError(t, writer.WriteField("toneMode", "counselor"))
	require.NoError(t, writer.WriteField("contactName", "小美"))
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, "/api/analyze/screenshot", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	var result model.Analysis
	err = json.NewDecoder(rec.Body).Decode(&result)
	require.NoError(t, err)
	assert.Equal(t, "screenshot", result.InputType)
	assert.Equal(t, 7, result.InterestScore)
}

func TestAnalyzeScreenshotHandler_NoTextDetected(t *testing.T) {
	h, _, ocrClient, _ := setupHandler()
	ocrClient.extractTextFn = func(_ context.Context, _ []byte) (*ocr.Result, error) {
		return &ocr.Result{FullText: "", Lines: nil}, nil
	}
	mux := setupMux(h)

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("screenshot", "empty.png")
	require.NoError(t, err)
	_, err = io.WriteString(part, "fake-image-data")
	require.NoError(t, err)
	require.NoError(t, writer.WriteField("toneMode", "counselor"))
	require.NoError(t, writer.WriteField("contactName", "小美"))
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, "/api/analyze/screenshot", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
}

func TestListConversationsHandler(t *testing.T) {
	h, repo, _, _ := setupHandler()
	// Pre-populate some conversations.
	repo.conversations = []*model.Conversation{
		{ID: uuid.New(), ContactName: "小明"},
		{ID: uuid.New(), ContactName: "小美"},
	}
	mux := setupMux(h)

	req := httptest.NewRequest(http.MethodGet, "/api/conversations", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	var result []*model.Conversation
	err := json.NewDecoder(rec.Body).Decode(&result)
	require.NoError(t, err)
	assert.Len(t, result, 2)
}

func TestListConversationsHandler_Empty(t *testing.T) {
	h, _, _, _ := setupHandler()
	mux := setupMux(h)

	req := httptest.NewRequest(http.MethodGet, "/api/conversations", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	// Should return an empty array, not null.
	body := rec.Body.String()
	assert.Contains(t, body, "[]")
}

func TestGetConversationHandler(t *testing.T) {
	h, repo, _, _ := setupHandler()
	convID := uuid.New()
	repo.conversations = []*model.Conversation{
		{ID: convID, ContactName: "小明"},
	}
	repo.analyses = []*model.Analysis{
		{ID: uuid.New(), ConversationID: convID, InputType: "text", InterestScore: 5},
	}
	mux := setupMux(h)

	req := httptest.NewRequest(http.MethodGet, "/api/conversations/"+convID.String(), nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	var result map[string]interface{}
	err := json.NewDecoder(rec.Body).Decode(&result)
	require.NoError(t, err)
	assert.Equal(t, "小明", result["contactName"])
	assert.NotNil(t, result["analyses"])
}

func TestGetConversationHandler_InvalidID(t *testing.T) {
	h, _, _, _ := setupHandler()
	mux := setupMux(h)

	req := httptest.NewRequest(http.MethodGet, "/api/conversations/not-a-uuid", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGetConversationHandler_NotFound(t *testing.T) {
	h, _, _, _ := setupHandler()
	mux := setupMux(h)

	req := httptest.NewRequest(http.MethodGet, "/api/conversations/"+uuid.New().String(), nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestAnalyzeTextHandler_InvalidJSON(t *testing.T) {
	h, _, _, _ := setupHandler()
	mux := setupMux(h)

	req := httptest.NewRequest(http.MethodPost, "/api/analyze/text", bytes.NewBufferString("{invalid"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}
