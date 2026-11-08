"use client";

import type { ReactNode } from "react";

import { cx } from "@/utils/cx";

export type OverviewResponse = {
  totals: {
    users: number;
    servers: number;
    apps: number;
    deployments24h: number;
    activeSubscriptions: number;
  };
  performance: { successRate: number; avgDeployTimeMs: number };
  revenue: { mrr: number; currency: string };
  engagement: { dau: number; wau: number };
  deploys30d: Array<{ date: string; total: number; succeeded: number; failed: number }>;
  newUsersToday: number;
  activeUsers7d: number;
  totalOrgs: number;
  connectedAgents: number;
  disconnectedAgents: number;
  deploySuccessRate24h: number;
  deploySuccessRate7d: number;
  queueWaitAvg: number;
  queueWaitP95: number;
  workerCountExpected: number;
  systemHealth: { api: "ok" | "error"; db: "ok" | "error"; redis: "ok" | "error" };
  recentDeployments: Array<{
    id: string;
    appName: string | null;
    status: string;
    startedAt: string;
    finishedAt: string | null;
  }>;
  recentSignups: Array<{ id: string; name: string | null; email: string; createdAt: string }>;
};

export type FunnelResponse = { steps: Array<{ step: number; name: string; count: number }> };

export type SystemHealthResponse = {
  api: { status: "ok" | "error"; uptimeSeconds: number };
  db: { status: "ok" | "error"; latencyMs: number };
  redis: { status: "ok" | "error"; usedPercent?: number | null };
  queue: {
    waiting: number;
    active: number;
    failed: number;
    status: "ok" | "warning" | "error";
    workersObserved: number;
    workersExpected: number;
    stuckCount: number;
    failed24h: number;
  };
  backup: { lastSuccessful: string | null };
  platformBackup: { status: string; ageHours: number | null };
  disk: { status: string; usedPercent: number | null; freeBytes: number | null; totalBytes: number | null };
};

export type ErrorsResponse = {
  errors: Array<{
    class: string;
    count24h: number;
    count7d: number;
    affectedUsers: number;
    suggestedFix: string;
  }>;
};

export type AgentMetricsResponse = {
  total: number;
  connected: number;
  disconnected: number;
  outdated: number;
  secureControl: number;
  helperMissing: number;
  versions: Record<string, number>;
};

export type RunningDeploymentsResponse = {
  deployments: Array<{
    id: string;
    appName: string;
    serverName: string;
    orgName: string | null;
    status: string;
    startedAt: string;
  }>;
  pagination: { total: number };
};

export function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMs(ms: number) {
  if (ms >= 60_000) return `${Math.round(ms / 60_000)}m`;
  if (ms >= 1000) return `${Math.round(ms / 100) / 10}s`;
  return `${Math.round(ms)}ms`;
}

export function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function percentDelta(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Title-case an ERROR_CLASS like MISSING_ENV_VAR → "Missing env var". */
export function humanizeClass(value: string) {
  const text = value.toLowerCase().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One card shell for every overview section: flat opaque container, one title. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cx(
        "flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default shadow-xs",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <h2 className="text-title-3-semibold text-text-primary">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-body-regular text-text-tertiary">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cx("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Label left, state right — the standard dense row. */
export function Row({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-separator-border px-5 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="truncate text-body-medium text-text-primary">{label}</p>
        {hint ? <p className="truncate text-caption-1-regular text-text-tertiary">{hint}</p> : null}
      </div>
      <div className="shrink-0 text-body-medium tabular-nums text-text-primary">{children}</div>
    </div>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="px-5 pb-6 pt-2 text-body-regular text-text-tertiary">{children}</p>;
}
