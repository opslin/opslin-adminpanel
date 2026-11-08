"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, CheckCircle2, KeyRound, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type AiConfigProvider, type AiProviderCheck, type AiSavedProvider } from "@/lib/api";
import { MODEL_ID_PATTERN, MODEL_QUICK_PICKS, modelLabel } from "@/lib/ai-models";

const PROVIDER_LABEL: Record<AiConfigProvider, string> = {
  anthropic: "Anthropic",
  openai_compatible: "OpenRouter / OpenAI-compatible",
};

const EFFORT_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};

const DEFAULT_EFFORT = "default";

// What the effort really is: the one the admin chose, else what runs when none is chosen. "Default" alone sounds like the
// model's highest level, so the automatic case says who decides and which level it is.
function effortText(entry: Pick<AiSavedProvider, "reasoningEffort" | "automaticSource" | "automaticEffort">): string {
  if (entry.reasoningEffort) return EFFORT_LABEL[entry.reasoningEffort] ?? entry.reasoningEffort;
  const level = entry.automaticEffort ? ` (${EFFORT_LABEL[entry.automaticEffort] ?? entry.automaticEffort})` : "";
  return entry.automaticSource === "opslin" ? `Automatic${level}` : `Model default${level}`;
}
const CUSTOM_MODEL = "__custom__";

function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

function refresh(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["admin", "aiConfig"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "aiSaved"] });
}

// Switch the model provider the deploys use between the saved connections without typing a key again, and set how hard
// the active model may think. Both changes are checked live by the API before they are saved.
export function AiProviderSwitch() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "aiSaved"], queryFn: () => api.getSavedAiProviders() });

  const activate = useMutation({
    mutationFn: (provider: AiConfigProvider) => api.activateAiProvider(provider),
    onSuccess: (config) => {
      toast.success(`Deploys now use ${PROVIDER_LABEL[config.provider as AiConfigProvider]}`);
      refresh(queryClient);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not switch the provider"),
  });

  const setEffort = useMutation({
    mutationFn: (value: string) => api.setAiEffort(value === DEFAULT_EFFORT ? null : value),
    onSuccess: () => {
      toast.success("Effort saved");
      refresh(queryClient);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save the effort"),
  });

  const providers = data?.providers ?? [];
  const active = providers.find((entry) => entry.active);

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-secondary/20 p-4">
      <div>
        <p className="text-sm font-medium">Which AI the deploys use</p>
        <p className="text-xs text-muted-foreground">
          Save each provider once below. Then switch between them here; the saved key is checked before the switch.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((entry) => (
          <ProviderOption
            key={entry.provider}
            entry={entry}
            pending={activate.isPending && activate.variables === entry.provider}
            disabled={activate.isPending}
            onSwitch={() => activate.mutate(entry.provider)}
          />
        ))}
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
      </div>

      {active && (
        <div className="space-y-2">
          <Label htmlFor="ai-effort">Thinking effort</Label>
          <Select
            value={active.reasoningEffort ?? DEFAULT_EFFORT}
            onValueChange={(value) => setEffort.mutate(value)}
            disabled={setEffort.isPending}
          >
            <SelectTrigger id="ai-effort" className="h-9 w-full border-border/60 bg-background sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_EFFORT}>{effortText({ reasoningEffort: null, automaticSource: active.automaticSource, automaticEffort: active.automaticEffort })}</SelectItem>
              {active.availableEfforts.map((level) => (
                <SelectItem key={level} value={level}>{EFFORT_LABEL[level] ?? level}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Lower is faster and cheaper; higher thinks longer. These are the levels {active.model} supports. Each
            provider keeps its own level. A level the model refuses is not saved.
            {!active.reasoningEffort && active.automaticSource === "opslin"
              ? " Automatic means Opslin asks for Low when it writes and repairs Dockerfiles, so the model does not spend its budget thinking. Choose High or Max to override that."
              : ""}
            {active.reasoningEffort === "max" || active.reasoningEffort === "xhigh"
              ? " Warning: at this level a small model can think for its whole limit and write no Dockerfile (measured on BookStack: 32,768 tokens thinking, nothing written, 2 minutes). Low or High is safer for deploys."
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function ProviderOption({
  entry,
  pending,
  disabled,
  onSwitch,
}: {
  entry: AiSavedProvider;
  pending: boolean;
  disabled: boolean;
  onSwitch: () => void;
}) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<AiProviderCheck | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customModel, setCustomModel] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const customInput = useRef<HTMLInputElement>(null);

  // The model list gives focus back to itself when it closes, so the field is focused a moment later, once that has happened.
  useEffect(() => {
    if (!customOpen) return;
    const timer = setTimeout(() => customInput.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [customOpen]);

  const test = useMutation({
    mutationFn: () => api.checkAiProvider(entry.provider),
    onSuccess: ({ check }) => {
      setResult(check);
      setChangeError(null);
      if (check.success) toast.success(`${PROVIDER_LABEL[entry.provider]} is working`);
      else toast.error(check.message ?? "The test failed");
      refresh(queryClient);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not run the test";
      setResult({ success: false, message, latencyMs: 0 });
      toast.error(message);
    },
  });

  // Changing the model reuses the saved key, tests the new model, and saves it only if it works. A refused model changes nothing.
  const change = useMutation({
    mutationFn: (model: string) => api.changeAiModel(entry.provider, model),
    onSuccess: ({ check, effortReset, provider }) => {
      setResult(check);
      setChangeError(null);
      setCustomOpen(false);
      setCustomModel("");
      toast.success(`${PROVIDER_LABEL[entry.provider]} now uses ${modelLabel(entry.provider, provider.model ?? "")}${effortReset ? ". Its effort went back to the model default." : ""}`);
      refresh(queryClient);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not change the model";
      setChangeError(message);
      toast.error(message);
    },
  });

  const picks = MODEL_QUICK_PICKS[entry.provider];
  const modelOptions = picks.some((pick) => pick.id === entry.model) || !entry.model ? picks : [{ id: entry.model, label: entry.model }, ...picks];
  const customValid = MODEL_ID_PATTERN.test(customModel.trim()) && customModel.trim() !== entry.model;

  // A fresh result from the button wins; otherwise show the one the server remembers from the last test.
  const shown = result ?? (entry.lastCheck ? { success: entry.lastCheck.ok, message: entry.lastCheck.message, latencyMs: null as number | null } : null);
  const when = result ? "just now" : entry.lastCheck ? ago(entry.lastCheck.at) : null;

  return (
    <div className={`rounded-xl border p-3 ${entry.active ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/70 bg-background"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{PROVIDER_LABEL[entry.provider]}</p>
          {entry.active && (
            <Badge className="mt-1 gap-1">
              <CheckCircle2 className="size-3" /> In use
            </Badge>
          )}
        </div>
        {entry.configured && (
          <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={() => test.mutate()} disabled={test.isPending}>
            {test.isPending ? <Loader2 className="mr-1 size-3 animate-spin" /> : <ShieldAlert className="mr-1 size-3" />}
            Test
          </Button>
        )}
      </div>

      {entry.configured ? (
        <div className="mt-2 space-y-1.5 text-xs">
          <div className="space-y-1.5">
            <Select
              value={entry.model ?? ""}
              onValueChange={(value) => {
                setChangeError(null);
                if (value === CUSTOM_MODEL) setCustomOpen(true);
                else if (value !== entry.model) change.mutate(value);
              }}
              disabled={change.isPending}
            >
              <SelectTrigger aria-label={`${PROVIDER_LABEL[entry.provider]} model`} className="h-8 w-full border-border/60 bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((pick) => (
                  <SelectItem key={pick.id} value={pick.id}>{pick.label}</SelectItem>
                ))}
                <SelectItem value={CUSTOM_MODEL}>Another model…</SelectItem>
              </SelectContent>
            </Select>
            {entry.model ? <p className="truncate font-mono text-[11px] text-muted-foreground">{entry.model}</p> : null}
            {customOpen ? (
              <div className="flex items-center gap-1.5">
                <Input
                  ref={customInput}
                  aria-label="Model id"
                  value={customModel}
                  onChange={(event) => setCustomModel(event.target.value)}
                  placeholder={entry.provider === "anthropic" ? "claude-…" : "vendor/model-name"}
                  className="h-8 text-xs"
                  onKeyDown={(event) => { if (event.key === "Enter" && customValid && !change.isPending) change.mutate(customModel.trim()); }}
                />
                <Button type="button" size="sm" className="h-8 shrink-0 px-2 text-xs" disabled={!customValid || change.isPending} onClick={() => change.mutate(customModel.trim())}>
                  Test &amp; save
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0 px-2 text-xs" onClick={() => { setCustomOpen(false); setCustomModel(""); }}>
                  Cancel
                </Button>
              </div>
            ) : null}
            {change.isPending ? (
              <p className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Testing the new model…</p>
            ) : null}
            {changeError ? (
              <p className="flex items-start gap-1.5 text-destructive"><XCircle className="mt-0.5 size-3 shrink-0" /><span>{changeError}</span></p>
            ) : null}
          </div>
          <p className="flex items-center gap-1.5">
            <Brain className="size-3 text-muted-foreground" />
            <span className="text-muted-foreground">Effort</span>
            <span className="font-medium text-foreground">{effortText(entry)}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <KeyRound className="size-3 text-muted-foreground" />
            {entry.keyHint ? (
              <span className="font-mono text-foreground">{entry.keyHint}</span>
            ) : (
              <span className="text-destructive">Key could not be read. Save it again.</span>
            )}
          </p>
          {!shown ? <p className="text-muted-foreground">Not tested yet. Press Test to check the key now.</p> : null}
          {shown ? (
            <p className={`flex items-start gap-1.5 ${shown.success ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
              {shown.success ? <CheckCircle2 className="mt-0.5 size-3 shrink-0" /> : <XCircle className="mt-0.5 size-3 shrink-0" />}
              <span>
                {shown.success ? "Working" : "Not working"}
                {when ? ` · tested ${when}` : ""}
                {result?.success ? ` · ${(result.latencyMs / 1000).toFixed(1)} s` : ""}
                {result?.success && result.answeredModel ? ` · answered by ${result.answeredModel}` : ""}
                {result?.success && result.reasoningTokens !== undefined ? ` · ${result.reasoningTokens} thinking tokens` : ""}
                {result?.success && result.costUsd !== undefined ? ` · test cost $${result.costUsd.toFixed(6)}` : ""}
                {!shown.success && shown.message ? `: ${shown.message}` : ""}
              </span>
            </p>
          ) : null}
          {result?.success && result.modelMatches === false ? (
            <p className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-3 shrink-0" />
              <span>Asked for {entry.model}, but {result.answeredModel} answered.</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No API key yet. Fill the form below and press Save.</p>
      )}

      {!entry.active && entry.configured && (
        <Button size="sm" variant="outline" className="mt-3" onClick={onSwitch} disabled={disabled}>
          {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Use this one
        </Button>
      )}
    </div>
  );
}
