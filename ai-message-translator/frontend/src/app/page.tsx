"use client";

import { useState, useCallback } from "react";
import type { ToneMode, AnalysisResponse } from "@/types";
import { analyzeScreenshot, analyzeText } from "@/lib/api";
import UploadArea from "@/components/UploadArea";
import AnalysisResult from "@/components/AnalysisResult";

type PageState = "input" | "loading" | "result" | "error";

/**
 * Main page: upload conversation screenshots or text, then display analysis results.
 */
export default function Home() {
  const [pageState, setPageState] = useState<PageState>("input");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleScreenshot = useCallback(
    async (file: File, toneMode: ToneMode, contactName: string) => {
      setPageState("loading");
      setErrorMessage("");
      try {
        const data = await analyzeScreenshot(file, toneMode, contactName);
        setResult(data);
        setPageState("result");
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "分析時發生未知錯誤"
        );
        setPageState("error");
      }
    },
    []
  );

  const handleText = useCallback(
    async (text: string, toneMode: ToneMode, contactName: string) => {
      setPageState("loading");
      setErrorMessage("");
      try {
        const data = await analyzeText(text, toneMode, contactName);
        setResult(data);
        setPageState("result");
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "分析時發生未知錯誤"
        );
        setPageState("error");
      }
    },
    []
  );

  const handleReset = useCallback(() => {
    setPageState("input");
    setResult(null);
    setErrorMessage("");
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center bg-gray-50 min-h-screen">
      <header className="w-full bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 text-center">
            AI 已讀不回翻譯機
          </h1>
          <p className="mt-1 text-sm text-gray-500 text-center">
            上傳聊天截圖或貼上對話，幫你解讀對方的潛台詞
          </p>
        </div>
      </header>

      <main className="w-full max-w-2xl mx-auto px-4 py-8">
        {/* Input state */}
        {(pageState === "input" || pageState === "loading") && (
          <UploadArea
            onSubmitScreenshot={handleScreenshot}
            onSubmitText={handleText}
            isLoading={pageState === "loading"}
          />
        )}

        {/* Error state */}
        {pageState === "error" && (
          <div className="w-full max-w-2xl mx-auto space-y-4">
            <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
              <svg
                className="mx-auto h-10 w-10 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <p className="mt-3 text-sm font-medium text-red-800">
                分析失敗
              </p>
              <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="w-full rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              重新嘗試
            </button>
          </div>
        )}

        {/* Result state */}
        {pageState === "result" && result && (
          <AnalysisResult result={result} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}
