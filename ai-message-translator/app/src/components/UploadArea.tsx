"use client";

import { useState, useCallback, useRef } from "react";
import type { ToneMode } from "@/types";
import ToneModeToggle from "./ToneModeToggle";

type InputTab = "screenshot" | "text";

interface UploadAreaProps {
  onSubmitScreenshot: (
    file: File,
    toneMode: ToneMode,
    contactName: string
  ) => void;
  onSubmitText: (
    text: string,
    toneMode: ToneMode,
    contactName: string
  ) => void;
  isLoading: boolean;
}

/**
 * Upload area with drag-and-drop for screenshots and a text input tab.
 */
export default function UploadArea({
  onSubmitScreenshot,
  onSubmitText,
  isLoading,
}: UploadAreaProps) {
  const [activeTab, setActiveTab] = useState<InputTab>("screenshot");
  const [toneMode, setToneMode] = useState<ToneMode>("counselor");
  const [contactName, setContactName] = useState("");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSelectedFile(file);
      }
    },
    []
  );

  const handleSubmit = useCallback(() => {
    if (!contactName.trim()) return;

    if (activeTab === "screenshot" && selectedFile) {
      onSubmitScreenshot(selectedFile, toneMode, contactName.trim());
    } else if (activeTab === "text" && textInput.trim()) {
      onSubmitText(textInput.trim(), toneMode, contactName.trim());
    }
  }, [
    activeTab,
    selectedFile,
    textInput,
    toneMode,
    contactName,
    onSubmitScreenshot,
    onSubmitText,
  ]);

  const canSubmit =
    contactName.trim() &&
    !isLoading &&
    ((activeTab === "screenshot" && selectedFile) ||
      (activeTab === "text" && textInput.trim()));

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Contact name input */}
      <div>
        <label
          htmlFor="contact-name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          對方名稱
        </label>
        <input
          id="contact-name"
          type="text"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="輸入對方的名字..."
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors"
        />
      </div>

      {/* Tone mode toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          分析模式
        </label>
        <ToneModeToggle value={toneMode} onChange={setToneMode} />
      </div>

      {/* Input tab switcher */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("screenshot")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "screenshot"
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          上傳截圖
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("text")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "text"
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          貼上文字
        </button>
      </div>

      {/* Screenshot upload zone */}
      {activeTab === "screenshot" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
            isDragOver
              ? "border-indigo-400 bg-indigo-50"
              : selectedFile
                ? "border-green-400 bg-green-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {selectedFile ? (
            <div className="text-center">
              <svg
                className="mx-auto h-10 w-10 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="mt-2 text-sm font-medium text-green-700">
                {selectedFile.name}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                點擊此處更換圖片
              </p>
            </div>
          ) : (
            <div className="text-center">
              <svg
                className="mx-auto h-10 w-10 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                拖放截圖到此處，或點擊選擇檔案
              </p>
              <p className="mt-1 text-xs text-gray-400">
                支援 PNG、JPG、WEBP
              </p>
            </div>
          )}
        </div>
      )}

      {/* Text input area */}
      {activeTab === "text" && (
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="將對話內容貼在這裡..."
          rows={8}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors resize-y"
        />
      )}

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            分析中...
          </span>
        ) : (
          "開始分析"
        )}
      </button>
    </div>
  );
}
