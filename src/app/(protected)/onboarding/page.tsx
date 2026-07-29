"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Route, Timer, Users } from "lucide-react";

import { DateRangePicker, type AdminDateRange } from "@/components/admin/date-range-picker";
import { EmptyState } from "@/components/admin/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type FunnelStep = {
  step: number;
  name: string;
  count: number;
  conversionPercent: number;
  medianTimeToNext: number;
  dropOffReason: string | null;
};

type FunnelResponse = {
  steps: FunnelStep[];
  coreMetric: {
    medianTimeToFirstDeploy: number;
    formatted: string;
    medianTimeFormatted?: string;
  };
  cohortSize: number;
  dateRange: {
    from: string | null;
    to: string | null;
  };
};

function defaultRange(): AdminDateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 30);
  return { preset: "30d", from, to };
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

function formatMs(ms: number) {
  if (!ms || ms <= 0) {
    return "0s";
  }

  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

function barTone(conversion: number) {
  if (conversion >= 80) {
    return "bg-success";
  }
  if (conversion >= 60) {
    return "bg-warning";
  }
  return "bg-danger";
}

function FunnelBar({ step, baseline }: { step: FunnelStep; baseline: number }) {
  const width = baseline > 0 ? Math.max(4, Math.round((step.count / baseline) * 100)) : 0;

  return (
    <div className="grid gap-3 rounded-lg border border-border/80 bg-secondary/20 p-3 lg:grid-cols-[260px_minmax(0,1fr)_220px] lg:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{step.step}. {step.name}</p>
        <p className="text-xs text-muted-foreground">{step.count.toLocaleString()} users</p>
      </div>
      <div className="h-8 rounded-md border border-border/60 bg-background/60 p-1">
        <div
          className={cn("h-full rounded-sm transition-[width]", barTone(step.conversionPercent))}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm lg:text-right">
        <div>
          <p className="text-muted-foreground">Conversion</p>
          <p className="font-medium">{step.conversionPercent}%</p>
        </div>
        <div>
          <p className="text-muted-foreground">Median next</p>
          <p className="font-medium">{formatMs(step.medianTimeToNext)}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminOnboardingPage() {
  const [range, setRange] = useState<AdminDateRange>(() => defaultRange());

  const funnel = useQuery({
    queryKey: ["admin", "onboarding", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => api.get<FunnelResponse>(buildQuery("/admin/onboarding/funnel", {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    })),
  });

  const baseline = funnel.data?.steps[0]?.count ?? 0;
  const medianLabel = funnel.data?.coreMetric.formatted ?? funnel.data?.coreMetric.medianTimeFormatted ?? "0s";

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="dashboard-section-label">Activation</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Onboarding funnel</h1>
        </div>
        <DateRangePicker
          idPrefix="admin-onboarding-range"
          value={range}
          onChange={(nextRange) => setRange(nextRange)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Median time to first deploy"
          value={medianLabel}
          icon={Timer}
          status={(funnel.data?.coreMetric.medianTimeToFirstDeploy ?? 0) > 60 * 60 * 1000 ? "warning" : "ok"}
          description="Signup to first successful deployment"
        />
        <StatCard
          label="Cohort size"
          value={funnel.data?.cohortSize ?? 0}
          icon={Users}
          status="info"
          description="Users created in the selected range"
        />
      </div>

      <Card className="rounded-lg py-0">
        <CardHeader className="border-b border-border/80 px-4 py-3">
          <CardTitle className="text-sm">
            {funnel.data?.steps.length ? `${funnel.data.steps.length}-step conversion` : "Conversion funnel"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {funnel.isError ? (
            <EmptyState icon={Route} title="Funnel unavailable" description="The onboarding funnel endpoint did not return data." />
          ) : funnel.isLoading ? (
            Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg border border-border/80 bg-secondary/30" />
            ))
          ) : funnel.data?.steps.length ? (
            funnel.data.steps.map((step) => (
              <FunnelBar key={step.step} step={step} baseline={baseline} />
            ))
          ) : (
            <EmptyState icon={Route} title="No funnel events" description="No users reached onboarding steps in this cohort." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
