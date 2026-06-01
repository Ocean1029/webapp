"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ConversationSummary, AnalysisResponse } from "@/types";
import { getConversations, getConversation } from "@/lib/api";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreBadgeClass(score: number): string {
  if (score >= 7) return "bg-green-100 text-green-700";
  if (score >= 4) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

interface ConversationGroup {
  conversation: ConversationSummary;
  analyses: AnalysisResponse[];
}

export default function ConversationList() {
  const [groups, setGroups] = useState<ConversationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const conversations = await getConversations();
        const results = await Promise.all(
          conversations.map((conv) =>
            getConversation(conv.id).then((detail) => ({
              conversation: conv,
              analyses: detail.analyses,
            }))
          )
        );
        setGroups(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入失敗");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const hasAny = groups.some((g) => g.analyses.length > 0);

  if (!hasAny) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">目前還沒有任何分析紀錄，快去分析一段對話吧！</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups
        .filter((g) => g.analyses.length > 0)
        .map(({ conversation, analyses }) => (
          <div key={conversation.id}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
              {conversation.contactName}
            </p>
            <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
              {analyses.map((analysis) => (
                <Link
                  key={analysis.id}
                  href={`/history/analyses/${analysis.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-400">{formatDate(analysis.createdAt)}</p>
                    <p className="mt-0.5 text-sm text-gray-700 truncate">{analysis.summary}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreBadgeClass(
                        analysis.interestScore
                      )}`}
                    >
                      {analysis.interestScore}/10
                    </span>
                    <svg
                      className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
