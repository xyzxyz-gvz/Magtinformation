"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { month: string; count: number };

const MONTH_LABEL: Record<string, string> = {
  "01": "jan",
  "02": "feb",
  "03": "mar",
  "04": "apr",
  "05": "maj",
  "06": "jun",
  "07": "jul",
  "08": "aug",
  "09": "sep",
  "10": "okt",
  "11": "nov",
  "12": "dec",
};

function formatMonth(m: string) {
  // m = "YYYY-MM"
  const [y, mo] = m.split("-");
  return `${MONTH_LABEL[mo] ?? mo} '${y.slice(2)}`;
}

export function VotesPerMonthChart({ data }: { data: Point[] }) {
  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="vpmGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111418" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#111418" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            interval="preserveStartEnd"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickMargin={6}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "#111418", strokeWidth: 1, strokeOpacity: 0.2 }}
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              fontSize: 12,
              padding: "6px 8px",
            }}
            labelFormatter={(label) => formatMonth(String(label))}
            formatter={(value) => [`${value} afstemninger`, ""] as [string, string]}
            separator=""
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#111418"
            strokeWidth={1.5}
            fill="url(#vpmGrad)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
