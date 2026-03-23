// Package model defines domain types for the AI message translator.
package model

import (
	"time"

	"github.com/google/uuid"
)

// Conversation groups analyses by contact person.
type Conversation struct {
	ID          uuid.UUID `json:"id"`
	ContactName string    `json:"contactName"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// SubtextEntry represents a single message with its translated subtext.
type SubtextEntry struct {
	Original string `json:"original"`
	Subtext  string `json:"subtext"`
}

// ReplySuggestion represents a suggested reply with its expected effect.
type ReplySuggestion struct {
	Text           string `json:"text"`
	ExpectedEffect string `json:"expectedEffect"`
}

// Analysis represents a single screenshot or text analysis result.
type Analysis struct {
	ID                 uuid.UUID         `json:"id"`
	ConversationID     uuid.UUID         `json:"conversationId"`
	InputType          string            `json:"inputType"`
	RawText            string            `json:"rawText"`
	ImageURL           string            `json:"imageUrl,omitempty"`
	ToneMode           string            `json:"toneMode"`
	InterestScore      int               `json:"interestScore"`
	SubtextTranslation []SubtextEntry    `json:"subtextTranslation"`
	ReplySuggestions   []ReplySuggestion `json:"replySuggestions"`
	Summary            string            `json:"summary"`
	CreatedAt          time.Time         `json:"createdAt"`
}
