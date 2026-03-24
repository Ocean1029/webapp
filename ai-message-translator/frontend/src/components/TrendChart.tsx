"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { AnalysisResponse } from "@/types";

/** A single data point for the chart. */
interface DataPoint {
  date: string;
  score: number;
  toneMode: string;
}

/** Determine the dot color based on score value. */
function dotColor(score: number): string {
  if (score >= 7) return "#22c55e"; // green-500
  if (score >= 4) return "#eab308"; // yellow-500
  return "#ef4444"; // red-500
}

interface TrendChartProps {
  contactName: string;
  analyses: AnalysisResponse[];
}

/**
 * Render a line chart showing interest score changes over time for a contact.
 * Color-coded: green (warming >= 7), yellow (stable 4-6), red (cooling <= 3).
 */
export default function TrendChart({
  contactName,
  analyses,
}: TrendChartProps) {
  if (!analyses || analyses.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500">
          選擇一個聯絡人以查看興趣趨勢圖
        </p>
      </div>
    );
  }

  // Sort analyses by date ascending and map to chart data
  const data: DataPoint[] = [...analyses]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .map((a) => ({
      date: new Date(a.createdAt).toLocaleDateString("zh-TW", {
        month: "short",
        day: "numeric",
      }),
      score: a.interestScore,
      toneMode: a.toneMode,
    }));

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-4">
        {contactName} — 興趣指數趨勢
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 10]}
            ticks={[0, 2, 4, 6, 8, 10]}
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            tickLine={false}
            width={30}
          />
          <Tooltip
            formatter={(value) => [`${value}/10`, "興趣指數"]}
            labelStyle={{ color: "#374151", fontWeight: 600 }}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "13px",
            }}
          />
          {/* Reference lines for score zones */}
          <ReferenceLine
            y={7}
            stroke="#22c55e"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            y={4}
            stroke="#eab308"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props;
              const color = dotColor(payload.score);
              return (
                <circle
                  key={`dot-${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={color}
                  stroke="white"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
          升溫 (7-10)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-500" />
          穩定 (4-6)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
          降溫 (1-3)
        </span>
      </div>
    </div>
  );
}
