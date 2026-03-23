package ai

import (
	"context"
	"testing"

	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/model"
	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newMockClient creates a Client with a mock message creation function.
func newMockClient(fn MessageCreateFunc) *Client {
	return &Client{createMessage: fn}
}

// makeTextMessage builds an anthropic.Message containing a single text block.
func makeTextMessage(text string) *anthropic.Message {
	return &anthropic.Message{
		Content: []anthropic.ContentBlockUnion{
			{
				Type: "text",
				Text: text,
			},
		},
	}
}

func TestSelectPrompt_Counselor(t *testing.T) {
	t.Parallel()
	got := selectPrompt("counselor")
	assert.Equal(t, counselorSystemPrompt, got)
}

func TestSelectPrompt_BestFriend(t *testing.T) {
	t.Parallel()
	got := selectPrompt("bestfriend")
	assert.Equal(t, bestFriendSystemPrompt, got)
}

func TestSelectPrompt_DefaultsToCounselor(t *testing.T) {
	t.Parallel()
	// Unknown tone modes should fall back to counselor.
	got := selectPrompt("unknown")
	assert.Equal(t, counselorSystemPrompt, got)
}

func TestAnalyze_CounselorPromptUsed(t *testing.T) {
	t.Parallel()

	var capturedParams anthropic.MessageNewParams
	mock := newMockClient(func(ctx context.Context, params anthropic.MessageNewParams, opts ...option.RequestOption) (*anthropic.Message, error) {
		capturedParams = params
		return makeTextMessage(`{
			"subtextTranslation": [{"original": "嗨", "subtext": "想找你聊天"}],
			"interestScore": 7,
			"replySuggestions": [{"text": "嗨～", "expectedEffect": "自然回應"}],
			"summary": "對方主動開啟對話"
		}`), nil
	})

	resp, err := mock.Analyze(context.Background(), AnalysisRequest{
		ConversationText: "嗨～你在幹嘛",
		ToneMode:         "counselor",
	})

	require.NoError(t, err)
	require.NotNil(t, resp)

	// Verify counselor prompt was selected.
	require.Len(t, capturedParams.System, 1)
	assert.Equal(t, counselorSystemPrompt, capturedParams.System[0].Text)
}

func TestAnalyze_BestFriendPromptUsed(t *testing.T) {
	t.Parallel()

	var capturedParams anthropic.MessageNewParams
	mock := newMockClient(func(ctx context.Context, params anthropic.MessageNewParams, opts ...option.RequestOption) (*anthropic.Message, error) {
		capturedParams = params
		return makeTextMessage(`{
			"subtextTranslation": [{"original": "嗨", "subtext": "無聊找你"}],
			"interestScore": 4,
			"replySuggestions": [{"text": "幹嘛", "expectedEffect": "直接"}],
			"summary": "沒什麼誠意"
		}`), nil
	})

	resp, err := mock.Analyze(context.Background(), AnalysisRequest{
		ConversationText: "嗨～你在幹嘛",
		ToneMode:         "bestfriend",
	})

	require.NoError(t, err)
	require.NotNil(t, resp)

	// Verify bestfriend prompt was selected.
	require.Len(t, capturedParams.System, 1)
	assert.Equal(t, bestFriendSystemPrompt, capturedParams.System[0].Text)
}

func TestAnalyze_ResponseParsing(t *testing.T) {
	t.Parallel()

	jsonResp := `{
		"subtextTranslation": [
			{"original": "你今天過得好嗎", "subtext": "想關心你但不知道怎麼開口"},
			{"original": "沒什麼啦", "subtext": "其實有事但不想說"}
		],
		"interestScore": 8,
		"replySuggestions": [
			{"text": "還不錯啊～你呢？", "expectedEffect": "讓對方感到被關心"},
			{"text": "你是不是有什麼事想說？", "expectedEffect": "直接切入正題"}
		],
		"summary": "對方有心事但在試探你的態度"
	}`

	mock := newMockClient(func(ctx context.Context, params anthropic.MessageNewParams, opts ...option.RequestOption) (*anthropic.Message, error) {
		return makeTextMessage(jsonResp), nil
	})

	resp, err := mock.Analyze(context.Background(), AnalysisRequest{
		ConversationText: "你今天過得好嗎\n沒什麼啦",
		ToneMode:         "counselor",
	})

	require.NoError(t, err)
	require.NotNil(t, resp)

	// Verify subtext translation entries.
	assert.Len(t, resp.SubtextTranslation, 2)
	assert.Equal(t, model.SubtextEntry{
		Original: "你今天過得好嗎",
		Subtext:  "想關心你但不知道怎麼開口",
	}, resp.SubtextTranslation[0])

	// Verify interest score.
	assert.Equal(t, 8, resp.InterestScore)

	// Verify reply suggestions.
	assert.Len(t, resp.ReplySuggestions, 2)
	assert.Equal(t, model.ReplySuggestion{
		Text:           "還不錯啊～你呢？",
		ExpectedEffect: "讓對方感到被關心",
	}, resp.ReplySuggestions[0])

	// Verify summary.
	assert.Equal(t, "對方有心事但在試探你的態度", resp.Summary)
}

func TestAnalyze_EmptyResponse(t *testing.T) {
	t.Parallel()

	mock := newMockClient(func(ctx context.Context, params anthropic.MessageNewParams, opts ...option.RequestOption) (*anthropic.Message, error) {
		return &anthropic.Message{Content: []anthropic.ContentBlockUnion{}}, nil
	})

	_, err := mock.Analyze(context.Background(), AnalysisRequest{
		ConversationText: "test",
		ToneMode:         "counselor",
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "empty response")
}

func TestAnalyze_InvalidJSON(t *testing.T) {
	t.Parallel()

	mock := newMockClient(func(ctx context.Context, params anthropic.MessageNewParams, opts ...option.RequestOption) (*anthropic.Message, error) {
		return makeTextMessage("not valid json"), nil
	})

	_, err := mock.Analyze(context.Background(), AnalysisRequest{
		ConversationText: "test",
		ToneMode:         "counselor",
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse Claude response")
}

func TestAnalyze_APIError(t *testing.T) {
	t.Parallel()

	mock := newMockClient(func(ctx context.Context, params anthropic.MessageNewParams, opts ...option.RequestOption) (*anthropic.Message, error) {
		return nil, assert.AnError
	})

	_, err := mock.Analyze(context.Background(), AnalysisRequest{
		ConversationText: "test",
		ToneMode:         "counselor",
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "claude API call failed")
}
