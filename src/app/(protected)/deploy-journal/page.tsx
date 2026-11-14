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
  inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; costUsd: number;
  appDeleted: boolean; status: string | null; lastKind: string;
};
type Project = { repo: string; runs: number; liveRuns: number; aiCalls: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; costUsd: number; lastAt: string; appDeleted: boolean };

// The journal's own cost field is empty for this provider, so cost is estimated from the tokens with rates the founder can edit
// (kept in this browser only). inputTokens already contains the cached part; cache writes cost 1.25x, cache reads 0.1x of the input rate.
type Rates = { inUsd: number; outUsd: number; inrPerUsd: number };
const DEFAULT_RATES: Rates = { inUsd: 3, outUsd: 15, inrPerUsd: 88 };
function estimateUsd(t: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; costUsd: number }, r: Rates): number {
  if (t.costUsd > 0) return t.costUsd;
  const fresh = Math.max(0, t.inputTokens - t.cacheReadTokens - t.cacheCreationTokens);
  return ((fresh + t.cacheCreationTokens * 1.25 + t.cacheReadTokens * 0.1) * r.inUsd + t.outputTokens * r.outUsd) / 1_000_000;
}
const inr = (usd: number, r: Rates) => `₹${(usd * r.inrPerUsd).toFixed(usd * r.inrPerUsd < 10 ? 1 : 0)}`;
const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
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
  if (event.kind === "agent_step") {
    return (
      <Card className="rounded-lg">
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.refused || p.ok === false ? "warning" : "info"} label={`Investigation step ${str(p.n)} · ${event.stage ?? ""}`} />
            <span className="text-xs text-muted-foreground">{when}</span>
          </div>
          <p className="text-sm"><span className="font-medium">What the AI thought:</span> {str(p.note)}</p>
          <p className="text-sm"><span className="font-medium">What it did:</span> <span className="font-mono text-xs">{str(p.action)}</span></p>
          {p.refused ? <p className="text-sm text-amber-700">Refused by the rules: {str(p.refused)}</p> : null}
          {p.result ? <details><summary className="cursor-pointer text-sm font-medium">What came back</summary><Pre text={str(p.result)} /></details> : null}
        </CardContent>
      </Card>
    );
  }
  if (event.kind === "agent_plan") {
    const plan = (p.plan ?? {}) as { version?: number; services?: Array<Record<string, unknown>> };
    return (
      <Card className="rounded-lg border-blue-300">
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="info" label={`Recipe version ${str(plan.version)} · ${event.stage ?? ""}`} />
            <span className="text-xs text-muted-foreground">{when} · step {str(p.n)}</span>
          </div>
          {(plan.services ?? []).map((service, i) => (
            <details key={i}>
              <summary className="cursor-pointer text-sm font-medium">Service "{str(service.path) || "."}": settings, checks, memory{service.dockerfile ? ", Dockerfile" : ""}</summary>
              <Pre text={json({ ...service, dockerfile: undefined })} max={360} />
              {service.dockerfile ? <Pre text={str(service.dockerfile)} max={360} /> : null}
            </details>
          ))}
        </CardContent>
      </Card>
    );
  }
  if (event.kind === "agent_exec") {
    return (
      <Card className="rounded-lg">
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.verified === true ? "ok" : p.finished === true ? "error" : "info"} label={`Deploy attempt ${str(p.attempt ?? p.n)} · ${p.started ? "started" : p.verified === true ? "verified" : "did not verify"} · ${event.stage ?? ""}`} />
            <span className="text-xs text-muted-foreground">{when}</span>
          </div>
          {p.evidence ? <details><summary className="cursor-pointer text-sm font-medium">What the check found</summary><Pre text={str(p.evidence)} /></details> : null}
          {p.verification ? <details><summary className="cursor-pointer text-sm font-medium">What was proved and what was not</summary><Pre text={json(p.verification)} /></details> : null}
        </CardContent>
      </Card>
    );
  }
  if (event.kind === "agent_outcome" || event.kind === "agent_question") {
    return (
      <Card className={`rounded-lg ${event.kind === "agent_outcome" ? "border-amber-300" : ""}`}>
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.outcome === "live" ? "ok" : event.kind === "agent_question" ? "warning" : "error"} label={`${event.kind === "agent_outcome" ? `Ended: ${str(p.outcome)}${p.category ? ` (${str(p.category)})` : ""}` : "Asked the owner"} · ${event.stage ?? ""}`} />
            <span className="text-xs text-muted-foreground">{when}</span>
          </div>
          {p.explanation ? <p className="text-sm"><span className="font-medium">Why:</span> {str(p.explanation)}</p> : null}
          {p.nextStep ? <p className="text-sm"><span className="font-medium">Next step it named:</span> {str(p.nextStep)}</p> : null}
          {p.usage ? <p className="text-xs text-muted-foreground">Used {json(p.usage)}</p> : null}
          <details><summary className="cursor-pointer text-sm font-medium">Everything recorded</summary><Pre text={json(p)} max={360} /></details>
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

function RunDrawer({ runKey, run: summary, rates }: { runKey: string; run: JournalRun; rates: Rates }) {
  const run = useQuery({ queryKey: ["admin", "deploy-journal", "run", runKey], queryFn: () => api.get<RunResponse>(`/admin/deploy-journal/runs/${encodeURIComponent(runKey)}`) });
  if (run.isLoading) return <p className="text-sm text-muted-foreground">Loading the journal…</p>;
  if (run.isError || !run.data) return <EmptyState icon={ScrollText} title="Journal unavailable" description="This run could not be loaded." />;
  return (
    <div className="space-y-4">
      <Card className="rounded-lg">
        <CardContent className="space-y-1 p-4 text-sm">
          <p><span className="font-medium">{summary.repo ?? "Repository not recorded"}</span> · {summary.aiCalls} AI calls · {tokens(summary.inputTokens)} tokens read ({tokens(summary.cacheReadTokens)} from cache) · {tokens(summary.outputTokens)} written · about {inr(estimateUsd(summary, rates), rates)}</p>
          <p className="text-xs text-muted-foreground">{summary.appDeleted ? "The user deleted the app; this record stays. " : ""}Result: {summary.status ? summary.status.toLowerCase() : "not recorded"}. Read top to bottom: what Opslin saw, every AI question and answer, each investigation step (what the AI thought and did), each recipe version, each deploy attempt, and how it ended.</p>
        </CardContent>
      </Card>
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
  const [rates, setRates] = useState<Rates>(() => {
    try { const saved = typeof window !== "undefined" ? window.localStorage.getItem("journalRates") : null; return saved ? { ...DEFAULT_RATES, ...JSON.parse(saved) } : DEFAULT_RATES; } catch { return DEFAULT_RATES; }
  });
  const changeRate = (key: keyof Rates, value: string) => {
    const number = Number(value);
    const next = { ...rates, [key]: Number.isFinite(number) && number >= 0 ? number : rates[key] };
    setRates(next);
    try { window.localStorage.setItem("journalRates", JSON.stringify(next)); } catch { /* per-browser convenience only */ }
  };
  const projects = useQuery({ queryKey: ["admin", "deploy-journal", "projects"], queryFn: () => api.get<{ projects: Project[] }>("/admin/deploy-journal/projects") });
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
    { header: "Tokens (in / out)", id: "tokens", cell: ({ row }) => <span>{tokens(row.original.inputTokens)} / {tokens(row.original.outputTokens)}</span> },
    { header: "Cost (about)", id: "cost", cell: ({ row }) => <span>{inr(estimateUsd(row.original, rates), rates)}</span> },
    { header: "Events", accessorKey: "events" },
    { header: "When", accessorKey: "lastAt", cell: ({ row }) => formatRelativeTime(row.original.lastAt) },
    { header: "", id: "open", cell: ({ row }) => <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(row.original); }}>Open</Button> },
  ], [chosen, rates]);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <p className="dashboard-section-label">Deploy journal</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Every deploy, kept forever</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every run with what the AI was asked and answered, every repair attempt and its reason, and what happened to the app, also after it is deleted. Nothing here can be changed or removed.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">By project (repository name)</p>
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Cost is an estimate from tokens. Rates:
            <span className="flex items-center gap-1">$/M in <Input aria-label="Dollars per million input tokens" className="h-7 w-16" inputMode="decimal" defaultValue={rates.inUsd} onBlur={(e) => changeRate("inUsd", e.target.value)} /></span>
            <span className="flex items-center gap-1">$/M out <Input aria-label="Dollars per million output tokens" className="h-7 w-16" inputMode="decimal" defaultValue={rates.outUsd} onBlur={(e) => changeRate("outUsd", e.target.value)} /></span>
            <span className="flex items-center gap-1">₹ per $ <Input aria-label="Rupees per dollar" className="h-7 w-16" inputMode="decimal" defaultValue={rates.inrPerUsd} onBlur={(e) => changeRate("inrPerUsd", e.target.value)} /></span>
          </span>
        </div>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Project</th><th className="pr-3">Deploy runs</th><th className="pr-3">Ended live</th><th className="pr-3">AI calls</th><th className="pr-3">Tokens in / out</th><th className="pr-3">Cost (about)</th><th>Last run</th></tr></thead>
            <tbody>
              {(projects.data?.projects ?? []).map((project) => (
                <tr key={project.repo} className="cursor-pointer border-t border-border/60 hover:bg-muted/40" onClick={() => { setPage(1); setSearch(project.repo); }}>
                  <td className="py-1.5 pr-3 font-medium">{project.repo}{project.appDeleted ? <span className="ml-2 text-xs text-amber-700">(app deleted, record kept)</span> : null}</td>
                  <td className="pr-3">{project.runs}</td><td className="pr-3">{project.liveRuns}</td><td className="pr-3">{project.aiCalls}</td>
                  <td className="pr-3">{tokens(project.inputTokens)} / {tokens(project.outputTokens)}</td>
                  <td className="pr-3">{inr(estimateUsd(project, rates), rates)}</td><td>{formatRelativeTime(project.lastAt)}</td>
                </tr>
              ))}
              {projects.data && projects.data.projects.length === 0 ? <tr><td colSpan={7} className="py-3 text-muted-foreground">No project yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Click a project to see its runs below.</p>
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
            <RunDrawer runKey={selected.runKey} run={selected} rates={rates} />
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
