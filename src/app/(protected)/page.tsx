"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AppWindow,
  Building2,
  Clock3,
  Gauge,
  Server,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";

import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { ChartLoading, useRecharts } from "@/components/charts/use-recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

type OverviewResponse = {
  totals: {
    users: number;
    servers: number;
    apps: number;
    deployments24h: number;
    activeSubscriptions: number;
  };
  performance: {
    successRate: number;
    avgDeployTimeMs: number;
  };
  deploys30d: Array<{
    date: string;
    total: number;
    succeeded: number;
    failed: number;
  }>;
  newUsersToday: number;
  activeUsers7d: number;
  totalOrgs: number;
  connectedAgents: number;
  disconnectedAgents: number;
  deploySuccessRate24h: number;
  deploySuccessRate7d: number;
  queueWaitAvg: number;
  queueWaitP95: number;
  workerCountExpected: number;
  systemHealth: {
    api: "ok" | "error";
    db: "ok" | "error";
    redis: "ok" | "error";
  };
  recentDeployments: Array<{
    id: string;
    appName: string | null;
    status: string;
    startedAt: string;
    finishedAt: string | null;
  }>;
  recentSignups: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
  }>;
};

function formatMs(ms: number) {
  if (ms >= 60_000) {
    return `${Math.round(ms / 60_000)}m`;
  }
  if (ms >= 1000) {
    return `${Math.round(ms / 100) / 10}s`;
  }
  return `${ms}ms`;
}

function systemStatus(health?: OverviewResponse["systemHealth"]): BadgeStatus {
  if (!health) {
    return "offline";
  }
  return health.api === "ok" && health.db === "ok" && health.redis === "ok" ? "ok" : "error";
}

function DeployVolumeChart({ data }: { data: OverviewResponse["deploys30d"] }) {
  const recharts = useRecharts();
  const chartData = data.slice(-7).map((point) => ({
    ...point,
    label: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  if (!recharts) {
    return <ChartLoading className="h-72" />;
  }

  const { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = recharts;

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} opacity={0.25} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--foreground)",
            }}
          />
          <Bar dataKey="succeeded" stackId="deploys" fill="var(--chart-5)" radius={[0, 0, 3, 3]} />
          <Bar dataKey="failed" stackId="deploys" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecentDeployments({ deployments }: { deployments: OverviewResponse["recentDeployments"] }) {
  return (
    <Card className="rounded-lg py-0">
      <CardHeader className="border-b border-border/80 px-4 py-3">
        <CardTitle className="text-sm">Recent Deploys</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.slice(0, 10).map((deployment) => (
              <TableRow key={deployment.id}>
                <TableCell className="font-medium">{deployment.appName ?? "Unknown app"}</TableCell>
                <TableCell>
                  <StatusBadge
                    status={deployment.status === "SUCCEEDED" ? "ok" : deployment.status === "FAILED" ? "error" : "info"}
                    label={deployment.status.toLowerCase()}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">{formatRelativeTime(deployment.startedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Link href="/deployments" className="block border-t border-border/80 px-4 py-3 text-sm text-primary">
          View all deploys
        </Link>
      </CardContent>
    </Card>
  );
}

function RecentSignups({ signups }: { signups: OverviewResponse["recentSignups"] }) {
  return (
    <Card className="rounded-lg py-0">
      <CardHeader className="border-b border-border/80 px-4 py-3">
        <CardTitle className="text-sm">Recent Signups</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signups.slice(0, 10).map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell className="text-muted-foreground">{formatRelativeTime(user.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Link href="/users" className="block border-t border-border/80 px-4 py-3 text-sm text-primary">
          View all users
        </Link>
      </CardContent>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 11 }).map((_, index) => (
        <div key={index} className="h-36 animate-pulse rounded-lg border border-border/80 bg-card" />
      ))}
    </div>
  );
}

export default function AdminOverviewPage() {
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => api.get<OverviewResponse>("/admin"),
  });

  const { refetch } = overview;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refetch();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [refetch]);

  const data = overview.data;
  const healthStatus = systemStatus(data?.systemHealth);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">Super Admin</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Overview cockpit</h1>
      </div>

      {overview.isLoading || !data ? (
        <LoadingGrid />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Users" value={data.totals.users} icon={Users} status="info" />
            <StatCard label="New Today" value={data.newUsersToday} icon={UserPlus} trend={{ value: data.newUsersToday, direction: "up" }} status="ok" />
            <StatCard label="Active 7d" value={data.activeUsers7d} icon={Activity} status="info" />
            <StatCard label="Organizations" value={data.totalOrgs} icon={Building2} status="info" />
            <StatCard label="Connected Agents" value={data.connectedAgents} icon={Server} status="ok" />
            <StatCard label="Disconnected Agents" value={data.disconnectedAgents} icon={Server} status={data.disconnectedAgents > 0 ? "error" : "ok"} />
            <StatCard label="Apps" value={data.totals.apps} icon={AppWindow} status="info" />
            <StatCard label="Deploy Rate 24h" value={`${data.deploySuccessRate24h}%`} icon={TrendingUp} status={data.deploySuccessRate24h >= 90 ? "ok" : "warning"} />
            <StatCard label="Queue Wait Avg" value={formatMs(data.queueWaitAvg)} icon={Clock3} status={data.queueWaitAvg > 10_000 ? "warning" : "ok"} description={`p95 ${formatMs(data.queueWaitP95)}`} />
            <StatCard label="Workers" value={data.workerCountExpected} icon={Workflow} status="info" description="Expected capacity (live count not exposed by the API)" />
            <StatCard label="System Health" value={healthStatus === "ok" ? "OK" : "Check"} icon={ShieldCheck} status={healthStatus === "ok" ? "ok" : "error"} description={`${data.systemHealth.api}/${data.systemHealth.db}/${data.systemHealth.redis}`} />
            <StatCard label="Deploy Rate 7d" value={`${data.deploySuccessRate7d}%`} icon={Gauge} status={data.deploySuccessRate7d >= 90 ? "ok" : "warning"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
            <Card className="rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/80">
                <CardTitle>Deploy Volume</CardTitle>
                <StatusBadge status={healthStatus} label={healthStatus === "ok" ? "Healthy" : "Degraded"} />
              </CardHeader>
              <CardContent>
                <DeployVolumeChart data={data.deploys30d} />
              </CardContent>
            </Card>
            <div className="grid gap-6">
              <RecentDeployments deployments={data.recentDeployments} />
              <RecentSignups signups={data.recentSignups} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
