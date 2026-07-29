"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { FlaskConical, Gauge } from "lucide-react";

import { DataTable } from "@/components/admin/data-table";
import { DetailDrawer } from "@/components/admin/detail-drawer";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

type DeployTestFilter = "all" | "failed_health" | "high_latency" | "high_error_rate" | "container_restarted";

type HealthReport = {
  id: string;
  deploymentId: string;
  appId: string;
  serverId: string;
  organizationId: string | null;
  mode: string;
  status: string;
  healthPassed: boolean;
  healthPath: string | null;
  healthStatusCode: number | null;
  healthResponseMs: number | null;
  smokePassed: boolean;
  smokeStatusCode: number | null;
  smokeResponseMs: number | null;
  virtualUsers: number;
  durationSeconds: number;
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  p50Ms: number | null;
  p95Ms: number | null;
  errorRate: number | null;
  containerRestarted: boolean;
  autoRolledBack: boolean;
  report: unknown;
  createdAt: string;
  app: { id: string; name: string; domain: string | null } | null;
  server: { id: string; name: string; ip: string | null; status: string } | null;
  deployment: { id: string; sha: string; status: string; startedAt: string; finishedAt: string | null } | null;
};

type HealthReportsResponse = {
  reports: HealthReport[];
  total: number;
};

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

function shortId(value: string) {
  return value.slice(0, 8);
}

function successRate(report: HealthReport) {
  if (!report.totalRequests) {
    return report.healthPassed ? 100 : 0;
  }
  return Math.round((report.successRequests / report.totalRequests) * 1000) / 10;
}

function displayErrorRate(report: HealthReport) {
  const raw = report.errorRate ?? 0;
  const percent = raw <= 1 ? raw * 100 : raw;
  return Math.round(percent * 10) / 10;
}

function matchesFilter(report: HealthReport, filter: DeployTestFilter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "failed_health") {
    return !report.healthPassed || report.status.toLowerCase() === "failed";
  }
  if (filter === "high_latency") {
    return (report.p95Ms ?? report.healthResponseMs ?? 0) > 2000;
  }
  if (filter === "high_error_rate") {
    return displayErrorRate(report) > 5;
  }
  return report.containerRestarted;
}

function ReportDetail({ report }: { report: HealthReport | null }) {
  if (!report) {
    return <EmptyState icon={FlaskConical} title="Select a report" description="Health report metrics appear here." />;
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="dashboard-section-label">Health Path</p>
            <p className="mt-2 font-mono text-sm">{report.healthPath ?? "/health"}</p>
          </div>
          <div>
            <p className="dashboard-section-label">Health Status</p>
            <p className="mt-2 font-medium">
              {report.healthStatusCode ?? "N/A"} {report.healthResponseMs ? `(${report.healthResponseMs}ms)` : ""}
            </p>
          </div>
          <div>
            <p className="dashboard-section-label">Smoke Status</p>
            <p className="mt-2 font-medium">
              {report.smokeStatusCode ?? "N/A"} {report.smokeResponseMs ? `(${report.smokeResponseMs}ms)` : ""}
            </p>
          </div>
          <div>
            <p className="dashboard-section-label">Container</p>
            <div className="mt-2">
              <StatusBadge status={report.containerRestarted ? "warning" : "ok"} label={report.containerRestarted ? "restarted" : "stable"} />
            </div>
          </div>
          <div>
            <p className="dashboard-section-label">Requests</p>
            <p className="mt-2 font-medium">{report.successRequests}/{report.totalRequests} successful</p>
          </div>
          <div>
            <p className="dashboard-section-label">Latency</p>
            <p className="mt-2 font-medium">p50 {report.p50Ms ?? 0}ms / p95 {report.p95Ms ?? 0}ms</p>
          </div>
          <div>
            <p className="dashboard-section-label">Error Rate</p>
            <p className="mt-2 font-medium">{displayErrorRate(report)}%</p>
          </div>
          <div>
            <p className="dashboard-section-label">Auto Rollback</p>
            <p className="mt-2 font-medium">{report.autoRolledBack ? "Yes" : "No"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg py-0">
        <CardHeader className="border-b border-border/80 px-4 py-3">
          <CardTitle className="text-sm">Full report JSON</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <pre className="max-h-96 overflow-auto p-4 font-mono text-xs leading-5 text-muted-foreground">
            {JSON.stringify(report.report ?? report, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDeployTestsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filter, setFilter] = useState<DeployTestFilter>("all");
  const [selectedReport, setSelectedReport] = useState<HealthReport | null>(null);

  const statusFilter = filter === "failed_health" ? "failed" : undefined;
  const reports = useQuery({
    queryKey: ["admin", "deploy-tests", { page, pageSize, statusFilter }],
    queryFn: () => api.get<HealthReportsResponse>(buildQuery("/admin/deploy-gates/health-reports", {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      status: statusFilter,
    })),
  });

  const visibleReports = useMemo(() =>
    (reports.data?.reports ?? []).filter((report) => matchesFilter(report, filter)),
  [filter, reports.data?.reports]);

  const columns = useMemo<ColumnDef<HealthReport>[]>(() => [
    {
      header: "Deployment",
      accessorKey: "deploymentId",
      cell: ({ row }) => <span className="font-mono text-xs">{shortId(row.original.deploymentId)}</span>,
    },
    {
      header: "App",
      accessorFn: (row) => row.app?.name ?? row.appId,
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.app?.name ?? "Unknown app"}</p>
          <p className="text-xs text-muted-foreground">{row.original.app?.domain ?? row.original.appId}</p>
        </div>
      ),
    },
    {
      header: "Health",
      accessorKey: "healthPassed",
      cell: ({ row }) => <StatusBadge status={row.original.healthPassed ? "ok" : "error"} label={row.original.healthPassed ? "passed" : "failed"} />,
    },
    { header: "VU", accessorKey: "virtualUsers" },
    { header: "Requests", accessorKey: "totalRequests" },
    {
      header: "Success Rate",
      accessorKey: "successRequests",
      cell: ({ row }) => `${successRate(row.original)}%`,
    },
    {
      header: "p95",
      accessorKey: "p95Ms",
      cell: ({ row }) => `${row.original.p95Ms ?? 0}ms`,
    },
    {
      header: "Error Rate",
      accessorKey: "errorRate",
      cell: ({ row }) => `${displayErrorRate(row.original)}%`,
    },
    {
      header: "Container",
      accessorKey: "containerRestarted",
      cell: ({ row }) => (
        <StatusBadge status={row.original.containerRestarted ? "warning" : "ok"} label={row.original.containerRestarted ? "restarted" : "stable"} />
      ),
    },
    {
      header: "Result",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status === "passed" ? "ok" : row.original.status === "failed" ? "error" : "info"} label={row.original.status} />,
    },
  ], []);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="dashboard-section-label">Safe Deploy</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Deploy tests</h1>
        </div>
        <Select value={filter} onValueChange={(value) => { setPage(1); setFilter(value as DeployTestFilter); }}>
          <SelectTrigger id="admin-deploy-tests-filter" className="w-[220px]">
            <SelectValue placeholder="Filter reports" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reports</SelectItem>
            <SelectItem value="failed_health">Failed health</SelectItem>
            <SelectItem value="high_latency">High latency</SelectItem>
            <SelectItem value="high_error_rate">High error rate</SelectItem>
            <SelectItem value="container_restarted">Container restarted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reports.isError ? (
        <EmptyState icon={Gauge} title="Health reports unavailable" description="The deploy-gates health endpoint failed to respond." />
      ) : null}

      <DataTable
        idPrefix="admin-deploy-tests-table"
        columns={columns}
        data={visibleReports}
        pagination={{ page, pageSize, total: filter === "all" || filter === "failed_health" ? reports.data?.total ?? 0 : visibleReports.length }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        isLoading={reports.isLoading}
        emptyMessage="No deploy test reports match this filter."
        onRowClick={(report) => setSelectedReport(report)}
      />

      <DetailDrawer
        open={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        title={selectedReport ? `Report ${shortId(selectedReport.deploymentId)}` : "Deploy test report"}
        subtitle={selectedReport?.app?.name ?? undefined}
        width="lg"
      >
        <ReportDetail report={selectedReport} />
      </DetailDrawer>
    </div>
  );
}
