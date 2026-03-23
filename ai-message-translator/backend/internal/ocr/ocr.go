// Package ocr wraps the Google Cloud Vision API for text extraction from images.
package ocr

import (
	"context"
	"strings"

	vision "cloud.google.com/go/vision/v2/apiv1"
	visionpb "cloud.google.com/go/vision/v2/apiv1/visionpb"
)

// Client wraps a Google Cloud Vision ImageAnnotatorClient.
type Client struct {
	visionClient *vision.ImageAnnotatorClient
}

// Result holds the extracted text from an image.
type Result struct {
	// FullText is the complete detected text from the image.
	FullText string `json:"fullText"`
	// Lines contains each line of detected text.
	Lines []string `json:"lines"`
}

// New creates a new OCR Client using the Google Cloud Vision API.
// It requires valid Google Cloud credentials in the environment.
func New(ctx context.Context) (*Client, error) {
	vc, err := vision.NewImageAnnotatorClient(ctx)
	if err != nil {
		return nil, err
	}
	return &Client{visionClient: vc}, nil
}

// Close releases resources held by the underlying Vision client.
func (c *Client) Close() error {
	return c.visionClient.Close()
}

// ExtractText performs text detection on the provided image data
// and returns the extracted text split into lines.
func (c *Client) ExtractText(ctx context.Context, imageData []byte) (*Result, error) {
	req := &visionpb.BatchAnnotateImagesRequest{
		Requests: []*visionpb.AnnotateImageRequest{
			{
				Image: &visionpb.Image{
					Content: imageData,
				},
				Features: []*visionpb.Feature{
					{
						Type: visionpb.Feature_TEXT_DETECTION,
					},
				},
			},
		},
	}

	resp, err := c.visionClient.BatchAnnotateImages(ctx, req)
	if err != nil {
		return nil, err
	}

	if len(resp.Responses) == 0 {
		return &Result{}, nil
	}

	return ParseAnnotations(resp.Responses[0].TextAnnotations), nil
}

// ParseAnnotations converts Vision API text annotations into a Result.
// The first annotation contains the full detected text; subsequent entries
// are individual words/blocks. Lines are derived by splitting the full text.
func ParseAnnotations(annotations []*visionpb.EntityAnnotation) *Result {
	if len(annotations) == 0 {
		return &Result{}
	}

	fullText := annotations[0].GetDescription()
	lines := splitLines(fullText)

	return &Result{
		FullText: fullText,
		Lines:    lines,
	}
}

// splitLines splits text into non-empty trimmed lines.
func splitLines(text string) []string {
	raw := strings.Split(text, "\n")
	lines := make([]string, 0, len(raw))
	for _, line := range raw {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			lines = append(lines, trimmed)
		}
	}
	return lines
}
