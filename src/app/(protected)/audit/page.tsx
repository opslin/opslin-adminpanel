"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, ScrollText, Search } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/admin/data-table";
import { DateRangePicker, type AdminDateRange } from "@/components/admin/date-range-picker";
import { DetailDrawer } from "@/components/admin/detail-drawer";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

type AuditLog = {
  id: string;
  createdAt: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  orgId: string | null;
};

type AuditResponse = {
  logs: AuditLog[];
  pagination: { page: number; pageSize: number; total: number };
};

function defaultRange(): AdminDateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 7);
  return { preset: "7d", from, to };
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

function targetLabel(log: AuditLog) {
  if (!log.targetType && !log.targetId) {
    return "None";
  }
  return `${log.targetType ?? "target"}:${log.targetId?.slice(0, 8) ?? "unknown"}`;
}

function metadataSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return "No metadata";
  }
  const keys = Object.keys(metadata as Record<string, unknown>);
  return keys.length ? keys.slice(0, 3).join(", ") : "Empty object";
}

function AuditDetail({ log }: { log: AuditLog | null }) {
  if (!log) {
    return <EmptyState icon={ScrollText} title="Select an audit log" description="Metadata appears here." />;
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="dashboard-section-label">Actor</p>
            <p className="mt-2 font-medium">{log.actorName ?? log.actorType}</p>
            <p className="text-xs text-muted-foreground">{log.actorEmail ?? log.actorId ?? "system"}</p>
          </div>
          <div>
            <p className="dashboard-section-label">Action</p>
            <p className="mt-2 font-mono text-sm">{log.action}</p>
          </div>
          <div>
            <p className="dashboard-section-label">Target</p>
            <p className="mt-2 font-mono text-sm">{targetLabel(log)}</p>
          </div>
          <div>
            <p className="dashboard-section-label">Organization</p>
            <p className="mt-2 font-mono text-sm">{log.orgId ?? "None"}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-lg py-0">
        <CardHeader className="border-b border-border/80 px-4 py-3">
          <CardTitle className="text-sm">Metadata JSON</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <pre className="max-h-96 overflow-auto p-4 font-mono text-xs leading-5 text-muted-foreground">
            {JSON.stringify(log.metadata ?? {}, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminAuditPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("all");
  const [targetType, setTargetType] = useState("");
  const [orgId, setOrgId] = useState(searchParams.get("orgId") ?? "");
  const [range, setRange] = useState<AdminDateRange>(() => defaultRange());
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const logs = useQuery({
    queryKey: ["admin", "audit-logs", { page, pageSize, actorId, action, targetType, orgId, from: range.from.toISOString(), to: range.to.toISOString() }],
    queryFn: () => api.get<AuditResponse>(buildQuery("/admin/audit-logs", {
      page,
      pageSize,
      actorId,
      action: action === "all" ? undefined : action,
      targetType,
      orgId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    })),
  });

  const columns = useMemo<ColumnDef<AuditLog>[]>(() => [
    {
      header: "Time",
      accessorKey: "createdAt",
      cell: ({ row }) => formatRelativeTime(row.original.createdAt),
    },
    {
      header: "Actor",
      accessorKey: "actorName",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.actorName ?? row.original.actorType}</p>
          <p className="text-xs text-muted-foreground">{row.original.actorEmail ?? row.original.actorId ?? "system"}</p>
        </div>
      ),
    },
    {
      header: "Action",
      accessorKey: "action",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.action}</span>,
    },
    {
      header: "Target",
      accessorKey: "targetType",
      cell: ({ row }) => <span className="font-mono text-xs">{targetLabel(row.original)}</span>,
    },
    {
      header: "Org",
      accessorKey: "orgId",
      cell: ({ row }) => row.original.orgId ? <span className="font-mono text-xs">{row.original.orgId.slice(0, 8)}</span> : "None",
    },
    {
      header: "Details",
      accessorKey: "metadata",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{metadataSummary(row.original.metadata)}</span>,
    },
  ], []);

  function exportJson() {
    const payload = logs.data?.logs ?? [];
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Audit logs exported");
  }

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="dashboard-section-label">Governance</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Audit logs</h1>
        </div>
        <Button
          id="admin-audit-export"
          type="button"
          variant="outline"
          disabled={!logs.data?.logs.length}
          onClick={exportJson}
        >
          <Download className="size-4" />
          Export JSON
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border border-border/80 bg-card p-3 xl:grid-cols-[minmax(160px,1fr)_180px_minmax(160px,1fr)_minmax(160px,1fr)_auto] xl:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="admin-audit-actor-filter"
            value={actorId}
            onChange={(event) => { setPage(1); setActorId(event.target.value); }}
            placeholder="Actor ID"
            className="pl-9"
          />
        </div>
        <Select value={action} onValueChange={(value) => { setPage(1); setAction(value); }}>
          <SelectTrigger id="admin-audit-action-filter">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="auth.login">auth.login</SelectItem>
            <SelectItem value="admin.org_updated">admin.org_updated</SelectItem>
            <SelectItem value="admin.org_limits_set">admin.org_limits_set</SelectItem>
            <SelectItem value="admin.org_comped">admin.org_comped</SelectItem>
            <SelectItem value="admin.manual_invoice_created">admin.manual_invoice_created</SelectItem>
            <SelectItem value="deploy.gate_triggered">deploy.gate_triggered</SelectItem>
          </SelectContent>
        </Select>
        <Input
          id="admin-audit-target-filter"
          value={targetType}
          onChange={(event) => { setPage(1); setTargetType(event.target.value); }}
          placeholder="Target type"
        />
        <Input
          id="admin-audit-org-filter"
          value={orgId}
          onChange={(event) => { setPage(1); setOrgId(event.target.value); }}
          placeholder="Organization ID"
        />
        <DateRangePicker
          idPrefix="admin-audit-range"
          value={range}
          onChange={(nextRange) => { setPage(1); setRange(nextRange); }}
        />
      </div>

      {logs.isError ? (
        <EmptyState icon={ScrollText} title="Audit logs unavailable" description="The audit log endpoint failed to respond." />
      ) : null}

      <DataTable
        idPrefix="admin-audit-table"
        columns={columns}
        data={logs.data?.logs ?? []}
        pagination={logs.data?.pagination ?? { page, pageSize, total: 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        isLoading={logs.isLoading}
        emptyMessage="No audit logs match this filter."
        onRowClick={(log) => setSelectedLog(log)}
      />

      <DetailDrawer
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog?.action ?? "Audit detail"}
        subtitle={selectedLog ? formatRelativeTime(selectedLog.createdAt) : undefined}
        width="lg"
      >
        <AuditDetail log={selectedLog} />
      </DetailDrawer>
    </div>
  );
}
