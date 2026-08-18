"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, HardDrive, Loader2, Settings, ShieldAlert, ShieldCheck, Users, XCircle } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, type AgentReleaseStorageInput, type AgentReleaseStorageProvider } from "@/lib/api";

const storageProviderOptions: { value: AgentReleaseStorageProvider; label: string; needsEndpoint: boolean }[] = [
  { value: "cloudflare_r2", label: "Cloudflare R2", needsEndpoint: true },
  { value: "aws_s3", label: "Amazon S3", needsEndpoint: false },
  { value: "s3_compatible", label: "S3-compatible (MinIO, Backblaze, etc.)", needsEndpoint: true },
];

function AgentReleaseStorageCard() {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<AgentReleaseStorageProvider>("cloudflare_r2");
  const [bucket, setBucket] = useState("");
  const [region, setRegion] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const providerMeta = storageProviderOptions.find((option) => option.value === provider) || storageProviderOptions[0];

  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "agentReleaseStorage"],
    queryFn: () => api.getAgentReleaseStorage(),
  });

  const currentInput = (): AgentReleaseStorageInput => ({
    provider,
    bucket: bucket.trim(),
    region: region.trim() || undefined,
    endpoint: providerMeta.needsEndpoint ? endpoint.trim() : undefined,
    accessKeyId: accessKeyId.trim(),
    secretAccessKey,
  });

  function invalidatePriorTest() {
    setTestResult(null);
  }

  const testMutation = useMutation({
    mutationFn: () => api.testAgentReleaseStorage(currentInput()),
    onSuccess: (result) => {
      setTestResult(result);
      if (result.success) {
        toast.success("Bucket is reachable and writable");
      } else {
        toast.error(result.message);
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not test the connection";
      setTestResult({ success: false, message });
      toast.error(message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => api.saveAgentReleaseStorage(currentInput()),
    onSuccess: () => {
      toast.success("Agent release storage connected");
      setAccessKeyId("");
      setSecretAccessKey("");
      setTestResult(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "agentReleaseStorage"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save agent release storage");
    },
  });

  const canSubmit =
    bucket.trim().length > 0 &&
    accessKeyId.trim().length > 0 &&
    secretAccessKey.length > 0 &&
    (!providerMeta.needsEndpoint || endpoint.trim().length > 0);

  return (
    <Card className="rounded-lg py-0">
      <CardHeader className="border-b border-border/80 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <HardDrive className="size-4 text-muted-foreground" />
            Agent release storage
          </CardTitle>
          {!isLoading && (
            <Badge variant={status?.configured ? "default" : "secondary"}>
              {status?.configured ? "Connected" : "Not connected"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4">
        <p className="text-xs text-muted-foreground">
          Uploaded opslin-agent binaries are stored here — an R2/S3 bucket, tested live before it&apos;s ever saved.
          Configured here instead of a .env var so a broken bucket is caught immediately, not discovered mid-rollout.
        </p>

        {status?.configured && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Provider</p>
              <p className="mt-1 font-medium text-foreground">
                {storageProviderOptions.find((option) => option.value === status.provider)?.label || status.provider}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Bucket</p>
              <p className="mt-1 truncate font-medium text-foreground">{status.bucket}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(value) => {
                setProvider(value as AgentReleaseStorageProvider);
                invalidatePriorTest();
              }}
            >
              <SelectTrigger className="h-9 border-border/60 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {storageProviderOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-release-bucket">Bucket name</Label>
            <Input
              id="agent-release-bucket"
              value={bucket}
              onChange={(event) => { setBucket(event.target.value); invalidatePriorTest(); }}
              placeholder="opslin-agent-releases"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {providerMeta.needsEndpoint ? (
            <div className="space-y-2">
              <Label htmlFor="agent-release-endpoint">Endpoint URL</Label>
              <Input
                id="agent-release-endpoint"
                value={endpoint}
                onChange={(event) => { setEndpoint(event.target.value); invalidatePriorTest(); }}
                placeholder={provider === "cloudflare_r2" ? "https://<account-id>.r2.cloudflarestorage.com" : "https://your-storage-host:9000"}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="agent-release-region">Region</Label>
              <Input
                id="agent-release-region"
                value={region}
                onChange={(event) => { setRegion(event.target.value); invalidatePriorTest(); }}
                placeholder="ap-south-1"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="agent-release-access-key">Access key ID</Label>
            <Input
              id="agent-release-access-key"
              value={accessKeyId}
              onChange={(event) => { setAccessKeyId(event.target.value); invalidatePriorTest(); }}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="agent-release-secret-key">Secret access key</Label>
          <Input
            id="agent-release-secret-key"
            type="password"
            value={secretAccessKey}
            onChange={(event) => { setSecretAccessKey(event.target.value); invalidatePriorTest(); }}
            autoComplete="off"
          />
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
              testResult.success
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {testResult.success ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={!canSubmit || testMutation.isPending}
            className="w-full sm:w-fit"
          >
            {testMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ShieldAlert className="mr-2 size-4" />}
            Test connection
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSubmit || !testResult?.success || saveMutation.isPending}
            className="w-full sm:w-fit"
          >
            {saveMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
        {canSubmit && !testResult?.success && (
          <p className="text-xs text-muted-foreground">Run a successful test first — a broken credential is never saved.</p>
        )}
      </CardContent>
    </Card>
  );
}

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

      <AgentReleaseStorageCard />

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
