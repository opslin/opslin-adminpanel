"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bug, Clock3, Users, Wrench } from "lucide-react";

import { DateRangePicker, type AdminDateRange } from "@/components/admin/date-range-picker";
import { DetailDrawer } from "@/components/admin/detail-drawer";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate, formatRelativeTime } from "@/lib/utils";

type ErrorClassRecord = {
  class: string;
  count24h: number;
  count7d: number;
  affectedUsers: number;
  latestExample: {
    deploymentId: string;
    appName: string;
    errorSnippet: string | null;
    createdAt: string;
  } | null;
  suggestedFix: string;
};

type AdminErrorsResponse = {
  errors: ErrorClassRecord[];
};

function defaultRange(): AdminDateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 7);
  return { preset: "7d", from, to };
}

function buildQuery(path: string, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function statusFor(error: ErrorClassRecord) {
  if (error.count24h >= 5 || error.affectedUsers >= 5) {
    return "error" as const;
  }
  if (error.count24h > 0 || error.count7d >= 5) {
    return "warning" as const;
  }
  return "info" as const;
}

function ErrorCard({ error, onView }: { error: ErrorClassRecord; onView: () => void }) {
  const status = statusFor(error);

  return (
    <Card className="rounded-lg border-border/80 transition-shadow hover:shadow-lg hover:shadow-black/20">
      <CardHeader className="space-y-0 border-b border-border/80 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-md border border-danger/20 bg-danger-muted text-danger-text">
              <AlertTriangle className="size-4" />
            </div>
            <CardTitle className="font-mono text-sm">{error.class}</CardTitle>
          </div>
          <StatusBadge status={status} label={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border/80 p-3">
            <p className="dashboard-section-label">24h</p>
            <p className="mt-1 text-2xl font-semibold">{error.count24h}</p>
          </div>
          <div className="rounded-md border border-border/80 p-3">
            <p className="dashboard-section-label">7d</p>
            <p className="mt-1 text-2xl font-semibold">{error.count7d}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          {error.affectedUsers} affected users
        </div>
        <div className="flex items-start gap-2 text-sm">
          <Wrench className="mt-0.5 size-4 text-muted-foreground" />
          <p className="line-clamp-2 text-muted-foreground">{error.suggestedFix}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onView} disabled={!error.latestExample}>
          View example
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminErrorsPage() {
  const [range, setRange] = useState<AdminDateRange>(() => defaultRange());
  const [selectedError, setSelectedError] = useState<ErrorClassRecord | null>(null);

  const errors = useQuery({
    queryKey: ["admin", "errors", { from: range.from.toISOString(), to: range.to.toISOString() }],
    queryFn: () => api.get<AdminErrorsResponse>(buildQuery("/admin/errors", {
      dateFrom: range.from.toISOString(),
      dateTo: range.to.toISOString(),
    })),
  });

  const errorRecords = useMemo(() => errors.data?.errors ?? [], [errors.data?.errors]);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="dashboard-section-label">P1 Intelligence</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Error intelligence</h1>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {errors.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-lg border border-border/80 bg-card" />
          ))}
        </div>
      ) : errorRecords.length === 0 ? (
        <EmptyState icon={Bug} title="No failed deployment classes" description="No failed deployments were found for this date range." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {errorRecords.map((error) => (
            <ErrorCard key={error.class} error={error} onView={() => setSelectedError(error)} />
          ))}
        </div>
      )}

      <DetailDrawer
        open={Boolean(selectedError)}
        onClose={() => setSelectedError(null)}
        title={selectedError?.class ?? "Error example"}
        subtitle={selectedError?.latestExample?.appName}
        width="md"
      >
        {selectedError?.latestExample ? (
          <div className="space-y-5">
            <Card className="rounded-lg">
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                <div>
                  <p className="dashboard-section-label">Deployment</p>
                  <p className="mt-2 font-mono text-sm">{selectedError.latestExample.deploymentId}</p>
                </div>
                <div>
                  <p className="dashboard-section-label">Created</p>
                  <p className="mt-2 text-sm">{formatDate(selectedError.latestExample.createdAt)}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(selectedError.latestExample.createdAt)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock3 className="size-4 text-muted-foreground" />
                  Suggested fix
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{selectedError.suggestedFix}</CardContent>
            </Card>

            <pre className="max-h-80 overflow-auto rounded-lg border border-border/80 bg-secondary/30 p-4 font-mono text-xs leading-5 text-muted-foreground">
              {selectedError.latestExample.errorSnippet ?? "No sanitized error snippet available."}
            </pre>
          </div>
        ) : (
          <EmptyState icon={Bug} title="No example available" description="This error class has no recent deployment example." />
        )}
      </DetailDrawer>
    </div>
  );
}
