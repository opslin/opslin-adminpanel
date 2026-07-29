"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  ExternalLink,
  Github,
  GitPullRequest,
  KeyRound,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

type DeployGateMetrics = {
  totalGates: number;
  gates: { active: number; disabled: number };
  ciRunsLast24h: Record<string, number>;
  healthReportsLast24h: Record<string, number>;
  githubInstallations?: number;
  openPrs?: number;
  setupFailures?: number;
  blockedDeploys?: number;
};

type CiRun = {
  id: string;
  deploymentId: string | null;
  repoFullName: string;
  branch: string;
  commitSha: string;
  runId: string | null;
  runUrl: string | null;
  status: string;
  failureReason: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  deployGate: {
    id: string;
    appId: string;
    repoFullName: string;
    branch: string;
    mode: string;
    enabled: boolean;
    disabledReason: string | null;
    app: { id: string; name: string } | null;
    organization: { id: string; name: string; slug: string } | null;
    secretsInjected?: boolean;
    workflowPath?: string | null;
  } | null;
};

type CiRunsResponse = {
  ciRuns: CiRun[];
  total: number;
};

type GateRow = {
  id: string;
  gateId: string | null;
  appId: string | null;
  appName: string;
  repo: string;
  branch: string;
  mode: string;
  workflow: string;
  secretsInjected: boolean;
  enabled: boolean;
  disabledReason: string | null;
  lastCiStatus: string;
  lastCiAt: string;
  lastDeploy: string | null;
  runUrl: string | null;
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

function statusTone(status: string): BadgeStatus {
  const normalized = status.toLowerCase();
  if (["success", "succeeded", "passed", "completed"].includes(normalized)) {
    return "ok";
  }
  if (["failed", "failure", "error", "cancelled"].includes(normalized)) {
    return "error";
  }
  if (["pending", "queued", "running", "in_progress"].includes(normalized)) {
    return "warning";
  }
  return "info";
}

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "None";
}

function maskDeployToken(token?: string | null) {
  if (!token) {
    return "tok_****";
  }
  if (token.startsWith("tok_")) {
    return `${token.slice(0, 4)}****`;
  }
  return `${token.slice(0, 4)}****`;
}

function countStatus(counts: Record<string, number> | undefined, names: string[]) {
  if (!counts) {
    return 0;
  }
  return names.reduce((total, name) => total + (counts[name] ?? counts[name.toUpperCase()] ?? 0), 0);
}

function toGateRows(ciRuns: CiRun[]): GateRow[] {
  return ciRuns.map((run) => {
    const gate = run.deployGate;
    return {
      id: run.id,
      gateId: gate?.id ?? null,
      appId: gate?.appId ?? null,
      appName: gate?.app?.name ?? "Unknown app",
      repo: gate?.repoFullName ?? run.repoFullName,
      branch: gate?.branch ?? run.branch,
      mode: gate?.mode ?? "safe",
      workflow: gate?.workflowPath ?? (run.runUrl ? "GitHub Actions" : "Default workflow"),
      secretsInjected: Boolean(gate?.secretsInjected),
      enabled: gate?.enabled ?? false,
      disabledReason: gate?.disabledReason ?? null,
      lastCiStatus: run.status,
      lastCiAt: run.createdAt,
      lastDeploy: run.deploymentId,
      runUrl: run.runUrl,
    };
  });
}

export default function AdminCiGatesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [confirmRotate, setConfirmRotate] = useState<GateRow | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<GateRow | null>(null);

  const metrics = useQuery({
    queryKey: ["admin", "deploy-gates", "metrics"],
    queryFn: () => api.get<DeployGateMetrics>("/admin/deploy-gates/metrics"),
  });

  const ciRuns = useQuery({
    queryKey: ["admin", "deploy-gates", "ci-runs", { page, pageSize }],
    queryFn: () => api.get<CiRunsResponse>(buildQuery("/admin/deploy-gates/ci-runs", {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })),
  });

  const rows = useMemo(() => toGateRows(ciRuns.data?.ciRuns ?? []), [ciRuns.data?.ciRuns]);
  const passedRuns = countStatus(metrics.data?.ciRunsLast24h, ["success", "succeeded", "passed"]);
  const failedRuns = countStatus(metrics.data?.ciRunsLast24h, ["failed", "failure", "error"]);
  const totalResolvedRuns = passedRuns + failedRuns;
  const passRate = totalResolvedRuns > 0 ? Math.round((passedRuns / totalResolvedRuns) * 100) : 0;
  const setupFailures = metrics.data?.setupFailures ?? failedRuns;
  const blockedDeploys = metrics.data?.blockedDeploys ?? countStatus(metrics.data?.healthReportsLast24h, ["failed", "error"]);

  const rotateToken = useMutation({
    mutationFn: async (row: GateRow) => {
      if (!row.appId || !row.gateId) {
        throw new Error("Missing gate identifiers");
      }
      return api.patch<{ token?: string }>(`/apps/${row.appId}/deploy-gates/${row.gateId}/rotate`, {});
    },
    onSuccess: async (response) => {
      toast.success(`Deploy token rotated: ${maskDeployToken(response.token)}`);
      setConfirmRotate(null);
      await ciRuns.refetch();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to rotate deploy token");
    },
  });

  const disableGate = useMutation({
    mutationFn: async (row: GateRow) => {
      if (!row.gateId) {
        throw new Error("Missing gate identifier");
      }
      return api.post(`/admin/deploy-gates/${row.gateId}/disable`, {
        reason: "Disabled from admin CI gates page",
      });
    },
    onSuccess: async () => {
      toast.success("Deploy gate disabled");
      setConfirmDisable(null);
      await Promise.all([metrics.refetch(), ciRuns.refetch()]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to disable deploy gate");
    },
  });

  const columns = useMemo<ColumnDef<GateRow>[]>(() => [
    { header: "App", accessorKey: "appName" },
    {
      header: "Repo",
      accessorKey: "repo",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.repo}</span>,
    },
    { header: "Branch", accessorKey: "branch" },
    {
      header: "Mode",
      accessorKey: "mode",
      cell: ({ row }) => <Badge variant="secondary">{row.original.mode}</Badge>,
    },
    {
      header: "Workflow",
      accessorKey: "workflow",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.workflow}</span>
          {row.original.runUrl ? (
            <Button
              id={`admin-ci-gate-${row.original.id}-run`}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Open GitHub run"
              onClick={() => window.open(row.original.runUrl ?? undefined, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="size-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
    {
      header: "Secrets",
      accessorKey: "secretsInjected",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.secretsInjected ? "ok" : "warning"}
          label={row.original.secretsInjected ? "injected" : "review"}
        />
      ),
    },
    {
      header: "Last CI",
      accessorKey: "lastCiStatus",
      cell: ({ row }) => (
        <div className="space-y-1">
          <StatusBadge status={statusTone(row.original.lastCiStatus)} label={row.original.lastCiStatus} />
          <p className="text-xs text-muted-foreground">{formatRelativeTime(row.original.lastCiAt)}</p>
        </div>
      ),
    },
    {
      header: "Last Deploy",
      accessorKey: "lastDeploy",
      cell: ({ row }) => <span className="font-mono text-xs">{shortId(row.original.lastDeploy)}</span>,
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              id={`admin-ci-gate-${row.original.id}-actions`}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${row.original.appName}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Gate actions</DropdownMenuLabel>
            <DropdownMenuItem
              id={`admin-ci-gate-${row.original.id}-regenerate-pr`}
              onSelect={() => toast.info("PR regeneration is queued from the deploy-gates service when available.")}
            >
              <GitPullRequest className="size-4" />
              Regenerate PR
            </DropdownMenuItem>
            <DropdownMenuItem
              id={`admin-ci-gate-${row.original.id}-rotate-token`}
              disabled={!row.original.appId || !row.original.gateId}
              onSelect={() => setConfirmRotate(row.original)}
            >
              <KeyRound className="size-4" />
              Rotate token
            </DropdownMenuItem>
            <DropdownMenuItem
              id={`admin-ci-gate-${row.original.id}-view-run`}
              disabled={!row.original.runUrl}
              onSelect={() => row.original.runUrl && window.open(row.original.runUrl, "_blank", "noopener,noreferrer")}
            >
              <Github className="size-4" />
              View GitHub run
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              id={`admin-ci-gate-${row.original.id}-disable`}
              variant="destructive"
              disabled={!row.original.enabled || !row.original.gateId}
              onSelect={() => setConfirmDisable(row.original)}
            >
              <ShieldOff className="size-4" />
              Disable gate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], []);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">Safe Deploy</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">CI/CD gates</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Safe Deploy Apps" value={metrics.data?.totalGates ?? 0} icon={ShieldCheck} status="info" />
        <StatCard label="Open PRs" value={metrics.data?.openPrs ?? 0} icon={GitPullRequest} status="info" />
        <StatCard label="Setup Failures" value={setupFailures} icon={AlertTriangle} status={setupFailures > 0 ? "error" : "ok"} />
        <StatCard label="CI Pass Rate" value={`${passRate}%`} icon={Workflow} status={passRate >= 90 ? "ok" : "warning"} />
        <StatCard label="Blocked Deploys" value={blockedDeploys} icon={ShieldOff} status={blockedDeploys > 0 ? "warning" : "ok"} />
        <StatCard label="GitHub Installs" value={metrics.data?.githubInstallations ?? 0} icon={Github} status="info" />
      </div>

      {metrics.isError || ciRuns.isError ? (
        <EmptyState icon={ShieldCheck} title="CI gate data unavailable" description="One or more deploy-gates endpoints failed to respond." />
      ) : null}

      <DataTable
        idPrefix="admin-ci-gates-table"
        columns={columns}
        data={rows}
        pagination={{ page, pageSize, total: ciRuns.data?.total ?? 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        isLoading={ciRuns.isLoading}
        emptyMessage="No CI runs or deploy gates match this page."
      />

      <ConfirmDialog
        idPrefix="admin-ci-gates-rotate-confirm"
        open={Boolean(confirmRotate)}
        onCancel={() => setConfirmRotate(null)}
        onConfirm={() => confirmRotate && rotateToken.mutate(confirmRotate)}
        title="Rotate deploy token"
        description="The new deploy token will only be shown as a masked prefix in this console."
        variant="danger"
        confirmText="ROTATE_TOKEN"
        isLoading={rotateToken.isPending}
      />

      <ConfirmDialog
        idPrefix="admin-ci-gates-disable-confirm"
        open={Boolean(confirmDisable)}
        onCancel={() => setConfirmDisable(null)}
        onConfirm={() => confirmDisable && disableGate.mutate(confirmDisable)}
        title="Disable deploy gate"
        description="This blocks future Safe Deploy triggers for the selected app and writes an admin audit log."
        variant="warning"
        isLoading={disableGate.isPending}
      />
    </div>
  );
}
