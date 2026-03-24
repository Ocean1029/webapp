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
