package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
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

// --- Integration test helpers ---

// integrationMockRepo provides a more realistic in-memory repository that
// tracks state across multiple calls, simulating a real database.
type integrationMockRepo struct {
	conversations map[uuid.UUID]*model.Conversation
	analyses      map[uuid.UUID]*model.Analysis
	// analysisOrder preserves insertion order for listing.
	analysisOrder []uuid.UUID
	// convOrder preserves insertion order for listing.
	convOrder []uuid.UUID
}

func newIntegrationMockRepo() *integrationMockRepo {
	return &integrationMockRepo{
		conversations: make(map[uuid.UUID]*model.Conversation),
		analyses:      make(map[uuid.UUID]*model.Analysis),
	}
}

func (m *integrationMockRepo) CreateConversation(_ context.Context, contactName string) (*model.Conversation, error) {
	conv := &model.Conversation{
		ID:          uuid.New(),
		ContactName: contactName,
	}
	m.conversations[conv.ID] = conv
	m.convOrder = append(m.convOrder, conv.ID)
	return conv, nil
}

func (m *integrationMockRepo) CreateAnalysis(_ context.Context, params repository.CreateAnalysisParams) (*model.Analysis, error) {
	a := &model.Analysis{
		ID:                 uuid.New(),
		ConversationID:     params.ConversationID,
		InputType:          params.InputType,
		RawText:            params.RawText,
		ImageURL:           params.ImageURL,
		ToneMode:           params.ToneMode,
		InterestScore:      params.InterestScore,
		SubtextTranslation: params.SubtextTranslation,
		ReplySuggestions:   params.ReplySuggestions,
		Summary:            params.Summary,
	}
	m.analyses[a.ID] = a
	m.analysisOrder = append(m.analysisOrder, a.ID)
	return a, nil
}

func (m *integrationMockRepo) GetAnalysis(_ context.Context, id uuid.UUID) (*model.Analysis, error) {
	a, ok := m.analyses[id]
	if !ok {
		return nil, &notFoundError{entity: "analysis"}
	}
	return a, nil
}

func (m *integrationMockRepo) ListByConversation(_ context.Context, conversationID uuid.UUID) ([]*model.Analysis, error) {
	var result []*model.Analysis
	for _, id := range m.analysisOrder {
		a := m.analyses[id]
		if a.ConversationID == conversationID {
			result = append(result, a)
		}
	}
	return result, nil
}

func (m *integrationMockRepo) ListConversations(_ context.Context) ([]*model.Conversation, error) {
	var result []*model.Conversation
	for _, id := range m.convOrder {
		result = append(result, m.conversations[id])
	}
	return result, nil
}

func (m *integrationMockRepo) GetConversation(_ context.Context, id uuid.UUID) (*model.Conversation, error) {
	c, ok := m.conversations[id]
	if !ok {
		return nil, &notFoundError{entity: "conversation"}
	}
	return c, nil
}

// notFoundError simulates a "not found" error from the repository.
type notFoundError struct {
	entity string
}

func (e *notFoundError) Error() string {
	return e.entity + " not found"
}

// setupIntegrationServer creates a test server with all routes registered.
func setupIntegrationServer(repo handler.Repo, ocrClient handler.OCRClient, aiClient handler.AIClient) *httptest.Server {
	h := handler.New(repo, ocrClient, aiClient)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	return httptest.NewServer(mux)
}

// --- Integration tests ---

func TestFullAnalysisFlow_CounselorMode(t *testing.T) {
	repo := newIntegrationMockRepo()

	aiClient := &mockAI{
		analyzeFn: func(_ context.Context, req ai.AnalysisRequest) (*ai.AnalysisResponse, error) {
			assert.Equal(t, "counselor", req.ToneMode)
			return &ai.AnalysisResponse{
				SubtextTranslation: []model.SubtextEntry{
					{Original: "最近好嗎？", Subtext: "I'm trying to reconnect with you"},
					{Original: "好久不見", Subtext: "I miss talking to you"},
				},
				InterestScore: 8,
				ReplySuggestions: []model.ReplySuggestion{
					{Text: "我很好呀～你呢？", ExpectedEffect: "reciprocates warmth and keeps conversation going"},
					{Text: "對啊好久不見！最近忙什麼？", ExpectedEffect: "shows interest and opens deeper topic"},
				},
				Summary: "The other person is actively reaching out, showing strong interest in reconnecting.",
			}, nil
		},
	}

	ocrClient := &mockOCR{}
	srv := setupIntegrationServer(repo, ocrClient, aiClient)
	defer srv.Close()

	// Step 1: POST /api/analyze/text with sample conversation.
	analyzeBody := `{
		"text": "最近好嗎？\n好久不見",
		"toneMode": "counselor",
		"contactName": "小明"
	}`
	resp, err := http.Post(srv.URL+"/api/analyze/text", "application/json", bytes.NewBufferString(analyzeBody))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var analysis model.Analysis
	err = json.NewDecoder(resp.Body).Decode(&analysis)
	require.NoError(t, err)

	// Verify analysis response contains expected fields.
	assert.NotEqual(t, uuid.Nil, analysis.ID)
	assert.NotEqual(t, uuid.Nil, analysis.ConversationID)
	assert.Equal(t, "text", analysis.InputType)
	assert.Equal(t, "counselor", analysis.ToneMode)
	assert.Equal(t, 8, analysis.InterestScore)
	assert.Len(t, analysis.SubtextTranslation, 2)
	assert.Len(t, analysis.ReplySuggestions, 2)
	assert.NotEmpty(t, analysis.Summary)

	// Step 2: GET /api/conversations — verify conversation was created.
	resp2, err := http.Get(srv.URL + "/api/conversations")
	require.NoError(t, err)
	defer resp2.Body.Close()

	assert.Equal(t, http.StatusOK, resp2.StatusCode)

	var convs []model.Conversation
	err = json.NewDecoder(resp2.Body).Decode(&convs)
	require.NoError(t, err)
	require.Len(t, convs, 1)
	assert.Equal(t, "小明", convs[0].ContactName)
	assert.Equal(t, analysis.ConversationID, convs[0].ID)

	// Step 3: GET /api/conversations/:id — verify analysis is linked.
	resp3, err := http.Get(srv.URL + "/api/conversations/" + analysis.ConversationID.String())
	require.NoError(t, err)
	defer resp3.Body.Close()

	assert.Equal(t, http.StatusOK, resp3.StatusCode)

	var convDetail map[string]json.RawMessage
	err = json.NewDecoder(resp3.Body).Decode(&convDetail)
	require.NoError(t, err)

	// Verify conversation fields.
	var contactName string
	require.NoError(t, json.Unmarshal(convDetail["contactName"], &contactName))
	assert.Equal(t, "小明", contactName)

	// Verify analyses are linked.
	var linkedAnalyses []model.Analysis
	require.NoError(t, json.Unmarshal(convDetail["analyses"], &linkedAnalyses))
	require.Len(t, linkedAnalyses, 1)
	assert.Equal(t, analysis.ID, linkedAnalyses[0].ID)
	assert.Equal(t, 8, linkedAnalyses[0].InterestScore)
}

func TestFullAnalysisFlow_BestfriendMode(t *testing.T) {
	repo := newIntegrationMockRepo()

	aiClient := &mockAI{
		analyzeFn: func(_ context.Context, req ai.AnalysisRequest) (*ai.AnalysisResponse, error) {
			assert.Equal(t, "bestfriend", req.ToneMode)
			return &ai.AnalysisResponse{
				SubtextTranslation: []model.SubtextEntry{
					{Original: "哈哈好啊", Subtext: "Meh, not that excited but will go along"},
				},
				InterestScore: 4,
				ReplySuggestions: []model.ReplySuggestion{
					{Text: "那你要不要約明天？", ExpectedEffect: "tests commitment level"},
					{Text: "隨便你啦", ExpectedEffect: "plays it cool"},
					{Text: "好喔那你說時間", ExpectedEffect: "puts the ball in their court"},
				},
				Summary: "Honestly, they're being lukewarm. Don't get your hopes up.",
			}, nil
		},
	}

	ocrClient := &mockOCR{}
	srv := setupIntegrationServer(repo, ocrClient, aiClient)
	defer srv.Close()

	// Step 1: POST /api/analyze/text in bestfriend mode.
	analyzeBody := `{
		"text": "哈哈好啊",
		"toneMode": "bestfriend",
		"contactName": "小美"
	}`
	resp, err := http.Post(srv.URL+"/api/analyze/text", "application/json", bytes.NewBufferString(analyzeBody))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var analysis model.Analysis
	err = json.NewDecoder(resp.Body).Decode(&analysis)
	require.NoError(t, err)

	assert.Equal(t, "bestfriend", analysis.ToneMode)
	assert.Equal(t, 4, analysis.InterestScore)
	assert.Len(t, analysis.SubtextTranslation, 1)
	assert.Len(t, analysis.ReplySuggestions, 3)
	assert.Contains(t, analysis.Summary, "lukewarm")

	// Step 2: GET /api/conversations — verify conversation was created.
	resp2, err := http.Get(srv.URL + "/api/conversations")
	require.NoError(t, err)
	defer resp2.Body.Close()

	var convs []model.Conversation
	err = json.NewDecoder(resp2.Body).Decode(&convs)
	require.NoError(t, err)
	require.Len(t, convs, 1)
	assert.Equal(t, "小美", convs[0].ContactName)

	// Step 3: GET /api/conversations/:id — verify analysis is linked.
	resp3, err := http.Get(srv.URL + "/api/conversations/" + analysis.ConversationID.String())
	require.NoError(t, err)
	defer resp3.Body.Close()

	var convDetail map[string]json.RawMessage
	err = json.NewDecoder(resp3.Body).Decode(&convDetail)
	require.NoError(t, err)

	var linkedAnalyses []model.Analysis
	require.NoError(t, json.Unmarshal(convDetail["analyses"], &linkedAnalyses))
	require.Len(t, linkedAnalyses, 1)
	assert.Equal(t, analysis.ID, linkedAnalyses[0].ID)
	assert.Equal(t, "bestfriend", linkedAnalyses[0].ToneMode)
}

func TestFullAnalysisFlow_ScreenshotUpload(t *testing.T) {
	repo := newIntegrationMockRepo()

	// Mock OCR to return extracted text from the "screenshot".
	ocrClient := &mockOCR{
		extractTextFn: func(_ context.Context, imageData []byte) (*ocr.Result, error) {
			// Verify we received the image data.
			assert.NotEmpty(t, imageData)
			return &ocr.Result{
				FullText: "你今天有空嗎？\n想約你出來",
				Lines:    []string{"你今天有空嗎？", "想約你出來"},
			}, nil
		},
	}

	aiClient := &mockAI{
		analyzeFn: func(_ context.Context, req ai.AnalysisRequest) (*ai.AnalysisResponse, error) {
			// Verify the OCR-extracted text was passed to the AI.
			assert.Contains(t, req.ConversationText, "你今天有空嗎？")
			assert.Equal(t, "counselor", req.ToneMode)
			return &ai.AnalysisResponse{
				SubtextTranslation: []model.SubtextEntry{
					{Original: "你今天有空嗎？", Subtext: "I want to spend time with you"},
					{Original: "想約你出來", Subtext: "I'm being direct about wanting to see you"},
				},
				InterestScore: 9,
				ReplySuggestions: []model.ReplySuggestion{
					{Text: "好呀！你想去哪？", ExpectedEffect: "shows enthusiasm and reciprocates"},
				},
				Summary: "Very high interest, direct invitation to meet.",
			}, nil
		},
	}

	srv := setupIntegrationServer(repo, ocrClient, aiClient)
	defer srv.Close()

	// Step 1: POST /api/analyze/screenshot with a fake screenshot.
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("screenshot", "chat.png")
	require.NoError(t, err)
	_, err = io.WriteString(part, "fake-png-image-binary-data")
	require.NoError(t, err)
	require.NoError(t, writer.WriteField("toneMode", "counselor"))
	require.NoError(t, writer.WriteField("contactName", "阿華"))
	require.NoError(t, writer.Close())

	resp, err := http.Post(srv.URL+"/api/analyze/screenshot", writer.FormDataContentType(), &buf)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var analysis model.Analysis
	err = json.NewDecoder(resp.Body).Decode(&analysis)
	require.NoError(t, err)

	// Verify analysis response.
	assert.Equal(t, "screenshot", analysis.InputType)
	assert.Equal(t, "counselor", analysis.ToneMode)
	assert.Equal(t, 9, analysis.InterestScore)
	assert.Len(t, analysis.SubtextTranslation, 2)
	assert.Len(t, analysis.ReplySuggestions, 1)
	assert.NotEmpty(t, analysis.Summary)

	// Step 2: GET /api/conversations — verify conversation was created.
	resp2, err := http.Get(srv.URL + "/api/conversations")
	require.NoError(t, err)
	defer resp2.Body.Close()

	var convs []model.Conversation
	err = json.NewDecoder(resp2.Body).Decode(&convs)
	require.NoError(t, err)
	require.Len(t, convs, 1)
	assert.Equal(t, "阿華", convs[0].ContactName)

	// Step 3: GET /api/conversations/:id — verify analysis is linked.
	resp3, err := http.Get(srv.URL + "/api/conversations/" + analysis.ConversationID.String())
	require.NoError(t, err)
	defer resp3.Body.Close()

	var convDetail map[string]json.RawMessage
	err = json.NewDecoder(resp3.Body).Decode(&convDetail)
	require.NoError(t, err)

	var linkedAnalyses []model.Analysis
	require.NoError(t, json.Unmarshal(convDetail["analyses"], &linkedAnalyses))
	require.Len(t, linkedAnalyses, 1)
	assert.Equal(t, "screenshot", linkedAnalyses[0].InputType)
	assert.Equal(t, 9, linkedAnalyses[0].InterestScore)
}

func TestFullAnalysisFlow_MultipleAnalysesSameConversation(t *testing.T) {
	repo := newIntegrationMockRepo()

	callCount := 0
	aiClient := &mockAI{
		analyzeFn: func(_ context.Context, _ ai.AnalysisRequest) (*ai.AnalysisResponse, error) {
			callCount++
			return &ai.AnalysisResponse{
				SubtextTranslation: []model.SubtextEntry{
					{Original: "test", Subtext: "subtext"},
				},
				InterestScore: callCount + 4,
				ReplySuggestions: []model.ReplySuggestion{
					{Text: "reply", ExpectedEffect: "effect"},
				},
				Summary: "summary",
			}, nil
		},
	}

	ocrClient := &mockOCR{}
	srv := setupIntegrationServer(repo, ocrClient, aiClient)
	defer srv.Close()

	// Submit two text analyses for the same contact.
	for i := 0; i < 2; i++ {
		body := `{"text":"message","toneMode":"counselor","contactName":"小明"}`
		resp, err := http.Post(srv.URL+"/api/analyze/text", "application/json", bytes.NewBufferString(body))
		require.NoError(t, err)
		resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	}

	// GET /api/conversations — should have 2 conversations (one per analyze call,
	// since each POST creates a new conversation in the current implementation).
	resp, err := http.Get(srv.URL + "/api/conversations")
	require.NoError(t, err)
	defer resp.Body.Close()

	var convs []model.Conversation
	err = json.NewDecoder(resp.Body).Decode(&convs)
	require.NoError(t, err)
	assert.Len(t, convs, 2)
}
