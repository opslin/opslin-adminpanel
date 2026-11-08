"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type AiCostBasis, type AiDeployCostFilters, type AiDeployCosts } from "@/lib/api";

// What each deploy cost in AI tokens, dollars and rupees, and how each model compares. Every call is priced on its own, so
// switching models never re-prices older deploys. A cost is "exact" when the provider reported it for the call or when it is
// exact tokens times a published or set price (Anthropic); "estimate" when it is tokens times the lowest price OpenRouter lists
// (calls from before the provider's own cost was recorded). A model nobody has a price for shows its tokens and no money.

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const ALL = "all";

export function formatUsd(value: number | null) {
  if (value === null) return "—";
  const decimals = value >= 1 ? 2 : value >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: decimals }).format(value);
}

export function formatInr(value: number | null) {
  if (value === null) return "—";
  const decimals = value >= 1 ? 2 : value >= 0.01 ? 3 : 5;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: decimals }).format(value);
}

export function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function formatSeconds(value: number | null) {
  if (value === null) return "—";
  if (value < 90) return `${Math.round(value * 10) / 10} s`;
  return `${Math.floor(value / 60)} min ${Math.round(value % 60)} s`;
}

function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

const EFFORT_NAME: Record<string, string> = { low: "Low", medium: "Medium", high: "High", xhigh: "Extra high", max: "Max" };
// Calls from before the effort was recorded, and calls where none was sent, have no effort to show.
const effortText = (efforts: string[]) => (efforts.length > 0 ? ` · effort ${efforts.map((e) => EFFORT_NAME[e] ?? e).join(", ")}` : "");

const shortModel = (model: string) =>
  model.startsWith("claude-")
    ? model.replace(/^claude-/, "").replace(/-(\d)-(\d)$/, " $1.$2").replace(/-(\d)$/, " $1").replace(/^./, (c) => c.toUpperCase())
    : model.replace(/^z-ai\//, "");

function Basis({ basis }: { basis: AiCostBasis | null }) {
  if (basis === null) return null;
  const exact = basis === "provider" || basis === "tokens";
  const text = basis === "provider" ? "Exact: the provider's own figure" : basis === "tokens" ? "Exact: tokens times the model's price" : basis === "estimated" ? "Estimate: tokens times the price OpenRouter lists" : "Mixed: some calls exact, some estimated";
  return (
    <span title={text} className={`ml-1.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase ${exact ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
      <span className={`size-1.5 rounded-full ${exact ? "bg-emerald-500" : "bg-amber-500"}`} />
      {exact ? "Exact" : basis === "mixed" ? "Mixed" : "Estimate"}
    </span>
  );
}

function Money({ usd, inr, basis }: { usd: number | null; inr: number | null; basis: AiCostBasis | null }) {
  if (usd === null) return <span className="text-xs text-muted-foreground">price unknown</span>;
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="font-medium">{inr !== null ? formatInr(inr) : formatUsd(usd)}<Basis basis={basis} /></span>
      {inr !== null ? <span className="text-xs text-muted-foreground">{formatUsd(usd)}</span> : null}
    </span>
  );
}

function Kpi({ label, value, hint, focal = false }: { label: string; value: string; hint?: string; focal?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${focal ? "border-primary/40 bg-primary/5" : "border-border/70 bg-secondary/30"}`}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums text-foreground ${focal ? "text-2xl" : "text-xl"}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// The conversion rate is the one number only the founder knows (what the card is really charged). Today's market rate is
// offered as a suggestion; nothing is converted at it until it is saved here.
function RateBar({ rate }: { rate: number | null }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(rate !== null ? String(rate) : "");
  const { data: fx } = useQuery({ queryKey: ["admin", "aiFx"], queryFn: () => api.getAiFxRate(), staleTime: 60 * 60 * 1000 });
  const save = useMutation({
    mutationFn: (next: number) => api.saveAiPricing({ usdToInrRate: next }),
    onSuccess: () => {
      toast.success("Rupee rate saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "aiDeployCosts"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "aiConfig"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save the rate"),
  });
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed > 0;
  const today = fx?.available && typeof fx.rate === "number" ? { rate: fx.rate, asOf: fx.asOf ?? null, source: fx.source ?? "market" } : null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-secondary/20 p-3 sm:flex-row sm:items-center">
      <div className="text-sm">
        <p className="font-medium">{rate === null ? "Set the rupee rate to see costs in rupees" : `Converted at ₹${rate} per $1`}</p>
        <p className="text-xs text-muted-foreground">
          {today ? `Today's market rate is ₹${today.rate} (${today.source}${today.asOf ? `, ${new Date(today.asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}). Use what your card is really charged.` : "Enter what your card is really charged per $1."}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:ml-auto">
        <Input
          aria-label="Rupees per dollar"
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="₹ per $1"
          className="h-8 w-28"
        />
        {today ? (
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setValue(String(today.rate))}>Use today&apos;s</Button>
        ) : null}
        <Button type="button" size="sm" className="h-8" disabled={!valid || save.isPending || parsed === rate} onClick={() => save.mutate(parsed)}>
          {save.isPending ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

export function AiDeployCostView({ data, isLoading }: { data: AiDeployCosts | undefined; isLoading: boolean }) {
  const summary = data?.summary;
  const rate = data?.usdToInrRate ?? null;
  const average = summary?.averageCostUsdPerDeploy ?? null;
  const total = summary?.totalCostUsd ?? null;
  const rupees = (usd: number | null) => (usd !== null && rate !== null ? usd * rate : null);
  const dash = (value: string) => (isLoading ? "…" : value);
  const money = (usd: number | null) => (rate !== null ? formatInr(rupees(usd)) : formatUsd(usd));
  const secondMoney = (usd: number | null) => (rate !== null && usd !== null ? formatUsd(usd) : undefined);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi focal label="Average per deploy" value={dash(money(average))} hint={secondMoney(average)} />
        <Kpi label="Total spent" value={dash(money(total))} hint={secondMoney(total)} />
        <Kpi
          label="Deploys"
          value={dash(String(summary?.deploys ?? 0))}
          hint={summary && summary.successRate !== null ? `${summary.passed} passed, ${summary.failed} failed (${Math.round(summary.successRate * 100)}% passed)` : undefined}
        />
        <Kpi
          label="Tokens per deploy (in / out)"
          value={dash(`${formatTokens(summary?.averageInputTokensPerDeploy ?? 0)} / ${formatTokens(summary?.averageOutputTokensPerDeploy ?? 0)}`)}
          hint={summary ? `${(summary.averageCallsPerDeploy ?? 0).toFixed(1)} AI calls${summary.averageCallSeconds !== null ? `, ${formatSeconds(summary.averageCallSeconds)} per call` : ""}` : undefined}
        />
      </div>

      {summary && summary.deploys > 0 ? (
        <p className="text-xs text-muted-foreground">
          {summary.exactCostDeploys} of {summary.deploys} deploys have an exact cost
          {summary.estimatedCostDeploys > 0 ? `; ${summary.estimatedCostDeploys} are estimates (older GLM calls priced from OpenRouter's listed price)` : ""}
          {summary.unpricedDeploys > 0 ? `; ${summary.unpricedDeploys} have no known price and are left out of the averages` : ""}.
        </p>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">Compare models</p>
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Deploys</TableHead>
                <TableHead className="text-right">Passed</TableHead>
                <TableHead className="text-right">Cost per deploy</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Tokens per deploy (in / out)</TableHead>
                <TableHead className="hidden text-right sm:table-cell">AI calls</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Time per call</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && (data?.byModel.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground">No deploy matches these filters</TableCell></TableRow>
              ) : (
                data?.byModel.map((row) => {
                  const settled = row.passed + row.failed;
                  return (
                    <TableRow key={row.model}>
                      <TableCell className="max-w-[7rem] whitespace-normal sm:max-w-none">
                        <span className="font-medium">{shortModel(row.model)}</span>
                        <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">{effortText(row.efforts).replace(/^ · /, "")}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.deploys}</TableCell>
                      <TableCell className="text-right tabular-nums">{settled > 0 ? `${Math.round((row.passed / settled) * 100)}%` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums"><Money usd={row.averageCostUsdPerDeploy} inr={row.averageCostInrPerDeploy} basis={row.costBasis} /></TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatTokens(row.averageInputTokensPerDeploy)} / {formatTokens(row.averageOutputTokensPerDeploy)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{row.averageCallsPerDeploy.toFixed(1)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatSeconds(row.averageCallSeconds)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{row.totalCostUsd === null ? "—" : money(row.totalCostUsd)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Each deploy</p>
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Tokens in / out</TableHead>
                <TableHead className="hidden text-right sm:table-cell">AI calls</TableHead>
                <TableHead className="hidden text-right sm:table-cell">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && (data?.deploys.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground">No deploy used the AI in this range</TableCell></TableRow>
              ) : (
                data?.deploys.map((row) => (
                  <TableRow key={row.jobId}>
                    <TableCell className="max-w-[9rem] whitespace-normal break-words sm:max-w-none">
                      <span className="font-medium">{row.repo ?? "—"}</span>
                      <span className="ml-1 block text-xs text-muted-foreground sm:inline">
                        {row.models.map(shortModel).join(", ")}{effortText(row.efforts)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{row.status === "COMPLETED" ? "Passed" : row.status === "FAILED" ? "Failed" : row.status ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums"><Money usd={row.costUsd} inr={row.costInr} basis={row.costBasis} /></TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatTokens(row.inputTokens)} / {formatTokens(row.outputTokens)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{row.calls}</TableCell>
                    <TableCell className="hidden text-right text-xs text-muted-foreground sm:table-cell">{ago(row.at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {(data?.prices.length ?? 0) > 0 ? (
        <p className="text-xs text-muted-foreground">
          Price per million tokens (input / output):{" "}
          {data!.prices.map((p, i) => (
            <span key={p.model}>
              {i > 0 ? " · " : ""}
              {shortModel(p.model)} {p.inputPerMillionUsd === null ? "price unknown" : `$${p.inputPerMillionUsd} / $${p.outputPerMillionUsd}`}
              {p.source === "admin" ? " (set by you)" : p.source === "openrouter" ? " (OpenRouter list)" : ""}
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
  const [model, setModel] = useState(ALL);
  const [effort, setEffort] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const filters: AiDeployCostFilters = {
    rangeDays: Number(rangeDays),
    ...(model !== ALL ? { model } : {}),
    ...(effort !== ALL ? { effort } : {}),
    ...(status !== ALL ? { status: status as "COMPLETED" | "FAILED" } : {}),
  };
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "aiDeployCosts", rangeDays, model, effort, status],
    queryFn: () => api.getAiDeployCosts(filters),
    placeholderData: (previous) => previous,
  });
  const models = data?.filters.models ?? [];
  const efforts = data?.filters.efforts ?? [];

  return (
    <Card className="rounded-lg py-0">
      <CardHeader className="border-b border-border/80 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Coins className="size-4 text-muted-foreground" />
            Cost per deploy
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={rangeDays} onValueChange={setRangeDays}>
              <SelectTrigger aria-label="Time range" className="h-8 w-36 border-border/60 bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger aria-label="Model" className="h-8 w-44 border-border/60 bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All models</SelectItem>
                {models.map((m) => <SelectItem key={m.model} value={m.model}>{shortModel(m.model)} ({m.deploys})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={effort} onValueChange={setEffort}>
              <SelectTrigger aria-label="Effort" className="h-8 w-36 border-border/60 bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any effort</SelectItem>
                {efforts.map((e) => <SelectItem key={e} value={e}>{EFFORT_NAME[e] ?? e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Result" className="h-8 w-32 border-border/60 bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any result</SelectItem>
                <SelectItem value="COMPLETED">Passed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {isError ? (
          <EmptyState icon={Coins} title="Cost data unavailable" description="The cost-per-deploy endpoint failed to respond." />
        ) : (
          <>
            {data ? <RateBar key={data.usdToInrRate ?? "none"} rate={data.usdToInrRate} /> : null}
            <AiDeployCostView data={data} isLoading={isLoading} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
