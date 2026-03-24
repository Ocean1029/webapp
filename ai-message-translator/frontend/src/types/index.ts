// Domain types for the AI Message Translator frontend

export interface SubtextEntry {
  original: string;
  subtext: string;
}

export interface ReplySuggestion {
  text: string;
  expectedEffect: string;
}

export type ToneMode = "counselor" | "bestfriend";

export interface AnalysisResponse {
  id: string;
  interestScore: number;
  subtextTranslation: SubtextEntry[];
  replySuggestions: ReplySuggestion[];
  summary: string;
  toneMode: ToneMode;
  createdAt: string;
}

export interface Conversation {
  id: string;
  contactName: string;
  createdAt: string;
  updatedAt: string;
}

/** Conversation with its associated analyses, returned by the detail endpoint. */
export interface ConversationWithAnalyses extends Conversation {
  analyses: AnalysisResponse[];
}

/** Lightweight conversation summary for the list view. */
export interface ConversationSummary extends Conversation {
  latestAnalysisDate: string | null;
  analysisCount: number;
}
