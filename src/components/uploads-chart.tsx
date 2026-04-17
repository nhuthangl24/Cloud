"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function UploadsChart({
  data,
}: {
  data: Array<{ label: string; count: number }>;
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
          <XAxis dataKey="label" stroke="currentColor" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} stroke="currentColor" tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(34,211,238,0.08)" }}
            contentStyle={{
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,0.2)",
              background: "rgba(15,23,42,0.92)",
            }}
          />
          <Bar dataKey="count" fill="rgb(34,211,238)" radius={[10, 10, 4, 4]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
