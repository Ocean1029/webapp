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

// Create an Anthropic client (reuses the same env-var check).
function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey });
}

// Parse the Claude response into an AnalysisResult.
function parseAnalysisResponse(message: Anthropic.Message): AnalysisResult {
  if (message.content.length === 0) {
    throw new Error("Claude returned empty response");
  }

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected content block type: ${block.type}`);
  }

  const cleaned = stripMarkdownFences(block.text);
  return JSON.parse(cleaned);
}

/**
 * Analyze a conversation using Claude AI (text input).
 */
export async function analyzeConversation(
  text: string,
  toneMode: string
): Promise<AnalysisResult> {
  const client = createClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    system: selectPrompt(toneMode),
    messages: [{ role: "user", content: text }],
  });
  return parseAnalysisResponse(message);
}

interface WeightedAnalysis {
  summary: string;
  interestScore: number;
  createdAt: string;
  weight: number;
}

interface PersonInsightResult {
  overallAnalysis: string;
  strategy: string;
}

/**
 * Generate a comprehensive insight and strategy for a person
 * based on all their weighted historical analyses.
 */
export async function generatePersonInsight(
  contactName: string,
  analyses: WeightedAnalysis[]
): Promise<PersonInsightResult> {
  const client = createClient();

  const analysesSummary = analyses
    .map((a, i) => {
      const pct = Math.round(a.weight * 100);
      const dateStr = new Date(a.createdAt as unknown as string | Date).toISOString().slice(0, 10);
      return `[第${i + 1}筆，日期：${dateStr}，興趣分數：${a.interestScore}/10，權重：${pct}%]\n${a.summary}`;
    })
    .join("\n\n");

  const systemPrompt = `你是一位人際關係分析專家，請根據使用者與某人的多次對話分析記錄，
給出綜合評估與應對策略。越近期的對話記錄權重越高，代表當前關係的實際狀態。

請用繁體中文（台灣用語）回答，並以下列 JSON 格式回覆（不含 markdown）：
{
  "overallAnalysis": "對這個人的綜合分析（100-200字）：包含他的個性特質、對你的態度轉變趨勢、溝通風格",
  "strategy": "整體應對策略（100-200字）：根據分析給出具體的互動建議與注意事項"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `聯絡人：${contactName}\n\n以下是所有對話分析記錄（依時間由舊到新排列）：\n\n${analysesSummary}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected content type");

  const cleaned = stripMarkdownFences(block.text);
  return JSON.parse(cleaned) as PersonInsightResult;
}
