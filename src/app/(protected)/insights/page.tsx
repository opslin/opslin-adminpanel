"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Coins, Gauge, RefreshCw, Rocket } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type Group = { key: string; total: number; succeeded: number; failed: number; successRate: number | null; avgDurationMs: number | null };
type Insights = {
  rangeDays: number; total: number; succeeded: number; failed: number; aborted: number; successRate: number | null; retried: number;
  withDatabase: number; aiCalls: number; aiInputTokens: number; aiOutputTokens: number;
  byStack: Group[]; byPath: Group[]; byRam: Group[]; failureClasses: Array<{ key: string; count: number }>; daily: Array<{ day: string; total: number; failed: number }>;
};
type FleetPattern = { class: string; contextSlice: Record<string, unknown>; orgCount: number; signatureCount: number; shareRate: number; attemptCount: number | null; classFailureRate: number | null; sliceFailureRate: number | null };
type Fleet = { patterns: FleetPattern[]; slices: Array<{ contextSliceHash: string; orgCount: number; attemptCount: number; succeededCount: number; failedCount: number; failureRate: number }> };

const RANGES = [7, 30, 90] as const;
const PATH_LABEL: Record<string, string> = { simple: "Single app", compose: "Compose project", dil: "AI-assisted (DIL)" };

const pct = (n: number | null, digits = 0) => (n === null ? "no data" : `${(n * 100).toFixed(digits)}%`);
function duration(ms: number | null) {
  if (ms === null) return null;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

function GroupList({ title, rows, label }: { title: string; rows: Group[]; label?: (k: string) => string }) {
  return (
    <Card className="rounded-lg border-border/80">
      <CardHeader className="border-b border-border/80 pb-3"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No data in this range.</p> : (
          <ul className="divide-y divide-border/80">
            {rows.map((g) => (
              <li key={g.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{label ? label(g.key) : g.key}</span>
                <span className="text-muted-foreground tabular-nums">
                  {g.total} deploys · {pct(g.successRate)} worked{duration(g.avgDurationMs) ? ` · ${duration(g.avgDurationMs)} avg` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function sliceText(slice: Record<string, unknown>) {
  const parts = ["buildpack", "buildpackMajor", "appType", "ramBucket", "diskFreeBucket", "osFamily"].map((k) => slice[k]).filter((v) => v !== null && v !== undefined && v !== "unknown");
  if (slice.dbPresent === true) parts.push("with database");
  if (slice.composeStack === true) parts.push("compose");
  return parts.join(" · ") || "any project";
}

export default function DeployInsightsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const insights = useQuery({ queryKey: ["admin", "insights", "deploys", range], queryFn: () => api.get<Insights>(`/admin/insights/deploys?rangeDays=${range}`) });
  const fleet = useQuery({ queryKey: ["admin", "insights", "fleet"], queryFn: () => api.get<Fleet>("/admin/insights/fleet") });
  const d = insights.data;

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="dashboard-section-label">Deploy data</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Deploy insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every organization with the insights flag on, bucketed. No logs, URLs or names are stored.</p>
        </div>
        <div className="inline-flex rounded-md border border-border/80 p-0.5" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={`rounded px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring ${range === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>{r} days</button>
          ))}
        </div>
      </div>

      {insights.isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-lg border border-border/80 bg-card" />)}</div>
      ) : insights.isError ? (
        <EmptyState icon={BarChart3} title="Couldn't load deploy insights" description="Check that the API is running and you are signed in as a platform admin." />
      ) : !d || d.total === 0 ? (
        <EmptyState icon={BarChart3} title="No deploys recorded yet" description="Rows appear after a deploy finishes in an organization that has the insights.deployProfile flag on." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Deploys" value={d.total} icon={Rocket} description={`${d.succeeded} worked, ${d.failed} failed, ${d.aborted} stopped`} />
            <StatCard label="Success rate" value={pct(d.successRate, 1)} icon={Gauge} status={d.successRate !== null && d.successRate < 0.9 ? "warning" : "ok"} description="worked / (worked + failed)" />
            <StatCard label="Needed a retry" value={d.retried} icon={RefreshCw} status={d.retried > 0 ? "warning" : "ok"} />
            <StatCard label="AI tokens" value={(d.aiInputTokens + d.aiOutputTokens).toLocaleString()} icon={Coins} accent="violet" description={`${d.aiCalls} AI-assisted deploys`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <GroupList title="By language" rows={d.byStack} label={(k) => (k === "unknown" ? "Not detected" : k)} />
            <GroupList title="By how it ran" rows={d.byPath} label={(k) => PATH_LABEL[k] ?? k} />
            <GroupList title="By server memory" rows={d.byRam} label={(k) => (k === "unknown" ? "Not reported" : k)} />
            <Card className="rounded-lg border-border/80">
              <CardHeader className="border-b border-border/80 pb-3"><CardTitle className="text-sm">What went wrong</CardTitle></CardHeader>
              <CardContent className="p-0">
                {d.failureClasses.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No failures in this range.</p> : (
                  <ul className="divide-y divide-border/80">
                    {d.failureClasses.map((f) => <li key={f.key} className="flex justify-between gap-4 px-4 py-2.5 text-sm"><span className="font-mono">{f.key}</span><span className="tabular-nums text-muted-foreground">{f.count}</span></li>)}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card className="rounded-lg border-border/80">
        <CardHeader className="border-b border-border/80 pb-3">
          <CardTitle className="text-sm">Fleet failure rates (FIS)</CardTitle>
          <p className="text-xs text-muted-foreground">Only organizations that opted in, and only groups with at least 5 organizations. The real rate is failures of that kind divided by all deploys of that kind of project.</p>
        </CardHeader>
        <CardContent className="p-0">
          {fleet.isLoading ? <div className="h-24 animate-pulse" /> : !fleet.data || fleet.data.patterns.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No fleet patterns yet. They need failures from 5 or more opted-in organizations.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-border/80 text-left text-xs text-muted-foreground"><th className="px-4 py-2 font-medium">Failure</th><th className="px-4 py-2 font-medium">Project kind</th><th className="px-4 py-2 text-right font-medium">Orgs</th><th className="px-4 py-2 text-right font-medium">Deploys</th><th className="px-4 py-2 text-right font-medium">Real rate</th><th className="px-4 py-2 text-right font-medium">Old share</th></tr></thead>
                <tbody>
                  {fleet.data.patterns.map((p, i) => (
                    <tr key={i} className="border-b border-border/80 last:border-0">
                      <td className="px-4 py-2.5 font-mono">{p.class}</td>
                      <td className="px-4 py-2.5 [overflow-wrap:anywhere]">{sliceText(p.contextSlice)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.orgCount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.attemptCount ?? "n/a"}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">{pct(p.classFailureRate, 1)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{pct(p.shareRate, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
