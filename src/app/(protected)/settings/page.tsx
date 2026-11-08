"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Bot,
  CheckCircle2,
  Coins,
  HardDrive,
  Loader2,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AiDeployCostCard } from "@/components/admin/ai-deploy-cost-card";
import { AiProviderSwitch } from "@/components/admin/ai-provider-switch";
import { MODEL_QUICK_PICKS } from "@/lib/ai-models";
import { DataTable } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { ChartLoading, useRecharts } from "@/components/charts/use-recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  api,
  type AgentReleaseStorageInput,
  type AgentReleaseStorageProvider,
  type AiConfigInput,
  type AiConfigProvider,
  type AiPricingInput,
  type AiUsageSummary,
} from "@/lib/api";

function formatUsd(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
}

function formatInr(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

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

const aiProviderOptions: { value: AiConfigProvider; label: string; needsBaseUrl: boolean }[] = [
  { value: "anthropic", label: "Anthropic", needsBaseUrl: false },
  { value: "openai_compatible", label: "OpenRouter / OpenAI-compatible", needsBaseUrl: true },
];

// Session recommendation, not a mandate — see docs/audit/22 canon doc. The
// founder can change provider/model here at any time; nothing in DIL's code
// requires a redeploy to switch.
const DEFAULT_MODEL_BY_PROVIDER: Record<AiConfigProvider, string> = {
  anthropic: "claude-sonnet-5-5",
  openai_compatible: "z-ai/glm-5.3-flash",
};
const EFFORT_NAME: Record<string, string> = { low: "Low", medium: "Medium", high: "High", xhigh: "Extra high", max: "Max" };

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const DEFAULT_BASE_URL_BY_PROVIDER: Record<AiConfigProvider, string> = {
  anthropic: "",
  openai_compatible: "https://openrouter.ai/api/v1",
};

function AiConfigCard() {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<AiConfigProvider>("anthropic");
  const [model, setModel] = useState(DEFAULT_MODEL_BY_PROVIDER.anthropic);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [formEffort, setFormEffort] = useState("keep");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const providerMeta = aiProviderOptions.find((option) => option.value === provider) || aiProviderOptions[0];

  // The effort levels belong to the typed model, so they are read from the catalog after the typing pauses.
  const modelToLookUp = useDebounced(model.trim(), 400);
  const urlToLookUp = useDebounced(baseUrl.trim(), 400);
  const { data: modelInfo } = useQuery({
    queryKey: ["admin", "aiModelInfo", provider, modelToLookUp, urlToLookUp],
    queryFn: () => api.getAiModelInfo(provider, modelToLookUp, providerMeta.needsBaseUrl ? urlToLookUp || undefined : undefined),
    enabled: modelToLookUp.length > 0,
  });
  const effortLevels = modelInfo?.availableEfforts ?? (provider === "anthropic" ? ["low", "medium", "high", "xhigh", "max"] : ["low", "medium", "high", "xhigh"]);
  // A level chosen for one model may not exist on the next one the admin picks.
  const chosenEffort = formEffort === "keep" || formEffort === "default" || effortLevels.includes(formEffort) ? formEffort : "keep";

  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "aiConfig"],
    queryFn: () => api.getAiConfig(),
  });

  const currentInput = (): AiConfigInput => ({
    provider,
    model: model.trim(),
    apiKey,
    baseUrl: providerMeta.needsBaseUrl ? baseUrl.trim() || undefined : undefined,
    ...(chosenEffort === "keep" ? {} : { reasoningEffort: chosenEffort === "default" ? null : chosenEffort }),
  });

  function invalidatePriorTest() {
    setTestResult(null);
  }

  const testMutation = useMutation({
    mutationFn: () => api.testAiConfig(currentInput()),
    onSuccess: (result) => {
      setTestResult(result);
      if (result.success) {
        toast.success("The model responded successfully");
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
    mutationFn: () => api.saveAiConfig(currentInput()),
    onSuccess: () => {
      toast.success("AI provider configured");
      setApiKey("");
      setTestResult(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "aiConfig"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "aiSaved"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save AI provider config");
    },
  });

  // baseUrl is always optional (even for openai_compatible — omitting it
  // defaults to the real OpenAI API in ai-client.ts), so it never gates
  // submission.
  const canSubmit = model.trim().length > 0 && apiKey.trim().length > 0;

  return (
    <Card className="rounded-lg py-0">
      <CardHeader className="border-b border-border/80 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bot className="size-4 text-muted-foreground" />
            Deploy Intelligence — AI provider
          </CardTitle>
          {!isLoading && (
            <Badge variant={status?.configured ? "default" : "secondary"} className="font-mono">
              {status?.configured ? `Key ${status.keyHint ?? "attached"}` : "No API key"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4">
        <p className="text-xs text-muted-foreground">
          The model behind Deploy Intelligence&apos;s AI-assisted stages (repo analysis, Dockerfile authoring,
          failure diagnosis) — tested live before it&apos;s ever saved, applies platform-wide across every org.
        </p>

        {status?.configured && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Provider</p>
              <p className="mt-1 font-medium text-foreground">
                {aiProviderOptions.find((option) => option.value === status.provider)?.label || status.provider}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Model</p>
              <p className="mt-1 truncate font-medium text-foreground">{status.model}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">API key</p>
              <p className="mt-1 truncate font-mono font-medium text-foreground">{status.keyHint ?? "Not readable"}</p>
            </div>
          </div>
        )}

        <AiProviderSwitch />

        <p className="text-sm font-medium">Save or update a provider</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(value) => {
                const nextProvider = value as AiConfigProvider;
                setProvider(nextProvider);
                setModel(DEFAULT_MODEL_BY_PROVIDER[nextProvider]);
                setBaseUrl(DEFAULT_BASE_URL_BY_PROVIDER[nextProvider]);
                setFormEffort("keep");
                invalidatePriorTest();
              }}
            >
              <SelectTrigger className="h-9 border-border/60 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aiProviderOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-config-model">Model</Label>
            <Input
              id="ai-config-model"
              value={model}
              onChange={(event) => { setModel(event.target.value); invalidatePriorTest(); }}
              placeholder="claude-sonnet-5-5"
            />
            <div className="flex flex-wrap gap-1.5">
              {MODEL_QUICK_PICKS[provider].map((pick) => (
                <Button
                  key={pick.id}
                  type="button"
                  size="sm"
                  variant={model.trim() === pick.id ? "secondary" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => { setModel(pick.id); setFormEffort("keep"); invalidatePriorTest(); }}
                >
                  {pick.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {providerMeta.needsBaseUrl && (
          <div className="space-y-2">
            <Label htmlFor="ai-config-base-url">Base URL (optional)</Label>
            <Input
              id="ai-config-base-url"
              value={baseUrl}
              onChange={(event) => { setBaseUrl(event.target.value); invalidatePriorTest(); }}
              placeholder="https://openrouter.ai/api/v1 — leave blank for the real OpenAI API"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Thinking effort</Label>
          <Select value={chosenEffort} onValueChange={(value) => { setFormEffort(value); invalidatePriorTest(); }}>
            <SelectTrigger className="h-9 w-full border-border/60 bg-background sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">Keep the saved level</SelectItem>
              <SelectItem value="default">
                {provider === "openai_compatible" ? "Automatic (Low for deploys)" : `Model default${modelInfo?.defaultEffort ? ` (${EFFORT_NAME[modelInfo.defaultEffort] ?? modelInfo.defaultEffort})` : ""}`}
              </SelectItem>
              {effortLevels.map((level) => (
                <SelectItem key={level} value={level}>{EFFORT_NAME[level] ?? level}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {modelInfo?.known
              ? `Levels ${model.trim()} supports, from OpenRouter's model list.`
              : "This model is not in OpenRouter's list, so the common levels are shown. The provider refuses a level it does not accept."}
            {modelInfo?.known && modelInfo.inputPerMillionUsd !== null && modelInfo.outputPerMillionUsd !== null
              ? ` Listed price: $${modelInfo.inputPerMillionUsd} in / $${modelInfo.outputPerMillionUsd} out per million tokens (enter it under Pricing after saving).`
              : ""}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-config-api-key">API key</Label>
          <Input
            id="ai-config-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => { setApiKey(event.target.value); invalidatePriorTest(); }}
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
          <p className="text-xs text-muted-foreground">Run a successful test first — a broken key is never saved.</p>
        )}

        {status?.configured && <AiPricingForm status={status} />}
      </CardContent>
    </Card>
  );
}

// DIL Phase 24 — the model's own published per-million-token price, entered
// once so /admin/ai-config/usage can compute real cost instead of just
// reporting raw token counts. Not a credential, so no live re-verification —
// a plain in-place PATCH.
function AiPricingForm({ status }: { status: { inputCostPerMillionUsd?: number | null; outputCostPerMillionUsd?: number | null; usdToInrRate?: number | null } }) {
  const queryClient = useQueryClient();
  const [inputCost, setInputCost] = useState(status.inputCostPerMillionUsd?.toString() ?? "");
  const [outputCost, setOutputCost] = useState(status.outputCostPerMillionUsd?.toString() ?? "");

  const parseOrNull = (value: string): number | null | undefined => {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const input: AiPricingInput = {
        inputCostPerMillionUsd: parseOrNull(inputCost),
        outputCostPerMillionUsd: parseOrNull(outputCost),
      };
      return api.saveAiPricing(input);
    },
    onSuccess: () => {
      toast.success("Pricing saved — usage & cost will reflect it immediately");
      queryClient.invalidateQueries({ queryKey: ["admin", "aiConfig"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "aiUsage"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save pricing");
    },
  });

  const hasInvalidValue = [inputCost, outputCost].some((value) => parseOrNull(value) === undefined);

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/20 p-4">
      <div className="flex items-center gap-2">
        <Coins className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">Pricing (for cost tracking)</p>
      </div>
      <p className="text-xs text-muted-foreground">
        The model&apos;s per-million-token price, for models without a published price. The rupee rate is set in Cost per deploy.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-pricing-input">Input $ / 1M tokens</Label>
          <Input id="ai-pricing-input" type="number" min="0" step="0.01" value={inputCost} onChange={(event) => setInputCost(event.target.value)} placeholder="0.20" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-pricing-output">Output $ / 1M tokens</Label>
          <Input id="ai-pricing-output" type="number" min="0" step="0.01" value={outputCost} onChange={(event) => setOutputCost(event.target.value)} placeholder="0.80" />
        </div>
      </div>
      <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || hasInvalidValue}>
        {saveMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Save pricing
      </Button>
    </div>
  );
}

const USAGE_RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

// DIL Phase 24 — per-user, per-deployment AI token/cost visibility, so the
// founder can see exactly how much every deploy's AI-assisted stages
// (analyze/author/diagnose) actually cost, not just that they ran.
function AiUsageTrendChart({ data, costKnown }: { data: AiUsageSummary["byDay"]; costKnown: boolean }) {
  const recharts = useRecharts();

  if (!recharts) {
    return <ChartLoading className="h-64" />;
  }

  const { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = recharts;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={costKnown} />
        <Tooltip formatter={(value) => (costKnown ? formatUsd(Number(value)) : value)} />
        <Bar dataKey={costKnown ? "costUsd" : "calls"} fill="#2563eb" name={costKnown ? "Cost (USD)" : "Calls"} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AiUsageCard() {
  const [rangeDays, setRangeDays] = useState("30");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "aiUsage", rangeDays],
    queryFn: () => api.getAiUsage(Number(rangeDays)),
  });

  return (
    <Card className="rounded-lg py-0">
      <CardHeader className="border-b border-border/80 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Coins className="size-4 text-muted-foreground" />
            Deploy Intelligence — usage &amp; cost
          </CardTitle>
          <Select value={rangeDays} onValueChange={setRangeDays}>
            <SelectTrigger className="h-8 w-40 border-border/60 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USAGE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4">
        {isError && (
          <EmptyState icon={Coins} title="Usage data unavailable" description="The AI usage endpoint failed to respond." />
        )}

        {!isError && (
          <>
            {!data?.costKnown && !isLoading && (
              <p className="text-xs text-muted-foreground">
                Cost is unknown — set the pricing above to see real USD/INR spend instead of just token counts.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">AI calls</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{isLoading ? "…" : data?.totals.calls ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Tokens (in / out)</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                  {isLoading ? "…" : `${formatTokens(data?.totals.inputTokens ?? 0)} / ${formatTokens(data?.totals.outputTokens ?? 0)}`}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Cost (USD / INR)</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                  {isLoading ? "…" : `${formatUsd(data?.totals.costUsd ?? null)} / ${formatInr(data?.totals.costInr ?? null)}`}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Unattributed calls</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{isLoading ? "…" : data?.totals.unattributedCalls ?? 0}</p>
              </div>
            </div>

            <div className="h-64">
              {isLoading ? <ChartLoading className="h-64" /> : <AiUsageTrendChart data={data?.byDay ?? []} costKnown={data?.costKnown ?? false} />}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">By stage</p>
                <div className="rounded-xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.byStage.length ?? 0) === 0 && !isLoading ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground">No AI calls in this range</TableCell></TableRow>
                      ) : (
                        data?.byStage.map((row) => (
                          <TableRow key={row.stage}>
                            <TableCell className="capitalize">{row.stage}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.calls}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatUsd(row.costUsd)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                  <Users className="size-3" /> By user — top spenders
                </p>
                <div className="rounded-xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.byUser.length ?? 0) === 0 && !isLoading ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground">No AI calls in this range</TableCell></TableRow>
                      ) : (
                        data?.byUser.slice(0, 8).map((row) => (
                          <TableRow key={row.userId ?? "unattributed"}>
                            <TableCell>
                              <span className="font-medium">{row.name}</span>
                              {row.email && <span className="ml-1 text-xs text-muted-foreground">{row.email}</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{row.calls}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatUsd(row.costUsd)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <AiUsageEventsTable />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Raw "show me exactly what happened" drill-down beneath the aggregates
// above — one row per real AI call, cursor-paginated.
function AiUsageEventsTable() {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const page = cursors.length - 1;

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "aiUsageEvents", cursors[page]],
    queryFn: () => api.getAiUsageEvents({ limit: 20, cursor: cursors[page] }),
  });

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase text-muted-foreground">Recent AI calls</p>
      <div className="rounded-xl border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Tokens (in / out)</TableHead>
              <TableHead>Job</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground">Loading…</TableCell></TableRow>
            ) : (data?.events.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground">No AI calls yet</TableCell></TableRow>
            ) : (
              data?.events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="capitalize">{event.stage}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs">{event.model}</TableCell>
                  <TableCell className="text-xs">{event.userName ?? "Unattributed"}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTokens(event.inputTokens)} / {formatTokens(event.outputTokens)}</TableCell>
                  <TableCell className="max-w-24 truncate text-xs text-muted-foreground">{event.jobId ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setCursors((prev) => prev.slice(0, -1))}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.nextCursor}
          onClick={() => setCursors((prev) => [...prev, data?.nextCursor ?? undefined])}
        >
          Next
        </Button>
      </div>
    </div>
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
      <AiConfigCard />
      <AiDeployCostCard />
      <AiUsageCard />

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
