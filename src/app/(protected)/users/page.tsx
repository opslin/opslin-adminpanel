"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, UserCircle, Users } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable } from "@/components/admin/data-table";
import { DetailDrawer } from "@/components/admin/detail-drawer";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate, formatRelativeTime } from "@/lib/utils";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  status: string;
  emailVerified: boolean;
  organization: { id: string; name: string } | null;
  orgRole: string | null;
  plan: string;
  subscriptionStatus: string | null;
  trialEnd: string | null;
  serverCount: number;
  appCount: number;
  lastActiveAt: string | null;
  riskLevel: "low" | "medium" | "high" | string;
};

type AdminUserListResponse = {
  users: AdminUser[];
  pagination: { page: number; pageSize: number; total: number };
};

type AdminUserDetailResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    platformRole: string | null;
    status: string;
    emailVerified: boolean;
    createdAt: string;
    sessions: Array<{ id: string; device: string; ip: string; lastActive: string; isRevoked: boolean }>;
    organizationMemberships: Array<{
      role: string;
      organization: {
        id: string;
        name: string;
        slug: string;
        plan: string;
        subscription: {
          status: string;
          trialEnd: string | null;
          currentPeriodEnd: string | null;
          plan: { slug: string; name: string; priceWithGst: number; currency: string };
        } | null;
        servers: Array<{ id: string; name: string; status: string; agentVersion: string | null; lastSeenAt: string | null }>;
        apps: Array<{
          id: string;
          name: string;
          status: string;
          healthStatus: string;
          deployedAt: string | null;
          deployments: Array<{ id: string; status: string; startedAt: string; finishedAt: string | null }>;
        }>;
      };
    }>;
  };
  auditLogs: Array<{ id: string; event: string; targetType: string | null; createdAt: string }>;
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

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function riskStatus(risk: string): BadgeStatus {
  if (risk === "high") {
    return "error";
  }
  if (risk === "medium") {
    return "warning";
  }
  return "ok";
}

function statusFor(value?: string | null): BadgeStatus {
  const normalized = value?.toLowerCase();
  if (normalized === "connected" || normalized === "running" || normalized === "healthy" || normalized === "succeeded") {
    return "ok";
  }
  if (normalized === "pending" || normalized === "deploying" || normalized === "unknown") {
    return "warning";
  }
  if (normalized === "failed" || normalized === "error" || normalized === "unhealthy" || normalized === "disconnected") {
    return "error";
  }
  return "info";
}

function TrialBadge({ user }: { user: AdminUser }) {
  if (!user.trialEnd) {
    return <Badge variant="outline">No trial</Badge>;
  }
  const expired = new Date(user.trialEnd).getTime() < Date.now();
  return (
    <StatusBadge
      status={expired ? "error" : "info"}
      label={expired ? "Expired" : `Ends ${formatDate(user.trialEnd)}`}
    />
  );
}

function UserDetail({ detail }: { detail?: AdminUserDetailResponse }) {
  if (!detail) {
    return <EmptyState icon={Users} title="Loading user" description="Fetching account details." />;
  }

  const membership = detail.user.organizationMemberships[0];
  const organization = membership?.organization;
  const deployments = organization?.apps.flatMap((app) =>
    app.deployments.map((deployment) => ({ ...deployment, appName: app.name }))
  ).slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar className="size-12 border border-border/80">
          <AvatarFallback>{initials(detail.user.name)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-lg font-semibold">{detail.user.name}</h2>
          <p className="text-sm text-muted-foreground">{detail.user.email}</p>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="dashboard-section-label">Organization</p>
            <p className="mt-2 font-medium">{organization?.name ?? "No organization"}</p>
          </div>
          <div>
            <p className="dashboard-section-label">Plan</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary">{organization?.subscription?.plan?.name ?? organization?.plan ?? "Free"}</Badge>
              {organization?.subscription?.trialEnd ? (
                <span className="text-sm text-muted-foreground">Trial ends {formatDate(organization.subscription.trialEnd)}</span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-sm">Servers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {organization?.servers.length ? organization.servers.map((server) => (
              <div key={server.id} className="flex items-center justify-between rounded-md border border-border/80 px-3 py-2">
                <span className="text-sm font-medium">{server.name}</span>
                <StatusBadge status={statusFor(server.status)} label={server.status.toLowerCase()} />
              </div>
            )) : <p className="text-sm text-muted-foreground">No servers yet.</p>}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-sm">Apps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {organization?.apps.length ? organization.apps.map((app) => (
              <div key={app.id} className="flex items-center justify-between rounded-md border border-border/80 px-3 py-2">
                <span className="text-sm font-medium">{app.name}</span>
                <StatusBadge status={statusFor(app.healthStatus)} label={app.healthStatus.toLowerCase()} />
              </div>
            )) : <p className="text-sm text-muted-foreground">No apps yet.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg py-0">
        <CardHeader className="border-b border-border/80 px-4 py-3">
          <CardTitle className="text-sm">Recent Deployments</CardTitle>
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
              {deployments.map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell>{deployment.appName}</TableCell>
                  <TableCell><StatusBadge status={statusFor(deployment.status)} label={deployment.status.toLowerCase()} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatRelativeTime(deployment.startedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  const users = useQuery({
    queryKey: ["admin", "users", { page, pageSize, search, plan, sortBy, sortOrder }],
    queryFn: () => api.get<AdminUserListResponse>(buildQuery("/admin/users", {
      page,
      pageSize,
      search,
      plan: plan === "all" ? undefined : plan,
      sortBy,
      sortOrder,
    })),
  });

  const detail = useQuery({
    queryKey: ["admin", "users", selectedUserId],
    queryFn: () => api.get<AdminUserDetailResponse>(`/admin/users/${selectedUserId}`),
    enabled: Boolean(selectedUserId),
  });

  const suspendUser = useMutation({
    mutationFn: (userId: string) => api.post<{ success: boolean }>(`/admin/users/${userId}/suspend`, {
      reason: "Suspended by platform admin from user detail drawer.",
    }),
    onSuccess: async () => {
      toast.success("User suspended");
      setConfirmSuspend(false);
      await Promise.all([users.refetch(), detail.refetch()]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to suspend user");
    },
  });

  const columns = useMemo<ColumnDef<AdminUser>[]>(() => [
    {
      header: "User",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8 border border-border/80">
            <AvatarFallback>{initials(row.original.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    { header: "Email", accessorKey: "email" },
    { header: "Org", accessorFn: (row) => row.organization?.name ?? "No org" },
    {
      header: "Plan",
      accessorKey: "plan",
      cell: ({ row }) => <Badge variant="secondary">{row.original.plan}</Badge>,
    },
    {
      header: "Trial",
      accessorKey: "trialEnd",
      cell: ({ row }) => <TrialBadge user={row.original} />,
    },
    { header: "Servers", accessorKey: "serverCount" },
    { header: "Apps", accessorKey: "appCount" },
    {
      header: "Last Active",
      accessorKey: "lastActiveAt",
      cell: ({ row }) => row.original.lastActiveAt ? formatRelativeTime(row.original.lastActiveAt) : "Never",
    },
    {
      header: "Risk",
      accessorKey: "riskLevel",
      cell: ({ row }) => <StatusBadge status={riskStatus(row.original.riskLevel)} label={row.original.riskLevel} />,
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Open user"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedUserId(row.original.id);
          }}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      ),
    },
  ], []);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="dashboard-section-label">P0 Users</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">User management</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={plan} onValueChange={(value) => { setPage(1); setPlan(value); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => { setPage(1); setSortBy(value); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Created</SelectItem>
              <SelectItem value="lastActiveAt">Last active</SelectItem>
              <SelectItem value="serverCount">Servers</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={(value) => { setPage(1); setSortOrder(value as "asc" | "desc"); }}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Desc</SelectItem>
              <SelectItem value="asc">Asc</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users.data?.users ?? []}
        pagination={users.data?.pagination ?? { page, pageSize, total: 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        searchPlaceholder="Search users, email, or org..."
        onSearch={(query) => { setPage(1); setSearch(query); }}
        isLoading={users.isLoading}
        emptyMessage="No beta users match this filter."
        onRowClick={(user) => setSelectedUserId(user.id)}
      />

      <DetailDrawer
        open={Boolean(selectedUserId)}
        onClose={() => {
          setConfirmSuspend(false);
          setSelectedUserId(null);
        }}
        title={detail.data?.user.name ?? "User details"}
        subtitle={detail.data?.user.email}
        width="lg"
      >
        {detail.isLoading ? (
          <EmptyState icon={UserCircle} title="Loading detail" description="Fetching organization, apps, servers, and deployments." />
        ) : (
          <div className="space-y-5">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!detail.data?.user || detail.data.user.status === "suspended"}
                onClick={() => setConfirmSuspend(true)}
              >
                {detail.data?.user.status === "suspended" ? "Suspended" : "Suspend User"}
              </Button>
            </div>
            <UserDetail detail={detail.data} />
          </div>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={confirmSuspend}
        onCancel={() => setConfirmSuspend(false)}
        onConfirm={() => selectedUserId && suspendUser.mutate(selectedUserId)}
        title="Suspend user"
        description="This disables the user account status and writes an admin audit log. Existing infrastructure is not deleted."
        variant="danger"
        confirmText={detail.data?.user.email ?? "SUSPEND"}
        isLoading={suspendUser.isPending}
      />
    </div>
  );
}
