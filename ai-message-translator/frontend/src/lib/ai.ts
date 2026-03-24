import Anthropic from "@anthropic-ai/sdk";

// System prompt: professional relationship counselor tone.
const counselorSystemPrompt = `You are a professional relationship counselor analyzing LINE chat conversations.
Analyze the conversation and respond in Traditional Chinese (Taiwan).

For each message from the other person, provide:
1. The subtext (what they likely mean beneath the surface)
2. An overall interest score from 1 to 10 (1 = not interested at all, 10 = extremely interested)
3. Two to three reply suggestions with expected effects
4. A brief summary of the overall conversation dynamics

You MUST respond with ONLY valid JSON in the following format (no markdown, no extra text):
{
  "subtextTranslation": [
    {"original": "the original message", "subtext": "what they really mean"}
  ],
  "interestScore": 7,
  "replySuggestions": [
    {"text": "suggested reply", "expectedEffect": "what effect this reply would have"}
  ],
  "summary": "brief overall analysis"
}`;

// System prompt: brutally honest best friend tone.
const bestFriendSystemPrompt = `You are the user's brutally honest best friend analyzing LINE chat conversations.
Be funny, use casual Taiwanese slang (e.g., \u6b38\u3001\u311f\u3001der\u3001\u8d85\u3001hen), and don't sugarcoat anything. Roast the situation if needed.

For each message from the other person, provide:
1. The subtext (roast-style translation of what they REALLY mean)
2. An overall interest score from 1 to 10 (1 = not interested at all, 10 = extremely interested)
3. Two to three reply suggestions ranging from bold to safe, with expected effects
4. A brief sarcastic summary of the overall situation

You MUST respond with ONLY valid JSON in the following format (no markdown, no extra text):
{
  "subtextTranslation": [
    {"original": "the original message", "subtext": "roast-style translation"}
  ],
  "interestScore": 5,
  "replySuggestions": [
    {"text": "suggested reply", "expectedEffect": "expected outcome"}
  ],
  "summary": "sarcastic summary of the situation"
}`;

// Structured response from Claude's analysis.
interface AnalysisResult {
  subtextTranslation: { original: string; subtext: string }[];
  interestScore: number;
  replySuggestions: { text: string; expectedEffect: string }[];
  summary: string;
}

// Select the system prompt based on tone mode.
function selectPrompt(toneMode: string): string {
  if (toneMode === "bestfriend") {
    return bestFriendSystemPrompt;
  }
  return counselorSystemPrompt;
}

// Strip markdown code block fences from Claude's response text.
function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Analyze a conversation using Claude AI.
 * Returns the structured analysis result.
 */
export async function analyzeConversation(
  text: string,
  toneMode: string
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = selectPrompt(toneMode);

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: text,
      },
    ],
  });

  if (message.content.length === 0) {
    throw new Error("Claude returned empty response");
  }

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected content block type: ${block.type}`);
  }

  const cleaned = stripMarkdownFences(block.text);

  const result: AnalysisResult = JSON.parse(cleaned);
  return result;
}
