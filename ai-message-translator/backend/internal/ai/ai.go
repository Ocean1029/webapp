package ai

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/model"
	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// AnalysisRequest contains the input for a conversation analysis.
type AnalysisRequest struct {
	ConversationText string // Raw conversation text to analyze.
	ToneMode         string // "counselor" or "bestfriend".
}

// AnalysisResponse holds the structured result from Claude's analysis.
type AnalysisResponse struct {
	SubtextTranslation []model.SubtextEntry    `json:"subtextTranslation"`
	InterestScore      int                     `json:"interestScore"`
	ReplySuggestions   []model.ReplySuggestion `json:"replySuggestions"`
	Summary            string                  `json:"summary"`
}

// MessageCreateFunc is the function signature for creating Claude messages.
// It is extracted as a type to allow mocking in tests.
type MessageCreateFunc func(ctx context.Context, params anthropic.MessageNewParams, opts ...option.RequestOption) (*anthropic.Message, error)

// Client wraps the Anthropic SDK to provide conversation analysis.
type Client struct {
	createMessage MessageCreateFunc
}

// New creates a new AI client using the provided Anthropic API key.
func New(apiKey string) *Client {
	sdk := anthropic.NewClient(option.WithAPIKey(apiKey))
	return &Client{
		createMessage: sdk.Messages.New,
	}
}

// selectPrompt returns the appropriate system prompt based on the tone mode.
func selectPrompt(toneMode string) string {
	if toneMode == "bestfriend" {
		return bestFriendSystemPrompt
	}
	return counselorSystemPrompt
}

// Analyze sends the conversation text to Claude for analysis and returns
// the parsed response. It selects the system prompt based on the ToneMode
// field of the request.
func (c *Client) Analyze(ctx context.Context, req AnalysisRequest) (*AnalysisResponse, error) {
	systemPrompt := selectPrompt(req.ToneMode)

	msg, err := c.createMessage(ctx, anthropic.MessageNewParams{
		Model:     anthropic.ModelClaudeSonnet4_5,
		MaxTokens: 2048,
		System: []anthropic.TextBlockParam{
			{Text: systemPrompt},
		},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(
				anthropic.NewTextBlock(req.ConversationText),
			),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("claude API call failed: %w", err)
	}

	if len(msg.Content) == 0 {
		return nil, fmt.Errorf("claude returned empty response")
	}

	// Extract text from the first content block.
	block := msg.Content[0]
	if block.Type != "text" {
		return nil, fmt.Errorf("unexpected content block type: %s", block.Type)
	}

	var resp AnalysisResponse
	if err := json.Unmarshal([]byte(block.Text), &resp); err != nil {
		return nil, fmt.Errorf("failed to parse Claude response as JSON: %w", err)
	}

	return &resp, nil
}
