# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Download dependencies first for better layer caching.
COPY go.mod go.sum ./
RUN go mod download

# Copy source code and build the binary.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

# Run stage
FROM alpine:3.21

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /server /app/server
COPY migrations/ /app/migrations/

EXPOSE 8080

ENTRYPOINT ["/app/server"]
