"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Download, Loader2, PackageCheck, RotateCcw, Rocket, UploadCloud, XCircle } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable } from "@/components/admin/data-table";
import { DetailDrawer } from "@/components/admin/detail-drawer";
import { EmptyState } from "@/components/admin/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type AgentRelease } from "@/lib/api";

function formatBytes(bytes: number) {
  const mb = bytes / 1024 ** 2;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${Math.max(1, Math.round(mb))}MB`;
}

function FailureRateBadge({ releaseId, hasArtifacts }: { releaseId: string; hasArtifacts: boolean }) {
  const { data } = useQuery({
    queryKey: ["admin", "agentReleaseErrorRate", releaseId],
    queryFn: () => api.getAgentReleaseErrorRate(releaseId),
    enabled: hasArtifacts,
    staleTime: 30_000,
  });

  if (!hasArtifacts || !data || data.totalUpdateAttempts === 0) {
    return <span className="text-xs text-muted-foreground">No update attempts yet</span>;
  }

  const percent = Math.round((data.updateFailureRate ?? 0) * 1000) / 10;
  const tone = percent >= 20 ? "text-destructive" : percent > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
  return (
    <span className={`text-sm font-medium ${tone}`} title="Share of AGENT_UPDATE jobs that failed to install this version — not a general crash/error rate">
      {percent}% update failure ({data.totalUpdateAttempts} attempt{data.totalUpdateAttempts === 1 ? "" : "s"})
    </span>
  );
}

const ARTIFACT_CHUNK_SIZE = 5 * 1024 * 1024;
const ARTIFACT_SLOTS: { os: "linux" | "darwin"; arch: "amd64" | "arm64"; label: string }[] = [
  { os: "linux", arch: "amd64", label: "linux-amd64" },
  { os: "linux", arch: "arm64", label: "linux-arm64" },
  { os: "darwin", arch: "amd64", label: "darwin-amd64" },
  { os: "darwin", arch: "arm64", label: "darwin-arm64" },
];

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((v) => v.toString(16).padStart(2, "0")).join("");
}

async function uploadArtifact(
  releaseId: string,
  os: string,
  arch: string,
  file: File,
  onProgress: (percent: number) => void
) {
  const bytes = await file.arrayBuffer();
  const sha256 = await sha256Hex(bytes);

  const session = await api.initAgentReleaseArtifactUpload(releaseId, os, arch, {
    filename: file.name,
    uploadLength: file.size,
    sha256,
  });

  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + ARTIFACT_CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, end);
    const result = await api.uploadAgentReleaseArtifactChunk(session.uploadUrl, file.size, offset, chunk);
    offset = result.uploadOffset || end;
    onProgress(Math.round((offset / file.size) * 100));
  }
}

function StatusPill({ status }: { status: string }) {
  const tone: Record<string, "default" | "secondary" | "destructive"> = {
    rolled_out: "default",
    uploaded: "secondary",
    rolled_back: "destructive",
    smoke_testing: "secondary",
    smoke_passed: "default",
    smoke_failed: "destructive",
    // AgentReleaseSmokeTest's own status values (distinct from the release-
    // level "smoke_*" ones above, no naming collision).
    pending: "secondary",
    running: "secondary",
    passed: "default",
    failed: "destructive",
    timed_out: "destructive",
    error: "destructive",
  };
  return <Badge variant={tone[status] || "secondary"}>{status.replace(/_/g, " ")}</Badge>;
}

export default function AgentReleasesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [createOpen, setCreateOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [uploadingReleaseId, setUploadingReleaseId] = useState<string | null>(null);
  const [artifactProgress, setArtifactProgress] = useState<Record<string, number | "done" | "error">>({});
  const [rolloutTarget, setRolloutTarget] = useState<AgentRelease | null>(null);
  const [activeRolloutId, setActiveRolloutId] = useState<string | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<AgentRelease | null>(null);
  const [rollbackToVersion, setRollbackToVersion] = useState("");
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);

  const releasesQuery = useQuery({
    queryKey: ["admin", "agentReleases", { page, pageSize }],
    queryFn: () => api.getAgentReleases({ page, pageSize }),
    refetchInterval: 60_000,
  });

  const releaseDetailQuery = useQuery({
    queryKey: ["admin", "agentReleaseDetail", selectedReleaseId],
    queryFn: () => api.getAgentReleaseDetail(selectedReleaseId!),
    enabled: Boolean(selectedReleaseId),
  });

  const rolloutProgressQuery = useQuery({
    queryKey: ["admin", "agentReleaseRollout", rolloutTarget?.id, activeRolloutId],
    queryFn: () => api.getAgentReleaseRollout(rolloutTarget!.id, activeRolloutId!),
    enabled: Boolean(rolloutTarget && activeRolloutId),
    refetchInterval: 5_000,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createAgentRelease({ version: version.trim() }),
    onSuccess: (release) => {
      toast.success(`Release ${release.version} created — upload artifacts next`);
      setCreateOpen(false);
      setVersion("");
      setUploadingReleaseId(release.id);
      setArtifactProgress({});
      queryClient.invalidateQueries({ queryKey: ["admin", "agentReleases"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to create release");
    },
  });

  const rolloutMutation = useMutation({
    mutationFn: (releaseId: string) => api.rolloutAgentRelease(releaseId),
    onSuccess: (result) => {
      toast.success(`Rollout started — ${result.totalTargeted} server(s) targeted, ${result.skippedCount} skipped`);
      setActiveRolloutId(result.rolloutId);
      queryClient.invalidateQueries({ queryKey: ["admin", "agentReleases"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to start rollout");
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: () => api.rollbackAgentRelease(rollbackTarget!.id, rollbackToVersion),
    onSuccess: (result) => {
      toast.success(`Rolled back to ${rollbackToVersion} — ${result.totalTargeted} server(s) targeted, ${result.skippedCount} skipped`);
      setRollbackTarget(null);
      setRollbackConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "agentReleases"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to roll back");
    },
  });

  async function handleArtifactFile(releaseId: string, os: string, arch: string, file: File) {
    const key = `${os}-${arch}`;
    setArtifactProgress((prev) => ({ ...prev, [key]: 0 }));
    try {
      await uploadArtifact(releaseId, os, arch, file, (percent) => {
        setArtifactProgress((prev) => ({ ...prev, [key]: percent }));
      });
      setArtifactProgress((prev) => ({ ...prev, [key]: "done" }));
      toast.success(`${key} uploaded`);
      queryClient.invalidateQueries({ queryKey: ["admin", "agentReleases"] });
    } catch (error) {
      setArtifactProgress((prev) => ({ ...prev, [key]: "error" }));
      toast.error(error instanceof Error ? error.message : `Failed to upload ${key}`);
    }
  }

  const releases = releasesQuery.data?.releases ?? [];
  const latestRolledOut = releases.find((release) => release.status === "rolled_out");

  const columns = useMemo<ColumnDef<AgentRelease>[]>(() => [
    {
      header: "Version",
      accessorKey: "version",
      cell: ({ row }) => <span className="font-medium">{row.original.version}</span>,
    },
    { header: "Channel", accessorKey: "channel" },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusPill status={row.original.status} />,
    },
    {
      header: "Artifacts",
      id: "artifacts",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.artifacts.length}/4 uploaded</span>
      ),
    },
    {
      header: "Servers on version",
      accessorKey: "serversOnVersion",
      cell: ({ row }) => <span className="text-sm">{row.original.serversOnVersion}</span>,
    },
    {
      header: "Update failures",
      id: "errorRate",
      cell: ({ row }) => <FailureRateBadge releaseId={row.original.id} hasArtifacts={row.original.artifacts.length > 0} />,
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.status === "rolled_out" ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={(event) => {
                event.stopPropagation();
                setRollbackTarget(row.original);
                setRollbackToVersion("");
              }}
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              Roll back
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setUploadingReleaseId(row.original.id);
              setArtifactProgress({});
            }}
          >
            <UploadCloud className="mr-1.5 size-3.5" />
            Upload
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={row.original.artifacts.length === 0 || row.original.status !== "smoke_passed"}
            title={
              row.original.artifacts.length === 0
                ? "Upload artifacts first"
                : row.original.status !== "smoke_passed"
                  ? `Blocked until the pre-rollout smoke test passes (current status: ${row.original.status.replace(/_/g, " ")})`
                  : undefined
            }
            onClick={(event) => {
              event.stopPropagation();
              setRolloutTarget(row.original);
              setActiveRolloutId(null);
            }}
          >
            <Rocket className="mr-1.5 size-3.5" />
            Roll out
          </Button>
        </div>
      ),
    },
  ], []);

  const uploadingRelease = releases.find((release) => release.id === uploadingReleaseId);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="dashboard-section-label">Operate</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Agent Releases</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PackageCheck className="mr-2 size-4" />
          New release
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Releases" value={releasesQuery.data?.total ?? 0} icon={PackageCheck} />
        <StatCard label="Latest rolled out" value={latestRolledOut?.version ?? "—"} icon={Rocket} status="info" />
        <StatCard
          label="Rollout in progress"
          value={rolloutMutation.isPending ? "Yes" : "No"}
          icon={UploadCloud}
          status={rolloutMutation.isPending ? "warning" : "ok"}
        />
      </div>

      {releasesQuery.isError ? (
        <EmptyState icon={PackageCheck} title="Agent releases unavailable" description="The agent releases endpoint failed to respond." />
      ) : null}

      <DataTable
        idPrefix="admin-agent-releases-table"
        columns={columns}
        data={releases}
        pagination={releasesQuery.data ? { page: releasesQuery.data.page, pageSize: releasesQuery.data.pageSize, total: releasesQuery.data.total } : { page, pageSize, total: 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        isLoading={releasesQuery.isLoading}
        emptyMessage="No agent releases yet — create one to upload a build."
        onRowClick={(release) => setSelectedReleaseId(release.id)}
      />

      {/* Create release */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New agent release</DialogTitle>
            <DialogDescription>Creates a draft release. Upload the 4 platform binaries next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="agent-release-version">Version</Label>
            <Input
              id="agent-release-version"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder="2.5.0"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!/^\d+\.\d+\.\d+$/.test(version.trim()) || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload artifacts */}
      <Dialog open={Boolean(uploadingReleaseId)} onOpenChange={(open) => { if (!open) setUploadingReleaseId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload artifacts{uploadingRelease ? ` — ${uploadingRelease.version}` : ""}</DialogTitle>
            <DialogDescription>One binary per OS/architecture. SHA-256 is verified on completion.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {ARTIFACT_SLOTS.map((slot) => {
              const key = `${slot.os}-${slot.arch}`;
              const progress = artifactProgress[key];
              const alreadyUploaded = uploadingRelease?.artifacts.some((artifact) => artifact.os === slot.os && artifact.arch === slot.arch);
              return (
                <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{slot.label}</span>
                    {alreadyUploaded && progress === undefined ? <CheckCircle2 className="size-4 text-emerald-500" /> : null}
                    {progress === "done" ? <CheckCircle2 className="size-4 text-emerald-500" /> : null}
                    {progress === "error" ? <XCircle className="size-4 text-destructive" /> : null}
                    {typeof progress === "number" ? <span className="text-xs text-muted-foreground">{progress}%</span> : null}
                  </div>
                  <Input
                    type="file"
                    className="max-w-[220px]"
                    disabled={typeof progress === "number"}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file && uploadingReleaseId) {
                        void handleArtifactFile(uploadingReleaseId, slot.os, slot.arch, file);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setUploadingReleaseId(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollout confirm + progress */}
      <ConfirmDialog
        open={Boolean(rolloutTarget) && !activeRolloutId}
        onCancel={() => setRolloutTarget(null)}
        onConfirm={() => rolloutTarget && rolloutMutation.mutate(rolloutTarget.id)}
        title={`Roll out ${rolloutTarget?.version ?? ""} to the fleet`}
        description="This immediately pushes this version to every eligible connected server. Servers below the minimum self-update version, or with no matching OS/arch artifact, are skipped and reported separately."
        confirmText="ROLL OUT"
        variant="danger"
        isLoading={rolloutMutation.isPending}
        idPrefix="admin-agent-release-rollout-confirm"
      />

      <Dialog open={Boolean(rolloutTarget && activeRolloutId)} onOpenChange={(open) => { if (!open) { setRolloutTarget(null); setActiveRolloutId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollout progress — {rolloutTarget?.version}</DialogTitle>
            <DialogDescription>
              {rolloutProgressQuery.data
                ? `${rolloutProgressQuery.data.totalTargeted} targeted, ${rolloutProgressQuery.data.skippedCount} skipped`
                : "Loading…"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {rolloutProgressQuery.data ? (
              Object.entries(rolloutProgressQuery.data.counts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm">
                  <span className="font-mono">{status}</span>
                  <span>{count}</span>
                </div>
              ))
            ) : (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => { setRolloutTarget(null); setActiveRolloutId(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback: pick target version, then a typed-confirm gate before it actually fires */}
      <Dialog open={Boolean(rollbackTarget) && !rollbackConfirmOpen} onOpenChange={(open) => { if (!open) setRollbackTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roll back {rollbackTarget?.version}</DialogTitle>
            <DialogDescription>
              Only servers currently running {rollbackTarget?.version} are targeted — servers on other versions are left alone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Roll back to</Label>
            <Select value={rollbackToVersion} onValueChange={setRollbackToVersion}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a previous version" />
              </SelectTrigger>
              <SelectContent>
                {releases
                  .filter((release) => release.id !== rollbackTarget?.id && release.artifacts.length > 0)
                  .map((release) => (
                    <SelectItem key={release.id} value={release.version}>{release.version}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {releases.filter((release) => release.id !== rollbackTarget?.id && release.artifacts.length > 0).length === 0 ? (
              <p className="text-xs text-muted-foreground">No other release with uploaded artifacts is available to roll back to yet.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)}>Cancel</Button>
            <Button
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              disabled={!rollbackToVersion}
              onClick={() => setRollbackConfirmOpen(true)}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={rollbackConfirmOpen}
        onCancel={() => setRollbackConfirmOpen(false)}
        onConfirm={() => rollbackMutation.mutate()}
        title={`Roll back ${rollbackTarget?.version} to ${rollbackToVersion}`}
        description={`Every connected server currently on ${rollbackTarget?.version} will be pushed to ${rollbackToVersion} immediately.`}
        confirmText="ROLL BACK"
        variant="danger"
        isLoading={rollbackMutation.isPending}
        idPrefix="admin-agent-release-rollback-confirm"
      />

      {/* Release detail: artifacts (with download) + rollout/rollback history */}
      <DetailDrawer
        open={Boolean(selectedReleaseId)}
        onClose={() => setSelectedReleaseId(null)}
        title={releaseDetailQuery.data ? `Release ${releaseDetailQuery.data.version}` : "Release details"}
        subtitle={releaseDetailQuery.data ? releaseDetailQuery.data.status.replace(/_/g, " ") : undefined}
        width="lg"
      >
        {releaseDetailQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : releaseDetailQuery.isError ? (
          <EmptyState icon={PackageCheck} title="Couldn't load this release" description="Try closing and reopening the drawer." />
        ) : releaseDetailQuery.data ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="artifacts">Artifacts ({releaseDetailQuery.data.artifacts.length})</TabsTrigger>
              <TabsTrigger value="history">History ({releaseDetailQuery.data.rollouts.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Channel</p>
                  <p className="font-medium">{releaseDetailQuery.data.channel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Criticality</p>
                  <p className="font-medium">{releaseDetailQuery.data.criticality}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Commit</p>
                  <p className="font-mono text-xs">{releaseDetailQuery.data.commit || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Uploaded</p>
                  <p className="font-medium">{new Date(releaseDetailQuery.data.uploadedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rolled out</p>
                  <p className="font-medium">{releaseDetailQuery.data.rolledOutAt ? new Date(releaseDetailQuery.data.rolledOutAt).toLocaleString() : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Update failure rate</p>
                  <p className="font-medium">
                    {releaseDetailQuery.data.errorRate.totalUpdateAttempts === 0
                      ? "No update attempts yet"
                      : `${Math.round((releaseDetailQuery.data.errorRate.updateFailureRate ?? 0) * 1000) / 10}% (${releaseDetailQuery.data.errorRate.totalUpdateAttempts} attempts)`}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 p-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pre-rollout smoke test</p>
                {releaseDetailQuery.data.smokeTests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No smoke test has run yet — only uploading the linux/amd64 artifact triggers one.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={releaseDetailQuery.data.smokeTests[0].status} />
                      <span className="text-xs text-muted-foreground">
                        {releaseDetailQuery.data.smokeTests[0].os}-{releaseDetailQuery.data.smokeTests[0].arch}
                      </span>
                      {releaseDetailQuery.data.smokeTests[0].reportedVersion ? (
                        <span className="text-xs text-muted-foreground">
                          reported version {releaseDetailQuery.data.smokeTests[0].reportedVersion}
                        </span>
                      ) : null}
                    </div>
                    {releaseDetailQuery.data.smokeTests[0].failureReason ? (
                      <p className="mt-1.5 text-xs text-destructive">{releaseDetailQuery.data.smokeTests[0].failureReason}</p>
                    ) : null}
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Started {new Date(releaseDetailQuery.data.smokeTests[0].startedAt).toLocaleString()}
                      {releaseDetailQuery.data.smokeTests[0].completedAt
                        ? ` · completed ${new Date(releaseDetailQuery.data.smokeTests[0].completedAt).toLocaleString()}`
                        : " · in progress"}
                    </p>
                  </>
                )}
              </div>

              {([
                ["Why update", releaseDetailQuery.data.whyUpdate],
                ["Bug fixes", releaseDetailQuery.data.bugFixes],
                ["New functions", releaseDetailQuery.data.newFunctions],
                ["VPS changes", releaseDetailQuery.data.vpsChanges],
                ["Security notes", releaseDetailQuery.data.securityNotes],
              ] as const).map(([label, items]) =>
                items && items.length > 0 ? (
                  <div key={label}>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
                    <ul className="list-inside list-disc space-y-0.5 text-sm">
                      {items.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                  </div>
                ) : null
              )}
            </TabsContent>

            <TabsContent value="artifacts" className="space-y-3 pt-4">
              {releaseDetailQuery.data.artifacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No artifacts uploaded yet.</p>
              ) : (
                releaseDetailQuery.data.artifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-lg border border-border/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm font-medium">{artifact.os}-{artifact.arch}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(
                          api.getAgentReleaseArtifactDownloadUrl(artifact.releaseId, artifact.id),
                          "_blank",
                          "noopener,noreferrer"
                        )}
                      >
                        <Download className="mr-1.5 size-3.5" />
                        Download
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Size: {formatBytes(artifact.sizeBytes)}</span>
                      <span>Uploaded: {new Date(artifact.uploadedAt).toLocaleString()}</span>
                      <span className="col-span-2 truncate font-mono" title={artifact.sha256}>sha256: {artifact.sha256}</span>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-3 pt-4">
              {releaseDetailQuery.data.rollouts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rollouts or rollbacks triggered yet.</p>
              ) : (
                releaseDetailQuery.data.rollouts.map((rollout) => (
                  <div key={rollout.id} className="flex items-center justify-between rounded-lg border border-border/70 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      {rollout.kind === "rollback" ? <RotateCcw className="size-4 text-destructive" /> : <Rocket className="size-4 text-emerald-500" />}
                      <div>
                        <p className="font-medium capitalize">{rollout.kind}</p>
                        <p className="text-xs text-muted-foreground">{new Date(rollout.triggeredAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{rollout.totalTargeted} targeted, {rollout.skippedCount} skipped</p>
                      <p>{rollout.status.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
