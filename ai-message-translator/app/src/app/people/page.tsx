"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { PersonSummary } from "@/types";

function scoreBadgeClass(score: number): string {
  if (score >= 7) return "bg-green-100 text-green-700";
  if (score >= 4) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/people")
      .then((res) => {
        if (!res.ok) throw new Error("載入失敗");
        return res.json();
      })
      .then(setPeople)
      .catch((err) => setError(err instanceof Error ? err.message : "載入失敗"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col flex-1 bg-gray-50 min-h-screen">
      <main className="w-full max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">人物</h2>
          <p className="text-sm text-gray-500">點選聯絡人查看綜合分析與應對策略</p>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && people.length === 0 && (
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">還沒有任何分析紀錄，先去分析幾則對話吧！</p>
          </div>
        )}

        {!loading && !error && (
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {people.map((person) => (
              <Link
                key={person.contactName}
                href={`/people/${encodeURIComponent(person.contactName)}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 shrink-0">
                  <span className="text-sm font-semibold text-indigo-600">
                    {person.contactName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{person.contactName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {person.analysisCount} 筆分析・最後：{formatDate(person.latestAnalysisDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreBadgeClass(person.weightedInterestScore)}`}>
                    {person.weightedInterestScore.toFixed(1)}/10
                  </span>
                  <svg className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
