"use client";

import type { ToneMode } from "@/types";

interface ToneModeToggleProps {
  value: ToneMode;
  onChange: (mode: ToneMode) => void;
}

/**
 * Toggle between counselor and bestfriend analysis modes.
 */
export default function ToneModeToggle({
  value,
  onChange,
}: ToneModeToggleProps) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-1">
      <button
        type="button"
        onClick={() => onChange("counselor")}
        className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          value === "counselor"
            ? "bg-white text-indigo-700 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        諮詢師模式
      </button>
      <button
        type="button"
        onClick={() => onChange("bestfriend")}
        className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          value === "bestfriend"
            ? "bg-white text-indigo-700 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        好友模式
      </button>
    </div>
  );
}
