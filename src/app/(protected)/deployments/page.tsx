"use client";

import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Clock3, Gauge, Rocket, Timer, TrendingUp } from "lucide-react";

import { DataTable } from "@/components/admin/data-table";
import { DateRangePicker, type AdminDateRange } from "@/components/admin/date-range-picker";
import { DetailDrawer } from "@/components/admin/detail-drawer";
import { EmptyState } from "@/components/admin/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

const LazyEnhancedLogViewer = lazy(() =>
  import("@/components/logs/enhanced-log-viewer").then((module) => ({
    default: module.EnhancedLogViewer,
  }))
);

type DeploymentStatusFilter = "all" | "success" | "failed" | "running";

type AdminDeployment = {
  id: string;
  appId: string;
  appName: string;
  serverId: string;
  serverName: string;
  orgId: string | null;
  orgName: string | null;
  sha: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorClass: string | null;
  triggeredBy?: string | null;
};

type AdminDeploymentsResponse = {
  widgets: {
    deploymentsToday: number;
    successRate: number;
    failureRate: number;
    avgDeployTimeMs: number;
    p95DeployTimeMs: number;
    topFailureReason: string | null;
  };
  deployments: AdminDeployment[];
  pagination: { page: number; pageSize: number; total: number };
};

function defaultRange(): AdminDateRange {
  const to = new Date();
  const from = new Date(to);
  from.setHours(to.getHours() - 24);
  return { preset: "24h", from, to };
}

function buildQuery(path: string, params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function formatDuration(ms: number | null) {
  if (ms === null) {
    return "In progress";
  }
  if (ms >= 60_000) {
    return `${Math.round(ms / 60_000)}m`;
  }
  if (ms >= 1000) {
    return `${Math.round(ms / 100) / 10}s`;
  }
  return `${ms}ms`;
}

function deployStatus(status: string): BadgeStatus {
  if (status === "SUCCEEDED" || status === "ROLLED_BACK") {
    return "ok";
  }
  if (status === "FAILED" || status === "ABORTED") {
    return "error";
  }
  if (status === "PENDING" || status === "RUNNING") {
    return "warning";
  }
  return "info";
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function DeploymentDrawer({
  deployment,
  logs,
  onLoadLogs,
}: {
  deployment?: AdminDeployment;
  logs: UseQueryResult<{ logs: string }, Error>;
  onLoadLogs: () => void;
}) {
  if (!deployment) {
    return <EmptyState icon={Rocket} title="Select a deployment" description="Deployment details appear here." />;
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="dashboard-section-label">Deployment</p>
            <p className="mt-2 font-mono text-sm">{deployment.id}</p>
          </div>
          <div>
            <p className="dashboard-section-label">Status</p>
            <div className="mt-2">
              <StatusBadge status={deployStatus(deployment.status)} label={deployment.status.toLowerCase()} />
            </div>
          </div>
          <div>
            <p className="dashboard-section-label">App</p>
            <p className="mt-2 font-medium">{deployment.appName}</p>
            <p className="text-xs text-muted-foreground">{deployment.orgName ?? "No org"}</p>
          </div>
          <div>
            <p className="dashboard-section-label">Duration</p>
            <p className="mt-2 font-medium">{formatDuration(deployment.durationMs)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onLoadLogs} disabled={logs.isFetching}>
          {logs.isFetching ? "Loading logs..." : "View Logs"}
        </Button>
        <p className="text-sm text-muted-foreground">Logs are lazy-loaded on request.</p>
      </div>

      {logs.isError ? (
        <EmptyState icon={AlertTriangle} title="Logs unavailable" description="The deployment log endpoint did not return logs for this record." />
      ) : logs.data ? (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading log viewer…</p>}>
          <LazyEnhancedLogViewer
            lines={logs.data.logs}
            title="Deployment log"
            fileName={`opslin-${deployment.appName}-${shortId(deployment.id)}.log`}
            height={384}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default function AdminDeploymentsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [status, setStatus] = useState<DeploymentStatusFilter>("all");
  const [range, setRange] = useState<AdminDateRange>(() => defaultRange());
  const [selectedDeployment, setSelectedDeployment] = useState<AdminDeployment | null>(null);

  const deployments = useQuery({
    queryKey: ["admin", "deployments", { page, pageSize, status, from: range.from.toISOString(), to: range.to.toISOString() }],
    queryFn: () => api.get<AdminDeploymentsResponse>(buildQuery("/admin/deployments", {
      page,
      pageSize,
      status,
      dateFrom: range.from.toISOString(),
      dateTo: range.to.toISOString(),
    })),
  });

  const logs = useQuery({
    queryKey: ["admin", "deployment-logs", selectedDeployment?.id],
    queryFn: () => api.get<{ logs: string }>(`/admin/deployments/${selectedDeployment?.id}/logs`),
    enabled: false,
    retry: false,
  });

  const columns = useMemo<ColumnDef<AdminDeployment>[]>(() => [
    {
      header: "ID",
      accessorKey: "id",
      cell: ({ row }) => <span className="font-mono text-xs">{shortId(row.original.id)}</span>,
    },
    { header: "App", accessorKey: "appName" },
    {
      header: "User/Org",
      accessorKey: "orgName",
      cell: ({ row }) => row.original.orgName ?? "No org",
    },
    { header: "Server", accessorKey: "serverName" },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={deployStatus(row.original.status)} label={row.original.status.toLowerCase()} />,
    },
    {
      header: "Duration",
      accessorKey: "durationMs",
      cell: ({ row }) => formatDuration(row.original.durationMs),
    },
    {
      header: "Trigger",
      accessorKey: "triggeredBy",
      cell: ({ row }) => row.original.triggeredBy ?? "Manual",
    },
    {
      header: "Error Class",
      accessorKey: "errorClass",
      cell: ({ row }) => row.original.errorClass ?? <span className="text-muted-foreground">None</span>,
    },
    {
      header: "Started",
      accessorKey: "startedAt",
      cell: ({ row }) => formatRelativeTime(row.original.startedAt),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedDeployment(row.original);
          }}
        >
          Open
        </Button>
      ),
    },
  ], []);

  const widgets = deployments.data?.widgets;

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">P0 Deployments</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Deployment operations</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Deploys Today" value={widgets?.deploymentsToday ?? 0} icon={Rocket} status="info" />
        <StatCard label="Success Rate" value={`${widgets?.successRate ?? 0}%`} icon={TrendingUp} status={(widgets?.successRate ?? 0) >= 90 ? "ok" : "warning"} />
        <StatCard label="Failure Rate" value={`${widgets?.failureRate ?? 0}%`} icon={AlertTriangle} status={(widgets?.failureRate ?? 0) > 5 ? "error" : "ok"} />
        <StatCard label="Avg Time" value={formatDuration(widgets?.avgDeployTimeMs ?? 0)} icon={Clock3} status="info" />
        <StatCard label="p95 Time" value={formatDuration(widgets?.p95DeployTimeMs ?? 0)} icon={Timer} status="info" />
        <StatCard label="Top Failure" value={widgets?.topFailureReason ?? "None"} icon={Gauge} status={widgets?.topFailureReason ? "warning" : "ok"} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <DateRangePicker value={range} onChange={(nextRange) => { setPage(1); setRange(nextRange); }} />
        <Select value={status} onValueChange={(value) => { setPage(1); setStatus(value as DeploymentStatusFilter); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={deployments.data?.deployments ?? []}
        pagination={deployments.data?.pagination ?? { page, pageSize, total: 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        isLoading={deployments.isLoading}
        emptyMessage="No deployments match this window."
        onRowClick={(deployment) => setSelectedDeployment(deployment)}
      />

      <DetailDrawer
        open={Boolean(selectedDeployment)}
        onClose={() => setSelectedDeployment(null)}
        title={selectedDeployment ? `Deploy ${shortId(selectedDeployment.id)}` : "Deployment details"}
        subtitle={selectedDeployment?.appName}
        width="lg"
      >
        <DeploymentDrawer
          deployment={selectedDeployment ?? undefined}
          logs={logs}
          onLoadLogs={() => void logs.refetch()}
        />
      </DetailDrawer>
    </div>
  );
}
