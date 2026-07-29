"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Clock3, Database, ListTodo, Timer, Users, Workflow, XCircle } from "lucide-react";

import { DataTable } from "@/components/admin/data-table";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { api } from "@/lib/api";

type AdminQueueResponse = {
  jobs: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    failed24h: number;
    dlq: number;
  };
  waitTime: {
    avgMs: number;
    p95Ms: number;
  };
  workers: {
    expected: number;
    concurrency: number;
    totalCapacity: number;
    observed: number;
    stale: number;
    missing: number;
  };
  redis: {
    status: "ok" | "error";
    latencyMs: number;
  };
};

type WorkerRow = {
  id: string;
  status: "ok" | "error";
  activeJobs: number;
  completed: number;
  failed24h: number;
  lastHeartbeat: string;
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

export default function AdminQueuePage() {
  const queue = useQuery({
    queryKey: ["admin", "queue"],
    queryFn: () => api.get<AdminQueueResponse>("/admin/queue"),
    refetchInterval: 60_000,
  });

  const data = queue.data;
  const workersAlive = data?.workers.observed ?? 0;
  const workerRows = useMemo<WorkerRow[]>(() => data ? [{
    id: "worker-pool",
    status: data.workers.missing === 0 && data.workers.stale === 0 ? "ok" : "error",
    activeJobs: data.jobs.active,
    completed: data.jobs.completed,
    failed24h: data.jobs.failed24h,
    lastHeartbeat: data.workers.observed > 0
      ? `${data.workers.observed} observed via heartbeat`
      : "No worker heartbeat",
  }] : [], [data]);

  const columns = useMemo<ColumnDef<WorkerRow>[]>(() => [
    { header: "Worker ID", accessorKey: "id" },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status === "ok" ? "ok" : "error"} label={row.original.status} />,
    },
    { header: "Active Jobs", accessorKey: "activeJobs" },
    { header: "Completed", accessorKey: "completed" },
    { header: "Failed 24h", accessorKey: "failed24h" },
    { header: "Last Heartbeat", accessorKey: "lastHeartbeat" },
  ], []);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">P0 Queue</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Queue and workers</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Jobs" value={data?.jobs.active ?? 0} icon={Workflow} status="info" />
        <StatCard label="Waiting Jobs" value={data?.jobs.waiting ?? 0} icon={ListTodo} status={(data?.jobs.waiting ?? 0) > 10 ? "warning" : "ok"} />
        <StatCard label="Failed 24h" value={data?.jobs.failed24h ?? 0} icon={AlertTriangle} status={(data?.jobs.failed24h ?? 0) > 0 ? "warning" : "ok"} />
        <StatCard label="DLQ" value={data?.jobs.dlq ?? 0} icon={XCircle} status={(data?.jobs.dlq ?? 0) > 0 ? "error" : "ok"} />
        <StatCard label="Avg Wait" value={formatMs(data?.waitTime.avgMs ?? 0)} icon={Clock3} status="info" />
        <StatCard label="p95 Wait" value={formatMs(data?.waitTime.p95Ms ?? 0)} icon={Timer} status="info" />
        <StatCard label="Workers" value={`${workersAlive}/${data?.workers.expected ?? 0}`} icon={Users} status={workersAlive < (data?.workers.expected ?? 0) ? "error" : "ok"} description={`${data?.workers.totalCapacity ?? 0} total capacity`} />
        <StatCard label="Redis Health" value={data?.redis.status ?? "loading"} icon={Database} status={data?.redis.status === "ok" ? "ok" : "error"} description={`${data?.redis.latencyMs ?? 0}ms latency`} />
      </div>

      <DataTable
        columns={columns}
        data={workerRows}
        pagination={{ page: 1, pageSize: 50, total: workerRows.length }}
        onPageChange={() => undefined}
        isLoading={queue.isLoading}
        emptyMessage="No worker heartbeat data is available."
      />
    </div>
  );
}
