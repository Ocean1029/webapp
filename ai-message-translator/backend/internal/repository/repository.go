// Package repository provides database access for conversations and analyses.
package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/model"
)

// Repository handles all database operations.
type Repository struct {
	pool *pgxpool.Pool
}

// New creates a new Repository backed by the given connection pool.
func New(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// CreateConversation inserts a new conversation and returns it.
func (r *Repository) CreateConversation(ctx context.Context, contactName string) (*model.Conversation, error) {
	var conv model.Conversation
	err := r.pool.QueryRow(ctx,
		`INSERT INTO conversations (contact_name)
		 VALUES ($1)
		 RETURNING id, contact_name, created_at, updated_at`,
		contactName,
	).Scan(&conv.ID, &conv.ContactName, &conv.CreatedAt, &conv.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create conversation: %w", err)
	}
	return &conv, nil
}

// CreateAnalysisParams holds the parameters for creating an analysis.
type CreateAnalysisParams struct {
	ConversationID     uuid.UUID
	InputType          string
	RawText            string
	ImageURL           string
	ToneMode           string
	InterestScore      int
	SubtextTranslation []model.SubtextEntry
	ReplySuggestions   []model.ReplySuggestion
	Summary            string
}

// CreateAnalysis inserts a new analysis and returns it.
func (r *Repository) CreateAnalysis(ctx context.Context, params CreateAnalysisParams) (*model.Analysis, error) {
	subtextJSON, err := json.Marshal(params.SubtextTranslation)
	if err != nil {
		return nil, fmt.Errorf("marshal subtext translation: %w", err)
	}

	replyJSON, err := json.Marshal(params.ReplySuggestions)
	if err != nil {
		return nil, fmt.Errorf("marshal reply suggestions: %w", err)
	}

	var a model.Analysis
	var imageURL *string
	if params.ImageURL != "" {
		imageURL = &params.ImageURL
	}

	var scannedImageURL *string
	err = r.pool.QueryRow(ctx,
		`INSERT INTO analyses (conversation_id, input_type, raw_text, image_url, tone_mode, interest_score, subtext_translation, reply_suggestions, summary)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, conversation_id, input_type, raw_text, image_url, tone_mode, interest_score, subtext_translation, reply_suggestions, summary, created_at`,
		params.ConversationID, params.InputType, params.RawText, imageURL,
		params.ToneMode, params.InterestScore, subtextJSON, replyJSON, params.Summary,
	).Scan(
		&a.ID, &a.ConversationID, &a.InputType, &a.RawText, &scannedImageURL,
		&a.ToneMode, &a.InterestScore, &subtextJSON, &replyJSON, &a.Summary, &a.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create analysis: %w", err)
	}

	if scannedImageURL != nil {
		a.ImageURL = *scannedImageURL
	}

	if err := json.Unmarshal(subtextJSON, &a.SubtextTranslation); err != nil {
		return nil, fmt.Errorf("unmarshal subtext translation: %w", err)
	}
	if err := json.Unmarshal(replyJSON, &a.ReplySuggestions); err != nil {
		return nil, fmt.Errorf("unmarshal reply suggestions: %w", err)
	}

	return &a, nil
}

// GetAnalysis retrieves a single analysis by its ID.
func (r *Repository) GetAnalysis(ctx context.Context, id uuid.UUID) (*model.Analysis, error) {
	var a model.Analysis
	var scannedImageURL *string
	var subtextJSON, replyJSON []byte

	err := r.pool.QueryRow(ctx,
		`SELECT id, conversation_id, input_type, raw_text, image_url, tone_mode,
		        interest_score, subtext_translation, reply_suggestions, summary, created_at
		 FROM analyses WHERE id = $1`,
		id,
	).Scan(
		&a.ID, &a.ConversationID, &a.InputType, &a.RawText, &scannedImageURL,
		&a.ToneMode, &a.InterestScore, &subtextJSON, &replyJSON, &a.Summary, &a.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get analysis: %w", err)
	}

	if scannedImageURL != nil {
		a.ImageURL = *scannedImageURL
	}

	if err := json.Unmarshal(subtextJSON, &a.SubtextTranslation); err != nil {
		return nil, fmt.Errorf("unmarshal subtext translation: %w", err)
	}
	if err := json.Unmarshal(replyJSON, &a.ReplySuggestions); err != nil {
		return nil, fmt.Errorf("unmarshal reply suggestions: %w", err)
	}

	return &a, nil
}

// ListByConversation retrieves all analyses for a given conversation, ordered by creation time.
func (r *Repository) ListByConversation(ctx context.Context, conversationID uuid.UUID) ([]*model.Analysis, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, conversation_id, input_type, raw_text, image_url, tone_mode,
		        interest_score, subtext_translation, reply_suggestions, summary, created_at
		 FROM analyses
		 WHERE conversation_id = $1
		 ORDER BY created_at ASC`,
		conversationID,
	)
	if err != nil {
		return nil, fmt.Errorf("list analyses by conversation: %w", err)
	}
	defer rows.Close()

	var analyses []*model.Analysis
	for rows.Next() {
		var a model.Analysis
		var scannedImageURL *string
		var subtextJSON, replyJSON []byte

		if err := rows.Scan(
			&a.ID, &a.ConversationID, &a.InputType, &a.RawText, &scannedImageURL,
			&a.ToneMode, &a.InterestScore, &subtextJSON, &replyJSON, &a.Summary, &a.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan analysis row: %w", err)
		}

		if scannedImageURL != nil {
			a.ImageURL = *scannedImageURL
		}

		if err := json.Unmarshal(subtextJSON, &a.SubtextTranslation); err != nil {
			return nil, fmt.Errorf("unmarshal subtext translation: %w", err)
		}
		if err := json.Unmarshal(replyJSON, &a.ReplySuggestions); err != nil {
			return nil, fmt.Errorf("unmarshal reply suggestions: %w", err)
		}

		analyses = append(analyses, &a)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate analysis rows: %w", err)
	}

	return analyses, nil
}
