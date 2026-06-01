"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { PersonSummary } from "@/types";

function scoreBadgeClass(score: number): string {
  if (score >= 7) return "bg-green-100 text-green-700";
  if (score >= 4) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Merge modal state
  const [mergeOpen, setMergeOpen] = useState(false);
  const [keepName, setKeepName] = useState("");
  const [mergeName, setMergeName] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");

  const loadPeople = useCallback(() => {
    setLoading(true);
    fetch("/api/people")
      .then((res) => { if (!res.ok) throw new Error("載入失敗"); return res.json(); })
      .then(setPeople)
      .catch((err) => setError(err instanceof Error ? err.message : "載入失敗"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPeople(); }, [loadPeople]);

  const handleMerge = useCallback(async () => {
    if (!keepName || !mergeName || keepName === mergeName) return;
    setMerging(true);
    setMergeError("");
    try {
      const res = await fetch(
        `/api/people/${encodeURIComponent(keepName)}/aliases`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "merge", mergeName }),
        }
      );
      if (!res.ok) throw new Error("合併失敗");
      setMergeOpen(false);
      setKeepName("");
      setMergeName("");
      loadPeople();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "合併失敗");
    } finally {
      setMerging(false);
    }
  }, [keepName, mergeName, loadPeople]);

  return (
    <div className="flex flex-col flex-1 bg-gray-50 min-h-screen">
      <main className="w-full max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">人物</h2>
            <p className="text-sm text-gray-500">點選聯絡人查看綜合分析與應對策略</p>
          </div>
          {people.length >= 2 && (
            <button
              type="button"
              onClick={() => setMergeOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
              </svg>
              合併聯絡人
            </button>
          )}
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

        {!loading && !error && people.length > 0 && (
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
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900">{person.contactName}</p>
                    {person.aliases.length > 0 && (
                      <span className="text-xs text-gray-400">
                        ({person.aliases.join(", ")})
                      </span>
                    )}
                  </div>
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

      {/* Merge modal */}
      {mergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setMergeOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900">合併聯絡人</h3>
            <p className="text-sm text-gray-500">將兩個聯絡人視為同一人，分析資料會合併計算。</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">保留的名稱（主要顯示名）</label>
                <select
                  value={keepName}
                  onChange={(e) => setKeepName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="">選擇…</option>
                  {people.map((p) => (
                    <option key={p.contactName} value={p.contactName}>{p.contactName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">要合併進來的名稱（變成別名）</label>
                <select
                  value={mergeName}
                  onChange={(e) => setMergeName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="">選擇…</option>
                  {people.filter((p) => p.contactName !== keepName).map((p) => (
                    <option key={p.contactName} value={p.contactName}>{p.contactName}</option>
                  ))}
                </select>
              </div>
            </div>

            {mergeError && <p className="text-xs text-red-500">{mergeError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMergeOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={!keepName || !mergeName || keepName === mergeName || merging}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {merging ? "合併中…" : "確認合併"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
