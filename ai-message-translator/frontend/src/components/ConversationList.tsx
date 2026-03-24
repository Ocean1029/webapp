"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  ConversationSummary,
  ConversationWithAnalyses,
  AnalysisResponse,
} from "@/types";
import { getConversations, getConversation } from "@/lib/api";

/** Format an ISO date string for display. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Return a Tailwind color class based on interest score. */
function scoreBadgeClass(score: number): string {
  if (score >= 7) return "bg-green-100 text-green-700";
  if (score >= 4) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

interface ConversationListProps {
  onSelectConversation?: (conversation: ConversationWithAnalyses) => void;
}

/**
 * List all conversations with expand/collapse to show analyses.
 */
export default function ConversationList({
  onSelectConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] =
    useState<ConversationWithAnalyses | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandLoading, setExpandLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getConversations()
      .then(setConversations)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "載入對話紀錄失敗")
      )
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedData(null);
        return;
      }

      setExpandedId(id);
      setExpandLoading(true);
      try {
        const data = await getConversation(id);
        setExpandedData(data);
        onSelectConversation?.(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入對話詳情失敗");
      } finally {
        setExpandLoading(false);
      }
    },
    [expandedId, onSelectConversation]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">
          目前還沒有任何對話紀錄，快去分析一段對話吧！
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden"
        >
          {/* Conversation header row */}
          <button
            type="button"
            onClick={() => handleToggle(conv.id)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {conv.contactName}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {conv.latestAnalysisDate
                  ? `最後分析：${formatDate(conv.latestAnalysisDate)}`
                  : "尚無分析"}
                {conv.analysisCount > 0 && (
                  <span className="ml-2">
                    共 {conv.analysisCount} 筆分析
                  </span>
                )}
              </p>
            </div>
            <svg
              className={`h-4 w-4 text-gray-400 transition-transform ${
                expandedId === conv.id ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>

          {/* Expanded analyses list */}
          {expandedId === conv.id && (
            <div className="border-t border-gray-100 px-5 py-4">
              {expandLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                </div>
              ) : expandedData?.analyses.length ? (
                <div className="space-y-3">
                  {expandedData.analyses.map((analysis: AnalysisResponse) => (
                    <div
                      key={analysis.id}
                      className="rounded-lg bg-gray-50 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          {formatDate(analysis.createdAt)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${scoreBadgeClass(
                            analysis.interestScore
                          )}`}
                        >
                          興趣指數：{analysis.interestScore}/10
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {analysis.summary}
                      </p>
                      <p className="text-xs text-gray-400">
                        模式：
                        {analysis.toneMode === "counselor"
                          ? "諮詢師"
                          : "好友"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-2">
                  此對話尚無分析紀錄
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
