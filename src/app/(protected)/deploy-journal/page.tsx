"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, ScrollText } from "lucide-react";

import { DataTable } from "@/components/admin/data-table";
import { DetailDrawer } from "@/components/admin/detail-drawer";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge, type BadgeStatus } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { downloadJournal } from "@/lib/journal-download";
import { formatRelativeTime } from "@/lib/utils";

// The permanent deploy journal (API: lib/deploy-journal.ts). Append-only: nothing here is ever deleted, also when the app was.

type JournalRun = {
  runKey: string; startedAt: string; lastAt: string; gitUrl: string | null; repo: string | null; appName: string | null;
  organizationId: string | null; userId: string | null; events: number; aiCalls: number; aiProblems: number;
  appDeleted: boolean; status: string | null; lastKind: string;
};
type RunsResponse = { page: number; pageSize: number; total: number; runs: JournalRun[] };
type JournalEvent = {
  id: string; seq: string; runKey: string; kind: string; stage: string | null; attempt: number | null; appId: string | null; appName: string | null;
  gitUrl: string | null; userId: string | null; payload: Record<string, unknown>; createdAt: string;
};
type AuditEntry = { id: string; event: string; actorId: string | null; targetId: string | null; createdAt: string };
type RunResponse = { runKey: string; events: JournalEvent[]; audit: AuditEntry[] };

function statusBadge(status: string | null): BadgeStatus {
  if (status === "SUCCEEDED") return "ok";
  if (status === "FAILED" || status === "ABORTED") return "error";
  return "info";
}

function Pre({ text, max = 320 }: { text: string; max?: number }) {
  return <pre className="overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-mono text-xs" style={{ maxHeight: max }}>{text}</pre>;
}
const json = (value: unknown) => JSON.stringify(value, null, 2);
const str = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : json(value));

function EventCard({ event }: { event: JournalEvent }) {
  const p = event.payload;
  const when = new Date(event.createdAt).toLocaleString();
  if (event.kind === "ai_call") {
    const outcome = String(p.outcome ?? "");
    return (
      <Card className="rounded-lg">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={outcome === "answered" ? "ok" : "error"} label={`AI call · ${event.stage ?? ""} · ${outcome}`} />
            <span className="text-xs text-muted-foreground">{[str(p.model), p.inputTokens !== undefined ? `${str(p.inputTokens)} in / ${str(p.outputTokens)} out tokens` : null, p.durationMs !== undefined ? `${str(p.durationMs)} ms` : null, p.finishReason ? `finish: ${str(p.finishReason)}` : null, when].filter(Boolean).join(" · ")}</span>
          </div>
          {p.error ? <p className="text-sm text-red-600">Reason: {str(p.error)}</p> : null}
          {p.system ? <details><summary className="cursor-pointer text-sm font-medium">System text</summary><Pre text={str(p.system)} /></details> : null}
          <details><summary className="cursor-pointer text-sm font-medium">What was asked (full prompt)</summary><Pre text={str(p.prompt)} max={480} /></details>
          <details open={outcome === "answered"}><summary className="cursor-pointer text-sm font-medium">What the AI answered (full response)</summary>{p.response ? <Pre text={str(p.response)} max={480} /> : <p className="text-sm text-muted-foreground">No answer came back.</p>}</details>
        </CardContent>
      </Card>
    );
  }
  if (event.kind === "deployment_finished") {
    const cls = (p.classification ?? null) as { title?: string; summary?: string; code?: string } | null;
    return (
      <Card className="rounded-lg">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={statusBadge(str(p.status))} label={`Deployment · ${str(p.status).toLowerCase()}`} />
            <span className="text-xs text-muted-foreground">{event.appName ?? ""} · {str(p.sha).slice(0, 8)} · {when}</span>
          </div>
          {cls?.title ? <p className="text-sm"><span className="font-medium">{cls.title}.</span> {cls.summary}</p> : null}
          {p.healthLog ? <details><summary className="cursor-pointer text-sm font-medium">Full deploy log</summary><Pre text={str(p.healthLog)} max={480} /></details> : null}
        </CardContent>
      </Card>
    );
  }
  if (event.kind === "app_deleted") {
    const deployments = Array.isArray(p.deployments) ? p.deployments : [];
    return (
      <Card className="rounded-lg border-amber-300">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="warning" label="App deleted" />
            <span className="text-xs text-muted-foreground">{event.appName ?? ""} · by user {event.userId ?? "unknown"} · {when} · {deployments.length} deployment(s) kept</span>
          </div>
          <details><summary className="cursor-pointer text-sm font-medium">Everything kept from the app</summary><Pre text={json(p)} max={480} /></details>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="rounded-lg">
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="info" label={event.kind.replace(/_/g, " ")} />
          <span className="text-xs text-muted-foreground">{when}</span>
        </div>
        <details><summary className="cursor-pointer text-sm font-medium">Details</summary><Pre text={json(p)} max={480} /></details>
      </CardContent>
    </Card>
  );
}

function RunDrawer({ runKey }: { runKey: string }) {
  const run = useQuery({ queryKey: ["admin", "deploy-journal", "run", runKey], queryFn: () => api.get<RunResponse>(`/admin/deploy-journal/runs/${encodeURIComponent(runKey)}`) });
  if (run.isLoading) return <p className="text-sm text-muted-foreground">Loading the journal…</p>;
  if (run.isError || !run.data) return <EmptyState icon={ScrollText} title="Journal unavailable" description="This run could not be loaded." />;
  return (
    <div className="space-y-4">
      {run.data.events.map((event) => <EventCard key={event.id} event={event} />)}
      {run.data.audit.length > 0 ? (
        <Card className="rounded-lg">
          <CardContent className="space-y-2 p-4">
            <p className="dashboard-section-label">What users did</p>
            {run.data.audit.map((entry) => (
              <p key={entry.id} className="text-sm"><span className="font-mono">{entry.event}</span> <span className="text-xs text-muted-foreground">by {entry.actorId ?? "system"} · {new Date(entry.createdAt).toLocaleString()}</span></p>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function DeployJournalPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [selected, setSelected] = useState<JournalRun | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [latestCount, setLatestCount] = useState("5");
  const [onlyAi, setOnlyAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const runs = useQuery({
    queryKey: ["admin", "deploy-journal", "runs", { page, pageSize, search, problemsOnly }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), problemsOnly: String(problemsOnly) });
      if (search.trim()) params.set("search", search.trim());
      return api.get<RunsResponse>(`/admin/deploy-journal/runs?${params.toString()}`);
    },
  });

  async function download(options: Parameters<typeof downloadJournal>[0]) {
    setBusy(true);
    setMessage(null);
    try {
      const count = await downloadJournal({ ...options, kind: onlyAi ? "ai_call" : undefined });
      setMessage(`Downloaded ${count} journal event${count === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The download failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(runKey: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(runKey)) next.delete(runKey); else next.add(runKey);
      return next;
    });
  }

  const columns = useMemo<ColumnDef<JournalRun>[]>(() => [
    {
      header: "", id: "select",
      cell: ({ row }) => (
        <input type="checkbox" aria-label={`Select ${row.original.repo ?? row.original.runKey}`} checked={chosen.has(row.original.runKey)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(row.original.runKey)} />
      ),
    },
    { header: "Repository", accessorKey: "repo", cell: ({ row }) => <span className="font-medium">{row.original.repo ?? <span className="text-muted-foreground">not recorded</span>}</span> },
    {
      header: "App", accessorKey: "appName",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">{row.original.appName ?? "-"}{row.original.appDeleted ? <StatusBadge status="warning" label="deleted" /> : null}</span>
      ),
    },
    { header: "Result", accessorKey: "status", cell: ({ row }) => row.original.status ? <StatusBadge status={statusBadge(row.original.status)} label={row.original.status.toLowerCase()} /> : <span className="text-muted-foreground">{row.original.lastKind.replace(/_/g, " ")}</span> },
    { header: "AI calls", accessorKey: "aiCalls", cell: ({ row }) => <span>{row.original.aiCalls}{row.original.aiProblems > 0 ? <span className="text-red-600"> ({row.original.aiProblems} problem)</span> : null}</span> },
    { header: "Events", accessorKey: "events" },
    { header: "When", accessorKey: "lastAt", cell: ({ row }) => formatRelativeTime(row.original.lastAt) },
    { header: "", id: "open", cell: ({ row }) => <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(row.original); }}>Open</Button> },
  ], [chosen]);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">Deploy journal</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Every deploy, kept forever</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every run with what the AI was asked and answered, every repair attempt and its reason, and what happened to the app, also after it is deleted. Nothing here can be changed or removed.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input className="w-full max-w-sm" placeholder="Search repository, app or run id" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={problemsOnly} onChange={(e) => { setPage(1); setProblemsOnly(e.target.checked); }} /> Problems only</label>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
          <span className="text-sm font-medium">Download</span>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyAi} onChange={(e) => setOnlyAi(e.target.checked)} /> AI calls only</label>
          <Button type="button" variant="outline" size="sm" disabled={busy || chosen.size === 0} onClick={() => void download({ runKeys: [...chosen] })}>
            <Download className="mr-2 size-4" />Selected runs ({chosen.size})
          </Button>
          <span className="flex items-center gap-2 text-sm">
            <Button type="button" variant="outline" size="sm" disabled={busy || !(Number(latestCount) > 0)} onClick={() => void download({ latestRuns: Math.min(500, Math.floor(Number(latestCount))) })}>
              <Download className="mr-2 size-4" />Latest
            </Button>
            <Input aria-label="How many of the latest runs" className="h-8 w-16" inputMode="numeric" value={latestCount} onChange={(e) => setLatestCount(e.target.value.replace(/[^0-9]/g, ""))} />
            runs
          </span>
          <Button type="button" variant="ghost" size="sm" disabled={chosen.size === 0} onClick={() => setChosen(new Set())}>Clear selection</Button>
          {message ? <span className="text-sm text-muted-foreground" role="status">{message}</span> : null}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={runs.data?.runs ?? []}
        pagination={{ page, pageSize, total: runs.data?.total ?? 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
        isLoading={runs.isLoading}
        emptyMessage="No journal entries yet. They appear with the next deploy."
        onRowClick={(run) => setSelected(run)}
      />

      <DetailDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.repo ?? selected?.appName ?? "Run"} subtitle={selected ? `${selected.runKey}` : undefined} width="lg">
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void download({ runKeys: [selected.runKey] })}><Download className="mr-2 size-4" />Download this run</Button>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyAi} onChange={(e) => setOnlyAi(e.target.checked)} /> AI calls only</label>
              {message ? <span className="text-sm text-muted-foreground" role="status">{message}</span> : null}
            </div>
            <RunDrawer runKey={selected.runKey} />
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
