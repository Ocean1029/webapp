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

export type Gender = "male" | "female";

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

/** Lightweight person summary for the people list. */
export interface PersonSummary {
  contactName: string;
  aliases: string[];
  analysisCount: number;
  weightedInterestScore: number;
  latestAnalysisDate: string;
}

/** AI-generated insight for a person. */
export interface PersonInsightData {
  overallAnalysis: string;
  strategy: string;
  weightedInterestScore: number;
  updatedAt: string;
}

/** Person detail with analyses and optional cached insight. */
export interface PersonDetail {
  contactName: string;
  aliases: string[];
  analyses: AnalysisResponse[];
  insight: PersonInsightData | null;
}
