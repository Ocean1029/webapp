package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"

	aiClient "github.com/Ocean1029/webapp/ai-message-translator/backend/internal/ai"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/handler"
	ocrClient "github.com/Ocean1029/webapp/ai-message-translator/backend/internal/ocr"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/repository"
)

func main() {
	ctx := context.Background()

	// Read configuration from environment variables.
	dbURL := getEnv("DATABASE_URL", "postgres://app:devpassword@localhost:5432/message_translator?sslmode=disable")
	anthropicKey := getEnv("ANTHROPIC_API_KEY", "")
	listenAddr := getEnv("LISTEN_ADDR", ":8080")
	corsOrigin := getEnv("CORS_ORIGIN", "http://localhost:3000")

	// Initialize database connection pool.
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Initialize dependencies.
	repo := repository.New(pool)

	oc, err := ocrClient.New(ctx)
	if err != nil {
		log.Fatalf("Failed to create OCR client: %v", err)
	}
	defer oc.Close()

	ac := aiClient.New(anthropicKey)

	// Create handler and register routes.
	h := handler.New(repo, oc, ac)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	h.RegisterRoutes(mux)

	// Wrap with CORS middleware for frontend development.
	wrapped := corsMiddleware(corsOrigin)(mux)

	log.Printf("Server starting on %s", listenAddr)
	log.Fatal(http.ListenAndServe(listenAddr, wrapped))
}

// getEnv returns the environment variable value or the provided default.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// corsMiddleware returns middleware that sets CORS headers for the given origin.
func corsMiddleware(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			// Handle preflight requests.
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
