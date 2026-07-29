"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  Clock3,
  CreditCard,
  MoreHorizontal,
  ScrollText,
  Settings2,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

type OrgRisk = "low" | "inactive" | "trial_ending" | "churning" | "high_failure";

type AdminOrg = {
  id: string;
  name: string;
  slug: string;
  owner: { id: string; name: string; email: string; lastActiveAt: string | null } | null;
  ownerName: string | null;
  ownerEmail: string | null;
  planName: string;
  planSlug: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  serverCount: number;
  appCount: number;
  dbCount: number;
  deploymentsMonth: number;
  deployFailRate: number;
  risk: OrgRisk;
  flags: {
    highTouchBeta?: boolean;
    internal?: boolean;
    notes?: string | null;
  };
};

type OrgListResponse = {
  orgs: AdminOrg[];
  pagination: { page: number; pageSize: number; total: number };
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

const riskLabels: Record<OrgRisk, string> = {
  low: "Low",
  inactive: "Inactive",
  trial_ending: "Trial ending",
  churning: "Churning",
  high_failure: "High failure",
};

const riskStyles: Record<OrgRisk, string> = {
  low: "border-success/25 bg-success-muted text-success-text",
  inactive: "border-muted-foreground/25 bg-secondary text-muted-foreground",
  trial_ending: "border-warning/25 bg-warning-muted text-warning-text",
  churning: "border-danger/25 bg-danger-muted text-danger-text",
  high_failure: "border-chart-violet/25 bg-chart-violet/10 text-chart-violet",
};

function RiskBadge({ risk }: { risk: OrgRisk }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium", riskStyles[risk])}>
      {riskLabels[risk] ?? risk}
    </span>
  );
}

function TrialCell({ org }: { org: AdminOrg }) {
  if (!org.trialEndsAt) {
    return <span className="text-sm text-muted-foreground">No trial</span>;
  }

  const expired = new Date(org.trialEndsAt).getTime() < Date.now();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm">{formatDate(org.trialEndsAt)}</span>
      <StatusBadge status={expired ? "error" : "info"} label={expired ? "expired" : org.subscriptionStatus ?? "trial"} />
    </div>
  );
}

export default function AdminOrgsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [trialStatus, setTrialStatus] = useState("all");
  const [risk, setRisk] = useState("all");
  const [sort, setSort] = useState("createdAt_desc");

  const orgs = useQuery({
    queryKey: ["admin", "orgs", { page, pageSize, search, plan, trialStatus, risk, sort }],
    queryFn: () => api.get<OrgListResponse>(buildQuery("/admin/orgs", {
      page,
      pageSize,
      search,
      plan: plan === "all" ? undefined : plan,
      trialStatus: trialStatus === "all" ? undefined : trialStatus,
      risk: risk === "all" ? undefined : risk,
      sort,
    })),
  });

  const markHighTouch = useMutation({
    mutationFn: (orgId: string) => api.patch(`/admin/orgs/${orgId}`, { highTouchBeta: true }),
    onSuccess: async () => {
      toast.success("Organization marked high touch");
      await orgs.refetch();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update organization");
    },
  });

  const extendTrial = useMutation({
    mutationFn: (ownerId: string) => api.post(`/admin/users/${ownerId}/extend-trial`, { days: 7 }),
    onSuccess: async () => {
      toast.success("Trial extended by 7 days");
      await orgs.refetch();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to extend trial");
    },
  });

  const columns = useMemo<ColumnDef<AdminOrg>[]>(() => [
    {
      header: "Org",
      accessorKey: "name",
      cell: ({ row }) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.flags?.internal ? <Badge variant="outline">Internal</Badge> : null}
            {row.original.flags?.highTouchBeta ? <Badge variant="secondary">High touch</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground">{row.original.slug}</p>
        </div>
      ),
    },
    {
      header: "Owner",
      accessorFn: (row) => row.ownerName ?? "No owner",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.ownerName ?? "No owner"}</p>
          <p className="text-xs text-muted-foreground">{row.original.ownerEmail ?? "Unassigned"}</p>
        </div>
      ),
    },
    {
      header: "Plan",
      accessorKey: "planName",
      cell: ({ row }) => <Badge variant="secondary">{row.original.planName}</Badge>,
    },
    {
      header: "Trial End",
      accessorKey: "trialEndsAt",
      cell: ({ row }) => <TrialCell org={row.original} />,
    },
    { header: "Servers", accessorKey: "serverCount" },
    { header: "Apps", accessorKey: "appCount" },
    { header: "DBs", accessorKey: "dbCount" },
    {
      header: "Usage",
      accessorKey: "deploymentsMonth",
      cell: ({ row }) => (
        <div className="text-sm">
          <p>{row.original.deploymentsMonth} deploys</p>
          <p className="text-xs text-muted-foreground">{row.original.deployFailRate}% fail rate</p>
        </div>
      ),
    },
    {
      header: "Risk",
      accessorKey: "risk",
      cell: ({ row }) => <RiskBadge risk={row.original.risk} />,
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const org = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                id={`admin-org-${org.id}-actions`}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${org.name}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Org actions</DropdownMenuLabel>
              <DropdownMenuItem
                id={`admin-org-${org.id}-change-plan`}
                onSelect={() => router.push(`/plans?orgId=${org.id}`)}
              >
                <CreditCard className="size-4" />
                Change plan
              </DropdownMenuItem>
              <DropdownMenuItem
                id={`admin-org-${org.id}-override-limits`}
                onSelect={() => toast.info("Use org detail limits endpoint from the admin API.")}
              >
                <Settings2 className="size-4" />
                Override limits
              </DropdownMenuItem>
              <DropdownMenuItem
                id={`admin-org-${org.id}-extend-trial`}
                disabled={!org.owner?.id || extendTrial.isPending}
                onSelect={() => org.owner?.id && extendTrial.mutate(org.owner.id)}
              >
                <Clock3 className="size-4" />
                Extend trial
              </DropdownMenuItem>
              <DropdownMenuItem
                id={`admin-org-${org.id}-view-audit`}
                onSelect={() => router.push(`/audit?orgId=${org.id}`)}
              >
                <ScrollText className="size-4" />
                View audit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                id={`admin-org-${org.id}-mark-high-touch`}
                disabled={markHighTouch.isPending || Boolean(org.flags?.highTouchBeta)}
                onSelect={() => markHighTouch.mutate(org.id)}
              >
                <Star className="size-4" />
                Mark high-touch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [extendTrial, markHighTouch, router]);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="dashboard-section-label">P0 Organizations</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Organization operations</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={plan} onValueChange={(value) => { setPage(1); setPlan(value); }}>
            <SelectTrigger id="admin-orgs-plan-filter" className="w-[150px]">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
          <Select value={trialStatus} onValueChange={(value) => { setPage(1); setTrialStatus(value); }}>
            <SelectTrigger id="admin-orgs-trial-filter" className="w-[165px]">
              <SelectValue placeholder="Trial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trials</SelectItem>
              <SelectItem value="trialing">Trialing</SelectItem>
              <SelectItem value="ending_soon">Ending soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="none">No trial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={risk} onValueChange={(value) => { setPage(1); setRisk(value); }}>
            <SelectTrigger id="admin-orgs-risk-filter" className="w-[160px]">
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risk</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="trial_ending">Trial ending</SelectItem>
              <SelectItem value="churning">Churning</SelectItem>
              <SelectItem value="high_failure">High failure</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(value) => { setPage(1); setSort(value); }}>
            <SelectTrigger id="admin-orgs-sort" className="w-[160px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt_desc">Newest</SelectItem>
              <SelectItem value="updatedAt_desc">Recently updated</SelectItem>
              <SelectItem value="name_asc">Name A-Z</SelectItem>
              <SelectItem value="plan_asc">Plan</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {orgs.isError ? (
        <EmptyState icon={Building2} title="Organizations unavailable" description="The admin organizations endpoint did not return a usable response." />
      ) : null}

      <DataTable
        idPrefix="admin-orgs-table"
        columns={columns}
        data={orgs.data?.orgs ?? []}
        pagination={orgs.data?.pagination ?? { page, pageSize, total: 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        searchPlaceholder="Search org, owner, email, or slug..."
        onSearch={(query) => { setPage(1); setSearch(query); }}
        isLoading={orgs.isLoading}
        emptyMessage="No organizations match these filters."
      />
    </div>
  );
}
