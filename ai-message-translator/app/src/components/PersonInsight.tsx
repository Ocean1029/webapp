"use client";

import type { PersonInsightData } from "@/types";

interface PersonInsightProps {
  insight: PersonInsightData;
}

export default function PersonInsight({ insight }: PersonInsightProps) {
  const updatedDate = new Date(insight.updatedAt).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-2">綜合分析</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{insight.overallAnalysis}</p>
      </div>

      <div className="rounded-xl bg-indigo-50 p-6 shadow-sm border border-indigo-100">
        <h2 className="text-sm font-medium text-indigo-500 mb-2">應對策略</h2>
        <p className="text-sm text-indigo-800 leading-relaxed">{insight.strategy}</p>
      </div>

      <p className="text-xs text-gray-400 text-right">最後更新：{updatedDate}</p>
    </div>
  );
}
