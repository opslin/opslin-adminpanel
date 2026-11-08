"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { RiCheckboxCircleLine, RiCoinsFill, RiGroupLine, RiRocketLine } from "@remixicon/react";

import { StatusBadge } from "@/components/admin/status-badge";
import { RefreshButton } from "@/components/admin/refresh-button";
import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { LiveDeploys, RecentDeploys, RecentSignups } from "@/components/overview/activity";
import { DeployChart } from "@/components/overview/deploy-chart";
import { FunnelCard } from "@/components/overview/funnel-card";
import { FailuresCard, FleetCard, PlatformHealthCard } from "@/components/overview/health-cards";
import { LiveStrip } from "@/components/overview/live-strip";
import {
  formatMoney,
  formatNumber,
  percentDelta,
  type AgentMetricsResponse,
  type ErrorsResponse,
  type FunnelResponse,
  type OverviewResponse,
  type RunningDeploymentsResponse,
  type SystemHealthResponse,
} from "@/components/overview/shared";
import { api } from "@/lib/api";

const DAY = 24 * 60 * 60 * 1000;

function startOfMonth(offsetMonths: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
}

function deltaPill(delta: number | null): Pick<Stat, "delta" | "deltaColor"> {
  if (delta === null) return { delta: "—", deltaColor: "neutral" };
  return { delta: `${Math.abs(delta)}%`, deltaColor: delta >= 0 ? "lime" : "rose" };
}

function sumLastDays(data: OverviewResponse["deploys30d"], days: number, offsetFromEnd = 0) {
  return data
    .slice(Math.max(0, data.length - offsetFromEnd - days), Math.max(0, data.length - offsetFromEnd))
    .reduce((sum, point) => sum + point.total, 0);
}

function LoadingOverview() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-24 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[210px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => api.get<OverviewResponse>("/admin"),
    refetchInterval: 30_000,
  });
  const running = useQuery({
    queryKey: ["admin", "overview", "running"],
    queryFn: () => api.get<RunningDeploymentsResponse>("/admin/deployments?status=running&pageSize=6"),
    refetchInterval: 10_000,
  });
  const system = useQuery({
    queryKey: ["admin", "overview", "system"],
    queryFn: () => api.get<SystemHealthResponse>("/admin/system-health"),
    refetchInterval: 30_000,
  });
  const agents = useQuery({
    queryKey: ["admin", "overview", "agents"],
    queryFn: () => api.get<AgentMetricsResponse>("/admin/agents/metrics"),
    refetchInterval: 30_000,
  });
  const errors = useQuery({
    queryKey: ["admin", "overview", "errors"],
    queryFn: () => api.get<ErrorsResponse>("/admin/errors"),
    refetchInterval: 60_000,
  });

  const bounds = useMemo(() => {
    const now = new Date().getTime();
    return {
      now: new Date(now).toISOString(),
      d30: new Date(now - 30 * DAY).toISOString(),
      thisFrom: startOfMonth(0).toISOString(),
      lastFrom: startOfMonth(-1).toISOString(),
    };
  }, []);

  const funnel30 = useQuery({
    queryKey: ["admin", "overview", "funnel", "30d"],
    queryFn: () =>
      api.get<FunnelResponse>(
        `/admin/onboarding/funnel?from=${encodeURIComponent(bounds.d30)}&to=${encodeURIComponent(bounds.now)}`,
      ),
  });
  const funnelThisMonth = useQuery({
    queryKey: ["admin", "overview", "funnel", "this-month"],
    queryFn: () =>
      api.get<FunnelResponse>(
        `/admin/onboarding/funnel?from=${encodeURIComponent(bounds.thisFrom)}&to=${encodeURIComponent(bounds.now)}`,
      ),
  });
  const funnelLastMonth = useQuery({
    queryKey: ["admin", "overview", "funnel", "last-month"],
    queryFn: () =>
      api.get<FunnelResponse>(
        `/admin/onboarding/funnel?from=${encodeURIComponent(bounds.lastFrom)}&to=${encodeURIComponent(bounds.thisFrom)}`,
      ),
  });

  const data = overview.data;
  const refreshAll = () => {
    void overview.refetch();
    void running.refetch();
    void system.refetch();
    void agents.refetch();
    void errors.refetch();
    void funnel30.refetch();
  };

  if (overview.isLoading || !data) {
    return (
      <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <LoadingOverview />
      </div>
    );
  }

  const newThisMonth = funnelThisMonth.data?.steps?.[0]?.count ?? null;
  const newLastMonth = funnelLastMonth.data?.steps?.[0]?.count ?? null;
  const signupDelta = percentDelta(newThisMonth, newLastMonth);
  const deploysThisWeek = sumLastDays(data.deploys30d, 7);
  const deploysLastWeek = sumLastDays(data.deploys30d, 7, 7);
  const deployWeekDelta = percentDelta(deploysThisWeek, deploysLastWeek);
  const successDelta = data.deploySuccessRate7d - data.deploySuccessRate24h;

  const allHealthy =
    data.systemHealth.api === "ok" && data.systemHealth.db === "ok" && data.systemHealth.redis === "ok";

  const kpis: Stat[] = [
    {
      icon: RiCoinsFill,
      label: "Monthly revenue",
      value: formatMoney(data.revenue.mrr, data.revenue.currency),
      delta: "—",
      deltaColor: "neutral",
      tone: "orange",
      caption: `${formatNumber(data.totals.activeSubscriptions)} active subscriptions`,
      hint: "Monthly recurring revenue: the sum of every active or trialing plan price.",
    },
    {
      icon: RiGroupLine,
      label: "Total users",
      value: formatNumber(data.totals.users),
      ...deltaPill(signupDelta),
      tone: "blue",
      caption: newThisMonth !== null ? `${formatNumber(newThisMonth)} joined this month` : "vs last month",
      hint: "All registered users. The change compares this month's signups with last month's.",
    },
    {
      icon: RiRocketLine,
      label: "Deploys this week",
      value: formatNumber(deploysThisWeek),
      ...deltaPill(deployWeekDelta),
      tone: "sky",
      caption: `${formatNumber(data.totals.apps)} ${data.totals.apps === 1 ? "app" : "apps"} live`,
      hint: "Deploys in the last 7 days compared with the 7 days before.",
    },
    {
      icon: RiCheckboxCircleLine,
      label: "Deploy success, 7 days",
      value: `${data.deploySuccessRate7d}%`,
      delta: successDelta === 0 ? "—" : `${Math.abs(Math.round(successDelta * 10) / 10)}%`,
      deltaColor: successDelta === 0 ? "neutral" : successDelta >= 0 ? "lime" : "rose",
      tone: "emerald",
      caption: `${data.deploySuccessRate24h}% in the last 24h`,
      hint: "Share of deploys that succeeded. The change shows how the last 24 hours compare with the 7-day rate.",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-caption-1-semibold uppercase tracking-[0.14em] text-text-tertiary">Super Admin</p>
          <h1 className="mt-1 text-title-1-medium text-text-primary">Overview</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={allHealthy ? "ok" : "error"} label={allHealthy ? "All systems healthy" : "Degraded"} />
          <RefreshButton onClick={refreshAll} isRefreshing={overview.isFetching} />
        </div>
      </div>

      <LiveStrip data={data} running={running.data} system={system.data} agents={agents.data} />

      <StatCards variant="footer" stats={kpis} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <DeployChart data={data.deploys30d} />
        <FunnelCard funnel={funnel30.data} isLoading={funnel30.isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <FailuresCard errors={errors.data} isLoading={errors.isLoading} />
        <FleetCard agents={agents.data} isLoading={agents.isLoading} />
        <PlatformHealthCard system={system.data} fallback={data.systemHealth} isLoading={system.isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <LiveDeploys running={running.data} />
        <RecentDeploys deployments={data.recentDeployments} />
        <RecentSignups signups={data.recentSignups} />
      </div>

      <p className="text-caption-1-regular text-text-tertiary">
        Live numbers refresh every 10 to 60 seconds. Signup steps come from the onboarding funnel.
      </p>
    </div>
  );
}
