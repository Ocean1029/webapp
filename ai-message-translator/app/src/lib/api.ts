// API client for communicating with the Next.js API routes

import type {
  AnalysisResponse,
  ConversationSummary,
  ConversationWithAnalyses,
} from "@/types";

/**
 * Upload a screenshot image for analysis.
 */
export async function analyzeScreenshot(
  file: File,
  toneMode: string,
  contactName: string
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append("screenshot", file);
  formData.append("toneMode", toneMode);
  formData.append("contactName", contactName);

  const res = await fetch("/api/analyze/screenshot", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Screenshot analysis failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Submit raw text for analysis.
 */
export async function analyzeText(
  text: string,
  toneMode: string,
  contactName: string
): Promise<AnalysisResponse> {
  const res = await fetch("/api/analyze/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, toneMode, contactName }),
  });

  if (!res.ok) {
    throw new Error(`Text analysis failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch all conversations (with summary info).
 */
export async function getConversations(): Promise<ConversationSummary[]> {
  const res = await fetch("/api/conversations");

  if (!res.ok) {
    throw new Error(`Failed to fetch conversations: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch a single conversation with all its analyses.
 */
export async function getConversation(
  id: string
): Promise<ConversationWithAnalyses> {
  const res = await fetch(`/api/conversations/${id}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch conversation: ${res.status}`);
  }

  return res.json();
}
