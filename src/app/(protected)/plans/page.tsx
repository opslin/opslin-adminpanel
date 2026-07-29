"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Building2, Clock3, CreditCard, Users, Zap } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable } from "@/components/admin/data-table";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type PlanSlug = "free" | "starter" | "pro" | "business" | "enterprise";

type AdminPlanOrg = {
  id: string;
  name: string;
  planName: string;
  planSlug: string;
  trialStart: string | null;
  trialEnd: string | null;
  trialExpired: boolean;
  paymentRequired: boolean;
  serversUsed: number;
  serversLimit: number;
  appsUsed: number;
  appsLimit: number;
  limitRisk: "ok" | "warning" | "critical";
};

type PlansResponse = {
  summary: {
    free: number;
    starterTrial: number;
    pro: number;
    business: number;
    trialEnding7d: number;
    trialExpired: number;
    nearLimits: number;
  };
  organizations: AdminPlanOrg[];
  pagination: { page: number; pageSize: number; total: number };
};

type PendingAction =
  | { kind: "change"; org: AdminPlanOrg; planSlug: PlanSlug }
  | { kind: "extend"; org: AdminPlanOrg }
  | { kind: "internal"; org: AdminPlanOrg };

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

function riskStatus(risk: AdminPlanOrg["limitRisk"]): BadgeStatus {
  if (risk === "critical") {
    return "error";
  }
  if (risk === "warning") {
    return "warning";
  }
  return "ok";
}

function usageText(used: number, limit: number) {
  return limit < 0 ? `${used}/unlimited` : `${used}/${limit}`;
}

function actionCopy(action: PendingAction | null) {
  if (!action) {
    return { title: "Confirm action", description: "Confirm this admin action." };
  }
  if (action.kind === "change") {
    return {
      title: `Change ${action.org.name} to ${action.planSlug}`,
      description: "This updates the organization's billing plan and writes an admin audit event.",
    };
  }
  if (action.kind === "extend") {
    return {
      title: `Extend trial for ${action.org.name}`,
      description: "This extends the trial by 7 days and writes an admin audit event.",
    };
  }
  return {
    title: `Mark ${action.org.name} as internal`,
    description: "This marks the organization as internal and writes an admin audit event.",
  };
}

export default function AdminPlansPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [desiredPlans, setDesiredPlans] = useState<Record<string, PlanSlug>>({});

  const plans = useQuery({
    queryKey: ["admin", "plans", { page, pageSize, search }],
    queryFn: () => api.get<PlansResponse>(buildQuery("/admin/plans", { page, pageSize, search })),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: PendingAction) => {
      if (action.kind === "extend") {
        return api.post<{ success: boolean }>(`/admin/orgs/${action.org.id}/trial/extend`, {
          days: 7,
          reason: "Admin extended beta trial from plan management.",
        });
      }
      if (action.kind === "internal") {
        return api.post<{ success: boolean }>(`/admin/orgs/${action.org.id}/plan`, {
          markInternal: true,
          reason: "Marked as internal from admin plan management.",
        });
      }
      return api.post<{ success: boolean }>(`/admin/orgs/${action.org.id}/plan`, {
        planSlug: action.planSlug,
        reason: "Admin changed plan from plan management.",
      });
    },
    onSuccess: async () => {
      toast.success("Admin action completed");
      setPendingAction(null);
      await plans.refetch();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Admin action failed");
    },
  });

  const columns = useMemo<ColumnDef<AdminPlanOrg>[]>(() => [
    {
      header: "Organization",
      accessorKey: "name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      header: "Plan",
      accessorKey: "planName",
      cell: ({ row }) => <StatusBadge status={row.original.planSlug === "internal" ? "info" : "ok"} label={row.original.planName} />,
    },
    {
      header: "Trial",
      accessorKey: "trialEnd",
      cell: ({ row }) => row.original.trialEnd ? (
        <StatusBadge
          status={row.original.trialExpired ? "error" : "info"}
          label={row.original.trialExpired ? "expired" : `ends ${formatDate(row.original.trialEnd)}`}
        />
      ) : <span className="text-muted-foreground">No trial</span>,
    },
    {
      header: "Servers",
      accessorKey: "serversUsed",
      cell: ({ row }) => usageText(row.original.serversUsed, row.original.serversLimit),
    },
    {
      header: "Apps",
      accessorKey: "appsUsed",
      cell: ({ row }) => usageText(row.original.appsUsed, row.original.appsLimit),
    },
    {
      header: "Risk",
      accessorKey: "limitRisk",
      cell: ({ row }) => <StatusBadge status={riskStatus(row.original.limitRisk)} label={row.original.limitRisk} />,
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const org = row.original;
        const planSlug = desiredPlans[org.id] ?? (["free", "starter", "pro", "business", "enterprise"].includes(org.planSlug) ? org.planSlug as PlanSlug : "pro");

        return (
          <div className="flex min-w-[420px] items-center gap-2">
            <Select
              value={planSlug}
              onValueChange={(value) => setDesiredPlans((current) => ({ ...current, [org.id]: value as PlanSlug }))}
            >
              <SelectTrigger className="h-8 w-[126px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={() => setPendingAction({ kind: "change", org, planSlug })}>
              Change
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPendingAction({ kind: "extend", org })}>
              Extend Trial
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPendingAction({ kind: "internal", org })}>
              Mark Internal
            </Button>
          </div>
        );
      },
    },
  ], [desiredPlans]);

  const summary = plans.data?.summary;
  const copy = actionCopy(pendingAction);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">P1 Billing</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Plan and trial management</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Free" value={summary?.free ?? 0} icon={Users} status="info" />
        <StatCard label="Starter Trial" value={summary?.starterTrial ?? 0} icon={Clock3} status="info" />
        <StatCard label="Pro" value={summary?.pro ?? 0} icon={CreditCard} status="ok" />
        <StatCard label="Business" value={summary?.business ?? 0} icon={Building2} status="ok" />
        <StatCard label="Expiring 7d" value={summary?.trialEnding7d ?? 0} icon={AlertTriangle} status={(summary?.trialEnding7d ?? 0) > 0 ? "warning" : "ok"} />
        <StatCard label="Near Limits" value={summary?.nearLimits ?? 0} icon={Zap} status={(summary?.nearLimits ?? 0) > 0 ? "warning" : "ok"} />
      </div>

      <DataTable
        columns={columns}
        data={plans.data?.organizations ?? []}
        pagination={plans.data?.pagination ?? { page, pageSize, total: 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        searchPlaceholder="Search organizations..."
        onSearch={(query) => { setPage(1); setSearch(query); }}
        isLoading={plans.isLoading}
        emptyMessage="No organizations match this filter."
      />

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => pendingAction && actionMutation.mutate(pendingAction)}
        title={copy.title}
        description={copy.description}
        variant={pendingAction?.kind === "internal" ? "danger" : "warning"}
        confirmText={pendingAction?.kind === "internal" ? "INTERNAL" : undefined}
        isLoading={actionMutation.isPending}
      />
    </div>
  );
}
