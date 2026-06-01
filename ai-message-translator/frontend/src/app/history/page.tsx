"use client";

import ConversationList from "@/components/ConversationList";

/**
 * History page: browse past conversations and navigate to individual analyses.
 */
export default function HistoryPage() {
  return (
    <div className="flex flex-col flex-1 items-center bg-gray-50 min-h-screen">
      <main className="w-full max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">對話紀錄</h2>
          <p className="text-sm text-gray-500">
            點選聯絡人查看分析記錄
          </p>
        </div>

        <ConversationList />
      </main>
    </div>
  );
}
