package repository_test

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/model"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/repository"
)

// setupTestDB creates a repository backed by a real PostgreSQL database.
// Set the TEST_DATABASE_URL environment variable to run these tests.
// Example: TEST_DATABASE_URL=postgres://app:devpassword@localhost:5432/message_translator?sslmode=disable
func setupTestDB(t *testing.T) *repository.Repository {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	require.NoError(t, err)
	t.Cleanup(func() { pool.Close() })

	// Verify connection
	require.NoError(t, pool.Ping(ctx))

	return repository.New(pool)
}

func TestCreateConversation(t *testing.T) {
	repo := setupTestDB(t)
	ctx := context.Background()

	conv, err := repo.CreateConversation(ctx, "小明")
	require.NoError(t, err)
	assert.Equal(t, "小明", conv.ContactName)
	assert.NotZero(t, conv.ID)
	assert.False(t, conv.CreatedAt.IsZero())
	assert.False(t, conv.UpdatedAt.IsZero())
}

func TestCreateAndGetAnalysis(t *testing.T) {
	repo := setupTestDB(t)
	ctx := context.Background()

	conv, err := repo.CreateConversation(ctx, "小美")
	require.NoError(t, err)

	analysis, err := repo.CreateAnalysis(ctx, repository.CreateAnalysisParams{
		ConversationID: conv.ID,
		InputType:      "text",
		RawText:        "嗨～你在幹嘛",
		ToneMode:       "bestfriend",
		InterestScore:  7,
		SubtextTranslation: []model.SubtextEntry{
			{Original: "嗨～你在幹嘛", Subtext: "我想找你聊天但不想太主動"},
		},
		ReplySuggestions: []model.ReplySuggestion{
			{Text: "剛下班～你呢？", ExpectedEffect: "自然延續對話"},
		},
		Summary: "對方主動開啟對話，興趣程度中高",
	})
	require.NoError(t, err)
	assert.Equal(t, 7, analysis.InterestScore)
	assert.Equal(t, "text", analysis.InputType)
	assert.Equal(t, "bestfriend", analysis.ToneMode)
	assert.Len(t, analysis.SubtextTranslation, 1)
	assert.Len(t, analysis.ReplySuggestions, 1)

	got, err := repo.GetAnalysis(ctx, analysis.ID)
	require.NoError(t, err)
	assert.Equal(t, analysis.ID, got.ID)
	assert.Equal(t, analysis.ConversationID, got.ConversationID)
	assert.Equal(t, analysis.InterestScore, got.InterestScore)
	assert.Equal(t, analysis.Summary, got.Summary)
	assert.Equal(t, analysis.SubtextTranslation[0].Original, got.SubtextTranslation[0].Original)
	assert.Equal(t, analysis.ReplySuggestions[0].Text, got.ReplySuggestions[0].Text)
}

func TestListByConversation(t *testing.T) {
	repo := setupTestDB(t)
	ctx := context.Background()

	conv, err := repo.CreateConversation(ctx, "小華")
	require.NoError(t, err)

	// Create two analyses for the same conversation
	for i, text := range []string{"你好", "最近還好嗎"} {
		_, err := repo.CreateAnalysis(ctx, repository.CreateAnalysisParams{
			ConversationID: conv.ID,
			InputType:      "text",
			RawText:        text,
			ToneMode:       "counselor",
			InterestScore:  5 + i,
			SubtextTranslation: []model.SubtextEntry{
				{Original: text, Subtext: "translated subtext"},
			},
			ReplySuggestions: []model.ReplySuggestion{
				{Text: "reply", ExpectedEffect: "effect"},
			},
			Summary: "summary",
		})
		require.NoError(t, err)
	}

	analyses, err := repo.ListByConversation(ctx, conv.ID)
	require.NoError(t, err)
	assert.Len(t, analyses, 2)
	// Verify ordering by created_at ASC
	assert.True(t, analyses[0].CreatedAt.Before(analyses[1].CreatedAt) || analyses[0].CreatedAt.Equal(analyses[1].CreatedAt))
}

func TestListByConversation_Empty(t *testing.T) {
	repo := setupTestDB(t)
	ctx := context.Background()

	conv, err := repo.CreateConversation(ctx, "空白對話")
	require.NoError(t, err)

	analyses, err := repo.ListByConversation(ctx, conv.ID)
	require.NoError(t, err)
	assert.Empty(t, analyses)
}
