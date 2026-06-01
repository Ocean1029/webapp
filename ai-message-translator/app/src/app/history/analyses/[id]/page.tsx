"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type { AnalysisResponse } from "@/types";
import AnalysisResult from "@/components/AnalysisResult";

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/analyses/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("找不到此分析記錄");
        return res.json();
      })
      .then(setAnalysis)
      .catch((err) => setError(err instanceof Error ? err.message : "載入失敗"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center max-w-sm w-full">
          <p className="text-sm text-red-700">{error || "找不到此分析記錄"}</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 text-sm text-indigo-600 hover:text-indigo-500"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-gray-50 min-h-screen">
      <div className="w-full max-w-2xl mx-auto px-4 py-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          返回歷史紀錄
        </button>
        <AnalysisResult result={analysis} onReset={() => router.back()} resetLabel="返回歷史紀錄" />
      </div>
    </div>
  );
}
