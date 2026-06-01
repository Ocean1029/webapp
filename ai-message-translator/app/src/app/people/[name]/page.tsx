"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { PersonDetail, PersonInsightData, AnalysisResponse } from "@/types";
import TrendChart from "@/components/TrendChart";
import PersonInsight from "@/components/PersonInsight";

const LAMBDA = 0.05;
const MS_PER_DAY = 86400000;

function computeWeightedScore(analyses: AnalysisResponse[]): number {
  if (analyses.length === 0) return 0;
  const now = Date.now();
  let weightSum = 0;
  let scoreSum = 0;
  for (const a of analyses) {
    const daysAgo = (now - new Date(a.createdAt).getTime()) / MS_PER_DAY;
    const w = Math.exp(-LAMBDA * daysAgo);
    weightSum += w;
    scoreSum += a.interestScore * w;
  }
  return Math.round((scoreSum / weightSum) * 10) / 10;
}

function scoreColors(score: number) {
  if (score >= 7) return { bg: "bg-green-100", text: "text-green-700", ring: "ring-green-500" };
  if (score >= 4) return { bg: "bg-yellow-100", text: "text-yellow-700", ring: "ring-yellow-500" };
  return { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-500" };
}

export default function PersonDetailPage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const contactName = decodeURIComponent(name);

  const [data, setData] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [error, setError] = useState("");

  const fetchPerson = useCallback(async () => {
    const res = await fetch(`/api/people/${encodeURIComponent(contactName)}`);
    if (!res.ok) throw new Error("找不到此聯絡人");
    return res.json() as Promise<PersonDetail>;
  }, [contactName]);

  const generateInsight = useCallback(async (): Promise<PersonInsightData> => {
    const res = await fetch(`/api/people/${encodeURIComponent(contactName)}/insight`, {
      method: "PUT",
    });
    if (!res.ok) throw new Error("生成分析失敗");
    return res.json() as Promise<PersonInsightData>;
  }, [contactName]);

  useEffect(() => {
    (async () => {
      try {
        const person = await fetchPerson();
        setData(person);

        // Auto-generate if no cached insight and there are analyses
        if (!person.insight && person.analyses.length > 0) {
          setGeneratingInsight(true);
          try {
            const insight = await generateInsight();
            setData((prev) => prev ? { ...prev, insight } : prev);
          } catch {
            // Non-fatal
          } finally {
            setGeneratingInsight(false);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入失敗");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchPerson, generateInsight]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center max-w-sm w-full">
          <p className="text-sm text-red-700">{error || "找不到此聯絡人"}</p>
          <button type="button" onClick={() => router.back()} className="mt-4 text-sm text-indigo-600 hover:text-indigo-500">
            返回
          </button>
        </div>
      </div>
    );
  }

  const weightedScore = computeWeightedScore(data.analyses);
  const colors = scoreColors(weightedScore);

  return (
    <div className="flex flex-col flex-1 bg-gray-50 min-h-screen">
      <div className="w-full max-w-2xl mx-auto px-4 py-8 space-y-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          返回
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 shrink-0">
            <span className="text-lg font-bold text-indigo-600">
              {contactName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{contactName}</h2>
            <p className="text-xs text-gray-400">{data.analyses.length} 筆對話分析</p>
          </div>
        </div>

        {/* Weighted score — always shown immediately from analyses */}
        {data.analyses.length > 0 && (
          <div className="flex flex-col items-center rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="text-sm font-medium text-gray-500 mb-3">加權興趣指數</h2>
            <div className={`flex items-center justify-center w-24 h-24 rounded-full ring-4 ${colors.bg} ${colors.ring}`}>
              <span className={`text-3xl font-bold ${colors.text}`}>
                {weightedScore.toFixed(1)}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-400">/10</p>
          </div>
        )}

        {/* Insight: generating / ready / empty */}
        {generatingInsight ? (
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-3">
            <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
            <p className="text-sm text-gray-500">AI 正在生成綜合分析與應對策略…</p>
          </div>
        ) : data.insight ? (
          <PersonInsight insight={data.insight} />
        ) : data.analyses.length === 0 ? (
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500">尚無對話分析，先去分析幾則對話吧！</p>
          </div>
        ) : null}

        {/* Interest trend chart */}
        {data.analyses.length > 0 && (
          <TrendChart contactName={contactName} analyses={data.analyses} />
        )}
      </div>
    </div>
  );
}
