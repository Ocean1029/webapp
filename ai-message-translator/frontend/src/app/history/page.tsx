"use client";

import { useState } from "react";
import type { ConversationWithAnalyses } from "@/types";
import ConversationList from "@/components/ConversationList";
import TrendChart from "@/components/TrendChart";

/**
 * History page: browse past conversations and view interest score trends.
 */
export default function HistoryPage() {
  const [selected, setSelected] = useState<ConversationWithAnalyses | null>(
    null
  );

  return (
    <div className="flex flex-col flex-1 items-center bg-gray-50 min-h-screen">
      <main className="w-full max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            對話紀錄
          </h2>
          <p className="text-sm text-gray-500">
            點選聯絡人查看所有分析結果與興趣趨勢
          </p>
        </div>

        {/* Trend chart for the selected conversation */}
        <TrendChart
          contactName={selected?.contactName ?? ""}
          analyses={selected?.analyses ?? []}
        />

        {/* Conversation list with expand/collapse */}
        <ConversationList onSelectConversation={setSelected} />
      </main>
    </div>
  );
}
