"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PersonDetail, PersonInsightData, AnalysisResponse } from "@/types";
import TrendChart from "@/components/TrendChart";

const LAMBDA = 0.05;
const MS_PER_DAY = 86400000;

function computeWeightedScore(analyses: AnalysisResponse[]): number {
  if (analyses.length === 0) return 0;
  const now = Date.now();
  let weightSum = 0, scoreSum = 0;
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

function scoreBadgeClass(score: number): string {
  if (score >= 7) return "bg-green-100 text-green-700";
  if (score >= 4) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function PersonDetailPage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const contactName = decodeURIComponent(name);

  const [data, setData] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [error, setError] = useState("");

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPerson = useCallback(async () => {
    const res = await fetch(`/api/people/${encodeURIComponent(contactName)}`);
    if (!res.ok) throw new Error("找不到此聯絡人");
    return res.json() as Promise<PersonDetail>;
  }, [contactName]);

  const generateInsight = useCallback(async (): Promise<PersonInsightData> => {
    const res = await fetch(`/api/people/${encodeURIComponent(contactName)}/insight`, { method: "PUT" });
    if (!res.ok) throw new Error("生成分析失敗");
    return res.json() as Promise<PersonInsightData>;
  }, [contactName]);

  useEffect(() => {
    (async () => {
      try {
        const person = await fetchPerson();
        setData(person);
        setEditName(person.contactName);
        if (!person.insight && person.analyses.length > 0) {
          setGeneratingInsight(true);
          try {
            const insight = await generateInsight();
            setData((prev) => prev ? { ...prev, insight } : prev);
          } catch { /* non-fatal */ }
          finally { setGeneratingInsight(false); }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入失敗");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchPerson, generateInsight]);

  const patchAlias = useCallback(async (body: object) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(data!.contactName)}/aliases`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("操作失敗");
      const updated = await fetchPerson();
      setData(updated);
      setEditName(updated.contactName);
    } finally {
      setSaving(false);
    }
  }, [data, fetchPerson]);

  const handleRename = useCallback(async () => {
    if (!editName.trim() || editName.trim() === data?.contactName) { setEditing(false); return; }
    await patchAlias({ action: "rename", newName: editName.trim() });
    router.replace(`/people/${encodeURIComponent(editName.trim())}`);
    setEditing(false);
  }, [editName, data, patchAlias, router]);

  const handleAddAlias = useCallback(async () => {
    if (!newAlias.trim()) return;
    await patchAlias({ action: "addAlias", alias: newAlias.trim() });
    setNewAlias("");
  }, [newAlias, patchAlias]);

  const handleRemoveAlias = useCallback(async (alias: string) => {
    await patchAlias({ action: "removeAlias", alias });
  }, [patchAlias]);

  if (loading) return (
    <div className="flex flex-1 items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-1 items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center max-w-sm w-full">
        <p className="text-sm text-red-700">{error || "找不到此聯絡人"}</p>
        <button type="button" onClick={() => router.back()} className="mt-4 text-sm text-indigo-600 hover:text-indigo-500">返回</button>
      </div>
    </div>
  );

  const weightedScore = computeWeightedScore(data.analyses);
  const colors = scoreColors(weightedScore);
  const hasEnoughForChart = data.analyses.length >= 3;

  return (
    <div className="flex flex-col flex-1 bg-gray-50 min-h-screen">
      <div className="w-full max-w-2xl mx-auto px-4 py-8 space-y-4">
        <button type="button" onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          返回
        </button>

        {/* Unified summary card */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          {/* Header row */}
          <div className="flex items-center gap-3 px-6 pt-6 pb-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-indigo-100 shrink-0">
              <span className="text-base font-bold text-indigo-600">
                {data.contactName.charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename()}
                    className="text-lg font-bold text-gray-900 border-b-2 border-indigo-400 outline-none bg-transparent w-full"
                  />
                  <button onClick={handleRename} disabled={saving}
                    className="text-xs text-indigo-600 hover:text-indigo-500 font-medium shrink-0">
                    儲存
                  </button>
                  <button onClick={() => { setEditing(false); setEditName(data.contactName); }}
                    className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-gray-900">{data.contactName}</h2>
                  <button onClick={() => setEditing(true)}
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                    title="編輯名稱">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-0.5">{data.analyses.length} 筆對話分析</p>

              {/* Aliases */}
              {(editing || data.aliases.length > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {data.aliases.map((alias) => (
                    <span key={alias} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {alias}
                      {editing && (
                        <button onClick={() => handleRemoveAlias(alias)} className="text-gray-400 hover:text-red-400">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </span>
                  ))}
                  {editing && (
                    <div className="flex items-center gap-1">
                      <input
                        value={newAlias}
                        onChange={(e) => setNewAlias(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddAlias()}
                        placeholder="輸入別名..."
                        className="text-xs border border-gray-200 rounded-full px-2.5 py-0.5 outline-none focus:border-indigo-400 w-28"
                      />
                      <button onClick={handleAddAlias} disabled={saving || !newAlias.trim()}
                        className="text-xs text-indigo-500 hover:text-indigo-600 font-medium disabled:opacity-40">
                        新增
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {data.analyses.length > 0 && (
              <div className={`ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 ring-2 ${colors.bg} ${colors.ring} shrink-0`}>
                <span className={`text-xl font-bold ${colors.text}`}>{weightedScore.toFixed(1)}</span>
                <span className={`text-xs ${colors.text} opacity-70`}>/10</span>
              </div>
            )}
          </div>

          {/* Overall analysis */}
          <div className="border-t border-gray-50 px-6 py-4">
            <p className="text-xs font-medium text-gray-400 mb-1.5">綜合分析</p>
            {generatingInsight ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full shrink-0" />
                <p className="text-sm text-gray-400">AI 正在生成分析…</p>
              </div>
            ) : data.insight ? (
              <p className="text-sm text-gray-700 leading-relaxed">{data.insight.overallAnalysis}</p>
            ) : data.analyses.length === 0 ? (
              <p className="text-sm text-gray-400">尚無對話分析，先去分析幾則對話吧！</p>
            ) : (
              <p className="text-sm text-gray-400">載入中…</p>
            )}
          </div>
        </div>

        {/* Trend chart — only with >= 3 analyses */}
        {hasEnoughForChart && (
          <TrendChart contactName={data.contactName} analyses={data.analyses} />
        )}

        {/* Strategy */}
        {(generatingInsight || data.insight) && (
          <div className="rounded-xl bg-white shadow-sm border border-gray-100 px-6 py-4">
            <p className="text-xs font-medium text-indigo-400 mb-1.5">應對策略</p>
            {generatingInsight ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full shrink-0" />
                <p className="text-sm text-gray-400">生成中…</p>
              </div>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">{data.insight?.strategy}</p>
            )}
          </div>
        )}

        {/* Analyses list */}
        {data.analyses.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">對話記錄</p>
            <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
              {data.analyses.map((analysis) => (
                <Link key={analysis.id} href={`/history/analyses/${analysis.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-400">{formatDate(analysis.createdAt)}</p>
                    <p className="mt-0.5 text-sm text-gray-700 truncate">{analysis.summary}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreBadgeClass(analysis.interestScore)}`}>
                      {analysis.interestScore}/10
                    </span>
                    <svg className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
