"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type AiDeployCosts } from "@/lib/api";

// What each deploy cost in AI tokens and dollars. Every call is priced by the model that made it (published Anthropic prices,
// or the admin's own price for the active model), so switching models never re-prices older deploys. A model with no known
// price shows its tokens and "price unknown", never a made-up dollar figure.

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export function formatUsd(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
}

export function formatInr(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: value < 10 ? 2 : 0 }).format(value);
}

export function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

const shortModel = (model: string) => (model.startsWith("claude-") ? model.replace(/^claude-/, "").replace(/-(\d)-(\d)$/, " $1.$2").replace(/-(\d)$/, " $1").replace(/^./, (c) => c.toUpperCase()) : model);
const perMillion = (value: number | null) => (value === null ? "price unknown" : `$${value % 1 === 0 ? value.toFixed(0) : value}`);

function Kpi({ label, value, hint, focal = false }: { label: string; value: string; hint?: string; focal?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${focal ? "border-primary/40 bg-primary/5" : "border-border/70 bg-secondary/30"}`}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums text-foreground ${focal ? "text-2xl" : "text-xl"}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AiDeployCostView({ data, isLoading }: { data: AiDeployCosts | undefined; isLoading: boolean }) {
  const summary = data?.summary;
  const inr = data?.usdToInrRate ?? null;
  const average = summary?.averageCostUsdPerDeploy ?? null;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi focal label="Average per deploy" value={isLoading ? "…" : formatUsd(average)} hint={inr !== null && average !== null ? `${formatInr(average * inr)} at ₹${inr} per $` : undefined} />
        <Kpi label="Total spent" value={isLoading ? "…" : formatUsd(summary?.totalCostUsd ?? null)} hint={summary && summary.totalCostUsd !== null && inr !== null ? formatInr(summary.totalCostUsd * inr) : undefined} />
        <Kpi label="Deploys with AI calls" value={isLoading ? "…" : String(summary?.deploys ?? 0)} hint={summary && summary.unpricedDeploys > 0 ? `${summary.unpricedDeploys} with an unknown price` : undefined} />
        <Kpi label="Tokens (in / out)" value={isLoading ? "…" : `${formatTokens(summary?.totalInputTokens ?? 0)} / ${formatTokens(summary?.totalOutputTokens ?? 0)}`} />
      </div>

      <div className="rounded-xl border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">AI calls</TableHead>
              <TableHead className="text-right">Tokens in / out</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && (data?.deploys.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground">No deploy used the AI in this range</TableCell></TableRow>
            ) : (
              data?.deploys.map((row) => (
                <TableRow key={row.jobId}>
                  <TableCell>
                    <span className="font-medium">{row.repo ?? "—"}</span>
                    <span className="ml-1 text-xs text-muted-foreground">{row.models.map(shortModel).join(", ")}</span>
                  </TableCell>
                  <TableCell className="text-xs">{row.status === "COMPLETED" ? "Passed" : row.status === "FAILED" ? "Failed" : row.status ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.calls}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatTokens(row.inputTokens)} / {formatTokens(row.outputTokens)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.costUsd === null ? <span className="text-xs text-muted-foreground">price unknown</span> : (
                      <>
                        <span className="font-medium">{formatUsd(row.costUsd)}</span>
                        {row.costInr !== null ? <span className="ml-1 text-xs text-muted-foreground">{formatInr(row.costInr)}</span> : null}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{ago(row.at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {(data?.prices.length ?? 0) > 0 ? (
        <p className="text-xs text-muted-foreground">
          Prices per million tokens (input / output):{" "}
          {data!.prices.map((p, i) => (
            <span key={p.model}>
              {i > 0 ? " · " : ""}
              {shortModel(p.model)} {p.inputPerMillionUsd === null ? "price unknown" : `${perMillion(p.inputPerMillionUsd)} / ${perMillion(p.outputPerMillionUsd)}`}
              {p.source === "admin" ? " (set by you)" : ""}
            </span>
          ))}
          {summary && summary.callsWithoutDeploy > 0 ? ` · ${summary.callsWithoutDeploy} small calls were not part of a deploy and are not listed.` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function AiDeployCostCard() {
  const [rangeDays, setRangeDays] = useState("30");
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin", "aiDeployCosts", rangeDays], queryFn: () => api.getAiDeployCosts(Number(rangeDays)) });
  return (
    <Card className="rounded-lg py-0">
      <CardHeader className="border-b border-border/80 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Coins className="size-4 text-muted-foreground" />
            Cost per deploy
          </CardTitle>
          <Select value={rangeDays} onValueChange={setRangeDays}>
            <SelectTrigger className="h-8 w-40 border-border/60 bg-background text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {isError ? <EmptyState icon={Coins} title="Cost data unavailable" description="The cost-per-deploy endpoint failed to respond." /> : <AiDeployCostView data={data} isLoading={isLoading} />}
      </CardContent>
    </Card>
  );
}
