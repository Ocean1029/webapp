package ocr_test

import (
	"testing"

	visionpb "cloud.google.com/go/vision/v2/apiv1/visionpb"
	"github.com/Ocean1029/webapp/ai-message-translator/backend/internal/ocr"
	"github.com/stretchr/testify/assert"
)

func TestParseAnnotations_MultipleLines(t *testing.T) {
	annotations := []*visionpb.EntityAnnotation{
		{Description: "你好\n最近怎麼樣\n有空嗎"},
	}

	result := ocr.ParseAnnotations(annotations)

	assert.Equal(t, "你好\n最近怎麼樣\n有空嗎", result.FullText)
	assert.Equal(t, []string{"你好", "最近怎麼樣", "有空嗎"}, result.Lines)
}

func TestParseAnnotations_EmptyAnnotations(t *testing.T) {
	result := ocr.ParseAnnotations(nil)

	assert.Empty(t, result.FullText)
	assert.Empty(t, result.Lines)
}

func TestParseAnnotations_SingleLine(t *testing.T) {
	annotations := []*visionpb.EntityAnnotation{
		{Description: "Hello World"},
	}

	result := ocr.ParseAnnotations(annotations)

	assert.Equal(t, "Hello World", result.FullText)
	assert.Equal(t, []string{"Hello World"}, result.Lines)
}

func TestParseAnnotations_BlankLinesFiltered(t *testing.T) {
	annotations := []*visionpb.EntityAnnotation{
		{Description: "Line 1\n\n  \nLine 2\n"},
	}

	result := ocr.ParseAnnotations(annotations)

	assert.Equal(t, []string{"Line 1", "Line 2"}, result.Lines)
}

func TestParseAnnotations_WhitespaceTrimmed(t *testing.T) {
	annotations := []*visionpb.EntityAnnotation{
		{Description: "  早安  \n  午安  "},
	}

	result := ocr.ParseAnnotations(annotations)

	assert.Equal(t, []string{"早安", "午安"}, result.Lines)
}
