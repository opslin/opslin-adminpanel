"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Archive, Database, HardDrive, Radio, Wifi, type LucideIcon } from "lucide-react";

import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type AdminSystemHealth = {
  api: { status: "ok" | "error"; uptimeSeconds: number };
  db: { status: "ok" | "error"; latencyMs: number };
  redis: { status: "ok" | "error"; latencyMs: number; usedPercent: number | null };
  queue: { waiting: number; active: number; failed: number };
  websocket: { connectionCount: number };
  backup: { lastSuccessful: string | null };
  disk: { status: "ok" | "warning" | "critical" | "error"; usedPercent: number | null; freeBytes: number | null; totalBytes: number | null };
};

function formatBytes(bytes: number) {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)}GB` : `${Math.round(bytes / 1024 ** 2)}MB`;
}

function diskToBadge(status: AdminSystemHealth["disk"]["status"]): BadgeStatus {
  if (status === "ok") return "ok";
  if (status === "warning") return "warning";
  return "error";
}

function statusToBadge(status: "ok" | "error"): BadgeStatus {
  return status === "ok" ? "ok" : "error";
}

function borderFor(status: BadgeStatus) {
  if (status === "ok") {
    return "border-success/35";
  }
  if (status === "warning") {
    return "border-warning/35";
  }
  if (status === "error") {
    return "border-danger/35";
  }
  return "border-border/80";
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  return `${hours}h`;
}

function HealthCard({
  title,
  status,
  metric,
  secondary,
  icon: Icon,
}: {
  title: string;
  status: BadgeStatus;
  metric: string;
  secondary: string;
  icon: LucideIcon;
}) {
  return (
    <Card className={`rounded-lg border-2 ${borderFor(status)}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="mt-3">
              <StatusBadge status={status} label={status === "ok" ? "OK" : status === "warning" ? "Warning" : "Error"} />
            </div>
          </div>
          <div className="flex size-10 items-center justify-center rounded-md border border-border/80 bg-secondary/40">
            <Icon className="size-5 text-muted-foreground" />
          </div>
        </div>
        <p className="mt-6 font-mono text-3xl font-semibold tracking-tight">{metric}</p>
        <p className="mt-2 text-sm text-muted-foreground">{secondary}</p>
      </CardContent>
    </Card>
  );
}

function LoadingHealthGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-48 animate-pulse rounded-lg border border-border/80 bg-card" />
      ))}
    </div>
  );
}

export default function AdminSystemPage() {
  const health = useQuery({
    queryKey: ["admin", "system-health"],
    queryFn: () => api.get<AdminSystemHealth>("/admin/system-health"),
    refetchInterval: 60_000,
  });

  const data = health.data;
  const backupStatus: BadgeStatus = data?.backup.lastSuccessful ? "ok" : "warning";

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">P0 System</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">System health</h1>
      </div>

      {health.isLoading || !data ? (
        <LoadingHealthGrid />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <HealthCard
            title="API"
            status={statusToBadge(data.api.status)}
            metric={formatUptime(data.api.uptimeSeconds)}
            secondary="uptime"
            icon={Activity}
          />
          <HealthCard
            title="Database"
            status={statusToBadge(data.db.status)}
            metric={`${data.db.latencyMs}ms`}
            secondary="query latency"
            icon={Database}
          />
          <HealthCard
            title="Redis"
            status={statusToBadge(data.redis.status)}
            metric={`${data.redis.latencyMs}ms`}
            secondary={data.redis.usedPercent !== null ? `ping latency · ${data.redis.usedPercent.toFixed(0)}% memory used` : "ping latency"}
            icon={Wifi}
          />
          <HealthCard
            title="WebSocket"
            status={data.websocket.connectionCount > 0 ? "ok" : "warning"}
            metric={`${data.websocket.connectionCount}`}
            secondary="active connections"
            icon={Radio}
          />
          <HealthCard
            title="Disk"
            status={diskToBadge(data.disk.status)}
            metric={data.disk.usedPercent !== null ? `${data.disk.usedPercent.toFixed(0)}%` : "—"}
            secondary={data.disk.freeBytes !== null && data.disk.totalBytes !== null
              ? `${formatBytes(data.disk.freeBytes)} free of ${formatBytes(data.disk.totalBytes)}`
              : "usage unavailable"}
            icon={HardDrive}
          />
          <HealthCard
            title="Backup"
            status={backupStatus}
            metric={data.backup.lastSuccessful ? formatDate(data.backup.lastSuccessful) : "None"}
            secondary={data.backup.lastSuccessful ? "last successful backup" : "no successful backup yet"}
            icon={Archive}
          />
        </div>
      )}
    </div>
  );
}
