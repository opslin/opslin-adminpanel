"use client";

import type { ComponentType } from "react";
import { Activity, IndianRupee, Rocket, Server, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminAnalyticsResponse } from "@/lib/api";
import { ChartLoading, useRecharts } from "@/components/charts/use-recharts";

function formatDuration(ms: number) {
  if (ms <= 0) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsCharts({ data }: { data: AdminAnalyticsResponse }) {
  const recharts = useRecharts();

  if (!recharts) {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <ChartLoading className="h-80" />
        <ChartLoading className="h-80" />
      </div>
    );
  }

  const {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
  } = recharts;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
      <Card>
        <CardHeader>
          <CardTitle>Deploy volume</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.deploys30d}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="succeeded" stackId="deploys" fill="#16a34a" name="Succeeded" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" stackId="deploys" fill="#dc2626" name="Failed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operator engagement</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={[
                { label: "DAU", users: data.engagement.dau },
                { label: "WAU", users: data.engagement.wau },
                { label: "Users", users: data.totals.users },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="users" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalyticsDashboard({ data }: { data: AdminAnalyticsResponse }) {
  return (
    <div className="space-y-6" data-testid="admin-analytics-dashboard">
      <div>
        <p className="text-sm text-muted-foreground">Investor dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight">Admin analytics</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Users"
          value={formatNumber(data.totals.users)}
          detail={`${data.engagement.dau} DAU / ${data.engagement.wau} WAU`}
          icon={Users}
        />
        <StatCard
          label="Infrastructure"
          value={`${formatNumber(data.totals.servers)} servers`}
          detail={`${formatNumber(data.totals.apps)} apps managed`}
          icon={Server}
        />
        <StatCard
          label="Deploys today"
          value={formatNumber(data.totals.deployments24h)}
          detail={`${data.performance.successRate}% success, ${formatDuration(data.performance.avgDeployTimeMs)} avg`}
          icon={Rocket}
        />
        <StatCard
          label="MRR"
          value={formatCurrency(data.revenue.mrr, data.revenue.currency)}
          detail={`${formatNumber(data.totals.activeSubscriptions)} active subscriptions`}
          icon={IndianRupee}
        />
      </div>

      <AnalyticsCharts data={data} />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-5 text-sm text-muted-foreground">
          <Activity className="size-4" />
          <span>Generated {new Date(data.generatedAt).toLocaleString()}</span>
        </CardContent>
      </Card>
    </div>
  );
}
