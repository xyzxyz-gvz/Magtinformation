"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type AttendancePoint = {
  /** YYYY-Q (e.g. "2024-Q3") or YYYY-MM */
  bucket: string;
  /** label for the x-axis tick */
  label: string;
  /** attendance % (0-100) for that bucket */
  pct: number;
  /** total votes in the bucket — used in tooltip */
  total: number;
};

export function MemberAttendanceChart({
  data,
  averagePct,
}: {
  data: AttendancePoint[];
  averagePct: number | null;
}) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickMargin={6}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          {averagePct != null && (
            <ReferenceLine
              y={averagePct}
              stroke="#9ca3af"
              strokeDasharray="4 4"
              label={{
                value: `Snit ${averagePct}%`,
                position: "right",
                fill: "#6b7280",
                fontSize: 10,
              }}
            />
          )}
          <Tooltip
            cursor={{
              stroke: "#111418",
              strokeWidth: 1,
              strokeOpacity: 0.2,
            }}
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              fontSize: 12,
              padding: "6px 8px",
            }}
            formatter={(value, _name, ctx) => {
              const total = (ctx as { payload?: AttendancePoint }).payload?.total ?? 0;
              return [`${value}% (${total} afstemninger)`, "Fremmøde"] as [string, string];
            }}
          />
          <Line
            type="monotone"
            dataKey="pct"
            stroke="#111418"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "#111418" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
