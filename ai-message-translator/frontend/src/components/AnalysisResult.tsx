"use client";

import type { AnalysisResponse } from "@/types";

interface AnalysisResultProps {
  result: AnalysisResponse;
  onReset: () => void;
}

/**
 * Return color classes for the interest score gauge.
 */
function scoreColor(score: number): {
  bg: string;
  text: string;
  ring: string;
} {
  if (score >= 7) return { bg: "bg-green-100", text: "text-green-700", ring: "ring-green-500" };
  if (score >= 4) return { bg: "bg-yellow-100", text: "text-yellow-700", ring: "ring-yellow-500" };
  return { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-500" };
}

/**
 * Display analysis results: interest score, subtext translations,
 * reply suggestions, and summary.
 */
export default function AnalysisResult({
  result,
  onReset,
}: AnalysisResultProps) {
  const colors = scoreColor(result.interestScore);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Interest score gauge */}
      <div className="flex flex-col items-center rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">
          興趣指數
        </h2>
        <div
          className={`flex items-center justify-center w-24 h-24 rounded-full ring-4 ${colors.bg} ${colors.ring}`}
        >
          <span className={`text-3xl font-bold ${colors.text}`}>
            {result.interestScore}
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-400">/10</p>
      </div>

      {/* Subtext translation list */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-4">
          潛台詞翻譯
        </h2>
        <div className="space-y-3">
          {result.subtextTranslation.map((entry, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg bg-gray-50 p-4"
            >
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">
                  原文
                </p>
                <p className="text-sm text-gray-700">{entry.original}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-indigo-400 mb-1">
                  潛台詞
                </p>
                <p className="text-sm text-indigo-700 font-medium">
                  {entry.subtext}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reply suggestion cards */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-4">
          建議回覆
        </h2>
        <div className="space-y-3">
          {result.replySuggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-indigo-100 bg-indigo-50 p-4"
            >
              <p className="text-sm font-medium text-gray-800">
                {suggestion.text}
              </p>
              <p className="mt-1 text-xs text-indigo-600">
                預期效果：{suggestion.expectedEffect}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-2">
          整體分析
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          {result.summary}
        </p>
      </div>

      {/* Reset button */}
      <button
        type="button"
        onClick={onReset}
        className="w-full rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
      >
        重新分析
      </button>
    </div>
  );
}
