"use client";

import { useMemo, useState } from "react";

import { Chip } from "@/components/base/badges/chip";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";
import { ChartLoading, useRecharts } from "@/components/charts/use-recharts";
import { formatNumber, Panel, type OverviewResponse } from "./shared";

const RANGES = [
  { id: 7, label: "7 days" },
  { id: 14, label: "14 days" },
  { id: 30, label: "30 days" },
] as const;

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2.5 rounded-full ${color}`} aria-hidden />
      <span className="text-body-regular text-text-secondary">{label}</span>
      <span className="text-body-medium tabular-nums text-text-primary">{value}</span>
    </div>
  );
}

export function DeployChart({ data }: { data: OverviewResponse["deploys30d"] }) {
  const [days, setDays] = useState<(typeof RANGES)[number]["id"]>(14);
  const recharts = useRecharts();

  const series = useMemo(
    () =>
      data.slice(-days).map((point) => ({
        ...point,
        other: Math.max(0, point.total - point.succeeded - point.failed),
        label: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      })),
    [data, days],
  );

  const total = series.reduce((sum, point) => sum + point.total, 0);
  const succeeded = series.reduce((sum, point) => sum + point.succeeded, 0);
  const failed = series.reduce((sum, point) => sum + point.failed, 0);
  const finished = succeeded + failed;
  const rate = finished > 0 ? Math.round((succeeded / finished) * 1000) / 10 : null;

  return (
    <Panel
      title="Deploys"
      description={`${formatNumber(total)} in the last ${days} days`}
      action={
        <PillTabList>
          {RANGES.map((range) => (
            <PillTab
              key={range.id}
              variant="gray"
              isSelected={days === range.id}
              onSelect={() => setDays(range.id)}
            >
              {range.label}
            </PillTab>
          ))}
        </PillTabList>
      }
      bodyClassName="px-5 pb-5"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-3">
        <Legend color="bg-chart-1" label="Succeeded" value={formatNumber(succeeded)} />
        <Legend color="bg-chart-3" label="Failed" value={formatNumber(failed)} />
        <Chip variant="subtle" color={rate === null ? "gray" : rate >= 90 ? "lime" : rate >= 70 ? "yellow" : "rose"}>
          {rate === null ? "No finished deploys" : `${rate}% success`}
        </Chip>
      </div>
      {total === 0 ? (
        <div className="flex h-60 items-center justify-center rounded-2xl bg-background-secondary-default text-body-regular text-text-tertiary">
          No deploys in this period
        </div>
      ) : !recharts ? (
        <ChartLoading className="h-60" />
      ) : (
        <ChartBody recharts={recharts} series={series} />
      )}
    </Panel>
  );
}

function ChartBody({
  recharts,
  series,
}: {
  recharts: NonNullable<ReturnType<typeof useRecharts>>;
  series: Array<{ label: string; succeeded: number; failed: number; other: number }>;
}) {
  const { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = recharts;
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke="var(--color-separator-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-text-tertiary)", fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-text-tertiary)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--color-background-tertiary-default)", opacity: 0.6 }}
            contentStyle={{
              background: "var(--color-background-primary-default)",
              border: "1px solid var(--color-border-button-default)",
              borderRadius: 12,
              color: "var(--color-text-primary)",
              fontSize: 13,
            }}
          />
          <Bar dataKey="succeeded" name="Succeeded" stackId="d" fill="var(--color-chart-1)" radius={[0, 0, 4, 4]} />
          <Bar dataKey="other" name="Other" stackId="d" fill="var(--color-chart-4)" />
          <Bar dataKey="failed" name="Failed" stackId="d" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
