"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Settings, ShieldCheck, Users } from "lucide-react";

import { DataTable } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  status: string;
  platformRole?: string | null;
  orgRole?: string | null;
  emailVerified?: boolean;
};

type AdminUserResponse = {
  users: AdminUser[];
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

export default function AdminSettingsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const adminUsers = useQuery({
    queryKey: ["admin", "settings", "users", { page, pageSize }],
    queryFn: () => api.get<AdminUserResponse>(buildQuery("/admin/users", {
      page,
      pageSize,
      sortBy: "createdAt",
      sortOrder: "desc",
    })),
  });

  const columns = useMemo<ColumnDef<AdminUser>[]>(() => [
    {
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    { header: "Email", accessorKey: "email" },
    {
      header: "Role",
      accessorKey: "platformRole",
      cell: ({ row }) => <Badge variant="secondary">{row.original.platformRole ?? row.original.orgRole ?? "Platform admin"}</Badge>,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status === "suspended" ? "error" : "ok"} label={row.original.status ?? "active"} />,
    },
  ], []);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">Governance</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Admin settings</h1>
      </div>

      <Card className="rounded-lg py-0">
        <CardHeader className="border-b border-border/80 px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-muted-foreground" />
            Platform feature flags
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-secondary/20 p-4">
            <div>
              <Label htmlFor="admin-settings-safe-deploy" className="text-sm font-medium">Global Safe Deploy</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Not available yet — Safe Deploy is currently an org-level toggle (Organizations page), not a global kill switch.
              </p>
            </div>
            <Switch id="admin-settings-safe-deploy" checked={false} disabled />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-secondary/20 p-4">
            <div>
              <Label htmlFor="admin-settings-maintenance" className="text-sm font-medium">Maintenance mode</Label>
              <p className="mt-1 text-xs text-muted-foreground">Not available yet — no backend endpoint exists for this yet.</p>
            </div>
            <Switch id="admin-settings-maintenance" checked={false} disabled />
          </div>
        </CardContent>
      </Card>

      {adminUsers.isError ? (
        <EmptyState icon={Settings} title="Admin users unavailable" description="The admin users endpoint failed to respond." />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Admin users</h2>
        </div>
        <DataTable
          idPrefix="admin-settings-users-table"
          columns={columns}
          data={adminUsers.data?.users ?? []}
          pagination={adminUsers.data?.pagination ?? { page, pageSize, total: 0 }}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
          isLoading={adminUsers.isLoading}
          emptyMessage="No admin users found."
        />
      </section>
    </div>
  );
}
